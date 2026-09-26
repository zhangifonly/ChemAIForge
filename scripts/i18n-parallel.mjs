// 跨语种并行跑某个翻译脚本。
//
// 为什么需要：各翻译脚本按语种串行，实测界面词条约 4 分钟一个语种。
// 界面 51 语种 + 内容类 48 语种 × 三道（术语 / 实验内容 / 现象）串行要跑一整天。
// 语种之间互不相干、各写各的文件，天然可以并行；限制并发数是为了不触发上游限流。
//
// 用法：node scripts/i18n-parallel.mjs <脚本名> <语种列表|--all|--voiced> [并发数]
//   例：node scripts/i18n-parallel.mjs i18n-translate-content.mjs --voiced 6
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LOCALE_CODES, SOURCE_LOCALE } from "../src/lib/i18n/locales.ts";
import { voicedLocaleCodes } from "../src/components/lab/lesson/audioKey.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const [script, which = "--voiced", concurrencyArg = "6"] = process.argv.slice(2);
if (!script) {
  console.error("用法：node scripts/i18n-parallel.mjs <脚本名> <语种列表|--all|--voiced> [并发数]");
  process.exit(1);
}
const concurrency = Number(concurrencyArg);

const locales =
  which === "--all"
    ? LOCALE_CODES.filter((l) => l !== SOURCE_LOCALE)
    : which === "--voiced"
      ? voicedLocaleCodes().filter((l) => l !== SOURCE_LOCALE)
      : which.split(",");

/** 跑一个语种；各语种脚本本身支持断点续传，已译完的会秒退 */
function runOne(locale) {
  return new Promise((resolve) => {
    const child = spawn("npx", ["tsx", join("scripts", script), locale], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => {
      const failed = /✗|有失败|未译成/.test(out);
      resolve({ locale, code, failed, tail: out.trim().split("\n").slice(-2).join(" | ") });
    });
  });
}

const started = Date.now();
let next = 0;
const results = [];
async function worker() {
  while (next < locales.length) {
    const locale = locales[next++];
    const r = await runOne(locale);
    results.push(r);
    const mark = r.code === 0 && !r.failed ? "✓" : "✗";
    console.log(`${mark} ${locale} (${results.length}/${locales.length})${r.failed ? "  " + r.tail : ""}`);
  }
}
console.log(`${script}：${locales.length} 个语种，并发 ${concurrency}\n`);
await Promise.all(Array.from({ length: concurrency }, worker));

const bad = results.filter((r) => r.code !== 0 || r.failed).map((r) => r.locale);
console.log(
  `\n完成，用时 ${Math.round((Date.now() - started) / 60000)} 分钟` +
    (bad.length ? `；有失败的语种（重跑本命令会续传）：${bad.join(" ")}` : "；全部成功"),
);
