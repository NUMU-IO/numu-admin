import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

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

/**
 * Where the dev server proxies `/api` to.
 *
 * This used to be hardcoded to `https://numueg.app` — i.e. **production**.
 * Running `npm run dev` on this repo therefore pointed the whole admin
 * backoffice at the live platform: every list, every edit, and every
 * destructive action (suspend a capability platform-wide, approve a theme,
 * refund a purchase) executed against production data from `localhost:5000`,
 * with nothing in the UI saying so. There is no test/staging stack any more,
 * so an accidental prod write has no safety net.
 *
 * Default is the LOCAL API. Pointing at a remote host has to be a deliberate,
 * visible act — either `ADMIN_API_PROXY_TARGET=…` in the shell, or the same
 * key in `.env.local`.
 *
 * Prefer `127.0.0.1` over `localhost`: uvicorn binds IPv4 only, and Node
 * resolves `localhost` to `::1` first, which fails with ECONNREFUSED against
 * a server that is running perfectly well.
 */
const DEFAULT_API_PROXY_TARGET = "http://127.0.0.1:8001";

export default defineConfig(({ mode }) => {
  // `.env` files are not loaded into `process.env` for the config itself, so
  // read them explicitly. The empty prefix includes keys without `VITE_`.
  const env = loadEnv(mode, path.resolve(import.meta.dirname), "");
  const API_PROXY_TARGET =
    process.env.ADMIN_API_PROXY_TARGET ??
    env.ADMIN_API_PROXY_TARGET ??
    DEFAULT_API_PROXY_TARGET;

  return {
  plugins: [
    react(),
    tailwindcss(),
    vitePluginCSP(),
    VitePWA({
      // injectManifest, not generateSW: the worker needs an explicit
      // NetworkOnly deny on /api/, cache purging on sign-out, and the push
      // handlers. generateSW can host none of that. See client/src/sw.ts.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",

      // "prompt", NEVER "autoUpdate". The app lazy-loads its pages, so a
      // silent skipWaiting drops the old precache mid-session and an operator
      // reviewing a theme gets "Failed to fetch dynamically imported module"
      // instead of a page. With "prompt" the old worker keeps serving the old
      // chunks until the operator chooses to reload.
      registerType: "prompt",

      // Registered by hand in main.tsx after React mounts, so the worker
      // never competes with first paint.
      injectRegister: null,

      // The worker does not register in `vite dev`; it is exercised against
      // `npm run build && npm run preview`.
      devOptions: { enabled: false, type: "module" },

      injectManifest: {
        // ALLOWLIST the shell. A broad "**/*.{js,css,html}" glob would
        // precache every route chunk, which is an install cost paid by
        // someone who will only ever open two screens. The rest are runtime
        // cached by the CacheFirst rule in sw.ts — safe because the
        // filenames are content-hashed.
        globPatterns: ["index.html", "offline.html", "assets/index-*.{js,css}"],
        globIgnores: ["**/images/**", "**/__manus__/**"],
      },

      manifest: {
        id: "/",
        name: "NUMU Admin",
        short_name: "NUMU Admin",
        description:
          "The NUMU platform backoffice — merchant queues, payments and trust decisions.",
        // Free install attribution, and it distinguishes a launch from the
        // home screen from a bookmarked tab in the analytics.
        start_url: "/?source=pwa",
        scope: "/",
        display: "standalone",
        display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
        background_color: "#FAF6F0",
        // Navy 700 — the rail colour, so the phone's status bar continues the
        // rail rather than cutting a white band above it.
        theme_color: "#003366",
        // `orientation` is deliberately omitted: operators rotate to landscape
        // to read the order and reconciliation tables.
        lang: "en",
        dir: "ltr",
        categories: ["business", "productivity"],
        icons: [
          { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          // Separate file, not `purpose: "any maskable"`: a launcher that
          // crops to a circle would take the corners off the `any` art, and
          // this one is drawn inside Android's centre-80% safe zone.
          {
            src: "/pwa/maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
          { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
        ],
        // Straight to the two queues an operator opens on a phone. Anything
        // that needs a wide table is not a shortcut.
        shortcuts: [
          { name: "Trust & risk", url: "/trust-risk" },
          { name: "Support cases", url: "/support-cases" },
        ],
      },
    }),
  ],
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
    proxy: apiProxy(API_PROXY_TARGET),
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  // `vite preview` serves the PRODUCTION build, which is the only way to
  // exercise the service worker — it does not register in dev. Preview does
  // NOT inherit `server.proxy`, so without this every /api call 404s and the
  // worker can never be tested against a real session.
  preview: {
    port: 4173,
    proxy: apiProxy(API_PROXY_TARGET),
  },
  esbuild: {
    drop: mode === "production" ? ["debugger"] : [],
    pure: mode === "production" ? ["console.log", "console.debug", "console.info"] : [],
  },
  };
});

/**
 * The `/api` proxy, shared by `vite dev` and `vite preview`.
 *
 * The cookie renaming is the reason this is a function rather than an object:
 * both servers need identical behaviour, and a preview that authenticated
 * differently from dev would be testing something other than the app.
 */
function apiProxy(target: string) {
  return {
      "/api": {
        target,
        changeOrigin: true,
        cookieDomainRewrite: "",
        secure: false,
        configure: (proxy: any) => {
          // Rename auth cookies so admin and merchant dashboard
          // don't share sessions (both run on localhost in dev).
          const RENAMES: [string, string][] = [
            ["access_token", "admin_access_token"],
            ["refresh_token", "admin_refresh_token"],
            ["csrf_token", "admin_csrf_token"],
          ];

          // Backend → Browser: rename cookies in Set-Cookie headers
          proxy.on("proxyRes", (proxyRes: any) => {
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
          proxy.on("proxyReq", (proxyReq: any, req: any) => {
            const cookie: string | undefined = req.headers.cookie;
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
  };
}
