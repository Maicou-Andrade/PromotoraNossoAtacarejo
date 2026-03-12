import { COOKIE_NAME } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { ENV } from "./_core/env";
import { z } from "zod";
import { getDb } from "./db";
import { promotoras, lancamentos, metas, metaPromotoras, atendimentos, cadastroBaseMercafacil } from "../drizzle/schema";
import { eq, and, like, desc, asc, sql, gte, lte } from "drizzle-orm";

const LOJA_ENUM = z.enum([
  "Pau dos Ferros",
  "São Miguel",
  "Limoeiro do Norte",
  "Quixadá",
  "Assú",
  "Morada Nova",
]);

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  promotora: router({
    list: publicProcedure
      .input(z.object({ apenasAtivas: z.boolean().optional() }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        if (input?.apenasAtivas) {
          return db.select().from(promotoras).where(eq(promotoras.ativa, 1)).orderBy(asc(promotoras.nome));
        }
        return db.select().from(promotoras).orderBy(asc(promotoras.nome));
      }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        const result = await db.select().from(promotoras).where(eq(promotoras.id, input.id)).limit(1);
        return result.length > 0 ? result[0] : null;
      }),

    create: publicProcedure
      .input(z.object({
        nome: z.string().min(1),
        cpf: z.string().min(11),
        telefone: z.string().min(1),
        loja: LOJA_ENUM,
        senha: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const existing = await db.select().from(promotoras).where(eq(promotoras.cpf, input.cpf)).limit(1);
        if (existing.length > 0) throw new Error("CPF já cadastrado no sistema");
        await db.insert(promotoras).values({
          nome: input.nome,
          cpf: input.cpf,
          telefone: input.telefone,
          loja: input.loja,
          senha: input.senha,
          ativa: 1,
        });
        return { success: true };
      }),

    update: publicProcedure
      .input(z.object({
        id: z.number(),
        nome: z.string().min(1).optional(),
        cpf: z.string().min(11).optional(),
        telefone: z.string().min(1).optional(),
        loja: LOJA_ENUM.optional(),
        senha: z.string().min(1).optional(),
        ativa: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { id, ...updateData } = input;
        if (updateData.cpf) {
          const existing = await db.select().from(promotoras)
            .where(and(eq(promotoras.cpf, updateData.cpf), sql`${promotoras.id} != ${id}`)).limit(1);
          if (existing.length > 0) throw new Error("CPF já cadastrado no sistema");
        }
        const setObj: Record<string, unknown> = {};
        if (updateData.nome !== undefined) setObj.nome = updateData.nome;
        if (updateData.cpf !== undefined) setObj.cpf = updateData.cpf;
        if (updateData.telefone !== undefined) setObj.telefone = updateData.telefone;
        if (updateData.loja !== undefined) setObj.loja = updateData.loja;
        if (updateData.senha !== undefined) setObj.senha = updateData.senha;
        if (updateData.ativa !== undefined) setObj.ativa = updateData.ativa;
        if (Object.keys(setObj).length > 0) {
          await db.update(promotoras).set(setObj).where(eq(promotoras.id, id));
        }
        return { success: true };
      }),

    toggleStatus: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const current = await db.select().from(promotoras).where(eq(promotoras.id, input.id)).limit(1);
        if (current.length === 0) throw new Error("Promotora não encontrada");
        const newStatus = current[0].ativa === 1 ? 0 : 1;
        await db.update(promotoras).set({ ativa: newStatus }).where(eq(promotoras.id, input.id));
        return { success: true, ativa: newStatus };
      }),

    validatePassword: publicProcedure
      .input(z.object({ promotoraId: z.number(), senha: z.string() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const result = await db.select().from(promotoras).where(eq(promotoras.id, input.promotoraId)).limit(1);
        if (result.length === 0) throw new Error("Promotora não encontrada");
        return { valid: result[0].senha === input.senha };
      }),
  }),

  lancamento: router({
    list: publicProcedure
      .input(z.object({
        promotoraId: z.number().optional(),
        loja: z.string().optional(),
        dataCadastro: z.string().optional(),
        nomeCliente: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const conditions = [];
        if (input?.promotoraId) conditions.push(eq(lancamentos.promotoraId, input.promotoraId));
        if (input?.loja) conditions.push(eq(lancamentos.loja, input.loja));
        if (input?.dataCadastro) conditions.push(eq(lancamentos.dataCadastro, input.dataCadastro));
        if (input?.nomeCliente) conditions.push(like(lancamentos.nomeCliente, `%${input.nomeCliente}%`));

        const results = conditions.length > 0
          ? await db.select().from(lancamentos).where(and(...conditions)).orderBy(desc(lancamentos.createdAt))
          : await db.select().from(lancamentos).orderBy(desc(lancamentos.createdAt));

        const promotoraIds = Array.from(new Set(results.map((r) => r.promotoraId)));
        const promotorasData = promotoraIds.length > 0
          ? await db.select().from(promotoras).where(sql`${promotoras.id} IN (${sql.join(promotoraIds.map((id) => sql`${id}`), sql`, `)})`)
          : [];
        const promotoraMap = new Map(promotorasData.map((p) => [p.id, p]));

        return results.map((r) => ({
          ...r,
          promotoraNome: promotoraMap.get(r.promotoraId)?.nome || "Desconhecida",
          promotoraLoja: promotoraMap.get(r.promotoraId)?.loja || "",
        }));
      }),

    create: publicProcedure
      .input(z.object({
        promotoraId: z.number(),
        nomeCliente: z.string().min(1),
        cpfCliente: z.string().min(11),
        dataCadastro: z.string(),
        loja: z.string(),
        senha: z.string(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const promotora = await db.select().from(promotoras).where(eq(promotoras.id, input.promotoraId)).limit(1);
        if (promotora.length === 0) throw new Error("Promotora não encontrada");
        if (promotora[0].senha !== input.senha) throw new Error("Senha incorreta");
        if (promotora[0].ativa !== 1) throw new Error("Promotora inativa");
        await db.insert(lancamentos).values({
          promotoraId: input.promotoraId,
          nomeCliente: input.nomeCliente,
          cpfCliente: input.cpfCliente,
          dataCadastro: input.dataCadastro,
          loja: input.loja,
        });
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number(), senha: z.string() }))
      .mutation(async ({ input }) => {
        const adminPassword = ENV.adminDeletePassword;
        if (!adminPassword || input.senha !== adminPassword) {
          throw new Error("Senha de administrador incorreta");
        }
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db.delete(lancamentos).where(eq(lancamentos.id, input.id));
        return { success: true };
      }),

    stats: publicProcedure
      .input(z.object({
        loja: z.string().optional(),
        promotoraId: z.number().optional(),
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { porDia: [], porSemana: [], porMes: [], porDiaSemana: [], ranking: [], total: 0, meta: null as any };

        // Build conditions for lancamentos
        const conditions = [];
        if (input?.loja) conditions.push(eq(lancamentos.loja, input.loja));
        if (input?.promotoraId) conditions.push(eq(lancamentos.promotoraId, input.promotoraId));
        if (input?.dataInicio) conditions.push(gte(lancamentos.dataCadastro, input.dataInicio));
        if (input?.dataFim) conditions.push(lte(lancamentos.dataCadastro, input.dataFim));

        const allLancamentos = conditions.length > 0
          ? await db.select().from(lancamentos).where(and(...conditions)).orderBy(asc(lancamentos.dataCadastro))
          : await db.select().from(lancamentos).orderBy(asc(lancamentos.dataCadastro));

        // Find active meta for the period
        let activeMeta: any = null;
        let metaPromoMap = new Map<number, number>();
        if (input?.dataInicio && input?.dataFim) {
          const metaResults = await db.select().from(metas)
            .where(and(lte(metas.dataInicio, input.dataFim), gte(metas.dataFim, input.dataInicio)))
            .orderBy(desc(metas.createdAt)).limit(1);
          if (metaResults.length > 0) {
            activeMeta = metaResults[0];
            const metaPromos = await db.select().from(metaPromotoras).where(eq(metaPromotoras.metaId, activeMeta.id));
            metaPromos.forEach((mp) => metaPromoMap.set(mp.promotoraId, mp.metaIndividual));
          }
        } else {
          // Try to find current active meta
          const today = new Date().toISOString().split("T")[0];
          const metaResults = await db.select().from(metas)
            .where(and(lte(metas.dataInicio, today), gte(metas.dataFim, today)))
            .orderBy(desc(metas.createdAt)).limit(1);
          if (metaResults.length > 0) {
            activeMeta = metaResults[0];
            const metaPromos = await db.select().from(metaPromotoras).where(eq(metaPromotoras.metaId, activeMeta.id));
            metaPromos.forEach((mp) => metaPromoMap.set(mp.promotoraId, mp.metaIndividual));
          }
        }

        // Calculate business days in meta period for daily meta
        let diasUteis = 0;
        if (activeMeta) {
          const start = new Date(activeMeta.dataInicio + "T00:00:00");
          const end = new Date(activeMeta.dataFim + "T00:00:00");
          const d = new Date(start);
          while (d <= end) {
            const dow = d.getDay();
            if (dow !== 0 && dow !== 6) diasUteis++;
            d.setDate(d.getDate() + 1);
          }
        }

        // Per day stats
        const porDiaMap = new Map<string, number>();
        allLancamentos.forEach((l) => {
          porDiaMap.set(l.dataCadastro, (porDiaMap.get(l.dataCadastro) || 0) + 1);
        });
        const porDia = Array.from(porDiaMap.entries())
          .map(([data, quantidade]) => ({ data, quantidade }))
          .sort((a, b) => a.data.localeCompare(b.data));

        // Per week stats
        const porSemanaMap = new Map<string, number>();
        allLancamentos.forEach((l) => {
          const parts = l.dataCadastro.split("-");
          if (parts.length === 3) {
            const weekNum = Math.ceil(parseInt(parts[2]) / 7);
            const key = `${parts[0]}-${parts[1]}-S${weekNum}`;
            porSemanaMap.set(key, (porSemanaMap.get(key) || 0) + 1);
          }
        });
        const porSemana = Array.from(porSemanaMap.entries())
          .map(([semana, quantidade]) => ({ semana, quantidade }))
          .sort((a, b) => a.semana.localeCompare(b.semana));

        // Per month stats
        const porMesMap = new Map<string, number>();
        allLancamentos.forEach((l) => {
          const parts = l.dataCadastro.split("-");
          if (parts.length >= 2) {
            const key = `${parts[0]}-${parts[1]}`;
            porMesMap.set(key, (porMesMap.get(key) || 0) + 1);
          }
        });
        const porMes = Array.from(porMesMap.entries())
          .map(([mes, quantidade]) => ({ mes, quantidade }))
          .sort((a, b) => a.mes.localeCompare(b.mes));

        // Per day of week stats (Seg, Ter, Qua, Qui, Sex, Sab, Dom)
        const DOW_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
        const porDiaSemanaMap = new Map<number, number>();
        allLancamentos.forEach((l) => {
          const d = new Date(l.dataCadastro + "T00:00:00");
          const dow = d.getDay();
          porDiaSemanaMap.set(dow, (porDiaSemanaMap.get(dow) || 0) + 1);
        });
        // Order: Seg(1), Ter(2), Qua(3), Qui(4), Sex(5), Sab(6), Dom(0)
        const dowOrder = [1, 2, 3, 4, 5, 6, 0];
        const porDiaSemana = dowOrder.map((dow) => ({
          dia: DOW_NAMES[dow],
          quantidade: porDiaSemanaMap.get(dow) || 0,
        }));

        // Ranking with individual metas
        const rankingMap = new Map<number, number>();
        allLancamentos.forEach((l) => {
          rankingMap.set(l.promotoraId, (rankingMap.get(l.promotoraId) || 0) + 1);
        });

        const promotoraIds = Array.from(rankingMap.keys());
        // Also include promotoras that have meta but no lancamentos
        const allMetaPromoIds = Array.from(metaPromoMap.keys());
        const allIds = Array.from(new Set([...promotoraIds, ...allMetaPromoIds]));

        const promotorasData = allIds.length > 0
          ? await db.select().from(promotoras).where(sql`${promotoras.id} IN (${sql.join(allIds.map((id) => sql`${id}`), sql`, `)})`)
          : [];
        const promotoraMapData = new Map(promotorasData.map((p) => [p.id, p]));

        const ranking = allIds.map((promotoraId) => {
          const quantidade = rankingMap.get(promotoraId) || 0;
          const metaIndividual = metaPromoMap.get(promotoraId) || (activeMeta ? activeMeta.metaMensal : 0);
          const percentualMeta = metaIndividual > 0 ? Math.round((quantidade / metaIndividual) * 100) : 0;
          return {
            promotoraId,
            nome: promotoraMapData.get(promotoraId)?.nome || "Desconhecida",
            loja: promotoraMapData.get(promotoraId)?.loja || "",
            quantidade,
            meta: metaIndividual,
            percentualMeta,
          };
        }).sort((a, b) => b.quantidade - a.quantidade);

        // Fetch atendimentos for the same period
        const atendConditions = [];
        if (input?.loja) atendConditions.push(eq(atendimentos.loja, input.loja));
        if (input?.promotoraId) atendConditions.push(eq(atendimentos.promotoraId, input.promotoraId));
        if (input?.dataInicio) atendConditions.push(gte(atendimentos.data, input.dataInicio));
        if (input?.dataFim) atendConditions.push(lte(atendimentos.data, input.dataFim));
        const allAtendimentos = atendConditions.length > 0
          ? await db.select().from(atendimentos).where(and(...atendConditions))
          : await db.select().from(atendimentos);
        const totalAtendimentos = allAtendimentos.reduce((s, a) => s + a.quantidade, 0);
        const taxaConversao = totalAtendimentos > 0 ? Math.round((allLancamentos.length / totalAtendimentos) * 10000) / 100 : 0;

        // Atendimentos per promotora for conversion rate
        const atendPorPromoMap = new Map<number, number>();
        allAtendimentos.forEach((a) => {
          atendPorPromoMap.set(a.promotoraId, (atendPorPromoMap.get(a.promotoraId) || 0) + a.quantidade);
        });

        // Add conversion to ranking
        const rankingWithConversion = ranking.map((r) => {
          const atend = atendPorPromoMap.get(r.promotoraId) || 0;
          const conv = atend > 0 ? Math.round((r.quantidade / atend) * 10000) / 100 : 0;
          return { ...r, atendimentos: atend, taxaConversao: conv };
        });

        // Per loja stats
        const porLojaMap = new Map<string, number>();
        allLancamentos.forEach((l) => {
          porLojaMap.set(l.loja, (porLojaMap.get(l.loja) || 0) + 1);
        });
        const porLoja = Array.from(porLojaMap.entries()).map(([loja, quantidade]) => {
          const pctTotal = allLancamentos.length > 0 ? Math.round((quantidade / allLancamentos.length) * 10000) / 100 : 0;
          const pctMeta = activeMeta ? Math.round((quantidade / activeMeta.metaMensal) * 10000) / 100 : 0;
          return { loja, quantidade, percentualTotal: pctTotal, percentualMeta: pctMeta };
        }).sort((a, b) => b.quantidade - a.quantidade);

        // Acompanhamento: dias atingidos vs não atingidos por promotora
        const acompanhamento: any[] = [];
        if (activeMeta && diasUteis > 0) {
          const today = new Date().toISOString().split("T")[0];
          // Get all business days in meta period up to today
          const metaStart = new Date(activeMeta.dataInicio + "T00:00:00");
          const metaEnd = new Date(activeMeta.dataFim + "T00:00:00");
          const todayDate = new Date(today + "T00:00:00");
          const endDate = todayDate < metaEnd ? todayDate : metaEnd;
          const businessDays: string[] = [];
          const bd = new Date(metaStart);
          while (bd <= endDate) {
            const dow = bd.getDay();
            if (dow !== 0 && dow !== 6) {
              businessDays.push(bd.toISOString().split("T")[0]);
            }
            bd.setDate(bd.getDate() + 1);
          }
          const diasPassados = businessDays.length;

          // For each promotora with meta, count days where they met their daily target
          for (const promId of allIds) {
            const metaInd = metaPromoMap.get(promId) || 0;
            if (metaInd <= 0) continue;
            const metaDiariaInd = metaInd / diasUteis;
            // Count lancamentos per day for this promotora
            const lancPorDia = new Map<string, number>();
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
              percentualMeta: metaInd > 0 ? Math.round((totalRealizados / metaInd) * 100) : 0,
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
            metaDiaria: diasUteis > 0 ? Math.round((activeMeta.metaMensal / diasUteis) * 100) / 100 : 0,
          } : null,
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
    }),
  }),

  atendimento: router({
    list: publicProcedure
      .input(z.object({
        promotoraId: z.number().optional(),
        loja: z.string().optional(),
        data: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const conditions = [];
        if (input?.promotoraId) conditions.push(eq(atendimentos.promotoraId, input.promotoraId));
        if (input?.loja) conditions.push(eq(atendimentos.loja, input.loja));
        if (input?.data) conditions.push(eq(atendimentos.data, input.data));
        const results = conditions.length > 0
          ? await db.select().from(atendimentos).where(and(...conditions)).orderBy(desc(atendimentos.data))
          : await db.select().from(atendimentos).orderBy(desc(atendimentos.data));
        const promoIds = Array.from(new Set(results.map((r) => r.promotoraId)));
        const promotorasData = promoIds.length > 0
          ? await db.select().from(promotoras).where(sql`${promotoras.id} IN (${sql.join(promoIds.map((id) => sql`${id}`), sql`, `)})`)
          : [];
        const promoMap = new Map(promotorasData.map((p) => [p.id, p]));
        return results.map((r) => ({
          ...r,
          promotoraNome: promoMap.get(r.promotoraId)?.nome || "Desconhecida",
        }));
      }),

    create: publicProcedure
      .input(z.object({
        promotoraId: z.number(),
        data: z.string(),
        quantidade: z.number().min(1),
        senha: z.string(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const promotora = await db.select().from(promotoras).where(eq(promotoras.id, input.promotoraId)).limit(1);
        if (promotora.length === 0) throw new Error("Promotora não encontrada");
        if (promotora[0].senha !== input.senha) throw new Error("Senha incorreta");
        if (promotora[0].ativa !== 1) throw new Error("Promotora inativa");
        await db.insert(atendimentos).values({
          promotoraId: input.promotoraId,
          data: input.data,
          quantidade: input.quantidade,
          loja: promotora[0].loja,
        });
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number(), senha: z.string() }))
      .mutation(async ({ input }) => {
        const adminPassword = ENV.adminDeletePassword;
        if (!adminPassword || input.senha !== adminPassword) {
          throw new Error("Senha de administrador incorreta");
        }
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db.delete(atendimentos).where(eq(atendimentos.id, input.id));
        return { success: true };
      }),
  }),

  meta: router({
    current: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return null;
      const today = new Date().toISOString().split("T")[0];
      const results = await db.select().from(metas)
        .where(and(lte(metas.dataInicio, today), gte(metas.dataFim, today)))
        .orderBy(desc(metas.createdAt)).limit(1);
      if (results.length === 0) return null;
      return { dataInicio: results[0].dataInicio, dataFim: results[0].dataFim, nome: results[0].nome };
    }),

    list: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const metasList = await db.select().from(metas).orderBy(desc(metas.dataInicio));
      // For each meta, get the promotora assignments
      const result = [];
      for (const m of metasList) {
        const assignments = await db.select().from(metaPromotoras).where(eq(metaPromotoras.metaId, m.id));
        // Get promotora names
        const promoIds = assignments.map((a) => a.promotoraId);
        const promoData = promoIds.length > 0
          ? await db.select().from(promotoras).where(sql`${promotoras.id} IN (${sql.join(promoIds.map((id) => sql`${id}`), sql`, `)})`)
          : [];
        const promoMap = new Map(promoData.map((p) => [p.id, p]));

        // Calculate business days
        let diasUteis = 0;
        const start = new Date(m.dataInicio + "T00:00:00");
        const end = new Date(m.dataFim + "T00:00:00");
        const d = new Date(start);
        while (d <= end) {
          const dow = d.getDay();
          if (dow !== 0 && dow !== 6) diasUteis++;
          d.setDate(d.getDate() + 1);
        }

        result.push({
          ...m,
          diasUteis,
          metaDiaria: diasUteis > 0 ? Math.round((m.metaMensal / diasUteis) * 100) / 100 : 0,
          promotoras: assignments.map((a) => ({
            promotoraId: a.promotoraId,
            nome: promoMap.get(a.promotoraId)?.nome || "Desconhecida",
            loja: promoMap.get(a.promotoraId)?.loja || "",
            metaIndividual: a.metaIndividual,
          })),
        });
      }
      return result;
    }),

    create: publicProcedure
      .input(z.object({
        nome: z.string().min(1),
        metaMensal: z.number().min(1),
        dataInicio: z.string(),
        dataFim: z.string(),
        senha: z.string(),
        promotoras: z.array(z.object({
          promotoraId: z.number(),
          metaIndividual: z.number().min(0),
        })),
      }))
      .mutation(async ({ input }) => {
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
          dataFim: input.dataFim,
        }).$returningId();
        const metaId = inserted.id;
        if (input.promotoras.length > 0) {
          await db.insert(metaPromotoras).values(
            input.promotoras.map((p) => ({
              metaId,
              promotoraId: p.promotoraId,
              metaIndividual: p.metaIndividual,
            }))
          );
        }
        return { success: true, id: metaId };
      }),

    update: publicProcedure
      .input(z.object({
        id: z.number(),
        nome: z.string().min(1),
        metaMensal: z.number().min(1),
        dataInicio: z.string(),
        dataFim: z.string(),
        senha: z.string(),
        promotoras: z.array(z.object({
          promotoraId: z.number(),
          metaIndividual: z.number().min(0),
        })),
      }))
      .mutation(async ({ input }) => {
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
          dataFim: input.dataFim,
        }).where(eq(metas.id, input.id));
        // Delete old assignments and re-insert
        await db.delete(metaPromotoras).where(eq(metaPromotoras.metaId, input.id));
        if (input.promotoras.length > 0) {
          await db.insert(metaPromotoras).values(
            input.promotoras.map((p) => ({
              metaId: input.id,
              promotoraId: p.promotoraId,
              metaIndividual: p.metaIndividual,
            }))
          );
        }
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number(), senha: z.string() }))
      .mutation(async ({ input }) => {
        const adminPassword = ENV.adminDeletePassword;
        if (!adminPassword || input.senha !== adminPassword) {
          throw new Error("Senha de administrador incorreta");
        }
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db.delete(metaPromotoras).where(eq(metaPromotoras.metaId, input.id));
        await db.delete(metas).where(eq(metas.id, input.id));
        return { success: true };
      }),
  }),

  mercafacil: router({
    // Total geral de cadastros na base Mercafacil a partir de 01/02/2026
    totalGeral: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { total: 0 };
      const DATA_REF = "2026-02-01";
      const result = await db.select({ count: sql<number>`count(*)` })
        .from(cadastroBaseMercafacil)
        .where(gte(cadastroBaseMercafacil.dataCriacao, new Date(DATA_REF + "T00:00:00")));
      return { total: Number(result[0]?.count || 0) };
    }),

    // Cruzamento de CPFs: lançamentos das promotoras vs base Mercafacil
    cruzamento: publicProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
        loja: z.string().optional(),
        promotoraId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return {
          totalMercafacil: 0,
          totalPromotoras: 0,
          cadastradosViaPromotoras: 0,
          cadastradosPorFora: 0,
          percentualCRM: 0,
          naoEncontradosNaBase: 0,
        };

        const DATA_REF = "2026-02-01";

        // Get lancamentos CPFs with filters
        const lancConditions = [];
        if (input?.loja) lancConditions.push(eq(lancamentos.loja, input.loja));
        if (input?.promotoraId) lancConditions.push(eq(lancamentos.promotoraId, input.promotoraId));
        if (input?.dataInicio) lancConditions.push(gte(lancamentos.dataCadastro, input.dataInicio));
        if (input?.dataFim) lancConditions.push(lte(lancamentos.dataCadastro, input.dataFim));

        const allLanc = lancConditions.length > 0
          ? await db.select({ cpf: lancamentos.cpfCliente }).from(lancamentos).where(and(...lancConditions))
          : await db.select({ cpf: lancamentos.cpfCliente }).from(lancamentos);

        // Normalize CPFs from lancamentos (remove dots and dashes)
        const lancCpfs = new Set(allLanc.map(l => l.cpf.replace(/[^\d]/g, '')));

        // Get Mercafacil CPFs from the reference date
        const mercaRecords = await db.select({ cpf: cadastroBaseMercafacil.cpfCnpj })
          .from(cadastroBaseMercafacil)
          .where(gte(cadastroBaseMercafacil.dataCriacao, new Date(DATA_REF + "T00:00:00")));

        const mercaCpfs = new Set(mercaRecords.map(m => m.cpf.replace(/[^\d]/g, '')));

        // Cruzamento
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
        const percentualCRM = mercaCpfs.size > 0
          ? Math.round((cadastradosViaPromotoras / mercaCpfs.size) * 10000) / 100
          : 0;

        return {
          totalMercafacil: mercaCpfs.size,
          totalPromotoras: lancCpfs.size,
          cadastradosViaPromotoras,
          cadastradosPorFora: Math.max(0, cadastradosPorFora),
          percentualCRM,
          naoEncontradosNaBase,
        };
      }),

    // Status da última sincronização
    syncStatus: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { lastSync: null, totalRecords: 0 };
      const countResult = await db.select({ count: sql<number>`count(*)` }).from(cadastroBaseMercafacil);
      const lastResult = await db.select({ lastSync: sql<string>`MAX(syncedAt)` }).from(cadastroBaseMercafacil);
      return {
        totalRecords: Number(countResult[0]?.count || 0),
        lastSync: lastResult[0]?.lastSync || null,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
