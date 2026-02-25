import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { parse as parseCookies } from "cookie";
import type { User } from "../../drizzle/schema";
import { COOKIE_NAME } from "@shared/const";
import { rotateSessionIfNeeded } from "./cookies";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    const cookies = parseCookies(opts.req.headers.cookie ?? "");
    const sessionCookie = cookies[COOKIE_NAME];
    const session = await sdk.verifySession(sessionCookie);

    if (!session) {
      // No valid session cookie
    } else {
      // Valid session — try DB lookup; fall back to JWT-derived user if DB is down
      try {
        user = await sdk.authenticateRequest(opts.req);
      } catch {
        // DB unavailable — build a minimal admin user from JWT claims
        user = {
          id: 0,
          openId: session.openId,
          name: session.name ?? null,
          email: null,
          loginMethod: "email",
          role: "admin",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        };
      }
    }

    // Session rotation is best-effort: a failure must never invalidate an
    // otherwise valid session. Errors are logged and swallowed.
    if (session && user) {
      try {
        await rotateSessionIfNeeded(opts.req, opts.res, session);
      } catch (rotationErr) {
        console.warn("[Auth] Session rotation failed (non-fatal):", rotationErr);
      }
    }
  } catch {
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
