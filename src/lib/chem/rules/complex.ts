// 配位专项规则（第二组）：沉淀的配位溶解、EDTA 通用配位、掩蔽与显色试剂
// 与 coordination.ts 互补——那里是「离子 + 配体直接显色」，这里补齐
// 「难溶物被配体拉回溶液」这条主线（洗照片的定影液、氯化银溶于氨水都属此类）。
import type { Reaction } from "./helpers";
import type { Substance } from "../engine";
import { hasAnyFormula, hasCategory } from "./helpers";

/** 可被配体溶解的难溶银盐：溶解度依次减小，故所需配体的配位能力依次增强 */
const SILVER_HALIDE: Record<string, { name: string; ammonia: boolean; thio: boolean }> = {
  AgCl: { name: "氯化银", ammonia: true, thio: true },
  AgBr: { name: "溴化银", ammonia: false, thio: true },
  AgI: { name: "碘化银", ammonia: false, thio: false },
  Ag2CO3: { name: "碳酸银", ammonia: true, thio: true },
};

/** 能溶于过量氨水的氢氧化物 → 氨配离子 */
const AMMINE_SOLUBLE: Record<
  string,
  { product: string; name: string; equation: string; look: string }
> = {
  "Cu(OH)2": {
    product: "[Cu(NH3)4](OH)2",
    name: "四氨合铜配合物",
    equation: "Cu(OH)₂ + 4NH₃ → [Cu(NH₃)₄]²⁺ + 2OH⁻",
    look: "蓝色沉淀溶解为深蓝色透明溶液",
  },
  "Zn(OH)2": {
    product: "[Zn(NH3)4](OH)2",
    name: "四氨合锌配合物",
    equation: "Zn(OH)₂ + 4NH₃ → [Zn(NH₃)₄]²⁺ + 2OH⁻",
    look: "白色沉淀溶解为无色透明溶液",
  },
  "Ni(OH)2": {
    product: "[Ni(NH3)6](OH)2",
    name: "六氨合镍配合物",
    equation: "Ni(OH)₂ + 6NH₃ → [Ni(NH₃)₆]²⁺ + 2OH⁻",
    look: "绿色沉淀溶解为蓝紫色溶液",
  },
  "AgOH": {
    product: "[Ag(NH3)2]OH",
    name: "银氨配合物",
    equation: "AgOH + 2NH₃ → [Ag(NH₃)₂]⁺ + OH⁻",
    look: "棕色沉淀溶解为无色澄清液",
  },
};

/** EDTA 能与之形成稳定螯合物的常见金属离子（去色 / 掩蔽用） */
const EDTA_METAL: Record<string, { name: string; look: string }> = {
  CuSO4: { name: "铜", look: "浅蓝色略转深，生成更稳定的螯合物" },
  "Cu(NO3)2": { name: "铜", look: "浅蓝色略转深，生成更稳定的螯合物" },
  FeCl3: { name: "铁(III)", look: "棕黄色转为淡黄色" },
  "Fe2(SO4)3": { name: "铁(III)", look: "棕黄色转为淡黄色" },
  NiCl2: { name: "镍", look: "绿色转为蓝绿色" },
  CoCl2: { name: "钴", look: "粉红色转为紫红色" },
  "Pb(NO3)2": { name: "铅", look: "无色，需借指示剂判断终点" },
  ZnSO4: { name: "锌", look: "无色，需借指示剂判断终点" },
  AlCl3: { name: "铝", look: "无色，需返滴定测定" },
  MgSO4: { name: "镁", look: "无色，需借铬黑T判断终点" },
};

function findKey<T>(inputs: Substance[], table: Record<string, T>) {
  for (const s of inputs) {
    const hit = table[s.formula];
    if (hit) return { substance: s, spec: hit };
  }
  return null;
}

/** 判断输入中是否有氨（氨水或氨气均可提供配体 NH₃） */
function hasAmmonia(inputs: Substance[]): boolean {
  return hasAnyFormula(inputs, ["NH3·H2O", "NH3"]);
}

export const complexRules: Reaction[] = [
  {
    id: "silver-halide-ammonia-dissolve",
    name: "卤化银的氨配位溶解",
    // 氯化银溶、溴化银微溶、碘化银不溶：这条溶解度梯度正是配位平衡的经典演示
    match: (inputs) => {
      const hit = findKey(inputs, SILVER_HALIDE);
      return !!hit && hasAmmonia(inputs);
    },
    build: (inputs) => {
      const { substance, spec } = findKey(inputs, SILVER_HALIDE)!;
      const ok = spec.ammonia;
      return {
        products: ok
          ? [{ formula: "[Ag(NH3)2]+", name: "二氨合银配离子", category: "salt" as const }]
          : [{ formula: substance.formula, name: spec.name, category: "salt" as const }],
        producesGas: false,
        producesPrecipitate: !ok,
        colorChange: ok,
        thermal: "none" as const,
        phTrend: "neutral" as const,
        equation: ok
          ? `${substance.formula} + 2NH₃ → [Ag(NH₃)₂]⁺ + 阴离子`
          : `${substance.formula} + NH₃ → 不溶解`,
        description: ok
          ? `${spec.name}沉淀在过量氨水中溶解为无色澄清的银氨配离子，说明配位可以把难溶盐拉回溶液。`
          : `${spec.name}的溶度积极小，氨的配位能力不足以将它溶解，沉淀依旧存在——这正是卤化银溶解度递减的直接证据。`,
      };
    },
  },
  {
    id: "silver-halide-thiosulfate-fix",
    name: "卤化银的硫代硫酸钠定影",
    // 洗照片的定影液：S₂O₃²⁻ 配位能力远强于氨，连溴化银也能溶掉
    match: (inputs) => {
      const hit = findKey(inputs, SILVER_HALIDE);
      return !!hit && hasAnyFormula(inputs, ["Na2S2O3"]);
    },
    build: (inputs) => {
      const { substance, spec } = findKey(inputs, SILVER_HALIDE)!;
      const ok = spec.thio;
      return {
        products: ok
          ? [{ formula: "[Ag(S2O3)2]3-", name: "二硫代硫酸根合银配离子", category: "salt" as const }]
          : [{ formula: substance.formula, name: spec.name, category: "salt" as const }],
        producesGas: false,
        producesPrecipitate: !ok,
        colorChange: ok,
        thermal: "none" as const,
        phTrend: "neutral" as const,
        equation: ok
          ? `${substance.formula} + 2Na₂S₂O₃ → Na₃[Ag(S₂O₃)₂] + 卤化钠`
          : `${substance.formula} + Na₂S₂O₃ → 溶解极慢`,
        description: ok
          ? `硫代硫酸根的配位能力强于氨，${spec.name}沉淀溶解为无色配离子——这就是黑白照片定影液洗去未感光卤化银的原理。`
          : `${spec.name}即使遇到硫代硫酸钠也难以溶解，需更强配体（如氰化物）才行。`,
      };
    },
  },
  {
    id: "hydroxide-ammonia-complex-dissolve",
    name: "氢氧化物的氨配位溶解",
    match: (inputs) => !!findKey(inputs, AMMINE_SOLUBLE) && hasAmmonia(inputs),
    build: (inputs) => {
      const { spec } = findKey(inputs, AMMINE_SOLUBLE)!;
      return {
        products: [{ formula: spec.product, name: spec.name, category: "salt" as const }],
        producesGas: false,
        producesPrecipitate: false,
        colorChange: true,
        thermal: "none" as const,
        phTrend: "increase" as const,
        equation: spec.equation,
        description: `${spec.look}，沉淀溶解的推动力是配位平衡把金属离子从固体中夺走。`,
      };
    },
  },
  {
    id: "edta-metal-chelate",
    name: "EDTA 与金属离子的螯合",
    // EDTA 一分子六个配位点，几乎与所有二三价金属形成 1∶1 稳定螯合物
    match: (inputs) => !!findKey(inputs, EDTA_METAL) && hasAnyFormula(inputs, ["Na2EDTA"]),
    build: (inputs) => {
      const { spec } = findKey(inputs, EDTA_METAL)!;
      return {
        products: [
          { formula: "[M-EDTA]", name: `${spec.name}-EDTA 螯合物`, category: "salt" as const },
        ],
        producesGas: false,
        producesPrecipitate: false,
        colorChange: true,
        thermal: "none" as const,
        phTrend: "decrease" as const,
        equation: "M(n+) + H₂Y²⁻ → MY(n-4) + 2H⁺",
        description: `EDTA 以六个配位点包住${spec.name}离子形成 1∶1 稳定螯合物，${spec.look}；反应放出氢离子，故配位滴定必须在缓冲液中进行。`,
      };
    },
  },
];
