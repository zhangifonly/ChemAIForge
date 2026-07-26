// 滴定模型的化学正确性测试：pH 曲线形状、突跃陡度、酚酞变色区间、浓度反算。
import { describe, it, expect } from "vitest";
import {
  DROP_ML,
  TITRATION,
  equivalenceMl,
  phAt,
  phenolphthaleinPink,
  calcAnalyteConc,
  relativeErrorPct,
  verdictAt,
  FADED_THRESHOLD,
  flaskLevelY,
  FLASK_LIQUID_TOP,
  FLASK_MOUTH_Y,
  dropsThisFrame,
  DROP_GEN_MAX_DT,
} from "./model";


describe("滴定模型 · 等当点", () => {
  it("等当点体积等于 c(碱)V(碱)/c(酸)，约 20.86 mL", () => {
    const ve = equivalenceMl();
    expect(ve).toBeCloseTo(20.86, 2);
    // 物料平衡：该体积盐酸的物质的量应等于碱的物质的量
    const nAcid = (ve * TITRATION.titrantConc) / 1000;
    const nBase = (TITRATION.analyteVolumeMl * TITRATION.analyteConc) / 1000;
    expect(nAcid).toBeCloseTo(nBase, 10);
  });

  it("等当点处强酸强碱滴定 pH 为 7", () => {
    expect(phAt(equivalenceMl())).toBeCloseTo(7, 1);
  });
});

describe("滴定模型 · pH 曲线", () => {
  it("起始为氢氧化钠溶液，pH 约 13", () => {
    expect(phAt(0)).toBeGreaterThan(12.9);
    expect(phAt(0)).toBeLessThan(13.2);
  });

  it("pH 随滴入体积单调下降", () => {
    let prev = phAt(0);
    for (let v = 0.5; v <= 30; v += 0.5) {
      const cur = phAt(v);
      expect(cur).toBeLessThanOrEqual(prev + 1e-9);
      prev = cur;
    }
  });

  it("突跃区极陡：等当点前后各半滴之间 pH 落差大于 3", () => {
    const ve = equivalenceMl();
    const drop = phAt(ve - DROP_ML) - phAt(ve + DROP_ML);
    expect(drop).toBeGreaterThan(3);
  });

  it("远离突跃区时缓冲平缓：滴到一半处每 mL 变化小于 0.5", () => {
    const half = equivalenceMl() / 2;
    expect(phAt(half) - phAt(half + 1)).toBeLessThan(0.5);
  });

  it("过量盐酸后转为酸性", () => {
    expect(phAt(equivalenceMl() + 5)).toBeLessThan(3);
  });
});

describe("滴定模型 · 酚酞指示剂", () => {
  it("强碱中满色，pH 8.2 以下无色", () => {
    expect(phenolphthaleinPink(13)).toBe(1);
    expect(phenolphthaleinPink(8.2)).toBe(0);
    expect(phenolphthaleinPink(7)).toBe(0);
  });

  it("变色范围内单调递增且落在 8.2~10", () => {
    let prev = -1;
    for (let ph = 8.0; ph <= 10.2; ph += 0.1) {
      const p = phenolphthaleinPink(ph);
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
    expect(phenolphthaleinPink(9.1)).toBeGreaterThan(0.2);
    expect(phenolphthaleinPink(9.1)).toBeLessThan(0.8);
  });

  it("酚酞褪色点略早于等当点，误差在半滴量级", () => {
    const ve = equivalenceMl();
    // 找到刚好褪色的体积
    let faded = 0;
    for (let v = 0; v <= 30; v += DROP_ML / 5) {
      if (phenolphthaleinPink(phAt(v)) < FADED_THRESHOLD) {
        faded = v;
        break;
      }
    }
    expect(faded).toBeGreaterThan(0);
    expect(Math.abs(faded - ve)).toBeLessThan(0.1); // 2 滴以内
  });
});

describe("滴定模型 · 定量计算", () => {
  it("用等当点体积反算浓度应还原真实值", () => {
    expect(calcAnalyteConc(equivalenceMl())).toBeCloseTo(TITRATION.analyteConc, 6);
    expect(Math.abs(relativeErrorPct(equivalenceMl()))).toBeLessThan(1e-6);
  });

  it("多滴一滴带来的相对误差为正且小于 0.5%", () => {
    const e = relativeErrorPct(equivalenceMl() + DROP_ML);
    expect(e).toBeGreaterThan(0);
    expect(e).toBeLessThan(0.5);
  });
});

describe("滴定模型 · 终点判定", () => {
  it("未到终点仍显粉红", () => {
    expect(verdictAt(0)).toBe("before");
    expect(verdictAt(equivalenceMl() - 1)).toBe("before");
  });

  it("刚褪色判为合格终点", () => {
    expect(verdictAt(equivalenceMl())).toBe("good");
    expect(verdictAt(equivalenceMl() + DROP_ML)).toBe("good");
  });

  it("明显过量判为过量", () => {
    expect(verdictAt(equivalenceMl() + 3)).toBe("over");
    expect(verdictAt(equivalenceMl() + 0.3)).toBe("over");
  });
});

describe("锥形瓶液面高度", () => {
  it("未滴入时为初始液面，且随放出体积单调上升", () => {
    expect(flaskLevelY(0)).toBe(FLASK_LIQUID_TOP);
    let prev = flaskLevelY(0);
    for (let v = 1; v <= 50; v += 1) {
      const y = flaskLevelY(v);
      expect(y).toBeGreaterThan(prev);
      prev = y;
    }
  });

  it("液面始终低于瓶口，负值与超量输入被夹住", () => {
    expect(flaskLevelY(50)).toBeLessThan(FLASK_MOUTH_Y);
    expect(flaskLevelY(-5)).toBe(FLASK_LIQUID_TOP);
    expect(flaskLevelY(999)).toBe(flaskLevelY(50));
  });
});

describe("液滴生成计时与帧率解耦", () => {
  /** 以帧步长 dt 跑 frames 帧，返回总滴数 */
  const total = (dt: number, frames: number, rate: number) => {
    let acc = 0;
    let n = 0;
    for (let i = 0; i < frames; i++) {
      const r = dropsThisFrame(acc, dt, rate);
      acc = r.acc;
      n += r.count;
    }
    return n;
  };

  it("低帧率与 60fps 在同样墙钟时间内滴数一致", () => {
    const fast = total(1 / 60, 600, 2); // 60fps × 10 秒
    const slow = total(1 / 8, 80, 2); // 8fps × 10 秒（帧步长仍在上限内）
    // 2 滴/秒 × 10 秒 ≈ 20 滴；浮点累加允许 1 滴误差，但两种帧率不得系统性偏差
    for (const n of [fast, slow]) {
      expect(n).toBeGreaterThanOrEqual(19);
      expect(n).toBeLessThanOrEqual(20);
    }
    expect(Math.abs(fast - slow)).toBeLessThanOrEqual(1);
  });

  it("单帧生成量受 DROP_GEN_MAX_DT 上限约束（防止切回标签页倾泻）", () => {
    const r = dropsThisFrame(0, 30, 6);
    expect(r.count).toBe(Math.floor(DROP_GEN_MAX_DT * 6));
  });

  it("关闭旋塞时清零累计器，不留下半滴", () => {
    const r = dropsThisFrame(0.9, 1 / 60, 0);
    expect(r).toEqual({ count: 0, acc: 0 });
  });

  it("余量跨帧累加，慢滴速下也能凑出整滴", () => {
    let acc = 0;
    let n = 0;
    for (let i = 0; i < 35; i++) {
      const r = dropsThisFrame(acc, 0.2, 0.5); // 0.5 滴/秒，共 7 秒
      acc = r.acc;
      n += r.count;
    }
    expect(n).toBe(3); // 单帧只累积 0.1 滴，仍须跨帧凑出 3 滴
  });
});
