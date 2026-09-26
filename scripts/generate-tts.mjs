// TTS 预生成脚本：遍历全部实验，用 buildLesson 收集唯一口播文本，
// 调用 edge-tts（微软 Edge 在线 TTS）生成 mp3。
// 文件名由 audioKey() 决定、路径由 audioSrc() 决定，与客户端播放端一致。
//
// 用法：npm run tts:generate -- [--locale zh|en|ja|…] [--gender female|male] [--force]
//   不带 --locale 时只生成中文（全语种请显式指定，避免误跑几个小时）。
//
// ⚠️ 每个语种每个性别约 1350 句、61 MB。列入 LOCALE_VOICES 的语种才预生成，
// 其余语种走浏览器内置语音合成（见 LessonPlayer 的三级回退）。
//   ⚠️ 必须经 tsx 运行（package.json 的 tts:generate）：本文件 import 了 .ts 模块，
//   裸 node 无法解析其中省略扩展名的相对导入，会直接 ERR_MODULE_NOT_FOUND。
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, mkdirSync, readdirSync, statSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { allExperiments } from "../src/data/experiments/index.ts";
import { buildLesson } from "../src/components/lab/lesson/buildLesson.ts";
import { audioKey, LOCALE_VOICES } from "../src/components/lab/lesson/audioKey.ts";
import { plainT, loadMessagesFor } from "../src/lib/i18n/plainT.ts";
import { lessonContent } from "../src/lib/i18n/lessonContent.ts";

const run = promisify(execFile);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** 单句最多尝试次数（Edge 限频可持续十几秒，次数少了整批会大面积失败） */
const MAX_ATTEMPTS = 5;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE_DIR = join(ROOT, "public", "audio", "lesson");

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const arg = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
// 默认只跑中文：全语种一次要几个小时、几百 MB，必须显式指定
// --locale all 展开为全部有音色的语种；默认只跑中文（全语种要跑十几小时）
const localeArg = arg("--locale") ?? "zh";
const LOCALES =
  localeArg === "all" ? Object.keys(LOCALE_VOICES) : localeArg.split(",");
const GENDERS = arg("--gender") ? [arg("--gender")] : ["female", "male"];
/** 并发路数。见 runPool 的说明：太大会触发微软限频反而更慢 */
const CONCURRENCY = Number(arg("--concurrency") ?? 6);

/**
 * 收集某语种的全部唯一口播文本。
 *
 * 口播由 buildLesson 按该语种的词条拼出，所以每个语种的文本集不同 ——
 * 不能拿中文那一份去生成日语语音。
 */
async function collectTexts(locale) {
  const messages = await loadMessagesFor(locale);
  const t = plainT(messages, "lesson");
  const set = new Set();
  for (const exp of allExperiments) {
    // 口播里的实验描述与目标取自内容译文，不能拿中文那一份去生成外语语音
    const content = await lessonContent(exp.slug, locale);
    for (const step of buildLesson(exp, t, content)) set.add(step.narration);
  }
  return [...set];
}

/** 该语种该性别的输出目录（与 audioSrc 的路径规则一致） */
function outDir(locale, gender) {
  // 中文沿用历史路径，不带语言层（见 audioKey.ts 的说明）
  if (locale === "zh") return join(BASE_DIR, gender === "female" ? "xiaoxiao" : "yunxi");
  return join(BASE_DIR, locale, gender);
}

// 有效的非空 mp3 才算已生成（避免把 NoAudioReceived 留下的空文件当成功）
function isValidMp3(p) {
  return existsSync(p) && statSync(p).size > 0;
}

// 为单句 + 单音色生成 mp3（已存在有效文件且非 --force 则跳过；失败重试，清理空文件）
async function genOne(text, locale, gender) {
  const out = join(outDir(locale, gender), `${audioKey(text)}.mp3`);
  const edgeVoice = LOCALE_VOICES[locale][gender];
  if (isValidMp3(out) && !FORCE) return "skip";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      // timeout 必须给：edge-tts 偶发会在等 Edge 服务响应时永久挂住（实测挂了 44 分钟
      // 不退出），而本脚本是串行的，一个卡死的子进程就把整批生成堵在原地。
      // 超时后 execFile 发 SIGTERM，走下面的重试分支。
      await run("edge-tts", ["--voice", edgeVoice, "--text", text, "--write-media", out], {
        timeout: 60_000,
        killSignal: "SIGKILL",
      });
      if (isValidMp3(out)) return "ok";
      throw new Error("生成了空文件");
    } catch (e) {
      rmSync(out, { force: true }); // 清理空/损坏文件，避免下次误跳过
      if (attempt === MAX_ATTEMPTS) throw e;
      // 指数退避：Edge 限频不是一两秒能过去的，实测 800ms 线性退避下
      // 1219 句里有 158 句四次全败（全是 NoAudioReceived），补生成时却一次就成。
      await sleep(1500 * 2 ** (attempt - 1)); // 1.5s / 3s / 6s / 12s / 24s
    }
  }
  return "ok";
}

/**
 * 并发生成一批。
 *
 * 串行跑不完：60 语种 × 2 音色 × 1349 句，按每句 1.75 秒算是 79 小时。
 * edge-tts 每句是独立子进程，可以并行；但微软会限频（脚本里的退避注释记着
 * "限频不是一两秒能过去的"），并发开太大会大面积 NoAudioReceived 反而更慢。
 * 默认 6 路是实测的折中，可用 --concurrency 调。
 */
async function runPool(texts, locale, gender, concurrency, onDone) {
  let next = 0;
  const stats = { ok: 0, skip: 0, fail: 0, failed: [] };
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= texts.length) return;
      try {
        (await genOne(texts[i], locale, gender)) === "ok" ? stats.ok++ : stats.skip++;
      } catch (e) {
        stats.fail++;
        stats.failed.push(texts[i]);
      }
      onDone(stats.ok + stats.skip + stats.fail);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return stats;
}

async function genVoice(locale, gender, texts) {
  if (!LOCALE_VOICES[locale]) {
    console.error(
      `${locale} 没有配 edge-tts 音色，可选：${Object.keys(LOCALE_VOICES).join("、")}\n` +
        `（未列入的语种走浏览器内置语音合成，无需预生成）`,
    );
    process.exitCode = 1;
    return;
  }
  const dir = outDir(locale, gender);
  mkdirSync(dir, { recursive: true });
  // 清掉上次中断留下的空文件。进程被强杀时正在写入的文件会留成 0 字节，
  // 虽然 isValidMp3 会把它们当未生成、重试时覆盖掉，但留着会让
  // 「已生成多少」的统计虚高，也会被打进构建产物。
  const stale = readdirSync(dir).filter(
    (f) => f.endsWith(".mp3") && statSync(join(dir, f)).size === 0,
  );
  for (const f of stale) rmSync(join(dir, f), { force: true });
  if (stale.length) console.log(`  清掉 ${stale.length} 个上次中断留下的空文件`);
  console.log(`\n${locale} / ${gender}（${LOCALE_VOICES[locale][gender]}），共 ${texts.length} 句`);
  let lastLog = 0;
  const stats = await runPool(texts, locale, gender, CONCURRENCY, (done) => {
    if (done - lastLog >= 100 || done === texts.length) {
      lastLog = done;
      console.log(`  进度 ${done}/${texts.length}`);
    }
  });
  // 失败清单落盘：长跑时 stdout 会被日志截断，之前 158 句失败的清单就这么丢了。
  // 重跑时脚本会自动跳过已成功的句子。
  if (stats.failed.length > 0) {
    const log = join(BASE_DIR, `${locale}-${gender}-failed.txt`);
    writeFileSync(log, stats.failed.join("\n") + "\n");
    console.log(`  失败清单已写入 ${log}`);
  }
  console.log(
    `  ${locale}/${gender} 完成：生成 ${stats.ok}、跳过 ${stats.skip}、失败 ${stats.fail}`,
  );
  if (stats.fail > 0) process.exitCode = 1;
}

async function main() {
  for (const locale of LOCALES) {
    // 每个语种的口播文本不同（由该语种词条拼出），故逐语种收集
    const texts = await collectTexts(locale);
    for (const gender of GENDERS) await genVoice(locale, gender, texts);
  }
}

main();
