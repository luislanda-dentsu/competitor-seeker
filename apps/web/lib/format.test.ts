import { describe, expect, it } from "vitest";
import { fmtCompacto, fmtDelta } from "./format";

describe("fmtInt / fmtPct", () => {
  it("notación inglesa", async () => {
    const { fmtInt, fmtPct } = await import("./format");
    expect(fmtInt(12_345)).toBe("12,345");
    expect(fmtPct(0.382, { decimals: 1 })).toBe("38.2%");
    expect(fmtPct(25, { scaled: true })).toBe("25%");
  });
});

describe("fmtCompacto", () => {
  it("usa notación compacta inglesa: 15.5K, 1.2M", () => {
    expect(fmtCompacto(15_532)).toBe("15.5K");
    expect(fmtCompacto(41_464)).toBe("41.5K");
    expect(fmtCompacto(1_234_567)).toBe("1.2M");
    expect(fmtCompacto(950)).toBe("950");
  });
  it("sin dato: «—»", () => {
    expect(fmtCompacto(null)).toBe("—");
    expect(fmtCompacto(Number.NaN)).toBe("—");
  });
  it("fmtDelta conserva el signo", () => {
    expect(fmtDelta(1_500)).toBe("+1.5K");
    expect(fmtDelta(-3)).toBe("−3");
  });
});
