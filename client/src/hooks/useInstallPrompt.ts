/**
 * Chrome's deferred install prompt.
 *
 * The browser fires `beforeinstallprompt` once, early, and the event is the
 * only way to open the install dialog later. Miss it and the app can never be
 * installed from its own UI — only from the browser's menu, which most people
 * never open. So it is captured at module load rather than inside a component:
 * the event usually fires before React has mounted the topbar.
 *
 * Firefox and Safari never fire it. Those users install from the browser's own
 * menu, which is why `promptable` gates the button instead of the button
 * always being there and doing nothing.
 */
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(v: boolean) => void>();

function announce(value: boolean) {
  listeners.forEach((fn) => fn(value));
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Without this Chrome shows its own mini-infobar, which cannot be styled
    // and competes with the app's own control.
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    announce(true);
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    announce(false);
  });
}

export function useInstallPrompt() {
  const [promptable, setPromptable] = useState(deferred !== null);

  useEffect(() => {
    listeners.add(setPromptable);
    return () => {
      listeners.delete(setPromptable);
    };
  }, []);

  return {
    promptable,
    async install(): Promise<boolean> {
      if (!deferred) return false;
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      // The event is single-use: Chrome refuses a second prompt() on the same
      // one, so it is dropped either way.
      deferred = null;
      announce(false);
      return outcome === "accepted";
    },
  };
}
