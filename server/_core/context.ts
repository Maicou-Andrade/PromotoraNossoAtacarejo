import type { Request, Response } from "express";

export interface TrpcContext {
  req: Request;
  res: Response;
  user: { id: number; openId: string; role: string; name?: string | null; email?: string | null } | null;
}

export async function createContext({ req, res }: { req: Request; res: Response }): Promise<TrpcContext> {
  return { req, res, user: null };
}
