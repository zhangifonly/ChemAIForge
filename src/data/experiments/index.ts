// 实验目录聚合入口
// 合并各主题批次文件，导出全部实验列表。批次文件每个不超过 ~100 行，便于维护。
import type { ExperimentSeed } from "./types";
import { acidBaseExperiments } from "./acid-base";
import { gasExperiments } from "./gas";
import { precipitationExperiments } from "./precipitation";
import { redoxExperiments } from "./redox";
import { metalExperiments } from "./metal";
import { coordinationExperiments } from "./coordination";
import { organicExperiments } from "./organic";
import { thermoExperiments } from "./thermo";
import { analysisExperiments } from "./analysis";

export const allExperiments: ExperimentSeed[] = [
  ...acidBaseExperiments,
  ...gasExperiments,
  ...precipitationExperiments,
  ...redoxExperiments,
  ...metalExperiments,
  ...coordinationExperiments,
  ...organicExperiments,
  ...thermoExperiments,
  ...analysisExperiments,
];

export type { ExperimentSeed, ReactionProbe } from "./types";
