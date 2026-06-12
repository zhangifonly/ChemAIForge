// 扩展反应规则聚合入口
// 将各主题规则模块合并为一个有序数组，供 reactions.ts 注入主规则集。
// 排序原则：特异性强（按具体化学式匹配）的规则排在按类别匹配的通用规则之前，
// 避免通用规则提前命中导致特异现象（如沉淀、产气）被吞掉。

import type { Reaction } from "./helpers";
import { organicRules } from "./organic";
import { precipitationRules } from "./precipitation";
import { gasRules } from "./gas";
import { redoxRules } from "./redox";
import { coordinationRules } from "./coordination";
import { metalRules } from "./metal";

export const extendedReactions: Reaction[] = [
  // 有机特征反应：银镜/酯化/醇钠/苯酚溴代，多含三组分约束，特异性最高
  ...organicRules,
  // 显色 / 配位：多依赖具体离子
  ...coordinationRules,
  // 沉淀复分解：按具体化学式匹配
  ...precipitationRules,
  // 产气类：碳酸盐+酸、铵盐+碱、分解产气等
  ...gasRules,
  // 氧化还原：变色 / 褪色 / 置换
  ...redoxRules,
  // 金属相关：置换、与水反应等
  ...metalRules,
];
