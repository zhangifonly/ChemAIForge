// probe → 引擎输入的统一转换
//
// 需要加热的反应（酯化、银镜、铝热、各类燃烧）在常温下引擎不给结果，
// 因此凡是用 probe 驱动引擎的地方（测试、场景规划、讲解）都必须带上条件。
// 各处自己拼 conditions 迟早漏一个，于是收敛到这里一处。
import type { ReactionConditions, Substance } from "@/lib/chem/engine";
import { HEAT_THRESHOLD } from "@/lib/chem/engine";
import { resolveSubstance } from "@/components/lab/reagents";
import type { ExperimentSeed } from "./types";

/** 把 probe 的试剂名解析为引擎输入物质 */
export function probeSubstances(exp: ExperimentSeed): Substance[] {
  return (exp.probe?.reagentKeys ?? []).map(resolveSubstance);
}

/** 该实验驱动引擎时应使用的反应条件 */
export function probeConditions(exp: ExperimentSeed): ReactionConditions {
  return exp.probe?.heated
    ? { heated: true, temperature: HEAT_THRESHOLD + 20 }
    : {};
}
