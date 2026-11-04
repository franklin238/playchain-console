import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Connect, type Plugin } from "vite";
import { consoleSecurityHeaders, GAME_HEADERS } from "./src/security/csp.ts";

/** Console pages get the strict policy; /games/* gets a policy that lets the console frame them. */
function securityHeaders(): Plugin {
  const mw =
    (dev: boolean): Connect.NextHandleFunction =>
    (req, res, next) => {
      const extraConnect = process.env.PCF_E2E_RPC ? [process.env.PCF_E2E_RPC] : [];
      const h = req.url?.startsWith("/games/") ? GAME_HEADERS : consoleSecurityHeaders({ dev, extraConnect });
      for (const [k, v] of Object.entries(h)) res.setHeader(k, v);
      next();
    };
  return {
    name: "pcf-security-headers",
    configureServer: (s) => void s.middlewares.use(mw(true)),
    configurePreviewServer: (s) => void s.middlewares.use(mw(false)),
  };
}

export default defineConfig(() => ({
  plugins: [react(), tailwindcss(), securityHeaders()],
  server: { port: 5173 },
  preview: { port: 4949 },
  build: { target: "es2022", sourcemap: false },
}));
