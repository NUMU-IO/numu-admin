import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";

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
                "connect-src 'self' https://*.numu.store https://*.sentry.io https://*.ingest.sentry.io",
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

export default defineConfig(({ mode }) => ({
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
        target: "http://localhost:8021",
        changeOrigin: true,
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

          // Browser → Backend: rename cookies back in Cookie header
          proxy.on("proxyReq", (proxyReq, req) => {
            const cookie = req.headers.cookie;
            if (cookie) {
              let rewritten = cookie;
              for (const [from, to] of RENAMES) {
                rewritten = rewritten.replaceAll(to, from);
              }
              proxyReq.setHeader("cookie", rewritten);
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
}));
