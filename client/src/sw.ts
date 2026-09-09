/// <reference lib="webworker" />
/**
 * NUMU Admin Backoffice — service worker.
 *
 * ─── THE ONE RULE ────────────────────────────────────────────────────────────
 * NOTHING under /api/ may EVER enter a cache. This console reads and writes
 * every merchant on the platform, so a cached authenticated response is not a
 * stale-data bug, it is a data leak: the Cache API keys entries by URL and
 * ignores auth, so a response fetched under one operator's session would be
 * replayed to whoever opens the browser next. Shared laptops are the norm in
 * an ops room.
 *
 * The NetworkOnly route is registered FIRST so no later route can shadow it.
 * Do not add a cache rule that matches /api/, for any reason, including "just
 * temporarily".
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Strategy: injectManifest. The precache list lives in vite.config.ts and is
 * an allowlist — the shell only, never every route chunk.
 */
import { precacheAndRoute, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute, setCatchHandler, NavigationRoute } from "workbox-routing";
import { NetworkOnly, CacheFirst, StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

/**
 * Prefix for every RUNTIME cache this worker creates, so sign-out can find
 * them again.
 *
 * Deliberately does NOT cover Workbox's precache (`workbox-precache-v2-*`),
 * whose name is not ours to choose. That is correct: it holds the shell only
 * — JS, CSS, index.html, offline.html — with no API responses in it, and
 * dropping it on sign-out would take the offline page with it.
 */
const CACHE_PREFIX = "numu-admin-";
const OFFLINE_URL = "/offline.html";

// ─── 1. Precache the app shell ───────────────────────────────────────────────
precacheAndRoute(self.__WB_MANIFEST);

// ─── 2. /api/ — NetworkOnly. REGISTERED FIRST, ON PURPOSE. ───────────────────
registerRoute(
  ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/api/"),
  new NetworkOnly(),
);

// ─── 3. Navigations → the precached app shell ────────────────────────────────
// The denylist keeps /api/ out of the SPA fallback: an API request answered
// with index.html produces far more confusing bugs than a network error.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("/index.html"), {
    denylist: [/^\/api\//],
  }),
);

// ─── 4. Runtime caching ──────────────────────────────────────────────────────

// Hashed route chunks — content-hashed filenames are immutable, so CacheFirst
// is safe and makes a repeat visit instant on a phone.
registerRoute(
  ({ url, request, sameOrigin }) =>
    sameOrigin &&
    url.pathname.startsWith("/assets/") &&
    (request.destination === "script" || request.destination === "style"),
  new CacheFirst({
    cacheName: `${CACHE_PREFIX}chunks`,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 120, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  }),
);

// Google Fonts stylesheet — can change, so revalidate in the background.
registerRoute(
  ({ url }) => url.origin === "https://fonts.googleapis.com",
  new StaleWhileRevalidate({
    cacheName: `${CACHE_PREFIX}gfonts-css`,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 7 * 24 * 60 * 60 }),
    ],
  }),
);

// Google Fonts files — immutable, cache hard.
registerRoute(
  ({ url }) => url.origin === "https://fonts.gstatic.com",
  new CacheFirst({
    cacheName: `${CACHE_PREFIX}gfonts`,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 }),
    ],
  }),
);

// Own-origin images: the brand art and the design-system illustrations.
registerRoute(
  ({ url, request, sameOrigin }) =>
    sameOrigin && request.destination === "image" && !url.pathname.startsWith("/api/"),
  new CacheFirst({
    cacheName: `${CACHE_PREFIX}img`,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  }),
);

// ─── 5. Offline fallback ─────────────────────────────────────────────────────
// Navigations only. A failed API call must fail honestly so the app's own
// error handling runs.
setCatchHandler(async ({ request }) => {
  if (request.mode === "navigate") {
    const cached = await caches.match(OFFLINE_URL, { ignoreSearch: true });
    if (cached) return cached;
  }
  return Response.error();
});

// ─── 6. Messages from the page ───────────────────────────────────────────────
self.addEventListener("message", (event) => {
  const type = (event.data as { type?: string } | undefined)?.type;

  // Sent by the update banner when the operator taps "Reload". skipWaiting is
  // called ONLY here — activating silently would drop the old precache while
  // someone is mid-review and break their next lazy-loaded route.
  if (type === "SKIP_WAITING") {
    void self.skipWaiting();
    return;
  }

  // Sent on sign-out. A signed-out machine must retain no application state.
  if (type === "PURGE_CACHES") {
    event.waitUntil(
      (async () => {
        const names = await caches.keys();
        await Promise.all(
          names.filter((n) => n.startsWith(CACHE_PREFIX)).map((n) => caches.delete(n)),
        );
        event.ports?.[0]?.postMessage({ type: "PURGE_CACHES_DONE" });
      })(),
    );
  }
});

// ─── 7. Push ─────────────────────────────────────────────────────────────────
// These handlers introduce NO cache rule. The /api/ NetworkOnly guarantee
// above is absolute and nothing here touches it.

interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
  locale?: string;
  dir?: "rtl" | "ltr" | "auto";
  /** Someone is blocked and waiting on us. */
  important?: boolean;
}

self.addEventListener("push", (event) => {
  // A malformed payload must never throw: an uncaught error here kills the
  // worker, taking offline support and every future push with it.
  let data: PushPayload = {};
  try {
    data = (event.data?.json() as PushPayload) ?? {};
  } catch {
    data = {};
  }

  const title = data.title || "NUMU Admin";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body ?? "",
      icon: "/pwa/icon-192.png",
      // Monochrome silhouette; Android renders it in the status bar.
      badge: "/pwa/badge-72.png",
      // Collapses duplicates at the OS level, which is what makes a Celery
      // retry safe — it replaces the notification instead of stacking a
      // second one.
      tag: data.tag,
      dir: data.dir ?? "auto",
      lang: data.locale ?? "en",
      data: { url: data.url || "/" },
      // `renotify` is in the Notifications spec and implemented by browsers,
      // but missing from TypeScript's NotificationOptions. Without it a
      // replaced notification updates silently, so the second item in a queue
      // would arrive with no buzz at all.
      ...({
        renotify: Boolean(data.tag),
        silent: false,
        vibrate: data.important ? [300, 100, 300, 100, 300] : [200, 100, 200],
        requireInteraction: Boolean(data.important),
      } as Record<string, unknown>),
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data as { url?: string } | undefined)?.url || "/";

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Focus an EXISTING window and navigate it. Tapping five queue alerts
      // should leave one window on the fifth queue, not five windows.
      for (const client of windows) {
        if (client.url.startsWith(self.registration.scope)) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(target);
            } catch {
              /* navigation blocked — the focus still helped */
            }
          }
          return;
        }
      }

      await self.clients.openWindow(target);
    })(),
  );
});
