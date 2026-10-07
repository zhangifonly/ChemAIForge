// 焰色反应模型的行为测试（先于实现编写）。
// 可能出错的方式：
//  1. 由谱线合成的焰色色相不对（钾不是紫、铜不是绿、钠不是黄）
//  2. 钴玻璃没有滤掉钠黄，或把钾紫也一起滤没了 —— 那就失去用钴玻璃的意义
//  3. 铂丝不清洗时上一个样品的残留不影响下一次（真实实验最常见的错误被模型抹掉了）
//  4. 新铂丝本身没有钠污染（实际上几乎总有，所以要先蘸盐酸灼烧）
//  5. 钠钾混合样品不用钴玻璃时看不出钾（黄光掩盖紫光），用了又看不出钠
//  6. 灼烧无限进行后仍有残留 / 残留变负
import { describe, expect, it } from "vitest";
import {
  burn,
  cobaltT,
  dip,
  dipAcid,
  emission,
  flameColor,
  hueOf,
  isClean,
  newWire,
  visibleElements,
  type Element,
} from "./model";

/** 把铂丝洗干净：蘸盐酸灼烧，重复到干净为止 */
function cleaned() {
  let w = newWire();
  for (let i = 0; i < 6 && !isClean(w); i++) w = burn(dipAcid(w), 5);
  return w;
}
const hueFor = (els: Element[], cobalt = false) => hueOf(flameColor(emission(dip(cleaned(), els)), cobalt));

describe("焰色：色相", () => {
  it.each([
    ["Na", 40, 62], // 黄
    ["K", 255, 320], // 浅紫
    ["Li", 340, 375], // 紫红（跨 0°，用 360+ 表示）
    ["Ca", 5, 32], // 砖红
    ["Sr", 345, 372], // 洋红
    ["Cu", 95, 175], // 绿
    ["Ba", 65, 115], // 黄绿
  ] as const)("%s 的焰色色相在 %d°–%d°", (el, lo, hi) => {
    let h = hueFor([el]);
    if (h < lo) h += 360;
    expect(h).toBeGreaterThanOrEqual(lo);
    expect(h).toBeLessThanOrEqual(hi);
  });
});

describe("焰色：钴玻璃", () => {
  it("滤去钠的 589 nm 黄光，保留钾的 766 nm 与 404 nm", () => {
    expect(cobaltT(589)).toBeLessThan(0.05);
    expect(cobaltT(766)).toBeGreaterThan(0.5);
    expect(cobaltT(404)).toBeGreaterThan(0.4);
  });

  it("钠钾混合：不用钴玻璃时只看得出钠，用了只看得出钾", () => {
    const lines = emission(dip(cleaned(), ["Na", "K"]));
    expect(visibleElements(lines, false)).toEqual(["Na"]);
    expect(visibleElements(lines, true)).toEqual(["K"]);
  });
});

describe("焰色：铂丝的清洁", () => {
  it("新铂丝带有钠污染，灼烧呈黄色，必须先洗", () => {
    const w = newWire();
    expect(isClean(w)).toBe(false);
    expect(visibleElements(emission(w), false)).toContain("Na");
  });

  it("只灼烧不蘸盐酸，钠残留去得很慢；蘸盐酸后灼烧几次就干净", () => {
    expect(isClean(burn(newWire(), 5))).toBe(false);
    expect(isClean(cleaned())).toBe(true);
  });

  it("测完氯化钠不清洗就测钾盐，看到的仍是黄色", () => {
    const afterNa = burn(dip(cleaned(), ["Na"]), 2);
    const lines = emission(dip(afterNa, ["K"]));
    expect(visibleElements(lines, false)).toEqual(["Na"]);
    const h = hueOf(flameColor(lines, false));
    expect(h).toBeGreaterThan(35);
    expect(h).toBeLessThan(65);
  });

  it("持续灼烧样品逐渐烧尽，残留不为负", () => {
    const w = burn(dip(cleaned(), ["Cu"]), 3600);
    expect(isClean(w)).toBe(true);
    for (const v of Object.values(w.residue)) expect(v).toBeGreaterThanOrEqual(0);
  });

  it("干净铂丝的火焰没有可辨认的元素", () => {
    expect(visibleElements(emission(cleaned()), false)).toEqual([]);
  });
});
