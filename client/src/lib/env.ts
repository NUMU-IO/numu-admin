/**
 * Environment switcher for the admin dashboard.
 *
 * Lets a superadmin point the dashboard at a different NUMU API stack
 * (prod / stage / test) at runtime. Selection lives in localStorage so
 * it survives reloads, but auth cookies are scoped per-env (separate
 * Domain attribute on each API stack), so switching forces a re-login.
 *
 * Wiring:
 *   - apiClient + authApi import getApiBase() instead of static VITE_API_URL.
 *   - Header has a dropdown that calls setCurrentEnv() and reloads.
 *   - The build-time VITE_API_URL is the prod default; test/stage
 *     URLs are constants below.
 */

export const ADMIN_ENVS = ["prod", "stage", "test"] as const;
export type AdminEnv = (typeof ADMIN_ENVS)[number];

const STORAGE_KEY = "numu_admin_env";

const ENV_API_URL: Record<AdminEnv, string> = {
  // Prod uses the build-time VITE_API_URL (relative `/api/v1` when admin is
  // co-hosted with the API at numueg.app, or absolute if not).
  prod: import.meta.env.VITE_API_URL || "/api/v1",
  stage: "https://staging.numueg.app/api/v1",
  test: "https://test.numueg.app/api/v1",
};

const ENV_LABEL: Record<AdminEnv, string> = {
  prod: "Production",
  stage: "Staging",
  test: "Test",
};

/** Read the currently-selected env. Defaults to "prod". */
export function getCurrentEnv(): AdminEnv {
  if (typeof window === "undefined") return "prod";
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return ADMIN_ENVS.includes(raw as AdminEnv) ? (raw as AdminEnv) : "prod";
}

/**
 * Persist a new env selection. Caller is responsible for forcing a
 * reload + re-login afterwards (auth cookies are per-env-domain and
 * won't validate against the other env's API).
 */
export function setCurrentEnv(env: AdminEnv): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, env);
}

/** Resolved API base URL for the currently-selected env. */
export function getApiBase(): string {
  return ENV_API_URL[getCurrentEnv()];
}

/** Human-readable label used in the env switcher dropdown. */
export function getEnvLabel(env: AdminEnv): string {
  return ENV_LABEL[env];
}

/**
 * Tailwind colour token for the env badge. Prod is intentionally
 * neutral (no risk of confusing real data with test); non-prod is
 * loud so the operator can't miss it.
 */
export function getEnvBadgeClasses(env: AdminEnv): string {
  switch (env) {
    case "test":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30";
    case "stage":
      return "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}
