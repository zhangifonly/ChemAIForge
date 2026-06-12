// 氧化还原反应规则
// 覆盖：高锰酸钾褪色、溴水/碘水褪色、卤素置换、碘遇淀粉变蓝、
// 铁离子与硫氰酸盐显红（归入配位但氧化态相关时也可触发）、电池/置换见 metal。
import type { Reaction } from "./helpers";
import { hasAnyFormula, hasCategory } from "./helpers";

export const redoxRules: Reaction[] = [
  {
    id: "kmno4-decolor",
    name: "高锰酸钾氧化褪色",
    match: (inputs) =>
      hasAnyFormula(inputs, ["KMnO4"]) &&
      (hasCategory(inputs, "reducer") ||
        hasAnyFormula(inputs, ["H2C2O4", "Na2SO3", "FeSO4", "C2H5OH", "SO2"])),
    build: () => ({
      products: [{ formula: "Mn2+", name: "锰(II)离子", category: "salt" }],
      producesGas: false,
      producesPrecipitate: false,
      colorChange: true,
      thermal: "exothermic",
      phTrend: "unknown",
      equation: "MnO₄⁻ + 还原剂 → Mn²⁺ + …（紫红褪去）",
      description: "高锰酸钾被还原，紫红色逐渐褪去，体现其强氧化性。",
    }),
  },
  {
    id: "bromine-water-decolor",
    name: "溴水 / 碘水褪色",
    match: (inputs) =>
      hasAnyFormula(inputs, ["Br2", "I2"]) &&
      (hasCategory(inputs, "reducer") ||
        hasAnyFormula(inputs, ["SO2", "Na2SO3", "C2H4", "NaOH", "Fe"])),
    build: () => ({
      products: [{ formula: "X-", name: "卤离子", category: "salt" }],
      producesGas: false,
      producesPrecipitate: false,
      colorChange: true,
      thermal: "none",
      phTrend: "unknown",
      equation: "Br₂ / I₂ + 还原剂 → 无色卤离子",
      description: "溴水或碘水被还原剂还原，橙黄 / 棕黄色褪去。",
    }),
  },
  {
    id: "halogen-displacement",
    name: "卤素置换反应",
    match: (inputs) =>
      hasAnyFormula(inputs, ["Cl2", "Br2"]) &&
      hasAnyFormula(inputs, ["KBr", "NaBr", "KI", "NaI"]),
    build: () => ({
      products: [{ formula: "X2", name: "被置换的卤素单质", category: "other" }],
      producesGas: false,
      producesPrecipitate: false,
      colorChange: true,
      thermal: "exothermic",
      phTrend: "neutral",
      equation: "Cl₂ + 2KBr → 2KCl + Br₂",
      description: "氧化性强的卤素单质把氧化性弱的卤素从其盐溶液中置换出来，溶液变色。",
    }),
  },
  {
    id: "iodine-starch",
    name: "碘遇淀粉变蓝",
    match: (inputs) =>
      hasAnyFormula(inputs, ["I2"]) && hasAnyFormula(inputs, ["starch"]),
    build: () => ({
      products: [{ formula: "I2-starch", name: "碘-淀粉络合物", category: "other" }],
      producesGas: false,
      producesPrecipitate: false,
      colorChange: true,
      thermal: "none",
      phTrend: "neutral",
      equation: "I₂ + 淀粉 → 蓝色络合物",
      description: "碘单质遇淀粉显特征蓝色，常用于碘的检验与碘量法终点判断。",
    }),
  },
];
