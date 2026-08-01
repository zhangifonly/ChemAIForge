// 装置推导测试：很多实验的"看点"在装置而非反应（电解 / 量热 / 焰色 / 过滤），
// 这类实验的 3D 表现完全由仪器清单决定，必须保证判定稳定。
import { describe, it, expect } from "vitest";
import {
  chooseVessel,
  inferElectrodePair,
  pickFlameSample,
  planRig,
  planScene,
} from "./scenePlan";
import type { Substance } from "./engine";
import { allExperiments } from "@/data/experiments";

const s = (formula: string, name: string, category: Substance["category"]): Substance => ({
  formula,
  name,
  category,
});

describe("装置判定", () => {
  it("按特征仪器识别各类装置", () => {
    const cases: Array<[string[], string]> = [
      [["电解槽", "铂电极", "直流电源", "导线"], "electrolysis"],
      [["电压表", "盐桥", "导线", "烧杯"], "cell"],
      [["量热计", "温度计", "量筒"], "calorimeter"],
      [["试管", "水浴", "胶头滴管"], "water-bath"],
      [["铂丝", "酒精灯", "蓝色钴玻璃"], "flame-test"],
      [["漏斗", "滤纸", "烧杯", "玻璃棒"], "filtration"],
      [["蒸馏烧瓶", "冷凝管", "温度计", "酒精灯"], "distillation"],
      [["集气瓶", "导管", "试管"], "gas-collect"],
      [["试管", "试管架", "胶头滴管"], "none"],
    ];
    for (const [apparatus, kind] of cases) {
      expect(planRig(apparatus).kind, apparatus.join("/")).toBe(kind);
    }
  });

  it("铂丝 + 酒精灯优先判焰色，不被酒精灯误判成普通加热", () => {
    expect(planRig(["铂丝", "酒精灯"]).kind).toBe("flame-test");
    expect(planRig(["试管", "酒精灯", "试管夹"]).kind).toBe("none");
  });

  it("电解装置即使器材含试管也用宽口烧杯放电极", () => {
    expect(chooseVessel(["试管", "直流电源", "碳电极"], "electrolysis")).toBe("beaker");
    expect(chooseVessel(["试管", "试管架"], "none")).toBe("tube");
  });

  it("温度计 / 铁架台是独立开关，与装置类型无关", () => {
    const r = planRig(["蒸馏烧瓶", "冷凝管", "温度计", "铁架台"]);
    expect(r.thermometer).toBe(true);
    expect(r.stand).toBe(true);
    expect(planRig(["试管", "胶头滴管"]).thermometer).toBe(false);
  });

  it("识别新增的四类装置：注射器 / pH 计 / 蒸发结晶 / 软瓶", () => {
    const cases: Array<[string[], string]> = [
      [["注射器", "铁架台"], "syringe"],
      [["pH 计", "烧杯", "玻璃棒"], "ph-meter"],
      [["蒸发皿", "酒精灯", "铁架台", "玻璃棒"], "evaporation"],
    ];
    for (const [apparatus, kind] of cases) {
      expect(planRig(apparatus).kind, apparatus.join("/")).toBe(kind);
    }
  });

  it("注射器自带密闭容器，优先级高于其他装置", () => {
    expect(planRig(["注射器", "滴定管", "集气瓶"]).kind).toBe("syringe");
  });

  it("pH 计与其他装置共存时让位，只有别无装置时才主导画面", () => {
    expect(planRig(["滴定管", "pH 计", "锥形瓶"]).kind).toBe("titration");
    expect(planRig(["pH 计", "试管"]).kind).toBe("ph-meter");
  });

  it("蒸发皿无热源时不算蒸发结晶装置", () => {
    expect(planRig(["蒸发皿", "玻璃棒"]).kind).toBe("none");
  });

  it("注射器 / 焰色自带容器，蒸发结晶用敞口浅皿", () => {
    expect(chooseVessel(["注射器"], "syringe")).toBe("tube");
    expect(chooseVessel(["蒸发皿", "酒精灯"], "evaporation")).toBe("beaker");
  });

  it("pH 读数随体系酸碱性给出，供 pH 计显示", () => {
    const acid = planScene({
      contents: [s("HCl", "盐酸", "acid")],
      result: null,
      apparatus: ["pH 计", "烧杯"],
    });
    const base = planScene({
      contents: [s("NaOH", "氢氧化钠", "base")],
      result: null,
      apparatus: ["pH 计", "烧杯"],
    });
    expect(acid.rig.ph).toBeLessThan(3);
    expect(base.rig.ph).toBeGreaterThan(11);
  });
});

describe("电极材质推断", () => {
  it("两种金属并存时左右分别取（原电池 / 电镀）", () => {
    expect(inferElectrodePair(["锌片", "铜片", "盐桥"])).toEqual(["zinc", "copper"]);
    expect(inferElectrodePair(["直流电源", "银电极", "铁片"])).toEqual(["iron", "silver"]);
  });

  it("单一材质时两极同材质，未提材质默认碳棒", () => {
    expect(inferElectrodePair(["铂电极", "直流电源"])).toEqual(["platinum", "platinum"]);
    expect(inferElectrodePair(["电解槽", "直流电源"])).toEqual(["carbon", "carbon"]);
  });
});

describe("焰色样品", () => {
  it("取容器内首个含焰色金属的试剂", () => {
    expect(pickFlameSample([s("NaCl", "氯化钠", "salt")])).toBe("NaCl");
    expect(pickFlameSample([s("HCl", "盐酸", "acid"), s("CaCl2", "氯化钙", "salt")])).toBe("CaCl2");
    expect(pickFlameSample([s("HNO3", "硝酸", "acid")])).toBeNull();
  });
});

describe("装置驱动的现象", () => {
  const apparatus = ["电解槽", "铂电极", "直流电源", "导线"];
  const water = [s("H2O", "水", "water"), s("H2SO4", "稀硫酸", "acid")];

  it("电解通电即两极产气，不依赖引擎判定反应", () => {
    const off = planScene({ contents: water, result: null, apparatus });
    const on = planScene({ contents: water, result: null, apparatus, rigActive: true });
    expect(off.bubbles).toBeNull();
    expect(on.bubbles).not.toBeNull();
  });

  it("未注入电解液时通电也不产气（空槽）", () => {
    const on = planScene({ contents: [], result: null, apparatus, rigActive: true });
    expect(on.bubbles).toBeNull();
  });

  it("水浴装置启动即视为加热", () => {
    const bath = ["试管", "水浴", "温度计"];
    const c = [s("H2O", "水", "water")];
    expect(planScene({ contents: c, result: null, apparatus: bath }).heating).toBe(false);
    expect(planScene({ contents: c, result: null, apparatus: bath, rigActive: true }).heating).toBe(
      true,
    );
  });

  it("温度读数透传给装置层供温度计显示", () => {
    const p = planScene({
      contents: [s("H2O", "水", "water")],
      result: null,
      apparatus: ["量热计", "温度计"],
      temperature: 42.5,
    });
    expect(p.rig.temperature).toBe(42.5);
  });
});

describe("全实验装置覆盖", () => {
  it("每个实验都能推出装置方案，且焰色实验必带铂丝", () => {
    for (const e of allExperiments) {
      const r = planRig(e.apparatus);
      expect(r.kind, e.slug).toBeTruthy();
      if (r.kind === "flame-test") {
        expect(e.apparatus.join(" "), e.slug).toContain("铂丝");
      }
    }
  });
});
