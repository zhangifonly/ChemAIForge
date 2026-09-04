import { describe, expect, it } from "vitest";
import { react, type Substance } from "./engine";
import { resolveSubstance } from "@/components/lab/reagents";

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
    // 产物 formula 一律半角下标：它是查色表的键，全角 `Ca(OH)₂` 查不到任何表。
    // 本用例要守的是"钙按 +2 价配平"，与下标的排版形式无关
    expect(r.products.some((p) => p.formula === "Ca(OH)2")).toBe(true);
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

// 草酸的碳是 +3 价，被强氧化剂氧化即升到 +4 价变成 CO₂ 逸出
// （H₂C₂O₄ → 2CO₂↑）——「冒泡」与「褪色」是同时发生的两个现象。
// 通用的"强氧化剂 + 还原剂"规则原先一律不产气，六个用草酸的实验
// （含有专用 3D 场景的 kmno4-oxalic-acid）连一个气泡都不冒。
describe("react - 草酸被强氧化剂氧化放出 CO₂", () => {
  const S = (...names: string[]) => names.map(resolveSubstance);

  it("高锰酸钾 / 重铬酸钾氧化草酸时产气", () => {
    for (const oxidant of ["高锰酸钾", "重铬酸钾"]) {
      const r = react(S(oxidant, "草酸", "硫酸"), { temperature: 80 });
      expect(r.reacted, oxidant).toBe(true);
      expect(r.producesGas, oxidant).toBe(true);
      expect(r.colorChange, oxidant).toBe(true); // 褪色仍在
      expect(r.products.some((p) => p.formula === "CO2"), oxidant).toBe(true);
      expect(r.equation, oxidant).toContain("CO₂↑");
    }
  });

  it("不产 CO₂ 的还原剂仍然只褪色不冒泡", () => {
    // 亚硫酸钠不加酸：加了硫酸会走「亚硫酸盐 + 酸 → SO₂↑」那条规则，
    // 那个气泡是对的，但与草酸的 CO₂ 无关，会掩盖本用例要验的东西
    const cases: Array<[string[], string]> = [
      [["高锰酸钾", "亚硫酸钠"], "高锰酸钾+亚硫酸钠"],
      [["重铬酸钾", "乙醇", "硫酸"], "重铬酸钾+乙醇"],
    ];
    for (const [reagents, label] of cases) {
      const r = react(S(...reagents), { temperature: 80 });
      expect(r.producesGas, label).toBe(false);
      expect(r.colorChange, label).toBe(true);
    }
  });
});
