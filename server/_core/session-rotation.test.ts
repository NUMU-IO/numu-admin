import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_DURATION_MS, SESSION_ROTATION_THRESHOLD_MS } from "../../shared/const";

// ── Mocks ──────────────────────────────────────────────────────────────────
// sdk is imported internally by cookies.ts and context.ts — stub it here.
vi.mock("./sdk", () => ({
  sdk: {
    createSessionToken: vi.fn().mockResolvedValue("rotated-token"),
    verifySession: vi.fn(),
    authenticateRequest: vi.fn(),
  },
}));

// Lazy-import AFTER mocks are registered so the modules pick up the stubs.
const { sdk } = await import("./sdk");
const { rotateSessionIfNeeded } = await import("./cookies");
const { createContext } = await import("./context");

// ── Helpers ────────────────────────────────────────────────────────────────
type CookieCall = { name: string; value: string; options: Record<string, unknown> };

function createMockReqRes() {
  const setCookies: CookieCall[] = [];

  const req = {
    protocol: "https",
    headers: {} as Record<string, string | undefined>,
    hostname: "admin.example.com",
  } as any;

  const res = {
    cookie: (name: string, value: string, options: Record<string, unknown>) => {
      setCookies.push({ name, value, options });
    },
    clearCookie: vi.fn(),
  } as any;

  return { req, res, setCookies };
}

function iatSecondsAgo(ms: number): number {
  return Math.floor((Date.now() - ms) / 1000);
}

// ── Tests ──────────────────────────────────────────────────────────────────
describe("rotateSessionIfNeeded", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (sdk.createSessionToken as ReturnType<typeof vi.fn>).mockResolvedValue("rotated-token");
  });

  // ─── Rotate-at-threshold behaviour ───────────────────────────────────
  it("does NOT rotate when session age is below the threshold", async () => {
    const { req, res, setCookies } = createMockReqRes();
    const session = {
      openId: "user-1",
      name: "Alice",
      iat: iatSecondsAgo(SESSION_ROTATION_THRESHOLD_MS / 2), // half the threshold
    };

    await rotateSessionIfNeeded(req, res, session);

    expect(sdk.createSessionToken).not.toHaveBeenCalled();
    expect(setCookies).toHaveLength(0);
  });

  it("rotates when session age equals the threshold", async () => {
    const { req, res, setCookies } = createMockReqRes();
    const session = {
      openId: "user-1",
      name: "Alice",
      iat: iatSecondsAgo(SESSION_ROTATION_THRESHOLD_MS),
    };

    await rotateSessionIfNeeded(req, res, session);

    expect(sdk.createSessionToken).toHaveBeenCalledWith("user-1", {
      name: "Alice",
      expiresInMs: SESSION_DURATION_MS,
    });
    expect(setCookies).toHaveLength(1);
    expect(setCookies[0]!.value).toBe("rotated-token");
    expect(setCookies[0]!.options).toMatchObject({
      httpOnly: true,
      maxAge: SESSION_DURATION_MS,
    });
  });

  it("rotates when session age exceeds the threshold", async () => {
    const { req, res, setCookies } = createMockReqRes();
    const session = {
      openId: "user-2",
      name: "Bob",
      iat: iatSecondsAgo(SESSION_ROTATION_THRESHOLD_MS * 3),
    };

    await rotateSessionIfNeeded(req, res, session);

    expect(sdk.createSessionToken).toHaveBeenCalledOnce();
    expect(setCookies).toHaveLength(1);
  });

  // ─── Missing-iat (legacy) migration ──────────────────────────────────
  it("unconditionally rotates legacy tokens that lack an iat claim", async () => {
    const { req, res, setCookies } = createMockReqRes();
    const session = { openId: "legacy-user", name: "Legacy" }; // no iat

    await rotateSessionIfNeeded(req, res, session);

    expect(sdk.createSessionToken).toHaveBeenCalledWith("legacy-user", {
      name: "Legacy",
      expiresInMs: SESSION_DURATION_MS,
    });
    expect(setCookies).toHaveLength(1);
    expect(setCookies[0]!.options.maxAge).toBe(SESSION_DURATION_MS);
  });

  it("rotates when iat is explicitly undefined", async () => {
    const { req, res, setCookies } = createMockReqRes();
    const session = { openId: "u", name: "U", iat: undefined };

    await rotateSessionIfNeeded(req, res, session);

    expect(sdk.createSessionToken).toHaveBeenCalledOnce();
    expect(setCookies).toHaveLength(1);
  });
});

describe("createContext — rotation failure resilience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("still returns authenticated user when rotation throws", async () => {
    // Arrange: valid session that needs rotation, but token creation fails
    const staleIat = iatSecondsAgo(SESSION_ROTATION_THRESHOLD_MS * 2);
    (sdk.verifySession as ReturnType<typeof vi.fn>).mockResolvedValue({
      openId: "real-user-123",
      appId: "numu-admin",
      name: "Real Admin",
      iat: staleIat,
    });
    const mockUser = {
      id: 1,
      openId: "real-user-123",
      name: "Real Admin",
      email: "admin@example.com",
      loginMethod: "email",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    (sdk.authenticateRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
    (sdk.createSessionToken as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("signing key unavailable"),
    );

    const { req, res } = createMockReqRes();
    req.headers.cookie = "app_session_id=valid-jwt";

    const ctx = await createContext({ req, res } as any);

    // User must still be authenticated despite rotation failure
    expect(ctx.user).not.toBeNull();
    expect(ctx.user!.openId).toBe("real-user-123");
  });

  it("does not attempt rotation for unauthenticated requests", async () => {
    (sdk.verifySession as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { req, res } = createMockReqRes();

    const ctx = await createContext({ req, res } as any);

    expect(ctx.user).toBeNull();
    expect(sdk.createSessionToken).not.toHaveBeenCalled();
  });
});
