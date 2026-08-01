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
import { electrochemExperiments } from "./electrochem";
import { coordination2Experiments } from "./coordination2";
import { acidBase2Experiments } from "./acid-base2";
import { gas2Experiments } from "./gas2";
import { precipitation2Experiments } from "./precipitation2";
import { redox2Experiments } from "./redox2";
import { metal2Experiments } from "./metal2";
import { organic2Experiments } from "./organic2";
import { thermo2Experiments } from "./thermo2";
import { analysis2Experiments } from "./analysis2";
import { acidBase3Experiments } from "./acid-base3";
import { gas3Experiments } from "./gas3";
import { precipitation3Experiments } from "./precipitation3";
import { redox3Experiments } from "./redox3";
import { metal3Experiments } from "./metal3";
import { coordination3Experiments } from "./coordination3";
import { organic3Experiments } from "./organic3";
import { thermo3Experiments } from "./thermo3";
import { analysis3Experiments } from "./analysis3";
import { electrochem3Experiments } from "./electrochem3";

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
  ...electrochemExperiments,
  ...coordination2Experiments,
  ...acidBase2Experiments,
  ...gas2Experiments,
  ...precipitation2Experiments,
  ...redox2Experiments,
  ...metal2Experiments,
  ...organic2Experiments,
  ...thermo2Experiments,
  ...analysis2Experiments,
  ...acidBase3Experiments,
  ...gas3Experiments,
  ...precipitation3Experiments,
  ...redox3Experiments,
  ...metal3Experiments,
  ...coordination3Experiments,
  ...organic3Experiments,
  ...thermo3Experiments,
  ...analysis3Experiments,
  ...electrochem3Experiments,
];

export type { ExperimentSeed, ReactionProbe } from "./types";
