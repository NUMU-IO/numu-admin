import { describe, expect, it } from "vitest";
import { toCSV } from "./Reports";

describe("toCSV", () => {
  it("defuses spreadsheet formulas but leaves numbers alone", () => {
    const csv = toCSV([
      { name: "=HYPERLINK(1)", phone: "+201001234567", note: "@SUM", total: -5, plain: "Ali" },
    ]);
    expect(csv.split("\n")[1]).toBe("'=HYPERLINK(1),'+201001234567,'@SUM,-5,Ali");
  });
});
