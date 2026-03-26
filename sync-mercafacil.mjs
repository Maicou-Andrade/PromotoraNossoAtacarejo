/**
 * Script de sincronização da base Mercafacil (cad_fornecedor)
 * - Carga inicial: importa todos os registros
 * - Sincronização incremental: importa apenas novos/atualizados
 * 
 * Usage: node server/sync-mercafacil.mjs [--full]
 */

import pg from 'pg';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const PG_CONFIG = {
  host: '189.126.142.41',
  user: 'dbatacarejo',
  password: 'u98>C{8WO2xF',
  database: 'Atacarejo',
  port: 5432,
};

const BATCH_SIZE = 1000;

async function getMysqlConnection() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  return mysql.createConnection(url);
}

async function getLastSyncDate(mysqlConn) {
  const [rows] = await mysqlConn.execute(
    'SELECT MAX(syncedAt) as lastSync FROM cadastroBaseMercafacil'
  );
  return rows[0]?.lastSync || null;
}

async function getLastExternalDate(mysqlConn) {
  const [rows] = await mysqlConn.execute(
    'SELECT MAX(dataCriacao) as lastDate FROM cadastroBaseMercafacil'
  );
  return rows[0]?.lastDate || null;
}

async function syncFull() {
  console.log('[Mercafacil Sync] Starting FULL sync...');
  
  const pgClient = new pg.Client(PG_CONFIG);
  await pgClient.connect();
  console.log('[Mercafacil Sync] Connected to PostgreSQL');
  
  const mysqlConn = await getMysqlConnection();
  console.log('[Mercafacil Sync] Connected to MySQL');
  
  try {
    // Clear existing data
    await mysqlConn.execute('DELETE FROM cadastroBaseMercafacil');
    console.log('[Mercafacil Sync] Cleared existing data');
    
    // Count total records
    const countResult = await pgClient.query('SELECT count(*) FROM public.cad_fornecedor');
    const total = parseInt(countResult.rows[0].count);
    console.log(`[Mercafacil Sync] Total records to import: ${total}`);
    
    // Fetch in batches using cursor-like approach
    let offset = 0;
    let imported = 0;
    
    while (offset < total) {
      const result = await pgClient.query(
        `SELECT nome, cpf_cnpj, data_aniversario, genero, estado, cidade, bairro, data_criacao, data_atualizacao 
         FROM public.cad_fornecedor 
         ORDER BY data_criacao ASC NULLS FIRST
         LIMIT $1 OFFSET $2`,
        [BATCH_SIZE, offset]
      );
      
      if (result.rows.length === 0) break;
      
      // Build batch insert
      const values = [];
      const placeholders = [];
      let paramIndex = 0;
      
      for (const row of result.rows) {
        const cpf = (row.cpf_cnpj || '').trim();
        if (!cpf) continue; // Skip records without CPF
        
        placeholders.push(`(?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        values.push(
          (row.nome || '').trim() || null,
          cpf,
          row.data_aniversario || null,
          (row.genero || '').trim() || null,
          (row.estado || '').trim() || null,
          (row.cidade || '').trim() || null,
          (row.bairro || '').trim() || null,
          row.data_criacao || null,
          row.data_atualizacao || null,
        );
      }
      
      if (placeholders.length > 0) {
        await mysqlConn.execute(
          `INSERT INTO cadastroBaseMercafacil (nome, cpfCnpj, dataAniversario, genero, estado, cidade, bairro, dataCriacao, dataAtualizacao) 
           VALUES ${placeholders.join(', ')}`,
          values
        );
      }
      
      imported += result.rows.length;
      offset += BATCH_SIZE;
      
      if (imported % 10000 === 0 || imported >= total) {
        console.log(`[Mercafacil Sync] Progress: ${imported}/${total} (${Math.round(imported/total*100)}%)`);
      }
    }
    
    console.log(`[Mercafacil Sync] FULL sync complete. Imported ${imported} records.`);
  } finally {
    await pgClient.end();
    await mysqlConn.end();
  }
}

async function syncIncremental() {
  console.log('[Mercafacil Sync] Starting INCREMENTAL sync...');
  
  const pgClient = new pg.Client(PG_CONFIG);
  await pgClient.connect();
  console.log('[Mercafacil Sync] Connected to PostgreSQL');
  
  const mysqlConn = await getMysqlConnection();
  console.log('[Mercafacil Sync] Connected to MySQL');
  
  try {
    // Get last external date we have
    const lastDate = await getLastExternalDate(mysqlConn);
    
    let query;
    let params;
    
    if (lastDate) {
      console.log(`[Mercafacil Sync] Last record date: ${lastDate}`);
      // Fetch records created or updated after last sync
      query = `SELECT nome, cpf_cnpj, data_aniversario, genero, estado, cidade, bairro, data_criacao, data_atualizacao 
               FROM public.cad_fornecedor 
               WHERE data_criacao > $1 OR data_atualizacao > $1
               ORDER BY data_criacao ASC NULLS FIRST`;
      params = [lastDate];
    } else {
      // No data yet, do full sync
      console.log('[Mercafacil Sync] No existing data, switching to full sync');
      await syncFull();
      return;
    }
    
    const result = await pgClient.query(query, params);
    console.log(`[Mercafacil Sync] Found ${result.rows.length} new/updated records`);
    
    if (result.rows.length === 0) {
      console.log('[Mercafacil Sync] No new records to sync');
      return;
    }
    
    // Process in batches
    for (let i = 0; i < result.rows.length; i += BATCH_SIZE) {
      const batch = result.rows.slice(i, i + BATCH_SIZE);
      const values = [];
      const placeholders = [];
      
      for (const row of batch) {
        const cpf = (row.cpf_cnpj || '').trim();
        if (!cpf) continue;
        
        placeholders.push(`(?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        values.push(
          (row.nome || '').trim() || null,
          cpf,
          row.data_aniversario || null,
          (row.genero || '').trim() || null,
          (row.estado || '').trim() || null,
          (row.cidade || '').trim() || null,
          (row.bairro || '').trim() || null,
          row.data_criacao || null,
          row.data_atualizacao || null,
        );
      }
      
      if (placeholders.length > 0) {
        // Use INSERT IGNORE to skip duplicates (by cpfCnpj)
        await mysqlConn.execute(
          `INSERT INTO cadastroBaseMercafacil (nome, cpfCnpj, dataAniversario, genero, estado, cidade, bairro, dataCriacao, dataAtualizacao) 
           VALUES ${placeholders.join(', ')}
           ON DUPLICATE KEY UPDATE nome=VALUES(nome), dataAtualizacao=VALUES(dataAtualizacao), syncedAt=NOW()`,
          values
        );
      }
      
      console.log(`[Mercafacil Sync] Processed ${Math.min(i + BATCH_SIZE, result.rows.length)}/${result.rows.length}`);
    }
    
    console.log(`[Mercafacil Sync] Incremental sync complete.`);
  } finally {
    await pgClient.end();
    await mysqlConn.end();
  }
}

// Main
const isFullSync = process.argv.includes('--full');

if (isFullSync) {
  syncFull().catch(err => {
    console.error('[Mercafacil Sync] Error:', err);
    process.exit(1);
  });
} else {
  syncIncremental().catch(err => {
    console.error('[Mercafacil Sync] Error:', err);
    process.exit(1);
  });
}
