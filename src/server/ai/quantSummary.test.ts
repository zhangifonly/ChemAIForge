import { describe, expect, it } from "vitest";
import type { SessionMeasurement } from "@/server/session/types";
import { readingGroups, statsOf, summarizeQuantitative } from "./quantSummary";

function m(
  mark: string | undefined,
  temperature = 25,
  ph = 7,
  volume?: number,
): SessionMeasurement {
  return { ph, temperature, at: "2026-01-01T00:00:00.000Z", mark, volume };
}

describe("读数分组", () => {
  it("混合前后分成两组", () => {
    const groups = readingGroups([m("读数"), m("读数"), m("混合", 40), m("读数", 40)]);
    expect(groups.map((g) => g.length)).toEqual([2, 1]);
  });

  it("没有读数标记时返回空：混合快照不能当平行测定", () => {
    expect(readingGroups([m("混合"), m("加热")])).toEqual([]);
  });

  it("旧会话没有 mark 字段，同样不算平行测定", () => {
    expect(readingGroups([m(undefined), m(undefined)])).toEqual([]);
  });
});

describe("单组统计", () => {
  it("空组返回 null", () => {
    expect(statsOf([])).toBeNull();
  });

  it("取平均值并给出一致性判定", () => {
    const s = statsOf([m("读数", 24), m("读数", 26)]);
    expect(s?.temperatureMean).toBe(25);
    expect(s?.worstDeviation).toBeCloseTo(4, 10);
    expect(s?.consistency).toBe("fair");
  });

  it("单次测定不给偏差，也不拿 0 冒充完全一致", () => {
    const s = statsOf([m("读数", 25)]);
    expect(s?.worstDeviation).toBeNull();
    expect(s?.consistency).toBeNull();
  });

  it("没有体积的旧记录，体积均值为 null", () => {
    expect(statsOf([m("读数")])?.volumeMean).toBeNull();
  });

  it("部分记录带体积时只对有值的求均值", () => {
    const s = statsOf([m("读数", 25, 7, 10), m("读数", 25, 7, 20), m("读数")]);
    expect(s?.volumeMean).toBe(15);
  });

  it("pH 飘而温度稳，同样按更差的那路判定", () => {
    const s = statsOf([m("读数", 25, 1), m("读数", 25, 13)]);
    expect(s?.consistency).toBe("poor");
  });
});

describe("prompt 段落", () => {
  it("无读数时如实说明，不拿混合快照凑数", () => {
    const text = summarizeQuantitative([m("混合", 40)]);
    expect(text).toContain("未使用「读数」操作");
    expect(text).not.toContain("平均 pH");
  });

  it("给出平均值、相对偏差与结论评语", () => {
    const text = summarizeQuantitative([m("读数", 25), m("读数", 25)]);
    expect(text).toContain("平均温度=25.00℃");
    expect(text).toContain("最大相对平均偏差=0.00%");
    expect(text).toContain("数据一致性良好");
  });

  it("多组时标出最终一组，避免模型拿早期读数下结论", () => {
    const text = summarizeQuantitative([m("读数"), m("混合", 40), m("读数", 40)]);
    expect(text).toContain("共 2 组平行测定");
    expect(text).toContain("最终一组");
  });

  it("单组时不标「最终一组」，那句话只在有多组时才有意义", () => {
    expect(summarizeQuantitative([m("读数"), m("读数")])).not.toContain("最终一组");
  });

  it("要求模型直接引用数字而非定性描述", () => {
    const text = summarizeQuantitative([m("读数"), m("读数")]);
    expect(text).toContain("直接引用");
  });

  it("偏差过大时明确不可直接取平均", () => {
    const text = summarizeQuantitative([m("读数", 10), m("读数", 40)]);
    expect(text).toContain("重做平行测定");
  });
});
