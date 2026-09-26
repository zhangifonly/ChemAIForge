// 巡检外语页面上残留的汉字。
//
// 为什么需要：国际化的漏网之鱼大多不在"源码里的中文字符串"里，而在运行时拼接处 ——
// 引擎方程式里的「点燃」、trace 标记里的「加盐酸」、导师自动提问里的"我刚刚观察到"。
// 源码扫描（i18n-scan.mjs）看不到这些，只有渲染出来的页面看得到。
// 本轮这类问题是靠人工在浏览器里一层层挖出来的，不能每次都靠人眼。
//
// 用法：先起 dev server，再 node scripts/i18n-leak-check.mjs [base] [locale]
//   只抓服务端渲染的 HTML，不跑交互 —— 交互后才出现的文本需在浏览器里另查。
const BASE = process.argv[2] ?? "http://localhost:4399";
const LOCALE = process.argv[3] ?? "de";

const PAGES = [
  "",
  "/experiments",
  "/experiments/hcl-naoh-neutralization",
  "/experiments/hcl-naoh-neutralization/lab",
  "/experiments/chloride-identification/lab",
  "/sessions",
];

/** 取可见文本：去掉 script/style 与标签，避免把内联 JSON（词条表本身）算进来 */
function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/g, " ");
}

/**
 * 判定"残留中文"。
 *
 * 日语本就大量使用汉字（実験、塩酸），按"含汉字"判定会把整页日文都算成残留。
 * 日语页面改为只抓简体专有字形与中文独有的虚词 —— 日文里不会出现「实验」「的」「这」。
 */
const SIMPLIFIED_ONLY = /[实验这们为说对时过还发进开关现样应将么级经图两从问题错读选动气测试结话请击]/;
function leaks(text, locale) {
  const runs = [...new Set(text.match(/[\u4e00-\u9fff][\u4e00-\u9fff·（）]*/g) ?? [])];
  if (locale !== "ja") return runs;
  // 日语：只留下含简体专有字的片段，以及"的/了/是"这类中文虚词开头的片段
  return runs.filter((r) => SIMPLIFIED_ONLY.test(r) || /^[的了是在和与]/.test(r));
}

let total = 0;
for (const path of PAGES) {
  const url = `${BASE}/${LOCALE}${path}`;
  const res = await fetch(url);
  const text = visibleText(await res.text());
  const hits = leaks(text, LOCALE);
  total += hits.length;
  console.log(`${res.status} ${path || "/"}  残留 ${hits.length}${hits.length ? "：" + hits.slice(0, 8).join("、") : ""}`);
}
console.log(`\n合计 ${total} 处`);
process.exitCode = total > 0 ? 1 : 0;
