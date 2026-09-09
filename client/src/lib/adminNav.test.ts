/**
 * The two pieces of the redesign that fail silently.
 *
 * `navIdForPath` decides which sidebar item is lit. Get it wrong and the
 * navigation still works — it just stops telling the operator where they
 * are, which nobody files a bug about. The trap is `/`: it prefix-matches
 * every path in the app, so it needs an exact match while everything else
 * needs longest-prefix.
 *
 * `formatMoney` reads integer minor units. Passing it major units is off by
 * a factor of a hundred and looks entirely plausible on screen.
 */

import { describe, expect, it } from "vitest";
import { ADMIN_NAV, navIdForPath, navTrailForPath } from "./adminNav";
import { formatCompact, formatMoney, formatMoneyShort, formatNumber } from "./format";

describe("navIdForPath", () => {
  it("lights Overview only on the root", () => {
    expect(navIdForPath("/")).toBe("overview");
    expect(navIdForPath("/orders")).toBe("orders");
    expect(navIdForPath("/merchants")).not.toBe("overview");
  });

  it("keeps the parent lit on a nested route", () => {
    expect(navIdForPath("/merchants/store_4812")).toBe("merchants");
    expect(navIdForPath("/marketplace/snapshots/abc-123")).toBe("snapshots");
  });

  it("prefers the longest matching href", () => {
    // Both /marketplace/themes and /themes exist; the nested path must not
    // fall through to the shorter, unrelated entry.
    expect(navIdForPath("/marketplace/themes")).toBe("marketplace-themes");
    expect(navIdForPath("/themes")).toBe("themes");
  });

  it("returns nothing for a path outside the navigation", () => {
    expect(navIdForPath("/not-a-page")).toBe("");
  });

  it("does not match a path that merely starts with the same characters", () => {
    // /orders must not light for /orders-archive.
    expect(navIdForPath("/orders-archive")).toBe("");
  });
});

describe("navTrailForPath", () => {
  it("builds Admin → section → page", () => {
    expect(navTrailForPath("/wallets").map((t) => t.label)).toEqual([
      "Admin",
      "Billing",
      "Merchant wallets",
    ]);
  });

  it("omits the section for an ungrouped page", () => {
    expect(navTrailForPath("/").map((t) => t.label)).toEqual(["Admin", "Overview"]);
  });
});

describe("nav model", () => {
  it("has unique ids and absolute hrefs", () => {
    const items = ADMIN_NAV.flatMap((s) => s.items);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    for (const item of items) expect(item.href.startsWith("/")).toBe(true);
  });
});

describe("money", () => {
  it("reads minor units", () => {
    expect(formatMoney(124_000)).toContain("1,240.00");
    expect(formatMoneyShort(124_000)).toContain("1,240");
    expect(formatMoney(0)).toContain("0.00");
  });

  it("honours a per-row currency", () => {
    expect(formatMoney(124_000, "SAR")).toContain("SAR");
    expect(formatMoney(124_000)).toContain("EGP");
  });

  it("treats null as zero rather than NaN", () => {
    expect(formatMoney(null)).toContain("0.00");
    expect(formatNumber(undefined)).toBe("0");
  });
});

describe("formatCompact", () => {
  it("keeps small numbers exact and abbreviates large ones", () => {
    expect(formatCompact(940)).toBe("940");
    expect(formatCompact(35_402)).toBe("35.4k");
    expect(formatCompact(12_000)).toBe("12k");
    expect(formatCompact(2_400_000)).toBe("2.4M");
    expect(formatCompact(0)).toBe("0");
  });
});
