// 扩展反应规则聚合入口
// 将各主题规则模块合并为一个有序数组，供 reactions.ts 注入主规则集。
// 排序原则：特异性强（按具体化学式匹配）的规则排在按类别匹配的通用规则之前，
// 避免通用规则提前命中导致特异现象（如沉淀、产气）被吞掉。

import type { Reaction } from "./helpers";
import { kineticsRules } from "./kinetics";
import { organicRules } from "./organic";
import { precipitationRules } from "./precipitation";
import { gasRules } from "./gas";
import { redoxRules } from "./redox";
import { coordinationRules } from "./coordination";
import { metalRules } from "./metal";
import { dissolutionRules } from "./dissolution";
import { combustionRules } from "./combustion";
import { solubilityRules } from "./solubility";
import { oxidantRules } from "./oxidant";
import { oxideRules } from "./oxide";
import { complexRules } from "./complex";
import { organic2Rules } from "./organic2";
import { precipitation2Rules } from "./precipitation2";

export const extendedReactions: Reaction[] = [
  // 钟反应 / 速率类：约束多达四组分，特异性最高，须先于产气与浑浊类通用规则
  ...kineticsRules,
  // 有机官能团转化：芳烃取代/侧链氧化、不饱和烃加成、糖类水解、苯胺溴代。
  // 须排在 organicRules 之前——「苯甲醛 + 银氨」若落到通用银镜规则会打印
  // 脂肪醛的方程；也须排在 redoxRules 之前，否则「苯 + 溴 + 铁粉」会被
  // 「卤素 + 还原剂」抢走，取代放溴化氢这个核心现象就丢了
  ...organic2Rules,
  // 有机特征反应：银镜/酯化/醇钠/苯酚溴代，多含三组分约束，特异性最高
  ...organicRules,
  // 配位溶解 / 螯合专项：卤化银溶于氨水与定影液、氢氧化物溶于过量氨水、EDTA 螯合。
  // 必须排在 precipitationRules 与 solubilityRules 之前——否则「氯化银 + 氨水」
  // 会被沉淀兜底判成「仍是沉淀」，配位溶解这个核心现象就丢了
  ...complexRules,
  // 显色 / 配位：多依赖具体离子
  ...coordinationRules,
  // 沉淀复分解：按具体化学式匹配
  ...precipitationRules,
  // 沉淀补充组：过渡金属氢氧化物、铬酸盐、锶盐。须排在 solubilityRules 与
  // metalRules 之前，否则「硫酸镍 + 氢氧化钠」会落到中和/溶解兜底
  ...precipitation2Rules,
  // 氧化物专项：过氧化钠/氧化钠与水、两性氧化物溶于强碱、铝热反应。
  // 须排在 metalRules（含「金属氧化物 + 酸」通用条）与活泼金属+水之前，
  // 否则过氧化钠会被当成钠单质放氢气、氧化铝加碱会落空
  ...oxideRules,
  // 强氧化剂专项：制氯气 / 氯酸钾分解 / 碘量法 / Fe³⁺ 氧化 S²⁻。
  // 须排在通用产气与溶解度兜底之前——否则「二氧化锰 + 浓盐酸」会落到
  // 「金属氧化物 + 酸」，而「FeCl₃ + Na₂S」会被误判成硫化铁沉淀
  ...oxidantRules,
  // 燃烧 / 气体参与的反应：均按具体化学式匹配，须排在"酸性氧化物+碱"等
  // 通用产气规则之前，否则 O₂ + S 之类会被后面的规则抢先命中
  ...combustionRules,
  // 产气类：碳酸盐+酸、铵盐+碱、分解产气等
  ...gasRules,
  // 氧化还原：变色 / 褪色 / 置换
  ...redoxRules,
  // 金属相关：置换、与水反应等
  ...metalRules,
  // 溶解度表驱动的通用复分解兜底：覆盖上面未逐条列出的全部难溶组合，
  // 必须排在产气 / 显色 / 具体沉淀规则之后，只捡剩下的组合
  ...solubilityRules,
  // 溶解 / 稀释的热效应：不是化学反应，仅当体系只有"溶质 + 水"两种物质时才成立，
  // 必须排在全部真实反应之后，免得抢掉"某物质与水反应"这类真反应
  ...dissolutionRules,
];
