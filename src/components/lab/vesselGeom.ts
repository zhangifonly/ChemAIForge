// 器皿几何：烧杯 / 锥形瓶 / 试管的立体 SVG 形状参数。Glassware 组件据此渲染，
// 现象（液体/气泡/沉淀/蒸汽）按几何自适应位置。chooseVessel 由实验仪器选型。

export type VesselKind = "beaker" | "flask" | "tube";

export interface VesselGeom {
  kind: VesselKind;
  // 内壁裁剪路径（液体/沉淀/气泡都裁剪其中），同时用作玻璃高光叠层
  innerClip: string;
  // 杯身轮廓（描边）
  outline: string;
  // 杯口椭圆（描边）
  rim: { cx: number; cy: number; rx: number; ry: number };
  // 倾倒嘴（仅烧杯）
  spout?: string;
  // 桌面投影椭圆
  shadow: { cx: number; cy: number; rx: number; ry: number };
  // 加热火焰焰尖 y（贴器皿底中心），加热态在此升腾火焰
  heatY: number;
  // 液体矩形左右边界 + 液面可移动的上下范围
  liquid: { left: number; right: number; topY: number; bottomY: number };
  // 给定液面 y 处的液面椭圆半径（圆锥瓶随高度变化）
  surfaceRxAt: (y: number) => number;
  // 刻度 y 位置 + 刻度起始 x（试管无刻度）
  ticks: number[];
  tickX: number;
  // 气泡 x 位置、沉淀堆中心 x 位置
  bubbleXs: number[];
  precipCx: number[];
}

export const VESSELS: Record<VesselKind, VesselGeom> = {
  beaker: {
    kind: "beaker",
    innerClip: "M46 46 L46 178 A54 12 0 0 0 154 178 L154 46 Z",
    outline: "M40 42 L40 178 A60 13 0 0 0 160 178 L160 42",
    rim: { cx: 100, cy: 42, rx: 60, ry: 12 },
    spout: "M40 42 q -10 -3 -14 4 q 8 -1 14 2",
    shadow: { cx: 100, cy: 200, rx: 56, ry: 6 },
    heatY: 191,
    liquid: { left: 46, right: 154, topY: 58, bottomY: 178 },
    surfaceRxAt: () => 54,
    ticks: [120, 95, 70],
    tickX: 47,
    bubbleXs: [64, 82, 100, 118, 134],
    precipCx: [70, 100, 130, 85, 115],
  },
  flask: {
    kind: "flask",
    innerClip: "M89 34 L89 78 L49 182 A51 7 0 0 0 151 182 L111 78 L111 34 Z",
    outline: "M86 30 L86 78 L44 184 A56 8 0 0 0 156 184 L114 78 L114 30",
    rim: { cx: 100, cy: 30, rx: 14, ry: 4 },
    shadow: { cx: 100, cy: 190, rx: 54, ry: 6 },
    heatY: 192,
    liquid: { left: 44, right: 156, topY: 100, bottomY: 182 },
    // 圆锥体：肩部 y78 半宽 11，底部 y182 半宽 51，线性插值
    surfaceRxAt: (y) => {
      const t = Math.max(0, Math.min(1, (y - 78) / (182 - 78)));
      return 11 + t * (51 - 11);
    },
    ticks: [165, 150],
    tickX: 70,
    bubbleXs: [82, 95, 108, 118],
    precipCx: [75, 100, 125, 88, 112],
  },
  tube: {
    kind: "tube",
    innerClip: "M84 30 L84 186 A16 16 0 0 0 116 186 L116 30 Z",
    outline: "M80 28 L80 186 A20 20 0 0 0 120 186 L120 28",
    rim: { cx: 100, cy: 28, rx: 20, ry: 5 },
    shadow: { cx: 100, cy: 214, rx: 26, ry: 5 },
    heatY: 206,
    liquid: { left: 84, right: 116, topY: 46, bottomY: 184 },
    surfaceRxAt: () => 16,
    ticks: [],
    tickX: 85,
    bubbleXs: [92, 100, 108],
    precipCx: [92, 100, 108],
  },
};

// 由实验仪器列表选择器皿：含「试管」→ 试管，「锥形瓶/烧瓶」→ 锥形瓶，否则烧杯
export function chooseVessel(apparatus: string[]): VesselKind {
  const text = apparatus.join(" ");
  if (/试管/.test(text)) return "tube";
  if (/锥形瓶|烧瓶/.test(text)) return "flask";
  return "beaker";
}

// 实验是否配有排水法集气装置（须有集气瓶/水槽/排水等明确特征；
// 不能仅凭"导管"判定——很多导气→吸收/检验装置也有导管，那属于 usesGasDelivery）
export function usesGasCollection(apparatus: string[]): boolean {
  return /集气瓶|水槽|排水/.test(apparatus.join(" "));
}

// 是否为"导气 → 液体吸收 / 检验"装置：主容器加热/反应产气，经导管通入另一容器的
// 吸收液（饱和碳酸钠、石灰水/氢氧化钙、溴水、硝酸银溶液等）。导管口在液面上方防倒吸。
// 条件：有导管，且试剂/仪器中出现已知吸收液，且不是排水集气。
const ABSORBENT = /饱和碳酸钠|碳酸钠溶液|石灰水|氢氧化钙|溴水|硝酸银|高锰酸钾溶液|品红/;
export function usesGasDelivery(apparatus: string[], reagents: string[]): boolean {
  const ap = apparatus.join(" ");
  if (!/导管/.test(ap)) return false;
  if (usesGasCollection(apparatus)) return false;
  return ABSORBENT.test(ap) || ABSORBENT.test(reagents.join(" "));
}

// 是否为真·电解实验（外加直流电源 / 电解槽；区别于原电池、腐蚀）
export function isElectrolysisSetup(apparatus: string[]): boolean {
  return /直流电源|电解槽/.test(apparatus.join(" "));
}

// 阳极是否惰性：无"铜/银/金属/活性电极"字样即视为惰性（碳/铂）
export function isInertAnode(apparatus: string[]): boolean {
  return !/铜电极|银电极|金属电极|活性电极/.test(apparatus.join(" "));
}

// 是否为原电池 / 电化学腐蚀装置（电流计/盐桥/原电池/导线/培养皿；电解已优先判定）
export function isGalvanicSetup(apparatus: string[]): boolean {
  return /电流计|盐桥|原电池|导线|培养皿/.test(apparatus.join(" "));
}

// 是否为导电性对比装置（电导率仪 / 导电性）
export function usesConductivity(apparatus: string[]): boolean {
  return /电导率|导电性/.test(apparatus.join(" "));
}
