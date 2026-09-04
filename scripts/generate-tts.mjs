// TTS 预生成脚本：遍历全部实验，用 buildLesson 收集唯一口播文本，
// 调用 edge-tts（微软 Edge 在线 TTS）为每种音色生成 mp3 到 public/audio/lesson/<voice>/。
// 与 mathviz 同源方案；文件名由 audioKey() 决定，与客户端播放端一致。
//
// 用法：npm run tts:generate -- [--voice xiaoxiao|yunxi] [--force]
//   不带 --voice 时为所有音色生成。
//   ⚠️ 必须经 tsx 运行（package.json 的 tts:generate）：本文件 import 了 .ts 模块，
//   裸 node 无法解析其中省略扩展名的相对导入，会直接 ERR_MODULE_NOT_FOUND。
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, mkdirSync, statSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { allExperiments } from "../src/data/experiments/index.ts";
import { buildLesson } from "../src/components/lab/lesson/buildLesson.ts";
import { audioKey, VOICE_EDGE } from "../src/components/lab/lesson/audioKey.ts";

const run = promisify(execFile);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** 单句最多尝试次数（Edge 限频可持续十几秒，次数少了整批会大面积失败） */
const MAX_ATTEMPTS = 5;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE_DIR = join(ROOT, "public", "audio", "lesson");

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const pick = args.includes("--voice") ? args[args.indexOf("--voice") + 1] : null;
// 待生成音色列表（默认全部）
const VOICES = pick ? [pick] : Object.keys(VOICE_EDGE);

// 收集全部唯一口播文本
function collectTexts() {
  const set = new Set();
  for (const exp of allExperiments) {
    for (const step of buildLesson(exp)) set.add(step.narration);
  }
  return [...set];
}

// 有效的非空 mp3 才算已生成（避免把 NoAudioReceived 留下的空文件当成功）
function isValidMp3(p) {
  return existsSync(p) && statSync(p).size > 0;
}

// 为单句 + 单音色生成 mp3（已存在有效文件且非 --force 则跳过；失败重试，清理空文件）
async function genOne(text, voice) {
  const out = join(BASE_DIR, voice, `${audioKey(text)}.mp3`);
  if (isValidMp3(out) && !FORCE) return "skip";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      // timeout 必须给：edge-tts 偶发会在等 Edge 服务响应时永久挂住（实测挂了 44 分钟
      // 不退出），而本脚本是串行的，一个卡死的子进程就把整批生成堵在原地。
      // 超时后 execFile 发 SIGTERM，走下面的重试分支。
      await run("edge-tts", ["--voice", VOICE_EDGE[voice], "--text", text, "--write-media", out], {
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

async function genVoice(voice, texts) {
  if (!VOICE_EDGE[voice]) {
    console.error(`未知音色 ${voice}，可选：${Object.keys(VOICE_EDGE).join("、")}`);
    process.exitCode = 1;
    return;
  }
  mkdirSync(join(BASE_DIR, voice), { recursive: true });
  console.log(`\n音色 ${voice}（${VOICE_EDGE[voice]}），共 ${texts.length} 句`);
  let ok = 0,
    skip = 0,
    fail = 0;
  const failed = [];
  for (let i = 0; i < texts.length; i++) {
    try {
      (await genOne(texts[i], voice)) === "ok" ? ok++ : skip++;
    } catch (e) {
      fail++;
      failed.push(texts[i]);
      console.error(`✗ [${i}] ${texts[i].slice(0, 24)}… ${e.message ?? e}`);
    }
    if ((i + 1) % 50 === 0) console.log(`  进度 ${i + 1}/${texts.length}`);
  }
  // 失败清单落盘：长跑时 stdout 会被日志截断，之前 158 句失败的清单就这么丢了，
  // 只能靠比对另一音色的文件名反推。重跑时脚本会自动跳过已成功的句子。
  if (failed.length > 0) {
    const log = join(BASE_DIR, `${voice}-failed.txt`);
    writeFileSync(log, failed.join("\n") + "\n");
    console.log(`  失败清单已写入 ${log}`);
  }
  console.log(`  ${voice} 完成：生成 ${ok}、跳过 ${skip}、失败 ${fail}`);
  if (fail > 0) process.exitCode = 1;
}

async function main() {
  const texts = collectTexts();
  for (const voice of VOICES) await genVoice(voice, texts);
}

main();
