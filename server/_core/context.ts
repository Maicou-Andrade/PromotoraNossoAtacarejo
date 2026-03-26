import type { Request, Response } from "express";
import { jwtVerify } from "jose";
import { ENV } from "./env";
import { COOKIE_NAME } from "../../shared/const";

export interface TrpcContext {
  req: Request;
  res: Response;
  user: { id: number; openId: string; role: string; name?: string | null; email?: string | null } | null;
}

export async function createContext({ req, res }: { req: Request; res: Response }): Promise<TrpcContext> {
  try {
    const rawCookies = req.headers.cookie ?? "";
    const cookies: Record<string, string> = {};
    rawCookies.split(";").forEach((c) => {
      const [k, ...v] = c.trim().split("=");
      if (k) cookies[k.trim()] = decodeURIComponent(v.join("="));
    });

    const token = cookies[COOKIE_NAME];
    if (!token) return { req, res, user: null };

    const secret = new TextEncoder().encode(ENV.cookieSecret || "fallback-secret-change-me");
    const { payload } = await jwtVerify(token, secret);

    const user = {
      id: payload.id as number,
      openId: payload.openId as string,
      role: payload.role as string,
      name: payload.name as string | null,
      email: payload.email as string | null,
    };

    return { req, res, user };
  } catch {
    return { req, res, user: null };
  }
}
