// 化学正确性守护测试
//
// 为什么需要它：probe.test.ts 断言「引擎输出 == probe.expect」，而 probe.expect 当初
// 就是照着引擎输出写的 —— 这是循环验证，只能保证"能反应"，不能保证"反应的是标题
// 所说的那个反应"。历史上因此漏掉了一批错误（如 prussian-blue 用氢氧化钠冒充铁氰化钾、
// 硬水配位滴定的试剂表里没有 EDTA）。
//
// 本文件改用外部事实做校验：拿 title/description 这段人写的自然语言当作真相，
// 断言其中点名的物质确实出现在 reagents 里，且 apparatus 里不混入试剂。
import { describe, expect, it } from "vitest";
import { allExperiments } from "@/data/experiments";
import { resolveSubstance } from "@/components/lab/reagents";

// 描述里紧跟这些词出现的物质是「产物」而非试剂，不应要求出现在 reagents 中
// （如"溶于稀硫酸生成蓝色硫酸铜溶液"里的硫酸铜、"水解为葡萄糖"里的葡萄糖）。
const PRODUCT_MARKERS =
  "生成|析出|水解为|转化为|变为|得到|放出|产生|制得|逸出|冒出|还原产物为|氧化产物为";

/** 会在描述里被点名、且必须作为试剂出现的物质关键字 */
const NAMED_SUBSTANCES = [
  "铁氰化钾", "亚铁氰化钾", "硫代硫酸钠", "EDTA", "铬黑T", "氯化钴",
  "氢氧化铝", "碳酸氢铵", "碳酸铵", "二氧化氮", "四氧化二氮", "油脂",
  "硫酸铜", "氯化铁", "硫氰酸钾", "高锰酸钾", "重铬酸钾", "过氧化氢",
  "碳酸钙", "氢氧化钠", "氢氧化钙", "硝酸银", "氯化钡", "苯酚", "乙醇",
  "乙酸", "葡萄糖", "蔗糖", "淀粉", "酚酞", "石蕊", "甲基橙",
];

/** 出现在 apparatus 里即视为「把试剂当成了仪器」的词 */
const REAGENT_ONLY_WORDS = ["溶液", "试剂", "缓冲", "指示剂", "标准液"];

describe("实验数据化学正确性", () => {
  it("description 中作为反应物点名的物质必须出现在 reagents 里", () => {
    const offenders: string[] = [];
    for (const e of allExperiments) {
      const text = `${e.title}${e.description}`;
      // 指示剂常以"湿润石蕊试纸"这类形态列在 apparatus，故一并视为已提供
      const bag = [...e.reagents, ...e.apparatus].join(" ");
      for (const sub of NAMED_SUBSTANCES) {
        // 「亚铁氰化钾」含子串「铁氰化钾」，命中长名时不再追究短名
        if (sub === "铁氰化钾" && text.includes("亚铁氰化钾")) continue;
        if (sub === "碳酸铵" && text.includes("碳酸氢铵")) continue;
        if (!text.includes(sub) || bag.includes(sub)) continue;
        // 紧跟产物标志词出现（同一分句内）的，是产物，跳过
        const asProduct = new RegExp(`(${PRODUCT_MARKERS})[^，。；]{0,8}${sub}`);
        if (asProduct.test(text)) continue;
        offenders.push(`${e.slug}: 描述点名「${sub}」但 reagents 中没有`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("apparatus 只放仪器，不得混入试剂或溶液", () => {
    const offenders: string[] = [];
    for (const e of allExperiments) {
      for (const a of e.apparatus) {
        if (REAGENT_ONLY_WORDS.some((w) => a.includes(w))) {
          offenders.push(`${e.slug}: apparatus 含试剂「${a}」`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  // 试剂写进了数据、却忘了在 reagentRules 里登记，会静默退化成惰性的 other 类：
  // 拖进画布毫无现象，且没有任何测试会失败。这条把它变成硬错误。
  it("每个试剂都能被试剂库解析（不得静默退化为 other 兜底）", () => {
    const offenders: string[] = [];
    for (const e of allExperiments) {
      for (const label of e.reagents) {
        // 命中规则时会给出化学式（如 淀粉→starch、硫粉→S）；未命中则原样返回中文标签
        if (resolveSubstance(label).formula === label) {
          offenders.push(`${e.slug}: 试剂「${label}」未在 reagentRules 中登记`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
