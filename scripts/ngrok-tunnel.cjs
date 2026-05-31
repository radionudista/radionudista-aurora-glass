/**
 * Public HTTP tunnel to local Vite (default port 8080).
 * npm run dev:tunnel
 *
 * Usa ngrok como único proveedor soportado.
 * Forzar proveedor: TUNNEL_PROVIDER=ngrok
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const dotenv = require("dotenv");

function loadEnvIfExists(relPath) {
  const p = path.resolve(process.cwd(), relPath);
  if (fs.existsSync(p)) {
    dotenv.config({ path: p, override: true });
  }
}

loadEnvIfExists(".env");
loadEnvIfExists(".env.local");
loadEnvIfExists(".env.development");
loadEnvIfExists(".env.development.local");

const port = Number(process.env.NGROK_LOCAL_PORT || 8080);
const token = (process.env.NGROK_AUTHTOKEN || "").trim();
const forced = (process.env.TUNNEL_PROVIDER || "").trim().toLowerCase();
let ngrokProcess = null;

function ngrokConfigExists() {
  const h = os.homedir();
  if (process.platform === "win32") {
    const p = path.join(process.env.LOCALAPPDATA || "", "ngrok", "ngrok.yml");
    return Boolean(p && fs.existsSync(p));
  }
  return (
    fs.existsSync(path.join(h, ".config", "ngrok", "ngrok.yml")) ||
    fs.existsSync(path.join(h, ".ngrok2", "ngrok.yml"))
  );
}

async function shutdown() {
  if (ngrokProcess && !ngrokProcess.killed) {
    ngrokProcess.kill("SIGTERM");
  }
  process.exit(0);
}

(async () => {
  if (forced && forced !== "ngrok") {
    console.error("TUNNEL_PROVIDER debe ser ngrok. localtunnel ya no está soportado.");
    process.exit(1);
  }

  const wantNgrok =
    forced === "ngrok" || token.length > 0 || ngrokConfigExists();

  if (!wantNgrok) {
    console.error("Configura NGROK_AUTHTOKEN o ngrok.yml antes de usar npm run dev:tunnel.");
    process.exit(1);
  }

  const args = ["--yes", "ngrok", "http", String(port)];
  if (token) args.push(`--authtoken=${token}`);

  console.log(`Abriendo ngrok hacia http://127.0.0.1:${port} ...`);
  ngrokProcess = spawn("npx", args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  ngrokProcess.on("exit", (code) => {
    process.exit(code ?? 0);
  });
})();

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
