import { describe, expect, it } from "vitest";
import { molarMass, parseFormula } from "./formula";
import { REAGENT_RULES } from "@/components/lab/reagentRules";

// 非化学式的哨兵标签：试剂库里用它们表示指示剂、空气、催化剂等无需定量的项。
// 这些必须解析失败（返回 null），而不是被当成元素算出个数字。
const SENTINELS = new Set([
  "air",
  "catalyst",
  "cellulose",
  "EBT",
  "fat",
  "litmus",
  "methyl-orange",
  "petroleum",
  "ph-paper",
  "phenolphthalein",
  "soap-solution",
  "starch",
  "Na2EDTA",
]);

describe("parseFormula", () => {
  it("解析简单式", () => {
    expect(parseFormula("NaCl")).toEqual({ Na: 1, Cl: 1 });
    expect(parseFormula("H2SO4")).toEqual({ H: 2, S: 1, O: 4 });
  });

  it("解析圆括号与系数", () => {
    expect(parseFormula("Ca(OH)2")).toEqual({ Ca: 1, O: 2, H: 2 });
    expect(parseFormula("Al2(SO4)3")).toEqual({ Al: 2, S: 3, O: 12 });
    expect(parseFormula("(NH4)2CO3")).toEqual({ N: 2, H: 8, C: 1, O: 3 });
  });

  it("解析方括号配合物的嵌套括号", () => {
    // K4[Fe(CN)6]：方括号内还有一层圆括号，两层都要展开
    expect(parseFormula("K4[Fe(CN)6]")).toEqual({ K: 4, Fe: 1, C: 6, N: 6 });
  });

  it("解析结晶水与加合物", () => {
    expect(parseFormula("NH3·H2O")).toEqual({ N: 1, H: 5, O: 1 });
    // 段首系数：5 份 H2O
    expect(parseFormula("CuSO4·5H2O")).toEqual({ Cu: 1, S: 1, O: 9, H: 10 });
  });

  it("非法输入返回 null 而不是抛错或算出数字", () => {
    expect(parseFormula("air")).toBeNull(); // 全小写，不是元素符号
    expect(parseFormula("Xx2")).toBeNull(); // 未知元素
    expect(parseFormula("Ca(OH2")).toBeNull(); // 括号未闭合
    expect(parseFormula("")).toBeNull();
  });
});

describe("molarMass", () => {
  it("对得上课本常用值", () => {
    expect(molarMass("H2O")).toBeCloseTo(18.015, 2);
    expect(molarMass("NaOH")).toBeCloseTo(39.997, 2);
    expect(molarMass("CaCO3")).toBeCloseTo(100.087, 2);
    expect(molarMass("H2SO4")).toBeCloseTo(98.072, 2);
    expect(molarMass("CuSO4·5H2O")).toBeCloseTo(249.681, 2);
    expect(molarMass("KMnO4")).toBeCloseTo(158.032, 2);
  });

  it("哨兵标签返回 null，调用方据此隐去称量输入", () => {
    expect(molarMass("phenolphthalein")).toBeNull();
    expect(molarMass("litmus")).toBeNull();
  });
});

describe("试剂库全覆盖", () => {
  // 这条是回归闸门：将来往 REAGENT_RULES 加试剂时，若化学式写法解析器不认
  // （拼错、用了没登记的元素、写成中文），这里立刻失败，而不是等到界面上出现 NaN。
  it("每条规则的化学式要么能算出摩尔质量，要么是已登记的哨兵", () => {
    const bad: string[] = [];
    for (const rule of REAGENT_RULES) {
      if (SENTINELS.has(rule.formula)) continue;
      const m = molarMass(rule.formula);
      if (m === null || !(m > 0)) bad.push(rule.formula);
    }
    expect(bad).toEqual([]);
  });
});
