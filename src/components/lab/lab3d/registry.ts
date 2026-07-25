// 拥有 3D 版本的实验注册表。逐个实验做 3D 场景，此处登记 slug → 场景组件名。
// 未登记的实验只提供 2D 视图。新增 3D 实验时在此追加。

export const EXPERIMENTS_WITH_3D = new Set<string>([
  "iron-copper-sulfate", // 铁置换硫酸铜：铁钉表面析红铜、蓝液变浅
  "h2-from-zinc", // 锌与稀硫酸制氢：锌粒冒氢气泡上升
  // —— 气体与沉淀 ——
  "co2-preparation", // 二氧化碳制取：产气→导管→石灰水变浑浊
  "feoh3-precipitation", // 氢氧化铁：红棕絮状沉淀下沉
  "cuoh2-precipitation", // 氢氧化铜：蓝色絮状沉淀下沉
  // —— 变色与显色 ——
  "fe3-scn-coloring", // 硫氰合铁：无色瞬变血红
  "kmno4-oxalic-acid", // 高锰酸钾被草酸还原：紫红渐褪
  "copper-ammonia-complex", // 铜氨配离子：蓝沉淀→深蓝溶解
  // —— 燃烧与放热 ——
  "magnesium-burning", // 镁条燃烧：耀眼白光+白烟+白色氧化镁
  "o2-iron-combustion", // 铁丝在氧气中燃烧：火星四射+黑色熔珠
  // —— 电化学 ——
  "electrolysis-water", // 电解水：阴极产氢约 2 倍、阳极产氧 1 倍
  "copper-zinc-cell", // 锌铜原电池：电流计偏转+铜片析氢
  // —— 定量分析（精细场景，独立实现） ——
  "acid-base-titration", // 酸碱中和滴定：可拖拽活塞控制滴速、终点半滴之差
]);

export function has3D(slug: string): boolean {
  return EXPERIMENTS_WITH_3D.has(slug);
}
