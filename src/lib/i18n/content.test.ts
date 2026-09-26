// 实验内容译文取用层的行为守卫。
//
// 重点锁两件事：
//   1. reagents / apparatus 绝不能被翻译 —— 它们是引擎的匹配键，
//      译了就等于让 501 个实验的反应判定、3D 造型、操作按钮全部失效；
//   2. 搜索要同时覆盖原文与译文 —— 曾因先本地化再搜索而丢掉中文原文，
//      导致英语界面搜「滴定」一条都匹配不到。
import { describe, expect, it } from "vitest";
import type { ExperimentDTO } from "@/types/experiment";
import { localizeExperiment, localizeExperiments, searchableText } from "./content";
import { SOURCE_LOCALE } from "./locales";

const exp = {
  id: "e1",
  slug: "acid-base-titration",
  title: "酸碱中和滴定",
  description: "用标准盐酸滴定未知浓度的氢氧化钠溶液。",
  category: "ACID_BASE",
  difficulty: "MEDIUM",
  reagents: ["0.1 mol/L 盐酸标准液", "待测氢氧化钠溶液", "酚酞"],
  apparatus: ["酸式滴定管", "锥形瓶", "移液管", "铁架台"],
  objectives: ["理解中和滴定原理与终点判断", "规范使用滴定管", "计算未知浓度"],
  estimatedMinutes: 45,
  createdAt: "2026-01-01T00:00:00.000Z",
} as unknown as ExperimentDTO;

describe("套用实验译文", () => {
  it("源语言直接返回原对象，不做无谓的文件读取", async () => {
    await expect(localizeExperiment(exp, SOURCE_LOCALE)).resolves.toBe(exp);
  });

  it("英语下译出标题与描述", async () => {
    const out = await localizeExperiment(exp, "en");
    expect(out.title).not.toBe(exp.title);
    expect(out.title).toMatch(/[A-Za-z]/);
    expect(out.description).toMatch(/[A-Za-z]/);
  });

  it("试剂与仪器保持中文原文：它们是引擎匹配键，翻译会让反应判定失效", async () => {
    const out = await localizeExperiment(exp, "en");
    expect(out.reagents).toEqual(exp.reagents);
    expect(out.apparatus).toEqual(exp.apparatus);
  });

  it("objectives 条数与原文一致", async () => {
    const out = await localizeExperiment(exp, "en");
    expect(out.objectives).toHaveLength(exp.objectives.length);
  });

  it("basic 语种借道英语，而不是把汉字丢给不懂中文的人", async () => {
    // sq（阿尔巴尼亚语）只译了界面文案，没有内容译文
    const out = await localizeExperiment(exp, "sq");
    expect(out.title).not.toBe(exp.title);
    expect(out.title).toMatch(/[A-Za-z]/);
  });

  it("英语自身缺译时才回退中文原文，不会无限借道", async () => {
    const unknown = { ...exp, slug: "no-such-experiment" };
    const out = await localizeExperiment(unknown, "sq");
    expect(out.title).toBe(unknown.title);
  });

  it("库里没有的 slug 原样返回，不抛异常", async () => {
    const unknown = { ...exp, slug: "no-such-experiment" };
    const out = await localizeExperiment(unknown, "en");
    expect(out.title).toBe(unknown.title);
  });

  it("批量套译文保持顺序与条数", async () => {
    const list = [exp, { ...exp, slug: "hcl-naoh-neutralization" }];
    const out = await localizeExperiments(list, "en");
    expect(out).toHaveLength(2);
    expect(out[0].slug).toBe(list[0].slug);
    expect(out[1].slug).toBe(list[1].slug);
  });
});

describe("搜索文本", () => {
  it("源语言只含原文", async () => {
    const text = await searchableText(exp, SOURCE_LOCALE);
    expect(text).toContain("滴定");
  });

  it("译文语种同时含原文与译文：英语界面搜中文关键词也要能命中", async () => {
    const text = await searchableText(exp, "en");
    expect(text).toContain("滴定");
    expect(text).toContain("titration");
  });

  it("统一小写，调用方比对时无需再处理大小写", async () => {
    const text = await searchableText(exp, "en");
    expect(text).toBe(text.toLowerCase());
  });
});
