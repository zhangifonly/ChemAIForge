// 从模型回复里取出第一个完整的 JSON 对象。四个翻译脚本共用。
//
// 不能用 "第一个 { 到最后一个 }"：模型有时在 JSON 后追加一句说明，说明里的括号
// 会让截取越界，JSON.parse 报 "Unexpected non-whitespace character after JSON"
// （亚美尼亚语术语表连续两次失败于此）。这里按括号配对、跳过字符串内的括号。
//
// 还顺带容忍两类常见的轻微不合规：尾随逗号（`},]`）与 ``` 代码围栏（配对从第一个 { 开始，天然跳过）。

/** 返回回复中第一个完整 JSON 对象的原文；找不到则抛错 */
export function sliceFirstObject(text) {
  const start = text.indexOf("{");
  if (start < 0) throw new Error("回复中没有 JSON 对象");
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return text.slice(start, i + 1);
  }
  throw new Error("JSON 对象不完整（回复可能被截断）");
}

/** 取出并解析；去掉尾随逗号后再 parse */
export function extractJson(text) {
  return JSON.parse(sliceFirstObject(text).replace(/,\s*([\]}])/g, "$1"));
}
