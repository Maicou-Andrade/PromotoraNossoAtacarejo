import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, date, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Promotoras table - stores promoter information
 */
export const promotoras = mysqlTable("promotoras", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  cpf: varchar("cpf", { length: 14 }).notNull().unique(),
  telefone: varchar("telefone", { length: 20 }).notNull(),
  loja: mysqlEnum("loja", [
    "Pau dos Ferros",
    "São Miguel",
    "Limoeiro do Norte",
    "Quixadá",
    "Assú",
    "Morada Nova",
  ]).notNull(),
  senha: varchar("senha", { length: 255 }).notNull(),
  ativa: int("ativa").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Promotora = typeof promotoras.$inferSelect;
export type InsertPromotora = typeof promotoras.$inferInsert;

/**
 * Lancamentos table - stores client registration entries
 */
export const lancamentos = mysqlTable("lancamentos", {
  id: int("id").autoincrement().primaryKey(),
  promotoraId: int("promotoraId").notNull(),
  nomeCliente: varchar("nomeCliente", { length: 255 }).notNull(),
  cpfCliente: varchar("cpfCliente", { length: 14 }).notNull(),
  dataCadastro: varchar("dataCadastro", { length: 10 }).notNull(),
  loja: varchar("loja", { length: 100 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Lancamento = typeof lancamentos.$inferSelect;
export type InsertLancamento = typeof lancamentos.$inferInsert;

/**
 * Metas table - stores monthly goals with date ranges
 */
export const metas = mysqlTable("metas", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  metaMensal: int("metaMensal").notNull(),
  dataInicio: varchar("dataInicio", { length: 10 }).notNull(),
  dataFim: varchar("dataFim", { length: 10 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Meta = typeof metas.$inferSelect;
export type InsertMeta = typeof metas.$inferInsert;

/**
 * Meta por promotora - individual goals per promoter within a meta period
 */
export const metaPromotoras = mysqlTable("metaPromotoras", {
  id: int("id").autoincrement().primaryKey(),
  metaId: int("metaId").notNull(),
  promotoraId: int("promotoraId").notNull(),
  metaIndividual: int("metaIndividual").notNull(),
});

export type MetaPromotora = typeof metaPromotoras.$inferSelect;
export type InsertMetaPromotora = typeof metaPromotoras.$inferInsert;

/**
 * Atendimentos table - stores daily attendance count per promoter
 */
export const atendimentos = mysqlTable("atendimentos", {
  id: int("id").autoincrement().primaryKey(),
  promotoraId: int("promotoraId").notNull(),
  data: varchar("data", { length: 10 }).notNull(),
  quantidade: int("quantidade").notNull(),
  loja: varchar("loja", { length: 100 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Atendimento = typeof atendimentos.$inferSelect;
export type InsertAtendimento = typeof atendimentos.$inferInsert;

/**
 * Cadastro Base Mercafacil - mirror of external cad_fornecedor table
 */
export const cadastroBaseMercafacil = mysqlTable("cadastroBaseMercafacil", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 255 }),
  cpfCnpj: varchar("cpfCnpj", { length: 20 }).notNull(),
  dataAniversario: date("dataAniversario"),
  genero: varchar("genero", { length: 2 }),
  estado: varchar("estado", { length: 2 }),
  cidade: varchar("cidade", { length: 255 }),
  bairro: varchar("bairro", { length: 255 }),
  dataCriacao: timestamp("dataCriacao"),
  dataAtualizacao: timestamp("dataAtualizacao"),
  syncedAt: timestamp("syncedAt").defaultNow().notNull(),
});

export type CadastroBaseMercafacil = typeof cadastroBaseMercafacil.$inferSelect;
export type InsertCadastroBaseMercafacil = typeof cadastroBaseMercafacil.$inferInsert;
