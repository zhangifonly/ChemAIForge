// 焰色反应的光谱模型：每种元素一组真实发射谱线（原子线 + 火焰中 MOH/MCl 分子带），
// 焰色 = 谱线逐波长换算成 RGB 后叠加；钴玻璃是一条透过率曲线；"看得出哪种元素"
// 按各元素在眼中的亮度比较 —— 钠的 589 nm 极亮，会把钾的紫光盖住，这就是要用钴玻璃的原因。
//
// 铂丝残留模型：蘸样品使该元素残留 +1；灼烧时按元素的挥发时间常数衰减；
// 蘸过盐酸后残留转为易挥发的氯化物，衰减快得多。新铂丝自带钠污染。

export type Element = "Na" | "K" | "Li" | "Ca" | "Sr" | "Ba" | "Cu";
export const ELEMENTS: readonly Element[] = ["Na", "K", "Li", "Ca", "Sr", "Ba", "Cu"];

/** nm：中心波长；i：相对强度；w：线宽（nm，分子带较宽） */
export interface Line { nm: number; i: number; w: number }
export interface TaggedLine extends Line { el: Element }

export const LINES: Record<Element, Line[]> = {
  Na: [{ nm: 589.0, i: 1, w: 1 }, { nm: 589.6, i: 0.5, w: 1 }],
  K: [{ nm: 766.5, i: 0.55, w: 1.5 }, { nm: 769.9, i: 0.28, w: 1.5 }, { nm: 404.4, i: 0.6, w: 1 }],
  Li: [{ nm: 670.8, i: 1, w: 1.5 }, { nm: 610.4, i: 0.06, w: 1 }],
  Ca: [{ nm: 622, i: 1, w: 14 }, { nm: 554, i: 0.35, w: 10 }, { nm: 422.7, i: 0.1, w: 1 }],
  Sr: [{ nm: 606, i: 0.45, w: 8 }, { nm: 650, i: 0.6, w: 12 }, { nm: 681, i: 0.9, w: 10 }, { nm: 460.7, i: 0.12, w: 1 }],
  Ba: [{ nm: 553.5, i: 1, w: 1 }, { nm: 524, i: 0.6, w: 8 }, { nm: 513.7, i: 0.6, w: 6 }, { nm: 487, i: 0.25, w: 6 }],
  Cu: [{ nm: 510.5, i: 0.6, w: 8 }, { nm: 521.8, i: 0.5, w: 6 }, { nm: 488, i: 0.6, w: 10 }, { nm: 435, i: 0.25, w: 8 }],
};
/** 单位残留的发光强度：钠最亮，钾焰本就暗淡 */
const STRENGTH: Record<Element, number> = { Na: 1.5, K: 0.6, Li: 1, Ca: 0.8, Sr: 1, Ba: 0.7, Cu: 0.7 };
/** 不蘸盐酸时的挥发时间常数（s）：钠极难烧净 */
const TAU: Record<Element, number> = { Na: 30, K: 15, Li: 8, Ca: 15, Sr: 12, Ba: 12, Cu: 5 };
const ACID_TAU = 0.8; // 盐酸存在时的附加挥发时间常数
const ACID_LIFE = 2; // 盐酸自身蒸干的时间常数
const CLEAN = 0.01;
const VISIBLE_ABS = 0.02;
// 钠黄线在人眼最敏感的波段且极亮：痕量钠就足以盖住钾的浅紫
const MASK_RATIO = 0.25;

export interface Wire { residue: Partial<Record<Element, number>>; acid: number }

export const newWire = (): Wire => ({ residue: { Na: 0.3 }, acid: 0 });

export function dip(w: Wire, els: readonly Element[]): Wire {
  const residue = { ...w.residue };
  for (const e of els) residue[e] = (residue[e] ?? 0) + 1;
  return { ...w, residue };
}

/** 蘸盐酸：部分残留溶进酸里被带走，其余转为易挥发氯化物 */
export function dipAcid(w: Wire): Wire {
  const residue: Wire["residue"] = {};
  for (const e of ELEMENTS) if (w.residue[e]) residue[e] = w.residue[e]! * 0.5;
  return { residue, acid: 1 };
}

export function burn(w: Wire, dt: number): Wire {
  const residue = { ...w.residue };
  let acid = w.acid;
  for (let left = Math.max(0, dt); left > 0; left -= 0.05) {
    const h = Math.min(0.05, left);
    for (const e of ELEMENTS) {
      const v = residue[e];
      if (!v) continue;
      residue[e] = v * Math.exp(-h * (1 / TAU[e] + acid / ACID_TAU));
    }
    acid *= Math.exp(-h / ACID_LIFE);
  }
  return { residue, acid };
}

export const isClean = (w: Wire) => ELEMENTS.reduce((s, e) => s + (w.residue[e] ?? 0), 0) < CLEAN;

export function emission(w: Wire): TaggedLine[] {
  const out: TaggedLine[] = [];
  for (const e of ELEMENTS) {
    const v = w.residue[e] ?? 0;
    if (v <= 1e-4) continue;
    for (const l of LINES[e]) out.push({ ...l, el: e, i: l.i * v * STRENGTH[e] });
  }
  return out;
}

// —— 光学 ——

/** 钴玻璃透过率：吸收 520–660 nm（钠黄所在），透过蓝紫与深红 */
export function cobaltT(nm: number): number {
  const pts: [number, number][] = [[380, 0.6], [480, 0.65], [520, 0.1], [545, 0.008], [640, 0.008], [680, 0.5], [720, 0.75], [780, 0.75]];
  if (nm <= pts[0][0]) return pts[0][1];
  for (let k = 1; k < pts.length; k++) {
    const [x1, y1] = pts[k];
    const [x0, y0] = pts[k - 1];
    if (nm <= x1) return y0 + ((y1 - y0) * (nm - x0)) / (x1 - x0);
  }
  return pts[pts.length - 1][1];
}

/** 单色光 → 线性 RGB（Bruton 近似，含两端人眼灵敏度衰减） */
export function wavelengthRGB(nm: number): [number, number, number] {
  let r = 0, g = 0, b = 0;
  if (nm < 440) { r = (440 - nm) / 60; b = 1; }
  else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
  else if (nm < 510) { g = 1; b = (510 - nm) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
  else if (nm < 645) { r = 1; g = (645 - nm) / 65; }
  else r = 1;
  const f = nm < 420 ? 0.3 + (0.7 * (nm - 380)) / 40 : nm > 700 ? 0.3 + (0.7 * (780 - nm)) / 80 : 1;
  return [Math.max(0, r * f), Math.max(0, g * f), Math.max(0, b * f)];
}

/** 谱线在某波长处的强度（高斯线形），可选经过钴玻璃 */
export function spectrumAt(lines: readonly Line[], nm: number, cobalt = false): number {
  let s = 0;
  for (const l of lines) {
    const sigma = l.w / 2.355;
    s += (l.i / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-((nm - l.nm) ** 2) / (2 * sigma * sigma));
  }
  return cobalt ? s * cobaltT(nm) : s;
}

const lum = ([r, g, b]: [number, number, number]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function integrate(lines: readonly Line[], cobalt: boolean): [number, number, number] {
  const acc: [number, number, number] = [0, 0, 0];
  for (let nm = 380; nm <= 780; nm += 0.5) {
    const s = spectrumAt(lines, nm, cobalt) * 0.5;
    if (s < 1e-6) continue;
    const c = wavelengthRGB(nm);
    acc[0] += s * c[0]; acc[1] += s * c[1]; acc[2] += s * c[2];
  }
  return acc;
}

export interface FlameColor { r: number; g: number; b: number; luminance: number }

/** 焰色：rgb 归一到最大通道 = 1，luminance 为绝对亮度（决定火焰被染色的程度） */
export function flameColor(lines: readonly Line[], cobalt: boolean): FlameColor {
  const c = integrate(lines, cobalt);
  const m = Math.max(...c);
  if (m <= 0) return { r: 0, g: 0, b: 0, luminance: 0 };
  return { r: c[0] / m, g: c[1] / m, b: c[2] / m, luminance: lum(c) };
}

export function hueOf({ r, g, b }: { r: number; g: number; b: number }): number {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d === 0) return 0;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

/** 眼睛能辨认出的元素：亮度超过绝对阈值，且不被最亮的元素盖过 */
export function visibleElements(lines: readonly TaggedLine[], cobalt: boolean): Element[] {
  const by = ELEMENTS.map((e) => [e, lum(integrate(lines.filter((l) => l.el === e), cobalt))] as const);
  const max = Math.max(0, ...by.map(([, v]) => v));
  return by.filter(([, v]) => v >= VISIBLE_ABS && v >= MASK_RATIO * max).map(([e]) => e);
}
