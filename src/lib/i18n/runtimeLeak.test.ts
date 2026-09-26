// 运行时拼接文本的汉字泄漏守卫。
//
// 国际化的漏网之鱼大多不在源码字符串里，而在运行时拼接处：引擎方程式、
// 讲解口播、导师自动提问、曲线标记。这些文本在源码里看不到成句，只有把引擎
// 真跑一遍、用外语词条拼出来，才看得到里面是否还夹着汉字。
// scripts/i18n-leak-check.mjs 要起 dev server，这里把同一件事做成单测，每次都跑。
import { describe, expect, it } from "vitest";
import { allExperiments } from "@/data/experiments";
import { resolveSubstance } from "@/components/lab/reagents";
import { react } from "@/lib/chem/engine";
import { probeConditions } from "@/data/experiments/probeInput";
import { buildLesson } from "@/components/lab/lesson/buildLesson";
import { contextualPrompt } from "@/components/ai/labContext";
import { markLabel } from "@/components/lab/markLabel";
import { plainT } from "./plainT";
import en from "../../../messages/en.json";
import phenomenaEn from "../../../content/phenomena-en.json";
import contentEn from "../../../content/en.json";
import glossaryEn from "./glossary/en.json";

const CJK = /[一-鿿]/;
const phrases = phenomenaEn as Record<string, string>;
const phrase = (t: string) => phrases[t] ?? t;
const terms = { ...glossaryEn.reagents, ...glossaryEn.apparatus } as Record<string, string>;
const term = (zh: string) => terms[zh] ?? zh;
const content = contentEn as Record<string, { description: string; objectives: string[] }>;

/** 探针实验的引擎结果：覆盖全库实际会出现的反应 */
const probed = allExperiments
  .filter((e) => e.probe)
  .map((e) => ({ exp: e, r: react(e.probe!.reagentKeys.map(resolveSubstance), probeConditions(e)) }));

describe("英语下运行时拼接文本不夹汉字", () => {
  it("引擎现象描述经查表后无汉字", () => {
    const leaked = probed
      .map(({ r }) => r.description)
      .filter((d): d is string => Boolean(d))
      .filter((d) => CJK.test(phrase(d)));
    expect([...new Set(leaked)].slice(0, 5), "现象描述有漏译").toEqual([]);
  });

  it("方程式经查表后无汉字（「点燃」「盐」「不溶解」这类词）", () => {
    const leaked = probed
      .map(({ r }) => r.equation)
      .filter((q): q is string => Boolean(q))
      .filter((q) => CJK.test(phrase(q)));
    expect([...new Set(leaked)].slice(0, 5), "方程式有漏译").toEqual([]);
  });

  it("讲解口播与步骤标题无汉字", () => {
    const t = plainT(en, "lesson");
    const leaked: string[] = [];
    for (const exp of allExperiments) {
      const c = content[exp.slug];
      const steps = buildLesson(exp, t, {
        description: c?.description,
        objectives: c?.objectives,
        terms,
        phrases,
      });
      for (const s of steps) {
        if (CJK.test(s.title)) leaked.push(`${exp.slug} 标题：${s.title}`);
        if (CJK.test(s.narration)) leaked.push(`${exp.slug}：${s.narration.slice(0, 40)}`);
      }
    }
    expect(leaked.slice(0, 5), `讲解有 ${leaked.length} 处漏译`).toEqual([]);
  });

  it("导师自动提问无汉字：它作为学生的话显示在对话框里", () => {
    const t = plainT(en, "tutor");
    const leaked = probed
      .map(({ r }) => contextualPrompt(r, t, phrase))
      .filter((p): p is string => Boolean(p) && CJK.test(p!));
    expect([...new Set(leaked)].slice(0, 3)).toEqual([]);
  });

  it("曲线标记无汉字", () => {
    const tOp = plainT(en, "op");
    const tLab = plainT(en, "lab");
    const marks = new Set<string>(["混合", "读数", "搅拌", "加热", "静置"]);
    for (const exp of allExperiments) {
      for (const r of exp.reagents) {
        marks.add(`加${resolveSubstance(r).name}`);
        marks.add(`移除${resolveSubstance(r).name}`);
      }
    }
    const leaked = [...marks].filter((m) => CJK.test(markLabel(m, tOp, tLab, term)));
    expect(leaked.slice(0, 5)).toEqual([]);
  });
});
