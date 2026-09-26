import { describe, expect, it } from "vitest";
import {
  consistencyOf,
  groupReadings,
  mean,
  readingGroups,
  relativeDeviation,
  statsOf,
  READ_MARK,
} from "./quantitative";

function r(mark: string | undefined, temperature = 25, ph = 7) {
  return { ph, temperature, mark };
}

describe("按体系状态分组读数", () => {
  it("只挑出读数点，其余动作不进结果", () => {
    const got = groupReadings([r("取用"), r(READ_MARK), r("加热"), r(READ_MARK)]);
    expect(got).toHaveLength(2);
  });

  it("体系被改动后开新组", () => {
    const got = groupReadings([r(READ_MARK), r(READ_MARK), r("混合"), r(READ_MARK)]);
    expect(got.map((g) => g.group)).toEqual([0, 0, 1]);
  });

  it("首次读数之前的改动不算分组边界，否则第一组永远是空的", () => {
    const got = groupReadings([r("取用"), r("取用"), r(READ_MARK)]);
    expect(got.map((g) => g.group)).toEqual([0]);
  });

  it("无标记的纯采样点不分组", () => {
    const got = groupReadings([r(READ_MARK), r(undefined), r(READ_MARK)]);
    expect(got.map((g) => g.group)).toEqual([0, 0]);
  });

  it("空输入返回空数组", () => {
    expect(groupReadings([])).toEqual([]);
  });

  it("原样带回读数点本身，不丢字段", () => {
    const point = { ph: 3.2, temperature: 40, volume: 12.5, mark: READ_MARK };
    expect(groupReadings([point])[0].point).toBe(point);
  });
});

describe("平均值", () => {
  it("空数组返回 null，而不是 0", () => {
    expect(mean([])).toBeNull();
  });

  it("正常取算术平均", () => {
    expect(mean([24, 26])).toBe(25);
  });
});

describe("相对平均偏差", () => {
  it("单次测定返回 null：谈不上偏差", () => {
    expect(relativeDeviation([25])).toBeNull();
  });

  it("完全一致的读数偏差为 0", () => {
    expect(relativeDeviation([25, 25, 25])).toBe(0);
  });

  it("24 与 26 的相对平均偏差是 4%", () => {
    expect(relativeDeviation([24, 26])).toBeCloseTo(4, 10);
  });

  it("均值为 0 时返回 null，避免得出 Infinity", () => {
    expect(relativeDeviation([-5, 5])).toBeNull();
  });

  it("负均值按绝对值算，不返回负偏差", () => {
    expect(relativeDeviation([-24, -26])).toBeCloseTo(4, 10);
  });
});

describe("一致性档位", () => {
  it("1% 以内为良好", () => {
    expect(consistencyOf(0)).toBe("good");
    expect(consistencyOf(1)).toBe("good");
  });

  it("1%~5% 为偏大", () => {
    expect(consistencyOf(1.01)).toBe("fair");
    expect(consistencyOf(5)).toBe("fair");
  });

  it("超过 5% 必须重做", () => {
    expect(consistencyOf(5.01)).toBe("poor");
  });
});

describe("分组结果聚合", () => {
  it("按组把读数聚成数组，顺序与实验进行顺序一致", () => {
    const groups = readingGroups([
      r(READ_MARK, 24),
      r(READ_MARK, 26),
      r("混合", 40),
      r(READ_MARK, 40),
    ]);
    expect(groups.map((g) => g.length)).toEqual([2, 1]);
    expect(groups[1][0].temperature).toBe(40);
  });

  it("没有读数标记时返回空组，混合快照不能当平行测定", () => {
    expect(readingGroups([r("混合", 40), r("加热", 60)])).toEqual([]);
  });
});

describe("单组统计", () => {
  it("空组返回 null", () => {
    expect(statsOf([])).toBeNull();
  });

  it("给出平均值与一致性判定", () => {
    const s = statsOf([r(READ_MARK, 24), r(READ_MARK, 26)]);
    expect(s?.temperatureMean).toBe(25);
    expect(s?.worstDeviation).toBeCloseTo(4, 10);
    expect(s?.consistency).toBe("fair");
  });

  it("单次测定的偏差为 null，不拿 0 冒充完全一致", () => {
    const s = statsOf([r(READ_MARK, 25)]);
    expect(s?.worstDeviation).toBeNull();
    expect(s?.consistency).toBeNull();
  });

  it("温度稳而 pH 飘，仍按更差的那路判定", () => {
    expect(statsOf([r(READ_MARK, 25, 1), r(READ_MARK, 25, 13)])?.consistency).toBe(
      "poor",
    );
  });

  it("不带体积的读数体积均值为 null", () => {
    expect(statsOf([r(READ_MARK), r(READ_MARK)])?.volumeMean).toBeNull();
  });

  it("只对有体积的记录求均值", () => {
    const s = statsOf([
      { ph: 7, temperature: 25, volume: 10, mark: READ_MARK },
      { ph: 7, temperature: 25, volume: 20, mark: READ_MARK },
      { ph: 7, temperature: 25, mark: READ_MARK },
    ]);
    expect(s?.volumeMean).toBe(15);
  });
});
