import { describe, expect, it } from "vitest";

import { belowPlan, flagState, formatValue, parseValue, planLabel } from "./entitlementsAdminApi";

describe("entitlement helpers", () => {
  it("formats switches, limits and a missing grant", () => {
    expect(formatValue("boolean", true)).toBe("✓");
    expect(formatValue("boolean", false)).toBe("—");
    expect(formatValue("limit", "unlimited")).toBe("∞");
    expect(formatValue("limit", 0)).toBe("0");
    expect(formatValue("limit", 2500)).toBe("2,500");
    expect(formatValue("limit", undefined)).toBe("");
  });

  it("labels add-ons and leaves plans alone", () => {
    expect(planLabel("addon:cod_shield")).toBe("Add-on: cod_shield");
    expect(planLabel("starter")).toBe("starter");
  });

  it("parses typed values and never produces -1", () => {
    expect(parseValue("limit", "250")).toBe(250);
    expect(parseValue("limit", "unlimited")).toBe("unlimited");
    for (const bad of ["", "-1", "1.5", "1e3", " 5", "99999999999999999999"]) {
      expect(parseValue("limit", bad)).toBeNull();
    }
    expect(parseValue("boolean", "true")).toBe(true);
    expect(parseValue("boolean", "false")).toBe(false);
  });

  it("spots an override that takes away from the plan", () => {
    expect(belowPlan("limit", 50, 100)).toBe(true);
    expect(belowPlan("limit", 50, "unlimited")).toBe(true);
    expect(belowPlan("limit", 500, 100)).toBe(false);
    expect(belowPlan("limit", "unlimited", 100)).toBe(false);
    expect(belowPlan("boolean", false, true)).toBe(true);
    expect(belowPlan("limit", 50, undefined)).toBe(false);
  });

  it("names a flag's rollout state", () => {
    expect(flagState({ enabled: false, rollout_percent: 50, targets: 3 })).toBe("Off");
    expect(flagState({ enabled: true, rollout_percent: 100, targets: 0 })).toBe("Everyone");
    expect(flagState({ enabled: true, rollout_percent: 0, targets: 2 })).toBe("Selected");
    expect(flagState({ enabled: true, rollout_percent: 25, targets: 2 })).toBe("25%");
  });
});
