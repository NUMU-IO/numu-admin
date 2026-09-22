/**
 * `services/api` (used by platform capabilities, theme review, wallets and
 * nine more services) must share `lib/apiClient`'s 2FA step-up: with
 * NUMU_FORCE_ADMIN_2FA on, a gated call answers 403 "2FA verification …",
 * and without the shared prompt it dead-ended as "API error: 403".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setStepUpHandler } from "@/lib/apiClient";
import { apiClient } from "./api";

function reply(status: number, body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

const STALE = {
  success: false,
  error: { code: "HTTP_ERROR", message: "2FA verification required." },
};

describe("services/api 2FA step-up", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", {
      location: { pathname: "/", href: "" },
      localStorage: { getItem: () => null, setItem: () => undefined },
    });
    fetchMock.mockReset();
  });

  afterEach(() => {
    setStepUpHandler(null);
    vi.unstubAllGlobals();
  });

  it("asks for a code once and retries the gated call", async () => {
    const handler = vi.fn().mockResolvedValue(true);
    setStepUpHandler(handler);
    fetchMock
      .mockReturnValueOnce(reply(403, STALE))
      .mockReturnValueOnce(reply(200, { success: true, data: { ok: 1 } }));

    await expect(
      apiClient("/admin/platform-capabilities/x", { method: "PUT" }),
    ).resolves.toEqual({ ok: 1 });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shows the API's own message when no prompt is registered", async () => {
    fetchMock.mockReturnValueOnce(reply(403, STALE));
    await expect(apiClient("/admin/x", { method: "POST" })).rejects.toThrow(
      "2FA verification required.",
    );
  });

  it("reads NUMU-api's error envelope, not only FastAPI's detail", async () => {
    fetchMock.mockReturnValueOnce(
      reply(409, { success: false, error: { message: "Already recorded." } }),
    );
    await expect(apiClient("/admin/y")).rejects.toThrow("Already recorded.");
  });
});
