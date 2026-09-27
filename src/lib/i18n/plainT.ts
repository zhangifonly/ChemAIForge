// 不依赖 React 的取词函数，供 Node 脚本与测试使用。
//
// next-intl 的 useTranslations / getTranslations 都要有 React 或请求上下文，
// 而 TTS 生成脚本跑在纯 Node 里、单测也不该为取一句文案去搭 Provider。
// 这里直接读 messages/<locale>.json，补齐 ICU 占位符替换这一件事。
import { SOURCE_LOCALE } from "./locales";

type Tree = { [k: string]: string | Tree };

/** 按 "a.b.c" 取值 */
function pick(tree: Tree, path: string): string | undefined {
  let node: string | Tree | undefined = tree;
  for (const part of path.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}

/**
 * 造一个取词函数。命名空间与 useTranslations 一致，便于两边共用同一批键。
 * 取不到键时返回键名本身 —— 与 next-intl 的行为一致，便于一眼看出漏了哪条。
 */
export function plainT(
  messages: Tree,
  namespace = "",
): (key: string, vars?: Record<string, string | number>) => string {
  return (key, vars) => {
    const full = namespace ? `${namespace}.${key}` : key;
    const raw = pick(messages, full) ?? key;
    if (!vars) return raw;
    // 只做最简单的 {name} 替换：讲解文案不用复数与选择语法
    return raw.replace(/\{(\w+)\}/g, (m, name) =>
      name in vars ? String(vars[name]) : m,
    );
  };
}

/** 深合并：target 的键覆盖 base，target 缺的键保留 base 的值 */
function deepMerge(base: Tree, target: Tree): Tree {
  const out: Tree = { ...base };
  for (const [k, v] of Object.entries(target)) {
    const b = out[k];
    if (typeof b === "object" && b !== null && typeof v === "object" && v !== null) {
      out[k] = deepMerge(b, v);
    } else if (v !== "") {
      out[k] = v;
    }
  }
  return out;
}

/**
 * 载入某语种的词条树，逐键回退源语言。
 *
 * 必须深合并而不是浅合并：命名空间是一层对象，浅合并会让整个 lesson 命名空间
 * 被目标语言那份替换掉 —— 其中尚未翻译的键随即消失，取词函数只能返回键名，
 * 界面上就出现 "titlePrinciple" 这种原样输出。
 */
export async function loadMessagesFor(locale: string): Promise<Tree> {
  const base = (await import(`../../../messages/${SOURCE_LOCALE}.json`)).default as Tree;
  if (locale === SOURCE_LOCALE) return base;
  try {
    const target = (await import(`../../../messages/${locale}.json`)).default as Tree;
    return deepMerge(base, target);
  } catch {
    return base;
  }
}
