/**
 * CSRF token manager — re-export of the single implementation in `@/lib/csrf`.
 *
 * This file used to be a byte-identical COPY of `lib/csrf.ts`. Because each
 * module kept its own module-level `csrfToken`, the app had two independent
 * token stores:
 *
 *   - `lib/csrf`      ← bootstrapped by `main.tsx`, written by `authService.login`
 *                       (the path the Login page actually uses) and read by
 *                       `lib/apiClient`
 *   - `services/csrf` ← read by `services/api.ts`, which is what every
 *                       platform/admin service call goes through
 *
 * So after a fresh login the token existed in one store and not the other, and
 * the FIRST mutation of every admin session 403'd with "CSRF validation
 * failed", logged a console error, and only succeeded on `services/api.ts`'s
 * refresh-and-retry. The retry hid the bug; the console error is what exposed
 * it. Two stores for one token is not a caching strategy, it's a race.
 *
 * One module, one token. Importing from either path is now the same state.
 */

export { clearCSRFToken, getCSRFToken, initCSRF } from "@/lib/csrf";
