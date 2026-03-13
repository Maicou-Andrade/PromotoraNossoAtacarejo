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
