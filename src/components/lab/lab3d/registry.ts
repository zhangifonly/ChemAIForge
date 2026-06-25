// 拥有 3D 版本的实验注册表。逐个实验做 3D 场景，此处登记 slug → 场景组件名。
// 未登记的实验只提供 2D 视图。新增 3D 实验时在此追加。

export const EXPERIMENTS_WITH_3D = new Set<string>([
  "iron-copper-sulfate", // 铁置换硫酸铜：铁钉表面析红铜、蓝液变浅
]);

export function has3D(slug: string): boolean {
  return EXPERIMENTS_WITH_3D.has(slug);
}
