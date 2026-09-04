// probe 豁免清单：现象由「装置开关」而非「混合试剂」驱动的实验。
//
// 这些实验送入反应引擎必然 reacted:false（电解要通电、焰色要灼烧、萃取要振荡、
// 蒸馏要加热），写 probe 反而会把错误的期望固化下来。它们的 3D 看点来自装置层
// （rig.kind !== "none"），不是反应现象。
//
// ⚠️ 往这里加 slug 前先自问：真的是装置驱动，还是引擎缺规则？后者应补规则而非豁免。
// 独立成模块（而非放在 test 文件里）以便审计脚本与运行时代码都能引用。
export const PROBE_EXEMPT = new Set<string>([
  // —— 电解池：现象来自通电后的电极产物，不是混合反应 ——
  "electrolysis-nacl-solution",
  "electrolysis-cucl2-solution",
  "electrolysis-ki-solution",
  "electrolysis-electrode-products",
  "electrolysis-copper-anode",
  "faraday-electrolysis-quantitative",
  "molten-salt-electrolysis",
  "aluminum-electrolysis",
  "electroplating-copper",
  "electroplating-silver",
  "electrochemical-etching",
  "impressed-current-protection",
  // silver-electrolytic-cleaning 已移出：它其实不接外电源，是自发原电池，
  // 装置只有烧杯+酒精灯（planRig 判为 none），故必须靠真实反应 probe 支撑
  // —— 原电池：靠接通电路产生电流与电极现象 ——
  "daniell-cell",
  "concentration-cell",
  "dry-cell-dissection",
  // —— 焰色反应：靠点燃酒精灯灼烧，非溶液反应 ——
  "flame-test",
  "flame-test-sodium-potassium",
  "metal-flame-color",
  // —— 分离提纯 / 装置操作：过滤、蒸馏、加压平衡（都不是化学反应）——
  // 注：加热分解不在此列。高锰酸钾分解曾因引擎"至少两种物质"的门槛
  // 一律不反应而豁免，门槛去掉后它已能正常反应，故已补上 probe。
  "filtration-separation",
  "crystallization-purification",
  "ethanol-water-distillation",
  "pressure-equilibrium-no2",
  // —— 电解 / 电池：看点由 electrolysis.ts 的电极引擎产生，混合试剂给出的
  //    是完全无关的现象，写 probe 只会把错误期望固化 ——
  // 硫酸铜溶于水（"CuSO4 溶解放热"）≠ 电解析出铜
  "copper-electrolysis",
  // 稀释浓硫酸 ≠ 电解水两极出气
  "electrolysis-water",
  // 铜在硫酸铜溶液里本就不反应（reacted=false），精炼靠外加电压
  "copper-refining-electrolysis",
  // 铅酸电池是可逆放电/充电，混合只报"金属氧化物+酸"
  "lead-acid-battery",
  // 阳极氧化的看点是致密氧化膜，混合只报"Al+酸→H₂↑"（恰好相反：正常溶解）
  "anodizing-aluminum",
  // 电导率对比的看点是灯泡亮度差，混合被蔗糖水解规则截住
  "conductivity-electrolyte",
  // 燃料电池是可控放电，混合直接报氢氧爆鸣燃烧 —— 与"不燃烧而发电"相反
  "hydrogen-oxygen-fuel-cell",
]);
