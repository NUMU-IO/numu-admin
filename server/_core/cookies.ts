import { COOKIE_NAME, SESSION_DURATION_MS, SESSION_ROTATION_THRESHOLD_MS } from "@shared/const";
import type { CookieOptions, Request, Response } from "express";
import { sdk } from "./sdk";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  // const hostname = req.hostname;
  // const shouldSetDomain =
  //   hostname &&
  //   !LOCAL_HOSTS.has(hostname) &&
  //   !isIpAddress(hostname) &&
  //   hostname !== "127.0.0.1" &&
  //   hostname !== "::1";

  // const domain =
  //   shouldSetDomain && !hostname.startsWith(".")
  //     ? `.${hostname}`
  //     : shouldSetDomain
  //       ? hostname
  //       : undefined;

  const isSecure = isSecureRequest(req);
  return {
    httpOnly: true,
    path: "/",
    // "none" requires Secure; fall back to "lax" on plain HTTP (e.g. localhost)
    sameSite: isSecure ? "none" : "lax",
    secure: isSecure,
  };
}

/**
 * Session rotation (AD-11): On each authenticated request, if the session was
 * issued more than SESSION_ROTATION_THRESHOLD_MS ago, issue a fresh cookie with
 * a new 24-hour window. This keeps active users seamlessly logged in while
 * ensuring that stolen or stale sessions cannot persist indefinitely.
 *
 * Legacy tokens (issued before the iat fix) lack an iat claim and are
 * unconditionally rotated so they migrate to the new 24-hour regime.
 */
export async function rotateSessionIfNeeded(
  req: Request,
  res: Response,
  session: { openId: string; name: string; iat?: number },
): Promise<void> {
  // Legacy tokens without iat are always rotated to migrate them to the new
  // 24-hour duration with a proper iat claim.
  if (session.iat != null) {
    const sessionAgeMs = Date.now() - session.iat * 1000;
    if (sessionAgeMs < SESSION_ROTATION_THRESHOLD_MS) return;
  }

  const newToken = await sdk.createSessionToken(session.openId, {
    name: session.name,
    expiresInMs: SESSION_DURATION_MS,
  });

  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, newToken, { ...cookieOptions, maxAge: SESSION_DURATION_MS });
}
