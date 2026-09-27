// 从模型回复里取出第一个完整的 JSON 对象。四个翻译脚本共用。
//
// 不能用 "第一个 { 到最后一个 }"：模型有时在 JSON 后追加一句说明，说明里的括号
// 会让截取越界，JSON.parse 报 "Unexpected non-whitespace character after JSON"
// （亚美尼亚语术语表连续两次失败于此）。这里按括号配对、跳过字符串内的括号。
//
// 另一个坑：德语引号 „…" 的收尾是 ASCII 直引号，模型不转义。若把它当成字符串定界符，
// 字符串就提前结束、后面的 } 被当成结构，括号计数整个错位 —— 实测 17 个用 „…" 或
// «…» 的欧洲语种因此同时失败。判断一个 " 是否真的结束字符串：看它后面紧跟的是不是
// JSON 结构字符（, } ] : 或到结尾）。不是，就是正文里的引号，转义掉并继续。

/** 修正字符串值里未转义的直引号；输入须是从第一个 { 开始的文本 */
function repairQuotes(text) {
  let out = "";
  let inStr = false;
  let esc = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (!inStr) {
      if (c === '"') inStr = true;
      out += c;
      continue;
    }
    if (esc) {
      esc = false;
      out += c;
      continue;
    }
    if (c === "\\") {
      esc = true;
      out += c;
      continue;
    }
    if (c === '"') {
      const rest = text.slice(i + 1).trimStart();
      if (rest === "" || /^[,}\]:]/.test(rest)) {
        inStr = false;
        out += c;
      } else {
        out += '\\"';
      }
      continue;
    }
    out += c;
  }
  return out;
}

/** 返回回复中第一个完整 JSON 对象的原文（已修正正文里的直引号）；找不到则抛错 */
export function sliceFirstObject(text) {
  const start = text.indexOf("{");
  if (start < 0) throw new Error("回复中没有 JSON 对象");
  const fixed = repairQuotes(text.slice(start));
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < fixed.length; i++) {
    const c = fixed[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return fixed.slice(0, i + 1);
  }
  throw new Error("JSON 对象不完整（回复可能被截断）");
}

/** 取出并解析；去掉尾随逗号后再 parse */
export function extractJson(text) {
  return JSON.parse(sliceFirstObject(text).replace(/,\s*([\]}])/g, "$1"));
}
