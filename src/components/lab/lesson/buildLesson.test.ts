// 讲解生成器数据驱动测试：保证全部实验都能派生出结构合理的分步讲解。
import { describe, it, expect } from "vitest";
import { allExperiments } from "@/data/experiments";
import { resolveSubstance } from "../reagents";
import {
  isElectrolysisSetup,
  isGalvanicSetup,
  usesConductivity,
} from "../vesselGeom";
import { buildLesson } from "./buildLesson";
import { plainT } from "@/lib/i18n/plainT";
import zhMessages from "../../../../messages/zh.json";
import { chooseVessel, planRig } from "@/lib/chem/scenePlan";
import { react } from "@/lib/chem/engine";

// 用中文词条跑测试：断言里的文案判据（"取用"、"加热"等）仍按中文校验，
// 与改造前一致 —— 这些测试守的是讲解结构，不是某个语种的译文
const t = plainT(zhMessages, "lesson");

describe("buildLesson 为每个实验生成合理讲解", () => {
  it.each(allExperiments.map((e) => [e.slug, e] as const))(
    "%s",
    (_slug, exp) => {
      const steps = buildLesson(exp, t);
      const electrochem =
        isElectrolysisSetup(exp.apparatus) ||
        isGalvanicSetup(exp.apparatus) ||
        usesConductivity(exp.apparatus);

      // 至少包含 原理 + 准备 + 操作 + 现象 四步
      expect(steps.length).toBeGreaterThanOrEqual(4);

      // 首步为原理且清空容器
      expect(steps[0].phase).toBe("theory");
      expect(steps[0].action).toEqual({ kind: "reset" });

      // 必有一个操作阶段步骤
      expect(steps.some((s) => s.phase === "operate")).toBe(true);

      // 混合类实验恰有一个混合步骤；电化学实验无混合步骤
      const mixSteps = steps.filter((s) => s.action?.kind === "mix");
      expect(mixSteps).toHaveLength(electrochem ? 0 : 1);

      // 每个取用步骤的试剂都能被解析为具体物质
      for (const s of steps) {
        if (s.action?.kind === "add") {
          expect(s.action.reagent.length).toBeGreaterThan(0);
          expect(resolveSubstance(s.action.reagent).formula.length).toBeGreaterThan(0);
        }
        // 每步都有口播文字
        expect(s.narration.length).toBeGreaterThan(0);
      }
    },
  );
});

// 口播里提到的容器必须与 3D 里真正画出来的那个一致：原先三处写死容器名，
// 501 个实验里 313 个说着"加入烧杯"却画的是试管/锥形瓶，54 个更在同一段
// 讲解里先说烧杯、再说试管、又说烧杯。
describe("讲解里的容器名与 3D 场景一致", () => {
  it("每个实验的口播容器名都取自 chooseVessel", () => {
    const NAME: Record<string, string> = { beaker: "烧杯", tube: "试管", flask: "锥形瓶" };
    for (const exp of allExperiments) {
      const app = exp.apparatus ?? [];
      const want = NAME[chooseVessel(app, planRig(app).kind)];
      const text = buildLesson(exp, t)
        .map((s) => s.narration)
        .join("");
      for (const other of Object.values(NAME)) {
        if (other === want) continue;
        // 描述/目标里出现别的器皿是实验本身的表述，只校验由模板生成的三句
        expect(text.includes(`加入${other}中`), `${exp.slug} 说了「加入${other}中」`).toBe(false);
        expect(text.includes(`将${other}中的试剂`), `${exp.slug} 说了「将${other}中的试剂」`).toBe(
          false,
        );
      }
    }
  });
});

// 「现象」口播必须描述引擎真正算出的现象，而不是照搬测试探针的声明。
// probe.expect 只需声明关键字段（472 个带探针的实验里 87 个漏声明了
// 放热/变色/产气），拿它生成口播会让学生听到的与 3D 里看到的对不上。
describe("现象口播取自引擎实际结果", () => {
  it("引擎算出的每种现象都出现在口播里", () => {
    const bad: string[] = [];
    for (const exp of allExperiments) {
      // 电化学类的现象由电极引擎单独描述，不走混合反应
      if (
        isElectrolysisSetup(exp.apparatus) ||
        isGalvanicSetup(exp.apparatus) ||
        usesConductivity(exp.apparatus)
      )
        continue;
      const keys = exp.probe?.reagentKeys ?? exp.reagents.slice(0, 3);
      const r = react(keys.map(resolveSubstance), exp.probe?.heated ? { heated: true } : {});
      if (!r.reacted) continue;
      const text = buildLesson(exp, t).find((s) => s.id === "observe")?.narration ?? "";
      if (r.producesGas && !text.includes("气泡")) bad.push(`${exp.slug} 漏了产气`);
      if (r.producesPrecipitate && !text.includes("沉淀")) bad.push(`${exp.slug} 漏了沉淀`);
      if (r.thermal === "exothermic" && !text.includes("放出热量"))
        bad.push(`${exp.slug} 漏了放热`);
      if (r.thermal === "endothermic" && !text.includes("吸收热量"))
        bad.push(`${exp.slug} 漏了吸热`);
    }
    expect(bad).toEqual([]);
  });
});
