/**
 * Service-worker registration and the sign-out purge.
 *
 * Registered by hand after React mounts rather than by vite-plugin-pwa's
 * `injectRegister`, so worker installation never competes with first paint.
 * The worker itself is `client/src/sw.ts`.
 */

/** Called when a new worker is installed and waiting for permission to take over. */
type UpdateHandler = (activate: () => void) => void;

export function registerServiceWorker(onUpdate: UpdateHandler): void {
  // Dev has no worker: `devOptions.enabled` is false, so registering would
  // 404 and leave a broken registration behind that survives into the next
  // production visit.
  if (!import.meta.env.PROD) return;
  if (!("serviceWorker" in navigator)) return;

  void navigator.serviceWorker
    .register("/sw.js", { type: "module" })
    .then((reg) => {
      // Already waiting when the page loaded — the operator was away while a
      // deploy happened.
      if (reg.waiting) onUpdate(() => activate(reg));

      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          // `controller` is null on the very first install. Prompting then
          // would ask someone to reload a page that is already current.
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            onUpdate(() => activate(reg));
          }
        });
      });
    })
    .catch(() => {
      /* An unregistrable worker is not worth an error on screen. */
    });

  // The new worker calls clients.claim() implicitly on activation; reload once
  // so the page is served by it.
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
}

function activate(reg: ServiceWorkerRegistration): void {
  reg.waiting?.postMessage({ type: "SKIP_WAITING" });
}

/**
 * Drop every runtime cache on sign-out.
 *
 * SECURITY: a signed-out machine must retain no application state. Awaited by
 * the caller before it redirects — a shared ops laptop is the normal case.
 * Resolves either way: a purge that hangs must not trap someone on a page
 * they are trying to leave.
 */
export function purgeCaches(): Promise<void> {
  if (!("serviceWorker" in navigator)) return Promise.resolve();

  return new Promise((resolve) => {
    const done = setTimeout(resolve, 1000);
    void navigator.serviceWorker.ready
      .then((reg) => {
        if (!reg.active) {
          clearTimeout(done);
          resolve();
          return;
        }
        const channel = new MessageChannel();
        channel.port1.onmessage = () => {
          clearTimeout(done);
          resolve();
        };
        reg.active.postMessage({ type: "PURGE_CACHES" }, [channel.port2]);
      })
      .catch(() => {
        clearTimeout(done);
        resolve();
      });
  });
}
