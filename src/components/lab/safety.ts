// 操作安全 / 规范反馈（教学增强）：根据容器内试剂给出真实的化学安全提醒，
// 并在混合无反应时给出操作提示。纯函数、数据驱动，与反应引擎解耦。
import type { ReactionResult, SubstanceCategory } from "@/lib/chem/engine";

interface Item {
  formula: string;
  category: SubstanceCategory;
  name: string;
}

// 按化学式给出的精确安全提醒
const FORMULA_NOTES: Record<string, string> = {
  H2SO4: "硫酸具强腐蚀性；稀释浓硫酸务必“酸入水”——将酸缓缓倒入水中并搅拌，切勿相反。",
  HCl: "盐酸有挥发性且腐蚀，操作时注意通风、避免吸入酸雾。",
  HNO3: "硝酸强腐蚀且强氧化性，避免与还原性物质混放。",
  NaOH: "氢氧化钠强碱、强腐蚀，溶解放热，避免接触皮肤与眼睛。",
  KOH: "氢氧化钾强碱、强腐蚀，注意防护。",
  Na: "钠是活泼金属，遇水剧烈放热并放出氢气、易燃，须用镊子取用、煤油中保存。",
  K: "钾比钠更活泼，遇水剧烈反应，取用需格外小心。",
  Cl2: "氯气有毒、有刺激性，必须在通风橱中操作。",
  SO2: "二氧化硫有毒、刺激性气体，需在通风橱中操作。",
  NH3: "氨气有强烈刺激性气味，注意通风、避免吸入。",
  KMnO4: "高锰酸钾为强氧化剂，避免与可燃物、还原剂直接接触。",
  K2Cr2O7: "重铬酸钾有毒且强氧化性，废液需专门回收处理。",
};

// 类别兜底提醒（化学式未命中时）
const CATEGORY_NOTES: Partial<Record<SubstanceCategory, string>> = {
  acid: "酸具有腐蚀性，注意防护、避免溅到皮肤和衣物。",
  base: "碱具有腐蚀性，注意防护、避免接触皮肤和眼睛。",
  oxidizer: "氧化剂应避免与还原性物质、可燃物直接接触。",
};

// 收集当前容器内试剂触发的安全提醒（去重，最多 4 条避免刷屏）
export function safetyNotes(contents: Item[]): string[] {
  const seen = new Set<string>();
  const notes: string[] = [];
  for (const c of contents) {
    const note = FORMULA_NOTES[c.formula] ?? CATEGORY_NOTES[c.category];
    if (note && !seen.has(note)) {
      seen.add(note);
      notes.push(note);
    }
  }
  // 浓硫酸 + 水共存：强调“酸入水”
  const f = new Set(contents.map((c) => c.formula));
  if (f.has("H2SO4") && f.has("H2O")) {
    const tip = "稀释放热剧烈：必须将浓硫酸缓缓注入水中并不断搅拌，严禁将水倒入浓硫酸！";
    if (!seen.has(tip)) notes.unshift(tip);
  }
  return notes.slice(0, 4);
}

// 混合后无反应时的操作提示
export function operationHint(
  contents: Item[],
  result: ReactionResult | null,
): string | null {
  if (contents.length >= 2 && result && !result.reacted) {
    return "当前组合在常温下未发生明显反应。试着更换试剂搭配，或调高温度（部分反应需加热）。";
  }
  return null;
}
