import { describe, expect, it } from "vitest";
import { react, type Substance } from "./engine";

const HCl: Substance = { formula: "HCl", name: "盐酸", category: "acid" };
const NaOH: Substance = { formula: "NaOH", name: "氢氧化钠", category: "base" };
const Zn: Substance = { formula: "Zn", name: "锌", category: "metal" };
const NaCl: Substance = { formula: "NaCl", name: "氯化钠", category: "salt" };
const AgNO3: Substance = { formula: "AgNO3", name: "硝酸银", category: "salt" };
const H2O: Substance = { formula: "H2O", name: "水", category: "water" };

describe("react - 酸碱中和", () => {
  it("酸 + 碱 应放热生成盐和水，无气体无沉淀", () => {
    const r = react([HCl, NaOH]);
    expect(r.reacted).toBe(true);
    expect(r.thermal).toBe("exothermic");
    expect(r.producesGas).toBe(false);
    expect(r.producesPrecipitate).toBe(false);
    expect(r.products.some((p) => p.category === "water")).toBe(true);
  });
});

describe("react - 沉淀反应", () => {
  it("AgNO3 + NaCl 应生成 AgCl 沉淀", () => {
    const r = react([AgNO3, NaCl]);
    expect(r.reacted).toBe(true);
    expect(r.producesPrecipitate).toBe(true);
    expect(r.products.some((p) => p.formula === "AgCl")).toBe(true);
  });
});

describe("react - 金属与酸", () => {
  it("金属 + 酸 应放出氢气", () => {
    const r = react([Zn, HCl]);
    expect(r.reacted).toBe(true);
    expect(r.producesGas).toBe(true);
    expect(r.products.some((p) => p.formula === "H2")).toBe(true);
  });
});

describe("react - 无反应", () => {
  it("单一物质不反应", () => {
    expect(react([H2O]).reacted).toBe(false);
  });

  it("不匹配任何规则时不反应", () => {
    expect(react([NaCl, H2O]).reacted).toBe(false);
  });
});
