// server/_core/index.ts
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "session";
var ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1e3;
var NOT_ADMIN_ERR_MSG = "Acesso restrito a administradores";
var UNAUTHED_ERR_MSG = "Voc\xEA precisa estar autenticado";

// server/_core/cookies.ts
function getSessionCookieOptions(req) {
  const isSecure = req.secure || req.headers["x-forwarded-proto"] === "https";
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/"
  };
}

// server/_core/trpc.ts
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.query(() => ({ status: "ok" }))
});

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  adminDeletePassword: process.env.ADMIN_DELETE_PASSWORD ?? ""
};

// server/routers.ts
import { z } from "zod";

// server/db.ts
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, date } from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var promotoras = mysqlTable("promotoras", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  cpf: varchar("cpf", { length: 14 }).notNull().unique(),
  telefone: varchar("telefone", { length: 20 }).notNull(),
  loja: mysqlEnum("loja", [
    "Pau dos Ferros",
    "S\xE3o Miguel",
    "Limoeiro do Norte",
    "Quixad\xE1",
    "Ass\xFA",
    "Morada Nova"
  ]).notNull(),
  senha: varchar("senha", { length: 255 }).notNull(),
  ativa: int("ativa").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var lancamentos = mysqlTable("lancamentos", {
  id: int("id").autoincrement().primaryKey(),
  promotoraId: int("promotoraId").notNull(),
  nomeCliente: varchar("nomeCliente", { length: 255 }).notNull(),
  cpfCliente: varchar("cpfCliente", { length: 14 }).notNull(),
  dataCadastro: varchar("dataCadastro", { length: 10 }).notNull(),
  loja: varchar("loja", { length: 100 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var metas = mysqlTable("metas", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  metaMensal: int("metaMensal").notNull(),
  dataInicio: varchar("dataInicio", { length: 10 }).notNull(),
  dataFim: varchar("dataFim", { length: 10 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var metaPromotoras = mysqlTable("metaPromotoras", {
  id: int("id").autoincrement().primaryKey(),
  metaId: int("metaId").notNull(),
  promotoraId: int("promotoraId").notNull(),
  metaIndividual: int("metaIndividual").notNull()
});
var atendimentos = mysqlTable("atendimentos", {
  id: int("id").autoincrement().primaryKey(),
  promotoraId: int("promotoraId").notNull(),
  data: varchar("data", { length: 10 }).notNull(),
  quantidade: int("quantidade").notNull(),
  loja: varchar("loja", { length: 100 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var cadastroBaseMercafacil = mysqlTable("cadastroBaseMercafacil", {
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
  syncedAt: timestamp("syncedAt").defaultNow().notNull()
});

// server/db.ts
var _db = null;
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// server/routers.ts
import { eq as eq2, and, like, desc, asc, sql, gte, lte } from "drizzle-orm";
var LOJA_ENUM = z.enum([
  "Pau dos Ferros",
  "S\xE3o Miguel",
  "Limoeiro do Norte",
  "Quixad\xE1",
  "Ass\xFA",
  "Morada Nova"
]);
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    })
  }),
  promotora: router({
    list: publicProcedure.input(z.object({ apenasAtivas: z.boolean().optional() }).optional()).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      if (input?.apenasAtivas) {
        return db.select().from(promotoras).where(eq2(promotoras.ativa, 1)).orderBy(asc(promotoras.nome));
      }
      return db.select().from(promotoras).orderBy(asc(promotoras.nome));
    }),
    getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const result = await db.select().from(promotoras).where(eq2(promotoras.id, input.id)).limit(1);
      return result.length > 0 ? result[0] : null;
    }),
    create: publicProcedure.input(z.object({
      nome: z.string().min(1),
      cpf: z.string().min(11),
      telefone: z.string().min(1),
      loja: LOJA_ENUM,
      senha: z.string().min(1)
    })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const existing = await db.select().from(promotoras).where(eq2(promotoras.cpf, input.cpf)).limit(1);
      if (existing.length > 0) throw new Error("CPF j\xE1 cadastrado no sistema");
      await db.insert(promotoras).values({
        nome: input.nome,
        cpf: input.cpf,
        telefone: input.telefone,
        loja: input.loja,
        senha: input.senha,
        ativa: 1
      });
      return { success: true };
    }),
    update: publicProcedure.input(z.object({
      id: z.number(),
      nome: z.string().min(1).optional(),
      cpf: z.string().min(11).optional(),
      telefone: z.string().min(1).optional(),
      loja: LOJA_ENUM.optional(),
      senha: z.string().min(1).optional(),
      ativa: z.number().optional()
    })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { id, ...updateData } = input;
      if (updateData.cpf) {
        const existing = await db.select().from(promotoras).where(and(eq2(promotoras.cpf, updateData.cpf), sql`${promotoras.id} != ${id}`)).limit(1);
        if (existing.length > 0) throw new Error("CPF j\xE1 cadastrado no sistema");
      }
      const setObj = {};
      if (updateData.nome !== void 0) setObj.nome = updateData.nome;
      if (updateData.cpf !== void 0) setObj.cpf = updateData.cpf;
      if (updateData.telefone !== void 0) setObj.telefone = updateData.telefone;
      if (updateData.loja !== void 0) setObj.loja = updateData.loja;
      if (updateData.senha !== void 0) setObj.senha = updateData.senha;
      if (updateData.ativa !== void 0) setObj.ativa = updateData.ativa;
      if (Object.keys(setObj).length > 0) {
        await db.update(promotoras).set(setObj).where(eq2(promotoras.id, id));
      }
      return { success: true };
    }),
    toggleStatus: publicProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const current = await db.select().from(promotoras).where(eq2(promotoras.id, input.id)).limit(1);
      if (current.length === 0) throw new Error("Promotora n\xE3o encontrada");
      const newStatus = current[0].ativa === 1 ? 0 : 1;
      await db.update(promotoras).set({ ativa: newStatus }).where(eq2(promotoras.id, input.id));
      return { success: true, ativa: newStatus };
    }),
    validatePassword: publicProcedure.input(z.object({ promotoraId: z.number(), senha: z.string() })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const result = await db.select().from(promotoras).where(eq2(promotoras.id, input.promotoraId)).limit(1);
      if (result.length === 0) throw new Error("Promotora n\xE3o encontrada");
      return { valid: result[0].senha === input.senha };
    })
  }),
  lancamento: router({
    list: publicProcedure.input(z.object({
      promotoraId: z.number().optional(),
      loja: z.string().optional(),
      dataCadastro: z.string().optional(),
      nomeCliente: z.string().optional()
    }).optional()).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [];
      if (input?.promotoraId) conditions.push(eq2(lancamentos.promotoraId, input.promotoraId));
      if (input?.loja) conditions.push(eq2(lancamentos.loja, input.loja));
      if (input?.dataCadastro) conditions.push(eq2(lancamentos.dataCadastro, input.dataCadastro));
      if (input?.nomeCliente) conditions.push(like(lancamentos.nomeCliente, `%${input.nomeCliente}%`));
      const results = conditions.length > 0 ? await db.select().from(lancamentos).where(and(...conditions)).orderBy(desc(lancamentos.createdAt)) : await db.select().from(lancamentos).orderBy(desc(lancamentos.createdAt));
      const promotoraIds = Array.from(new Set(results.map((r) => r.promotoraId)));
      const promotorasData = promotoraIds.length > 0 ? await db.select().from(promotoras).where(sql`${promotoras.id} IN (${sql.join(promotoraIds.map((id) => sql`${id}`), sql`, `)})`) : [];
      const promotoraMap = new Map(promotorasData.map((p) => [p.id, p]));
      return results.map((r) => ({
        ...r,
        promotoraNome: promotoraMap.get(r.promotoraId)?.nome || "Desconhecida",
        promotoraLoja: promotoraMap.get(r.promotoraId)?.loja || ""
      }));
    }),
    create: publicProcedure.input(z.object({
      promotoraId: z.number(),
      nomeCliente: z.string().min(1),
      cpfCliente: z.string().min(11),
      dataCadastro: z.string(),
      loja: z.string(),
      senha: z.string()
    })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const promotora = await db.select().from(promotoras).where(eq2(promotoras.id, input.promotoraId)).limit(1);
      if (promotora.length === 0) throw new Error("Promotora n\xE3o encontrada");
      if (promotora[0].senha !== input.senha) throw new Error("Senha incorreta");
      if (promotora[0].ativa !== 1) throw new Error("Promotora inativa");
      await db.insert(lancamentos).values({
        promotoraId: input.promotoraId,
        nomeCliente: input.nomeCliente,
        cpfCliente: input.cpfCliente,
        dataCadastro: input.dataCadastro,
        loja: input.loja
      });
      return { success: true };
    }),
    delete: publicProcedure.input(z.object({ id: z.number(), senha: z.string() })).mutation(async ({ input }) => {
      const adminPassword = ENV.adminDeletePassword;
      if (!adminPassword || input.senha !== adminPassword) {
        throw new Error("Senha de administrador incorreta");
      }
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(lancamentos).where(eq2(lancamentos.id, input.id));
      return { success: true };
    }),
    stats: publicProcedure.input(z.object({
      loja: z.string().optional(),
      promotoraId: z.number().optional(),
      dataInicio: z.string().optional(),
      dataFim: z.string().optional()
    }).optional()).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { porDia: [], porSemana: [], porMes: [], porDiaSemana: [], ranking: [], total: 0, meta: null };
      const conditions = [];
      if (input?.loja) conditions.push(eq2(lancamentos.loja, input.loja));
      if (input?.promotoraId) conditions.push(eq2(lancamentos.promotoraId, input.promotoraId));
      if (input?.dataInicio) conditions.push(gte(lancamentos.dataCadastro, input.dataInicio));
      if (input?.dataFim) conditions.push(lte(lancamentos.dataCadastro, input.dataFim));
      const allLancamentos = conditions.length > 0 ? await db.select().from(lancamentos).where(and(...conditions)).orderBy(asc(lancamentos.dataCadastro)) : await db.select().from(lancamentos).orderBy(asc(lancamentos.dataCadastro));
      let activeMeta = null;
      let metaPromoMap = /* @__PURE__ */ new Map();
      if (input?.dataInicio && input?.dataFim) {
        const metaResults = await db.select().from(metas).where(and(lte(metas.dataInicio, input.dataFim), gte(metas.dataFim, input.dataInicio))).orderBy(desc(metas.createdAt)).limit(1);
        if (metaResults.length > 0) {
          activeMeta = metaResults[0];
          const metaPromos = await db.select().from(metaPromotoras).where(eq2(metaPromotoras.metaId, activeMeta.id));
          metaPromos.forEach((mp) => metaPromoMap.set(mp.promotoraId, mp.metaIndividual));
        }
      } else {
        const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
        const metaResults = await db.select().from(metas).where(and(lte(metas.dataInicio, today), gte(metas.dataFim, today))).orderBy(desc(metas.createdAt)).limit(1);
        if (metaResults.length > 0) {
          activeMeta = metaResults[0];
          const metaPromos = await db.select().from(metaPromotoras).where(eq2(metaPromotoras.metaId, activeMeta.id));
          metaPromos.forEach((mp) => metaPromoMap.set(mp.promotoraId, mp.metaIndividual));
        }
      }
      let diasUteis = 0;
      if (activeMeta) {
        const start = /* @__PURE__ */ new Date(activeMeta.dataInicio + "T00:00:00");
        const end = /* @__PURE__ */ new Date(activeMeta.dataFim + "T00:00:00");
        const d = new Date(start);
        while (d <= end) {
          const dow = d.getDay();
          if (dow !== 0 && dow !== 6) diasUteis++;
          d.setDate(d.getDate() + 1);
        }
      }
      const porDiaMap = /* @__PURE__ */ new Map();
      allLancamentos.forEach((l) => {
        porDiaMap.set(l.dataCadastro, (porDiaMap.get(l.dataCadastro) || 0) + 1);
      });
      const porDia = Array.from(porDiaMap.entries()).map(([data, quantidade]) => ({ data, quantidade })).sort((a, b) => a.data.localeCompare(b.data));
      const porSemanaMap = /* @__PURE__ */ new Map();
      allLancamentos.forEach((l) => {
        const parts = l.dataCadastro.split("-");
        if (parts.length === 3) {
          const weekNum = Math.ceil(parseInt(parts[2]) / 7);
          const key = `${parts[0]}-${parts[1]}-S${weekNum}`;
          porSemanaMap.set(key, (porSemanaMap.get(key) || 0) + 1);
        }
      });
      const porSemana = Array.from(porSemanaMap.entries()).map(([semana, quantidade]) => ({ semana, quantidade })).sort((a, b) => a.semana.localeCompare(b.semana));
      const porMesMap = /* @__PURE__ */ new Map();
      allLancamentos.forEach((l) => {
        const parts = l.dataCadastro.split("-");
        if (parts.length >= 2) {
          const key = `${parts[0]}-${parts[1]}`;
          porMesMap.set(key, (porMesMap.get(key) || 0) + 1);
        }
      });
      const porMes = Array.from(porMesMap.entries()).map(([mes, quantidade]) => ({ mes, quantidade })).sort((a, b) => a.mes.localeCompare(b.mes));
      const DOW_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "S\xE1b"];
      const porDiaSemanaMap = /* @__PURE__ */ new Map();
      allLancamentos.forEach((l) => {
        const d = /* @__PURE__ */ new Date(l.dataCadastro + "T00:00:00");
        const dow = d.getDay();
        porDiaSemanaMap.set(dow, (porDiaSemanaMap.get(dow) || 0) + 1);
      });
      const dowOrder = [1, 2, 3, 4, 5, 6, 0];
      const porDiaSemana = dowOrder.map((dow) => ({
        dia: DOW_NAMES[dow],
        quantidade: porDiaSemanaMap.get(dow) || 0
      }));
      const rankingMap = /* @__PURE__ */ new Map();
      allLancamentos.forEach((l) => {
        rankingMap.set(l.promotoraId, (rankingMap.get(l.promotoraId) || 0) + 1);
      });
      const promotoraIds = Array.from(rankingMap.keys());
      const allMetaPromoIds = Array.from(metaPromoMap.keys());
      const allIds = Array.from(/* @__PURE__ */ new Set([...promotoraIds, ...allMetaPromoIds]));
      const promotorasData = allIds.length > 0 ? await db.select().from(promotoras).where(sql`${promotoras.id} IN (${sql.join(allIds.map((id) => sql`${id}`), sql`, `)})`) : [];
      const promotoraMapData = new Map(promotorasData.map((p) => [p.id, p]));
      const ranking = allIds.map((promotoraId) => {
        const quantidade = rankingMap.get(promotoraId) || 0;
        const metaIndividual = metaPromoMap.get(promotoraId) || (activeMeta ? activeMeta.metaMensal : 0);
        const percentualMeta = metaIndividual > 0 ? Math.round(quantidade / metaIndividual * 100) : 0;
        return {
          promotoraId,
          nome: promotoraMapData.get(promotoraId)?.nome || "Desconhecida",
          loja: promotoraMapData.get(promotoraId)?.loja || "",
          quantidade,
          meta: metaIndividual,
          percentualMeta
        };
      }).sort((a, b) => b.quantidade - a.quantidade);
      const atendConditions = [];
      if (input?.loja) atendConditions.push(eq2(atendimentos.loja, input.loja));
      if (input?.promotoraId) atendConditions.push(eq2(atendimentos.promotoraId, input.promotoraId));
      if (input?.dataInicio) atendConditions.push(gte(atendimentos.data, input.dataInicio));
      if (input?.dataFim) atendConditions.push(lte(atendimentos.data, input.dataFim));
      const allAtendimentos = atendConditions.length > 0 ? await db.select().from(atendimentos).where(and(...atendConditions)) : await db.select().from(atendimentos);
      const totalAtendimentos = allAtendimentos.reduce((s, a) => s + a.quantidade, 0);
      const taxaConversao = totalAtendimentos > 0 ? Math.round(allLancamentos.length / totalAtendimentos * 1e4) / 100 : 0;
      const atendPorPromoMap = /* @__PURE__ */ new Map();
      allAtendimentos.forEach((a) => {
        atendPorPromoMap.set(a.promotoraId, (atendPorPromoMap.get(a.promotoraId) || 0) + a.quantidade);
      });
      const rankingWithConversion = ranking.map((r) => {
        const atend = atendPorPromoMap.get(r.promotoraId) || 0;
        const conv = atend > 0 ? Math.round(r.quantidade / atend * 1e4) / 100 : 0;
        return { ...r, atendimentos: atend, taxaConversao: conv };
      });
      const porLojaMap = /* @__PURE__ */ new Map();
      allLancamentos.forEach((l) => {
        porLojaMap.set(l.loja, (porLojaMap.get(l.loja) || 0) + 1);
      });
      const porLoja = Array.from(porLojaMap.entries()).map(([loja, quantidade]) => {
        const pctTotal = allLancamentos.length > 0 ? Math.round(quantidade / allLancamentos.length * 1e4) / 100 : 0;
        const pctMeta = activeMeta ? Math.round(quantidade / activeMeta.metaMensal * 1e4) / 100 : 0;
        return { loja, quantidade, percentualTotal: pctTotal, percentualMeta: pctMeta };
      }).sort((a, b) => b.quantidade - a.quantidade);
      const acompanhamento = [];
      if (activeMeta && diasUteis > 0) {
        const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
        const metaStart = /* @__PURE__ */ new Date(activeMeta.dataInicio + "T00:00:00");
        const metaEnd = /* @__PURE__ */ new Date(activeMeta.dataFim + "T00:00:00");
        const todayDate = /* @__PURE__ */ new Date(today + "T00:00:00");
        const endDate = todayDate < metaEnd ? todayDate : metaEnd;
        const businessDays = [];
        const bd = new Date(metaStart);
        while (bd <= endDate) {
          const dow = bd.getDay();
          if (dow !== 0 && dow !== 6) {
            businessDays.push(bd.toISOString().split("T")[0]);
          }
          bd.setDate(bd.getDate() + 1);
        }
        const diasPassados = businessDays.length;
        for (const promId of allIds) {
          const metaInd = metaPromoMap.get(promId) || 0;
          if (metaInd <= 0) continue;
          const metaDiariaInd = metaInd / diasUteis;
          const lancPorDia = /* @__PURE__ */ new Map();
          allLancamentos.filter((l) => l.promotoraId === promId).forEach((l) => {
            lancPorDia.set(l.dataCadastro, (lancPorDia.get(l.dataCadastro) || 0) + 1);
          });
          let diasAtingidos = 0;
          let diasNaoAtingidos = 0;
          businessDays.forEach((day) => {
            const count = lancPorDia.get(day) || 0;
            if (count >= metaDiariaInd) diasAtingidos++;
            else diasNaoAtingidos++;
          });
          const totalRealizados = rankingMap.get(promId) || 0;
          acompanhamento.push({
            promotoraId: promId,
            nome: promotoraMapData.get(promId)?.nome || "Desconhecida",
            loja: promotoraMapData.get(promId)?.loja || "",
            metaIndividual: metaInd,
            metaDiariaIndividual: Math.round(metaDiariaInd * 100) / 100,
            diasPassados,
            diasAtingidos,
            diasNaoAtingidos,
            totalRealizados,
            percentualMeta: metaInd > 0 ? Math.round(totalRealizados / metaInd * 100) : 0
          });
        }
      }
      return {
        porDia,
        porSemana,
        porMes,
        porDiaSemana,
        ranking: rankingWithConversion,
        porLoja,
        acompanhamento,
        total: allLancamentos.length,
        totalAtendimentos,
        taxaConversao,
        meta: activeMeta ? {
          ...activeMeta,
          diasUteis,
          metaDiaria: diasUteis > 0 ? Math.round(activeMeta.metaMensal / diasUteis * 100) / 100 : 0
        } : null
      };
    }),
    distinctDates: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const results = await db.selectDistinct({ dataCadastro: lancamentos.dataCadastro }).from(lancamentos).orderBy(desc(lancamentos.dataCadastro));
      return results.map((r) => r.dataCadastro);
    }),
    distinctClientes: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const results = await db.selectDistinct({ nomeCliente: lancamentos.nomeCliente }).from(lancamentos).orderBy(asc(lancamentos.nomeCliente));
      return results.map((r) => r.nomeCliente);
    })
  }),
  atendimento: router({
    list: publicProcedure.input(z.object({
      promotoraId: z.number().optional(),
      loja: z.string().optional(),
      data: z.string().optional()
    }).optional()).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [];
      if (input?.promotoraId) conditions.push(eq2(atendimentos.promotoraId, input.promotoraId));
      if (input?.loja) conditions.push(eq2(atendimentos.loja, input.loja));
      if (input?.data) conditions.push(eq2(atendimentos.data, input.data));
      const results = conditions.length > 0 ? await db.select().from(atendimentos).where(and(...conditions)).orderBy(desc(atendimentos.data)) : await db.select().from(atendimentos).orderBy(desc(atendimentos.data));
      const promoIds = Array.from(new Set(results.map((r) => r.promotoraId)));
      const promotorasData = promoIds.length > 0 ? await db.select().from(promotoras).where(sql`${promotoras.id} IN (${sql.join(promoIds.map((id) => sql`${id}`), sql`, `)})`) : [];
      const promoMap = new Map(promotorasData.map((p) => [p.id, p]));
      return results.map((r) => ({
        ...r,
        promotoraNome: promoMap.get(r.promotoraId)?.nome || "Desconhecida"
      }));
    }),
    create: publicProcedure.input(z.object({
      promotoraId: z.number(),
      data: z.string(),
      quantidade: z.number().min(1),
      senha: z.string()
    })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const promotora = await db.select().from(promotoras).where(eq2(promotoras.id, input.promotoraId)).limit(1);
      if (promotora.length === 0) throw new Error("Promotora n\xE3o encontrada");
      if (promotora[0].senha !== input.senha) throw new Error("Senha incorreta");
      if (promotora[0].ativa !== 1) throw new Error("Promotora inativa");
      await db.insert(atendimentos).values({
        promotoraId: input.promotoraId,
        data: input.data,
        quantidade: input.quantidade,
        loja: promotora[0].loja
      });
      return { success: true };
    }),
    delete: publicProcedure.input(z.object({ id: z.number(), senha: z.string() })).mutation(async ({ input }) => {
      const adminPassword = ENV.adminDeletePassword;
      if (!adminPassword || input.senha !== adminPassword) {
        throw new Error("Senha de administrador incorreta");
      }
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(atendimentos).where(eq2(atendimentos.id, input.id));
      return { success: true };
    })
  }),
  meta: router({
    current: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return null;
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const results = await db.select().from(metas).where(and(lte(metas.dataInicio, today), gte(metas.dataFim, today))).orderBy(desc(metas.createdAt)).limit(1);
      if (results.length === 0) return null;
      return { dataInicio: results[0].dataInicio, dataFim: results[0].dataFim, nome: results[0].nome };
    }),
    list: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const metasList = await db.select().from(metas).orderBy(desc(metas.dataInicio));
      const result = [];
      for (const m of metasList) {
        const assignments = await db.select().from(metaPromotoras).where(eq2(metaPromotoras.metaId, m.id));
        const promoIds = assignments.map((a) => a.promotoraId);
        const promoData = promoIds.length > 0 ? await db.select().from(promotoras).where(sql`${promotoras.id} IN (${sql.join(promoIds.map((id) => sql`${id}`), sql`, `)})`) : [];
        const promoMap = new Map(promoData.map((p) => [p.id, p]));
        let diasUteis = 0;
        const start = /* @__PURE__ */ new Date(m.dataInicio + "T00:00:00");
        const end = /* @__PURE__ */ new Date(m.dataFim + "T00:00:00");
        const d = new Date(start);
        while (d <= end) {
          const dow = d.getDay();
          if (dow !== 0 && dow !== 6) diasUteis++;
          d.setDate(d.getDate() + 1);
        }
        result.push({
          ...m,
          diasUteis,
          metaDiaria: diasUteis > 0 ? Math.round(m.metaMensal / diasUteis * 100) / 100 : 0,
          promotoras: assignments.map((a) => ({
            promotoraId: a.promotoraId,
            nome: promoMap.get(a.promotoraId)?.nome || "Desconhecida",
            loja: promoMap.get(a.promotoraId)?.loja || "",
            metaIndividual: a.metaIndividual
          }))
        });
      }
      return result;
    }),
    create: publicProcedure.input(z.object({
      nome: z.string().min(1),
      metaMensal: z.number().min(1),
      dataInicio: z.string(),
      dataFim: z.string(),
      senha: z.string(),
      promotoras: z.array(z.object({
        promotoraId: z.number(),
        metaIndividual: z.number().min(0)
      }))
    })).mutation(async ({ input }) => {
      const adminPassword = ENV.adminDeletePassword;
      if (!adminPassword || input.senha !== adminPassword) {
        throw new Error("Senha de administrador incorreta");
      }
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [inserted] = await db.insert(metas).values({
        nome: input.nome,
        metaMensal: input.metaMensal,
        dataInicio: input.dataInicio,
        dataFim: input.dataFim
      }).$returningId();
      const metaId = inserted.id;
      if (input.promotoras.length > 0) {
        await db.insert(metaPromotoras).values(
          input.promotoras.map((p) => ({
            metaId,
            promotoraId: p.promotoraId,
            metaIndividual: p.metaIndividual
          }))
        );
      }
      return { success: true, id: metaId };
    }),
    update: publicProcedure.input(z.object({
      id: z.number(),
      nome: z.string().min(1),
      metaMensal: z.number().min(1),
      dataInicio: z.string(),
      dataFim: z.string(),
      senha: z.string(),
      promotoras: z.array(z.object({
        promotoraId: z.number(),
        metaIndividual: z.number().min(0)
      }))
    })).mutation(async ({ input }) => {
      const adminPassword = ENV.adminDeletePassword;
      if (!adminPassword || input.senha !== adminPassword) {
        throw new Error("Senha de administrador incorreta");
      }
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(metas).set({
        nome: input.nome,
        metaMensal: input.metaMensal,
        dataInicio: input.dataInicio,
        dataFim: input.dataFim
      }).where(eq2(metas.id, input.id));
      await db.delete(metaPromotoras).where(eq2(metaPromotoras.metaId, input.id));
      if (input.promotoras.length > 0) {
        await db.insert(metaPromotoras).values(
          input.promotoras.map((p) => ({
            metaId: input.id,
            promotoraId: p.promotoraId,
            metaIndividual: p.metaIndividual
          }))
        );
      }
      return { success: true };
    }),
    delete: publicProcedure.input(z.object({ id: z.number(), senha: z.string() })).mutation(async ({ input }) => {
      const adminPassword = ENV.adminDeletePassword;
      if (!adminPassword || input.senha !== adminPassword) {
        throw new Error("Senha de administrador incorreta");
      }
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(metaPromotoras).where(eq2(metaPromotoras.metaId, input.id));
      await db.delete(metas).where(eq2(metas.id, input.id));
      return { success: true };
    })
  }),
  mercafacil: router({
    // Total geral de cadastros na base Mercafacil a partir de 01/02/2026
    totalGeral: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { total: 0 };
      const DATA_REF = "2026-02-01";
      const result = await db.select({ count: sql`count(*)` }).from(cadastroBaseMercafacil).where(gte(cadastroBaseMercafacil.dataCriacao, /* @__PURE__ */ new Date(DATA_REF + "T00:00:00")));
      return { total: Number(result[0]?.count || 0) };
    }),
    // Cruzamento de CPFs: lançamentos das promotoras vs base Mercafacil
    cruzamento: publicProcedure.input(z.object({
      dataInicio: z.string().optional(),
      dataFim: z.string().optional(),
      loja: z.string().optional(),
      promotoraId: z.number().optional()
    }).optional()).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return {
        totalMercafacil: 0,
        totalPromotoras: 0,
        cadastradosViaPromotoras: 0,
        cadastradosPorFora: 0,
        percentualCRM: 0,
        naoEncontradosNaBase: 0
      };
      const DATA_REF = "2026-02-01";
      const lancConditions = [];
      if (input?.loja) lancConditions.push(eq2(lancamentos.loja, input.loja));
      if (input?.promotoraId) lancConditions.push(eq2(lancamentos.promotoraId, input.promotoraId));
      if (input?.dataInicio) lancConditions.push(gte(lancamentos.dataCadastro, input.dataInicio));
      if (input?.dataFim) lancConditions.push(lte(lancamentos.dataCadastro, input.dataFim));
      const allLanc = lancConditions.length > 0 ? await db.select({ cpf: lancamentos.cpfCliente }).from(lancamentos).where(and(...lancConditions)) : await db.select({ cpf: lancamentos.cpfCliente }).from(lancamentos);
      const lancCpfs = new Set(allLanc.map((l) => l.cpf.replace(/[^\d]/g, "")));
      const mercaRecords = await db.select({ cpf: cadastroBaseMercafacil.cpfCnpj }).from(cadastroBaseMercafacil).where(gte(cadastroBaseMercafacil.dataCriacao, /* @__PURE__ */ new Date(DATA_REF + "T00:00:00")));
      const mercaCpfs = new Set(mercaRecords.map((m) => m.cpf.replace(/[^\d]/g, "")));
      let cadastradosViaPromotoras = 0;
      let naoEncontradosNaBase = 0;
      Array.from(lancCpfs).forEach((cpf) => {
        if (mercaCpfs.has(cpf)) {
          cadastradosViaPromotoras++;
        } else {
          naoEncontradosNaBase++;
        }
      });
      const cadastradosPorFora = mercaCpfs.size - cadastradosViaPromotoras;
      const percentualCRM = mercaCpfs.size > 0 ? Math.round(cadastradosViaPromotoras / mercaCpfs.size * 1e4) / 100 : 0;
      return {
        totalMercafacil: mercaCpfs.size,
        totalPromotoras: lancCpfs.size,
        cadastradosViaPromotoras,
        cadastradosPorFora: Math.max(0, cadastradosPorFora),
        percentualCRM,
        naoEncontradosNaBase
      };
    }),
    // Status da última sincronização
    syncStatus: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { lastSync: null, totalRecords: 0 };
      const countResult = await db.select({ count: sql`count(*)` }).from(cadastroBaseMercafacil);
      const lastResult = await db.select({ lastSync: sql`MAX(syncedAt)` }).from(cadastroBaseMercafacil);
      return {
        totalRecords: Number(countResult[0]?.count || 0),
        lastSync: lastResult[0]?.lastSync || null
      };
    })
  })
});

// server/_core/context.ts
async function createContext({ req, res }) {
  return { req, res, user: null };
}

// server/_core/index.ts
var __dirname = path.dirname(fileURLToPath(import.meta.url));
var app = express();
app.use(express.json());
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext
  })
);
if (ENV.isProduction) {
  const distPath = path.join(__dirname, "../../dist/public");
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}
var PORT = process.env.PORT || 3e3;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
