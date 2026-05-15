import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";

/**
 * Injects Content-Security-Policy meta tag only in production builds.
 * In dev mode, Vite's HMR requires inline scripts which CSP would block.
 */
function vitePluginCSP(): Plugin {
  return {
    name: "numu-csp",
    transformIndexHtml(html, ctx) {
      if (ctx.server) return html; // skip in dev
      return {
        html,
        tags: [
          {
            tag: "meta",
            attrs: {
              "http-equiv": "Content-Security-Policy",
              content: [
                "default-src 'self'",
                "script-src 'self'",
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                "font-src 'self' https://fonts.gstatic.com",
                "img-src 'self' data: blob: https:",
                "connect-src 'self' https://numueg.app https://*.numueg.app https://*.numu.store https://*.sentry.io https://*.ingest.sentry.io",
                "worker-src 'self' blob:",
              ].join("; ") + ";",
            },
            injectTo: "head",
          },
        ],
      };
    },
  };
}

export default defineConfig(({ mode }) => {
  // Load env from .env / .env.local / .env.<mode> with no prefix filter
  // so non-`VITE_` vars (like NUMU_API_PROXY_TARGET, used by the dev
  // server's proxy below) are available in the config. Without this,
  // `process.env.X` only sees vars set in the shell at Vite start
  // time — `.env.local` is silently ignored, leaving the proxy stuck
  // on its production default.
  const env = loadEnv(mode, path.resolve(import.meta.dirname), "");
  const apiProxyTarget = env.NUMU_API_PROXY_TARGET || "https://numueg.app";

  return ({
  plugins: [react(), tailwindcss(), vitePluginCSP()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port: 5000,
    host: true,
    allowedHosts: [
      "localhost",
      "127.0.0.1",
    ],
    proxy: {
      "/api": {
        // Override with NUMU_API_PROXY_TARGET in .env.local for local dev
        // (e.g. NUMU_API_PROXY_TARGET=http://localhost:8021). Defaults to
        // production so a fresh checkout works against staging without
        // any local API running. Read via loadEnv() above (Vite doesn't
        // auto-populate non-`VITE_` vars into process.env).
        target: apiProxyTarget,
        changeOrigin: true,
        cookieDomainRewrite: "",
        secure: false,
        configure: (proxy) => {
          // Rename auth cookies so admin and merchant dashboard
          // don't share sessions (both run on localhost in dev).
          const RENAMES: [string, string][] = [
            ["access_token", "admin_access_token"],
            ["refresh_token", "admin_refresh_token"],
            ["csrf_token", "admin_csrf_token"],
          ];

          // Backend → Browser: rename cookies in Set-Cookie headers
          proxy.on("proxyRes", (proxyRes) => {
            const sc = proxyRes.headers["set-cookie"];
            if (sc) {
              proxyRes.headers["set-cookie"] = sc.map((c: string) => {
                for (const [from, to] of RENAMES) {
                  if (c.startsWith(`${from}=`)) {
                    return `${to}${c.slice(from.length)}`;
                  }
                }
                return c;
              });
            }
          });

          // Browser → Backend: rename admin cookies back and strip
          // the merchant dashboard's original cookies so they don't collide.
          proxy.on("proxyReq", (proxyReq, req) => {
            const cookie = req.headers.cookie;
            if (cookie) {
              const pairs = cookie.split(";").map((p) => p.trim());
              const origNames = new Set(RENAMES.map(([from]) => from));
              const filtered = pairs
                .filter((p) => {
                  // Drop the merchant dashboard's plain cookies
                  const name = p.split("=")[0];
                  return !origNames.has(name);
                })
                .map((p) => {
                  // Rename admin_* back to original names
                  for (const [from, to] of RENAMES) {
                    if (p.startsWith(`${to}=`)) {
                      return `${from}${p.slice(to.length)}`;
                    }
                  }
                  return p;
                });
              proxyReq.setHeader("cookie", filtered.join("; "));
            }
          });
        },
      },
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  esbuild: {
    drop: mode === "production" ? ["debugger"] : [],
    pure: mode === "production" ? ["console.log", "console.debug", "console.info"] : [],
  },
  });
});
