// 场景方案推导测试：保证"数据驱动 3D"对每类现象都能给出正确呈现，
// 不依赖手写场景。新实验只要 probe 能反应，就应自动得到对应的 3D 表现。
import { describe, it, expect } from "vitest";
import {
  acidBaseEnv,
  chooseVessel,
  findIndicator,
  inferGasFormula,
  pickGas,
  pickPrecipitate,
  pickSolid,
  planScene,
} from "./scenePlan";
import { react } from "./engine";
import type { Substance } from "./engine";
import {
  CLEAR_TINT,
  INDICATOR_COLORS,
  PRECIPITATE_COLOR,
  SOLUTION_TINT,
} from "./appearance";
import { hasSolidLook } from "@/components/lab/lab3d/metalLook";

const s = (formula: string, name: string, category: Substance["category"]): Substance => ({
  formula,
  name,
  category,
});

describe("容器选型", () => {
  it("按仪器名选试管 / 锥形瓶 / 烧杯", () => {
    expect(chooseVessel(["试管", "试管夹"])).toBe("tube");
    expect(chooseVessel(["锥形瓶", "滴定管"])).toBe("flask");
    expect(chooseVessel(["烧杯", "玻璃棒"])).toBe("beaker");
    // 圆底/蒸馏烧瓶也是有颈的瓶，画成锥形瓶而非敞口烧杯（制取 SO₂、氯气、HCl 等）
    expect(chooseVessel(["圆底烧瓶", "分液漏斗", "集气瓶"])).toBe("flask");
    expect(chooseVessel([])).toBe("beaker"); // 缺仪器信息时的兜底
  });
});

describe("空容器", () => {
  it("未加试剂时无液体、无任何现象", () => {
    const p = planScene({ contents: [], result: null, apparatus: ["试管"] });
    expect(p.liquid).toBeNull();
    expect(p.bubbles).toBeNull();
    expect(p.precipitate).toBeNull();
    expect(p.flame).toBe(false);
  });
});

describe("液体颜色", () => {
  it("有色溶质决定液色，无色溶质呈澄清", () => {
    const blue = planScene({
      contents: [s("CuSO4", "硫酸铜", "salt")],
      result: null,
      apparatus: ["烧杯"],
    });
    expect(blue.liquid).toEqual(SOLUTION_TINT.CuSO4);

    const clear = planScene({
      contents: [s("NaCl", "氯化钠", "salt")],
      result: null,
      apparatus: ["烧杯"],
    });
    expect(clear.liquid).toEqual(CLEAR_TINT);
  });
});

describe("产气反应", () => {
  it("锌与稀硫酸：冒气泡且无沉淀", () => {
    const contents = [s("Zn", "锌", "metal"), s("H2SO4", "硫酸", "acid")];
    const result = react(contents);
    expect(result.producesGas).toBe(true);
    const p = planScene({ contents, result, apparatus: ["试管"] });
    expect(p.bubbles).not.toBeNull();
    expect(p.precipitate).toBeNull();
  });
});

describe("沉淀反应", () => {
  it("硝酸银与氯化钠：白色氯化银沉淀", () => {
    const contents = [s("AgNO3", "硝酸银", "salt"), s("NaCl", "氯化钠", "salt")];
    const result = react(contents);
    expect(result.producesPrecipitate).toBe(true);
    const p = planScene({ contents, result, apparatus: ["试管"] });
    expect(p.precipitate?.color).toBe(PRECIPITATE_COLOR.AgCl);
    expect(p.bubbles).toBeNull();
  });
});

describe("产物挑选", () => {
  it("从产物中分别挑出气体与沉淀，忽略占位化学式", () => {
    expect(pickGas([s("H2", "氢气", "gas"), s("salt", "盐", "salt")])).toBe("H2");
    expect(pickGas([s("H2O", "水", "water")])).toBeNull();
    // "Zn-salt" 这类占位产物不应被当作沉淀
    expect(pickPrecipitate([s("Zn-salt", "盐", "salt"), s("H2", "氢气", "gas")])).toBeNull();
    expect(pickPrecipitate([s("AgCl", "氯化银", "salt")])).toBe("AgCl");
  });
});

describe("加热与火焰", () => {
  it("外部加热态标记 heating", () => {
    const p = planScene({
      contents: [s("NaCl", "氯化钠", "salt")],
      result: null,
      apparatus: ["烧杯"],
      heated: true,
    });
    expect(p.heating).toBe(true);
  });

  it("金属与酸产气放热不应误判为燃烧火焰", () => {
    const contents = [s("Zn", "锌", "metal"), s("HCl", "盐酸", "acid")];
    const p = planScene({ contents, result: react(contents), apparatus: ["试管"] });
    expect(p.flame).toBe(false);
    expect(p.bubbles).not.toBeNull();
  });
});

describe("补充产气推断", () => {
  it("碳酸盐 + 酸 + 石灰水：引擎只报沉淀，场景仍须冒 CO₂ 气泡", () => {
    const contents = [
      s("Na2CO3", "碳酸钠", "carbonate"),
      s("HCl", "盐酸", "acid"),
      s("Ca(OH)2", "氢氧化钙", "base"),
    ];
    const result = react(contents);
    // 引擎命中「CO₂ 使石灰水变浑浊」，产气被单规则匹配吞掉
    expect(result.producesPrecipitate).toBe(true);
    const p = planScene({ contents, result, apparatus: ["锥形瓶"] });
    expect(p.bubbles).not.toBeNull();
    expect(p.precipitate).not.toBeNull();
  });

  it("无酸时不做产气补充，避免凭空冒泡", () => {
    expect(inferGasFormula([s("Na2CO3", "碳酸钠", "carbonate")])).toBeNull();
    expect(inferGasFormula([s("NaCl", "氯化钠", "salt"), s("HCl", "盐酸", "acid")])).toBeNull();
  });

  it("碳酸盐遇酸推 CO₂，活泼金属遇酸推 H₂", () => {
    expect(inferGasFormula([s("CaCO3", "碳酸钙", "carbonate"), s("HCl", "盐酸", "acid")])).toBe("CO2");
    expect(inferGasFormula([s("Zn", "锌", "metal"), s("HCl", "盐酸", "acid")])).toBe("H2");
  });

  it("未反应时不冒泡", () => {
    const contents = [s("Na2CO3", "碳酸钠", "carbonate"), s("HCl", "盐酸", "acid")];
    const p = planScene({ contents, result: null, apparatus: ["试管"] });
    expect(p.bubbles).toBeNull();
  });
});

describe("指示剂与酸碱环境", () => {
  const phenolphthalein = s("phenolphthalein", "酚酞", "indicator");
  const litmus = s("litmus", "石蕊", "indicator");

  it("酚酞遇碱变紫红，遇酸保持无色", () => {
    const base = [s("NaOH", "氢氧化钠", "base"), phenolphthalein];
    const acid = [s("HCl", "盐酸", "acid"), phenolphthalein];
    expect(planScene({ contents: base, result: null, apparatus: ["烧杯"] }).liquid).toEqual(
      INDICATOR_COLORS.phenolphthalein.base,
    );
    expect(planScene({ contents: acid, result: null, apparatus: ["烧杯"] }).liquid).toEqual(
      CLEAR_TINT,
    );
  });

  it("石蕊在酸 / 中 / 碱三种环境给出三种颜色", () => {
    const cases: Array<[Substance[], "acid" | "neutral" | "base"]> = [
      [[s("HCl", "盐酸", "acid"), litmus], "acid"],
      [[s("NaCl", "氯化钠", "salt"), litmus], "neutral"],
      [[s("NaOH", "氢氧化钠", "base"), litmus], "base"],
    ];
    for (const [contents, env] of cases) {
      const p = planScene({ contents, result: null, apparatus: ["试管"] });
      expect(p.liquid).toEqual(INDICATOR_COLORS.litmus[env]);
    }
  });

  it("酸碱共存时按引擎 pH 趋势定环境（中和滴定过量端）", () => {
    const contents = [s("HCl", "盐酸", "acid"), s("NaOH", "氢氧化钠", "base"), phenolphthalein];
    expect(acidBaseEnv(contents, null)).toBe("neutral");
    expect(acidBaseEnv(contents, { ...react(contents), phTrend: "increase" })).toBe("base");
    expect(acidBaseEnv(contents, { ...react(contents), phTrend: "decrease" })).toBe("acid");
  });

  it("底液本身有色时不被指示剂色覆盖（高锰酸钾仍是紫色）", () => {
    const contents = [s("KMnO4", "高锰酸钾", "oxidizer"), litmus];
    const p = planScene({ contents, result: null, apparatus: ["试管"] });
    expect(p.liquid).toEqual(SOLUTION_TINT.KMnO4);
  });

  it("无指示剂时液色不受酸碱环境影响", () => {
    const contents = [s("NaOH", "氢氧化钠", "base")];
    expect(planScene({ contents, result: null, apparatus: ["烧杯"] }).liquid).toEqual(CLEAR_TINT);
  });

  it("findIndicator 只认 indicator 类物质", () => {
    expect(findIndicator([s("HCl", "盐酸", "acid"), litmus])).toBe("litmus");
    expect(findIndicator([s("HCl", "盐酸", "acid")])).toBeNull();
  });
});

describe("有色产物驱动变色", () => {
  it("Fe³⁺ + SCN⁻ 生成血红配合物，液色取产物色", () => {
    const contents = [s("FeCl3", "氯化铁", "salt"), s("KSCN", "硫氰化钾", "salt")];
    const result = react(contents);
    const p = planScene({ contents, result, apparatus: ["试管"] });
    expect(result.colorChange).toBe(true);
    // 产物（血红）优先于底液氯化铁的黄棕
    expect(p.liquid).not.toEqual(SOLUTION_TINT.FeCl3);
  });

  it("有色产物化学式都已收录，不会退化成无色", () => {
    for (const f of ["Fe(SCN)3", "[Cu(NH3)4]2+", "Mn2+", "I2-starch", "KFe[Fe(CN)6]", "fe-scn"]) {
      expect(SOLUTION_TINT[f], f).toBeDefined();
    }
  });
});

// 「难溶固体逐渐溶解消失」是十余个实验的唯一看点（卤化银溶于氨水、
// 氢氧化锌两性、硫化银电解还原…）。此前固体判定只认 5 个难溶碱的白名单，
// 这些实验一律 solid=null，观众看到的是一杯清水里什么都没发生。
describe("难溶物按固体渲染", () => {
  it("难溶盐投入时能画出固体，并在溶解反应中标记为正在溶解", () => {
    const cases: Array<[string, string, string]> = [
      ["AgCl", "氯化银", "salt"],
      ["Ag2CO3", "碳酸银", "salt"],
      ["Zn(OH)2", "氢氧化锌", "base"],
      ["Ni(OH)2", "氢氧化镍", "base"],
    ];
    for (const [formula, name, category] of cases) {
      const contents = [
        s(formula, name, category as Substance["category"]),
        s("NH3·H2O", "氨水", "base"),
      ];
      const plan = planScene({ contents, result: react(contents), apparatus: ["试管"] });
      expect(plan.solid?.formula, name).toBe(formula);
      expect(plan.solid?.dissolving, name).toBe(true);
    }
  });

  it("可溶盐不画固体，避免把溶液画成一堆粉末", () => {
    const contents = [s("NaCl", "氯化钠", "salt"), s("AgNO3", "硝酸银", "salt")];
    expect(planScene({ contents, result: react(contents), apparatus: ["试管"] }).solid).toBeNull();
  });

  it("凡能成为固体的物质都有 3D 外观，不会退化成灰色颗粒", () => {
    for (const f of Object.keys(PRECIPITATE_COLOR)) {
      expect(hasSolidLook(f), f).toBe(true);
    }
  });
});

describe("非典型固体的渲染", () => {
  // 二氧化锰是黑色粉末催化剂，category 却记成 oxidizer；木炭、红磷只能记成
  // other —— 三者都不溶于水，实验里只可能是固体，漏判就成了"空杯子里冒泡"
  it("二氧化锰 / 木炭 / 红磷按固体渲染", () => {
    const cases: Array<[string, string, Substance["category"]]> = [
      ["MnO2", "二氧化锰", "oxidizer"],
      ["C", "木炭", "other"],
      ["P", "红磷", "other"],
    ];
    for (const [formula, name, category] of cases) {
      const contents = [s(formula, name, category), s("H2O2", "过氧化氢", "oxidizer")];
      expect(pickSolid(contents)?.formula, name).toBe(formula);
    }
  });

  // 高锰酸钾多数实验里是紫红色溶液作氧化剂，唯独单独投入时是紫黑晶体粉末
  it("高锰酸钾单独投入算固体，与溶液共存时不算", () => {
    const kmno4 = s("KMnO4", "高锰酸钾", "oxidizer");
    expect(pickSolid([kmno4])?.formula).toBe("KMnO4");
    expect(pickSolid([kmno4, s("H2C2O4", "草酸", "reducer")])).toBeNull();
  });
});
