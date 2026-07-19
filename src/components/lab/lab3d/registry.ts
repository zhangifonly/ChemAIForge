// 拥有 3D 版本的实验注册表。逐个实验做 3D 场景，此处登记 slug → 场景组件名。
// 未登记的实验只提供 2D 视图。新增 3D 实验时在此追加。

export const EXPERIMENTS_WITH_3D = new Set<string>([
  "iron-copper-sulfate", // 铁置换硫酸铜：铁钉表面析红铜、蓝液变浅
  "h2-from-zinc", // 锌与稀硫酸制氢：锌粒冒氢气泡上升
  // —— 气体与沉淀 ——
  "co2-preparation", // 二氧化碳制取：产气→导管→石灰水变浑浊
  "feoh3-precipitation", // 氢氧化铁：红棕絮状沉淀下沉
  "cuoh2-precipitation", // 氢氧化铜：蓝色絮状沉淀下沉
]);

export function has3D(slug: string): boolean {
  return EXPERIMENTS_WITH_3D.has(slug);
}
