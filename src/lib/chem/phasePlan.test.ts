// 相态与外观补充层的测试：分层 / 浑浊 / 结晶 / 压强 / pH 估算。
// 这些能力被全部实验共用，一处出错会波及一大片实验的 3D 表现，须逐项锁死。
import { describe, expect, it } from "vitest";
import { react } from "./engine";
import {
  estimatePh,
  extractedColor,
  findColoredGas,
  findCrystal,
  findOrganicPhase,
  isGasAbsorbed,
  isSelfCooling,
  isTurbid,
} from "./phasePlan";
import { planScene } from "./scenePlan";
import { resolveSubstance } from "@/components/lab/reagents";

const S = (...names: string[]) => names.map(resolveSubstance);

describe("有机相分层", () => {
  it("酯类与苯浮在水面，四氯化碳沉在水下（按密度）", () => {
    expect(findOrganicPhase(S("乙酸乙酯"))?.side).toBe("top");
    expect(findOrganicPhase(S("苯"))?.side).toBe("top");
    expect(findOrganicPhase(S("四氯化碳"))?.side).toBe("bottom");
  });

  it("纯水溶液不分层", () => {
    expect(findOrganicPhase(S("氯化钠", "蒸馏水"))).toBeNull();
  });

  it("萃取后有机相被卤素染色，而非保持无色", () => {
    const base = "#eef3f5";
    expect(extractedColor(S("碘水", "四氯化碳"), base)).not.toBe(base);
    expect(extractedColor(S("氯化钠", "四氯化碳"), base)).toBe(base);
  });

  // 酯化必须加热（浓硫酸催化 + 水浴），常温下引擎不给结果，故显式带上条件
  const HOT = { heated: true };

  it("酯化生成的酯要在液面形成油状层（产物也参与分层判定）", () => {
    const contents = S("乙酸", "乙醇", "硫酸");
    const plan = planScene({
      contents,
      result: react(contents, HOT),
      apparatus: ["试管", "酒精灯"],
      heated: true,
    });
    expect(plan.phase?.side).toBe("top");
  });

  it("酯化产物按实际酸醇组合推出，而非一律乙酸乙酯", () => {
    const formulas = (names: string[]) =>
      react(S(...names), HOT).products.map((p) => p.formula);
    expect(formulas(["甲酸", "甲醇", "硫酸"])).toContain("HCOOCH3");
    expect(formulas(["乙酸", "甲醇", "硫酸"])).toContain("CH3COOCH3");
    expect(formulas(["乙酸", "乙醇", "硫酸"])).toContain("CH3COOC2H5");
  });
});

describe("乳浊与澄清", () => {
  it("苯酚在水中呈乳浊", () => {
    expect(isTurbid(S("苯酚", "蒸馏水"), null)).toBe(true);
  });

  it("苯酚加碱生成可溶盐后变澄清", () => {
    const contents = S("苯酚", "氢氧化钠");
    const turbid = isTurbid(contents, react(contents));
    // 苯酚钠可溶，体系应当澄清
    expect(turbid).toBe(false);
  });

  it("不含难溶物的体系不浑浊", () => {
    expect(isTurbid(S("盐酸", "氢氧化钠"), null)).toBe(false);
  });

  // 「CO₂ 使澄清石灰水变浑浊」是二十多个实验的共同看点，
  // 一旦石灰水在反应前就被画成浊液，这个对比就彻底看不出来了。
  it("澄清石灰水本身澄清，通 CO₂ 后靠沉淀呈现浑浊", () => {
    const lime = S("澄清石灰水");
    expect(isTurbid(lime, null)).toBe(false);
    const contents = S("澄清石灰水", "二氧化碳");
    const result = react(contents);
    const plan = planScene({ contents, result, apparatus: ["试管", "导管"] });
    expect(result.reacted).toBe(true);
    expect(plan.precipitate).not.toBeNull(); // CaCO₃ 白色沉淀，浑浊由它体现
  });

  it("石灰水/氢氧化钙溶液里不该出现固体块", () => {
    for (const name of ["澄清石灰水", "石灰水", "氢氧化钙"]) {
      const contents = S(name, "盐酸");
      const plan = planScene({ contents, result: react(contents), apparatus: ["试管"] });
      expect(plan.solid, name).toBeNull();
    }
  });

  it("石灰乳是浊液且带固体，与澄清石灰水区分开", () => {
    const milk = S("石灰乳");
    expect(milk[0].formula).toBe("Ca(OH)2");
    expect(isTurbid(milk, null)).toBe(true);
    const contents = S("石灰乳", "氯气");
    const plan = planScene({ contents, result: react(contents), apparatus: ["烧杯", "导管"] });
    expect(plan.turbid).toBe(true);
    expect(plan.solid?.formula).toBe("Ca(OH)2");
  });
});

describe("晶体析出", () => {
  it("可结晶溶质能被识别并给出晶体外观", () => {
    expect(findCrystal(S("硝酸钾"))?.formula).toBe("KNO3");
    expect(findCrystal(S("硫酸铜"))?.color).toBeTruthy();
  });

  it("室温下配溶液不长晶体，降温才析出", () => {
    const contents = S("硝酸钾", "蒸馏水");
    const app = ["烧杯", "温度计", "玻璃棒"];
    expect(planScene({ contents, result: react(contents), apparatus: app }).crystal).toBeNull();
    expect(
      planScene({ contents, result: react(contents), apparatus: app, temperature: 8 }).crystal,
    ).not.toBeNull();
  });
});

describe("气体吸收致内压下降", () => {
  it("二氧化碳被氢氧化钠吸收 → 软瓶变瘪", () => {
    const contents = S("二氧化碳", "氢氧化钠");
    expect(isGasAbsorbed(contents, react(contents))).toBe(true);
    const plan = planScene({ contents, result: react(contents), apparatus: ["锥形瓶", "导管"] });
    expect(plan.rig.kind).toBe("pressure-drop");
  });

  it("反应本身产气时压强不降，不算这一路看点", () => {
    const contents = S("碳酸钠", "盐酸");
    expect(isGasAbsorbed(contents, react(contents))).toBe(false);
  });
});

describe("溶解与稀释的热效应", () => {
  it("浓硫酸稀释放热、硝酸钾溶解吸热", () => {
    expect(react(S("硫酸", "蒸馏水")).thermal).toBe("exothermic");
    expect(react(S("硝酸钾", "蒸馏水")).thermal).toBe("endothermic");
  });

  it("溶解吸热是体系自己变冷，不该画加热源", () => {
    const contents = S("硝酸钾", "蒸馏水");
    const result = react(contents);
    expect(isSelfCooling(result)).toBe(true);
    const plan = planScene({ contents, result, apparatus: ["烧杯", "温度计"] });
    expect(plan.heating).toBe(false);
    expect(plan.tempShift).toBe("down");
  });

  it("放热过程给出升温方向", () => {
    const contents = S("硫酸", "蒸馏水");
    const plan = planScene({ contents, result: react(contents), apparatus: ["烧杯", "温度计"] });
    expect(plan.tempShift).toBe("up");
  });

  it("溶解规则只在体系仅有溶质+水时成立，不抢真反应", () => {
    // 硫酸 + 水 + 碳酸钠 应命中产气反应，而不是稀释放热
    const r = react(S("硫酸", "蒸馏水", "碳酸钠"));
    expect(r.producesGas).toBe(true);
  });
});

describe("pH 估算", () => {
  it("强酸强碱给极端值，弱酸弱碱给温和值", () => {
    expect(estimatePh(S("盐酸"))).toBeLessThan(2);
    expect(estimatePh(S("氢氧化钠"))).toBeGreaterThan(12);
    expect(estimatePh(S("乙酸"))).toBeGreaterThan(2);
    expect(estimatePh(S("乙酸"))).toBeLessThan(6);
  });

  it("缓冲对（弱酸 + 共轭碱）锁在 4.7 附近，加强酸强碱也几乎不动", () => {
    const buffered = estimatePh(S("乙酸", "乙酸钠"));
    expect(buffered).toBeCloseTo(4.74, 1);
    expect(estimatePh(S("乙酸", "乙酸钠", "盐酸"))).toBeCloseTo(buffered, 1);
    expect(estimatePh(S("乙酸", "乙酸钠", "氢氧化钠"))).toBeCloseTo(buffered, 1);
  });

  it("纯水中性", () => {
    expect(estimatePh(S("蒸馏水"))).toBeCloseTo(7, 1);
  });
});

describe("注射器内有色气体", () => {
  it("二氧化氮能被识别并给出颜色", () => {
    expect(findColoredGas(S("二氧化氮"))?.color).toBeTruthy();
  });

  it("注射器装置接管场景并带上气体颜色", () => {
    const contents = S("二氧化氮", "四氧化二氮");
    const plan = planScene({
      contents,
      result: react(contents),
      apparatus: ["注射器", "铁架台"],
    });
    expect(plan.rig.kind).toBe("syringe");
    expect(plan.rig.gasColor).toBeTruthy();
  });
});
