import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("meta router", () => {
  it("meta.list returns an array", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.meta.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("meta.current returns null or object with dataInicio/dataFim", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.meta.current();
    if (result !== null) {
      expect(result).toHaveProperty("dataInicio");
      expect(result).toHaveProperty("dataFim");
      expect(result).toHaveProperty("nome");
      expect(typeof result.dataInicio).toBe("string");
      expect(typeof result.dataFim).toBe("string");
    } else {
      expect(result).toBeNull();
    }
  });
});

describe("lancamento router", () => {
  it("lancamento.list returns an array", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.lancamento.list({});
    expect(Array.isArray(result)).toBe(true);
  });

  it("lancamento.stats returns expected shape", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.lancamento.stats({});
    expect(result).toHaveProperty("porDia");
    expect(result).toHaveProperty("porSemana");
    expect(result).toHaveProperty("porMes");
    expect(result).toHaveProperty("porDiaSemana");
    expect(result).toHaveProperty("ranking");
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("meta");
    expect(Array.isArray(result.porDia)).toBe(true);
    expect(Array.isArray(result.porSemana)).toBe(true);
    expect(Array.isArray(result.porMes)).toBe(true);
    expect(Array.isArray(result.porDiaSemana)).toBe(true);
    expect(Array.isArray(result.ranking)).toBe(true);
    expect(typeof result.total).toBe("number");
  });

  it("lancamento.stats with date filters returns expected shape", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.lancamento.stats({
      dataInicio: "2026-02-01",
      dataFim: "2026-02-28",
    });
    expect(result).toHaveProperty("porDia");
    expect(result).toHaveProperty("ranking");
    expect(typeof result.total).toBe("number");
  });

  it("lancamento.distinctDates returns an array", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.lancamento.distinctDates();
    expect(Array.isArray(result)).toBe(true);
  });

  it("lancamento.distinctClientes returns an array", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.lancamento.distinctClientes();
    expect(Array.isArray(result)).toBe(true);
  });

  it("lancamento.delete rejects wrong admin password", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.lancamento.delete({ id: 999, senha: "wrong" })).rejects.toThrow("Senha de administrador incorreta");
  });

  it("lancamento.stats includes acompanhamento and porLoja", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.lancamento.stats({
      dataInicio: "2026-02-01",
      dataFim: "2026-02-28",
    });
    expect(result).toHaveProperty("acompanhamento");
    expect(result).toHaveProperty("porLoja");
    expect(result).toHaveProperty("totalAtendimentos");
    expect(result).toHaveProperty("taxaConversao");
    expect(Array.isArray(result.acompanhamento)).toBe(true);
    expect(Array.isArray(result.porLoja)).toBe(true);
    expect(typeof result.totalAtendimentos).toBe("number");
    expect(typeof result.taxaConversao).toBe("number");
  });
});

describe("atendimento router", () => {
  it("atendimento.list returns an array", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.atendimento.list({});
    expect(Array.isArray(result)).toBe(true);
  });

  it("atendimento.delete rejects wrong admin password", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.atendimento.delete({ id: 999, senha: "wrong" })).rejects.toThrow("Senha de administrador incorreta");
  });
});

describe("meta router - senha validation", () => {
  it("meta.create rejects wrong admin password", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.meta.create({
      nome: "Test",
      metaMensal: 80,
      dataInicio: "2026-03-01",
      dataFim: "2026-03-31",
      senha: "wrong",
      promotoras: [],
    })).rejects.toThrow("Senha de administrador incorreta");
  });

  it("meta.delete rejects wrong admin password", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.meta.delete({ id: 999, senha: "wrong" })).rejects.toThrow("Senha de administrador incorreta");
  });
});

describe("promotora router", () => {
  it("promotora.list returns an array", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.promotora.list({});
    expect(Array.isArray(result)).toBe(true);
  });

  it("promotora.list with apenasAtivas returns only active", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.promotora.list({ apenasAtivas: true });
    expect(Array.isArray(result)).toBe(true);
    result.forEach((p: any) => {
      expect(p.ativa).toBe(1);
    });
  });
});
