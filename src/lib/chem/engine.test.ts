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

describe("react - 活泼金属与水（价态正确）", () => {
  const Na: Substance = { formula: "Na", name: "钠", category: "metal" };
  const K: Substance = { formula: "K", name: "钾", category: "metal" };
  const Ca: Substance = { formula: "Ca", name: "钙", category: "metal" };

  it("钠 + 水 → NaOH（+1 价）放出氢气", () => {
    const r = react([Na, H2O]);
    expect(r.reacted).toBe(true);
    expect(r.producesGas).toBe(true);
    expect(r.products.some((p) => p.formula === "NaOH")).toBe(true);
    expect(r.equation).toContain("2Na + 2H₂O → 2NaOH");
  });

  it("钾 + 水 → KOH（+1 价）", () => {
    expect(react([K, H2O]).products.some((p) => p.formula === "KOH")).toBe(true);
  });

  it("钙 + 水 → Ca(OH)₂（+2 价，非 CaOH）配平正确", () => {
    const r = react([Ca, H2O]);
    expect(r.products.some((p) => p.formula === "Ca(OH)₂")).toBe(true);
    expect(r.products.some((p) => p.formula === "CaOH")).toBe(false);
    expect(r.equation).toContain("Ca + 2H₂O → Ca(OH)₂ + H₂↑");
  });
});

describe("react - 酸性氧化物与碱", () => {
  const CaOH2: Substance = { formula: "Ca(OH)2", name: "氢氧化钙", category: "base" };
  const NaOHb: Substance = { formula: "NaOH", name: "氢氧化钠", category: "base" };
  const CO2: Substance = { formula: "CO2", name: "二氧化碳", category: "gas" };
  const SO2: Substance = { formula: "SO2", name: "二氧化硫", category: "reducer" };

  it("CO₂ + 石灰水 → CaCO₃↓（变浑浊，CO₂ 检验）", () => {
    const r = react([CO2, CaOH2]);
    expect(r.reacted).toBe(true);
    expect(r.producesPrecipitate).toBe(true);
    expect(r.equation).toContain("CaCO₃↓");
  });

  it("SO₂ + 石灰水 → CaSO₃↓（变浑浊）", () => {
    const r = react([SO2, CaOH2]);
    expect(r.reacted).toBe(true);
    expect(r.producesPrecipitate).toBe(true);
  });

  it("CO₂ + 可溶强碱 NaOH → 被吸收（无沉淀）", () => {
    const r = react([CO2, NaOHb]);
    expect(r.reacted).toBe(true);
    expect(r.producesPrecipitate).toBe(false);
  });
});

describe("react - 指示剂变色（扩展）", () => {
  const litmus: Substance = { formula: "litmus", name: "石蕊", category: "indicator" };
  const phph: Substance = { formula: "phenolphthalein", name: "酚酞", category: "indicator" };
  const CO2: Substance = { formula: "CO2", name: "二氧化碳", category: "gas" };
  const Cl2: Substance = { formula: "Cl2", name: "氯水", category: "oxidizer" };
  const Na: Substance = { formula: "Na", name: "钠", category: "metal" };

  it("CO₂ + 石蕊 → 碳酸显酸性使石蕊变色", () => {
    expect(react([CO2, litmus, H2O]).colorChange).toBe(true);
  });

  it("氯水 + 石蕊 → 变色（含漂白说明）", () => {
    const r = react([Cl2, litmus]);
    expect(r.colorChange).toBe(true);
    expect(r.description).toContain("漂白");
  });

  it("钠 + 水 + 酚酞 → 生成碱使酚酞变红", () => {
    expect(react([Na, H2O, phph]).colorChange).toBe(true);
  });

  it("钠 + 水（无指示剂）→ 不显色", () => {
    expect(react([Na, H2O]).colorChange).toBe(false);
  });
});
