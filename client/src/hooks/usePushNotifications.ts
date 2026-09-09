/**
 * Push subscription lifecycle for the backoffice.
 *
 * Three rules encoded here, each with a reason:
 *
 *  1. NEVER prompt on load. `Notification.requestPermission()` is a one-shot
 *     with no undo — a browser-level "Block" is close to permanent — so this
 *     hook only reaches `subscribe()` from an explicit toggle.
 *  2. Must be called from a USER GESTURE. iOS enforces this; Chrome is moving
 *     the same way.
 *  3. iOS can only subscribe in STANDALONE mode. Web Push on iOS requires the
 *     app to be on the Home Screen, so from a Safari tab this reports
 *     `needsInstallFirst` rather than offering a toggle that cannot work.
 */
import { useCallback, useEffect, useState } from "react";

import {
  getPushKey,
  registerPushSubscription,
  revokePushSubscription,
  urlBase64ToUint8Array,
} from "@/services/pushApi";

export type PushPermission = "default" | "granted" | "denied" | "unsupported";

function isIos(): boolean {
  const s = navigator.userAgent;
  // iPadOS 13+ reports itself as Macintosh; the touch points give it away.
  return /iPad|iPhone|iPod/.test(s) || (/Macintosh/.test(s) && navigator.maxTouchPoints > 1);
}

/** True when running as an installed app rather than in a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS predates the display-mode media query and still sets this instead.
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<PushPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);

  const apiSupported =
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window;

  const standalone = isStandalone();
  // iOS only permits Web Push from a Home-Screen app. Offering the toggle in a
  // Safari tab would produce a failure the operator cannot act on.
  const supported = apiSupported && (!isIos() || standalone);

  useEffect(() => {
    if (!apiSupported) {
      setPermission("unsupported");
      setAvailable(false);
      return;
    }
    setPermission(Notification.permission as PushPermission);

    void navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => setSubscribed(false));

    // Whether the deployment has VAPID keys at all. Without this the toggle
    // would appear on a stack that can never deliver, and switching it on
    // would fail with nothing to explain why.
    void getPushKey()
      .then((key) => setAvailable(key.enabled && !!key.public_key))
      .catch(() => setAvailable(false));
  }, [apiSupported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!supported) return false;

    setBusy(true);
    try {
      const key = await getPushKey();
      if (!key.enabled || !key.public_key) return false;

      // MUST be inside the user-gesture call stack (iOS requirement).
      const result = await Notification.requestPermission();
      setPermission(result as PushPermission);
      if (result !== "granted") return false;

      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          // Chrome refuses a subscription without this, and a silent push
          // would be invisible to the operator anyway.
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key.public_key),
        }));

      await registerPushSubscription(sub);
      setSubscribed(true);
      return true;
    } catch {
      return false;
    } finally {
      setBusy(false);
    }
  }, [supported]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      // Revoke server-side FIRST: if the browser unsubscribe succeeds but the
      // API call does not, the row lingers and the platform keeps pushing to a
      // dead endpoint until it 410s.
      await revokePushSubscription(sub?.endpoint);
      await sub?.unsubscribe();
      setSubscribed(false);
    } catch {
      /* best effort — signing out revokes server-side too */
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    supported,
    /** Null until the VAPID key check returns; false when push is unconfigured. */
    available,
    permission,
    subscribed,
    busy,
    subscribe,
    unsubscribe,
    /** Blocked in the browser — needs settings, not a retry. */
    blocked: permission === "denied",
    /** iOS in a Safari tab: installing is the prerequisite, not a permission. */
    needsInstallFirst: apiSupported && isIos() && !standalone,
  };
}
