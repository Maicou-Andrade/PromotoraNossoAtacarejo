import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { ENV } from "./env";
import cron from "node-cron";
import { execFile } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());

// tRPC API
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// Rota: vendas por loja em uma data específica
app.get("/api/vendas-por-loja", async (_req, res) => {
  const { default: pg } = await import("pg");
  const { Client } = pg;
  const client = new Client({
    host: "189.126.142.41",
    port: 5432,
    database: "Atacarejo",
    user: "dbatacarejo",
    password: "u98>C{8WO2xF",
    connectionTimeoutMillis: 30000,
  });
  try {
    await client.connect();
    const result = await client.query(`
      WITH base_venda AS (
        SELECT
          vi.ID_EMPRESA,
          vi.QUANTIDADE,
          vi.VALORTOTAL,
          vi.VALORDESCONTO,
          vi.VALORACRESCIMO,
          vi.VALORCUSTOLIQ,
          vi.VALORCUSTOBRUTO,
          (vi.VALORTOTAL + vi.VALORACRESCIMO - vi.VALORDESCONTO) AS VALORTOTALLIQ,
          DATE(vi.DTMOVIMENTO) AS DTMOVIMENTO,
          vi.ID_SEGMENTO,
          v.NUMNOTA
        FROM PUBLIC.VENDA_ITEM vi
        LEFT JOIN PUBLIC.VENDA v
               ON v.ID_EMPRESA = vi.ID_EMPRESA
              AND CAST(v.NUMNOTA as VARCHAR(20)) = vi.NUMNOTA
              AND v.SERIENOTA = vi.SERIENOTA
              AND v.SERIEDOC = vi.SERIEDOC
        WHERE
          vi.ID_OPERACAO IN (800, 810, 813)
          AND VI.STATUS_NOTA = 'V'
          AND DATE(vi.DTMOVIMENTO) = '2026-03-10'
          AND vi.ID_SEGMENTO IN (1,2,3,4,5,6)
      ),
      base_dev AS (
        SELECT
          nfi.ID_EMPRESA,
          (nfi.QUANTIDADE * -1) AS QUANTIDADE,
          (nfi.VALORTOTAL * -1) AS VALORTOTAL,
          (nfi.VALORDESCONTO * -1) AS VALORDESCONTO,
          (COALESCE(nfi.VALORACRESCIMO,0) * -1) AS VALORACRESCIMO,
          (nfi.VALORCUSTOLIQ * -1) AS VALORCUSTOLIQ,
          (nfi.VALORCUSTOBRUTO * -1) AS VALORCUSTOBRUTO,
          ((nfi.VALORTOTAL + COALESCE(nfi.VALORACRESCIMO,0) - COALESCE(nfi.VALORDESCONTO,0)) * -1) AS VALORTOTALLIQ,
          DATE(nf.DTEMISSAO) AS DTMOVIMENTO,
          nfi.ID_SEGMENTO,
          CAST(nf.NUMNOTA as VARCHAR(20)) AS NUMNOTA
        FROM PUBLIC.NOTA nf
        INNER JOIN PUBLIC.NOTA_ITEM nfi
                ON nfi.NUMNOTA = CAST(nf.NUMNOTA as VARCHAR(20))
               AND nfi.SERIENOTA = nf.SERIENOTA
               AND nfi.ID_PESSOA = nf.ID_PESSOA
               AND nfi.ID_EMPRESA = nf.ID_EMPRESA
               AND nfi.TIPONOTAFISCAL = nf.TIPONOTAFISCAL
        WHERE
          nf.TIPONOTAFISCAL = 'E'
          AND nf.ID_OPERACAO IN (202, 209)
          AND DATE(nf.DTEMISSAO) = '2026-03-10'
          AND nfi.ID_SEGMENTO IN (1,2,3,4,5,6)
      ),
      base_union AS (
        SELECT * FROM base_venda
        UNION ALL
        SELECT * FROM base_dev
      )
      SELECT
        b.ID_EMPRESA,
        f.NOMEFANTASIA,
        f.APELIDO,
        COUNT(DISTINCT b.NUMNOTA)                                               AS qtd_cupons,
        ROUND(SUM(b.VALORTOTALLIQ)::numeric, 2)                                 AS venda_liq,
        ROUND(SUM(b.VALORCUSTOLIQ)::numeric, 2)                                 AS custo_liq,
        ROUND((SUM(b.VALORTOTALLIQ) - SUM(b.VALORCUSTOLIQ))::numeric, 2)        AS margem_r,
        ROUND(
          CASE WHEN SUM(b.VALORTOTALLIQ) > 0
               THEN ((SUM(b.VALORTOTALLIQ) - SUM(b.VALORCUSTOLIQ)) / SUM(b.VALORTOTALLIQ)) * 100
               ELSE 0 END::numeric, 2
        )                                                                        AS margem_pct,
        ROUND((SUM(b.VALORTOTALLIQ) / NULLIF(COUNT(DISTINCT b.NUMNOTA),0))::numeric, 2) AS ticket_medio
      FROM base_union b
      LEFT JOIN PUBLIC.FILIAL f ON f.ID_EMPRESA = b.ID_EMPRESA
      GROUP BY b.ID_EMPRESA, f.NOMEFANTASIA, f.APELIDO
      ORDER BY venda_liq DESC
    `);
    await client.end();
    res.json({ status: "OK", data: result.rows });
  } catch (e: any) {
    res.json({ status: "ERRO", mensagem: e.message });
  }
});

// Rota de teste: conexão com banco externo PostgreSQL (Mercafacil/DW)
app.get("/api/teste-db", async (_req, res) => {
  const { default: pg } = await import("pg");
  const { Client } = pg;
  const client = new Client({
    host: "189.126.142.41",
    port: 5432,
    database: "Atacarejo",
    user: "dbatacarejo",
    password: "u98>C{8WO2xF",
    connectionTimeoutMillis: 20000,
  });
  try {
    await client.connect();
    const result = await client.query("SELECT * FROM filial LIMIT 5;");
    await client.end();
    res.json({ status: "CONECTOU", linhas: result.rows });
  } catch (e: any) {
    res.json({ status: "ERRO", mensagem: e.message });
  }
});

// Serve static frontend in production
if (ENV.isProduction) {
  const distPath = path.join(__dirname, "public");
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Cron: sync Mercafacil todos os dias às 03:00
const syncScript = path.join(__dirname, "..", "sync-mercafacil.mjs");

function runSync(full = false) {
  const args = full ? [syncScript, "--full"] : [syncScript];
  console.log(`[Cron] Iniciando sync Mercafacil${full ? " (full)" : ""}...`);
  execFile("node", args, { timeout: 10 * 60 * 1000 }, (err, stdout, stderr) => {
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
    if (err) console.error("[Cron] Erro no sync:", err.message);
    else console.log("[Cron] Sync Mercafacil concluído.");
  });
}

cron.schedule("0 3 * * *", () => runSync(false), { timezone: "America/Fortaleza" });
console.log("[Cron] Sync Mercafacil agendado para 03:00 (Fortaleza)");

// Rota para disparar sync manualmente
app.post("/api/sync-mercafacil", (_req, res) => {
  const full = _req.query.full === "true";
  runSync(full);
  res.json({ ok: true, message: `Sync ${full ? "full" : "incremental"} iniciado` });
});

export type { AppRouter } from "../routers";
