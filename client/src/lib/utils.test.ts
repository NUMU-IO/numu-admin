import { describe, expect, it } from "vitest";
import { runLimited } from "./utils";

describe("runLimited", () => {
  it("caps calls in flight and settles in input order", async () => {
    let inFlight = 0;
    let peak = 0;
    const results = await runLimited([1, 2, 3, 4, 5, 6, 7, 8, 9], 4, async (n) => {
      peak = Math.max(peak, ++inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      if (n === 3) throw new Error("boom");
      return n * 10;
    });
    expect(peak).toBe(4);
    expect(results.map((r) => (r.status === "fulfilled" ? r.value : "x"))).toEqual([
      10,
      20,
      "x",
      40,
      50,
      60,
      70,
      80,
      90,
    ]);
  });
});
