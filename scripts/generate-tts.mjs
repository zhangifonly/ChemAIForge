// TTS 预生成脚本：遍历全部实验，用 buildLesson 收集唯一口播文本，
// 调用 edge-tts（微软 Edge 在线 TTS）为每种音色生成 mp3 到 public/audio/lesson/<voice>/。
// 与 mathviz 同源方案；文件名由 audioKey() 决定，与客户端播放端一致。
//
// 用法：node scripts/generate-tts.mjs [--voice xiaoxiao|yunxi] [--force]
//   不带 --voice 时为所有音色生成。
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, mkdirSync, statSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { allExperiments } from "../src/data/experiments/index.ts";
import { buildLesson } from "../src/components/lab/lesson/buildLesson.ts";
import { audioKey, VOICE_EDGE } from "../src/components/lab/lesson/audioKey.ts";

const run = promisify(execFile);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      await run("edge-tts", ["--voice", VOICE_EDGE[voice], "--text", text, "--write-media", out]);
      if (isValidMp3(out)) return "ok";
      throw new Error("生成了空文件");
    } catch (e) {
      rmSync(out, { force: true }); // 清理空/损坏文件，避免下次误跳过
      if (attempt === 4) throw e;
      await sleep(800 * attempt); // 退避后重试（Edge 偶发限频）
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
  for (let i = 0; i < texts.length; i++) {
    try {
      (await genOne(texts[i], voice)) === "ok" ? ok++ : skip++;
    } catch (e) {
      fail++;
      console.error(`✗ [${i}] ${texts[i].slice(0, 24)}… ${e.message ?? e}`);
    }
    if ((i + 1) % 50 === 0) console.log(`  进度 ${i + 1}/${texts.length}`);
  }
  console.log(`  ${voice} 完成：生成 ${ok}、跳过 ${skip}、失败 ${fail}`);
  if (fail > 0) process.exitCode = 1;
}

async function main() {
  const texts = collectTexts();
  for (const voice of VOICES) await genVoice(voice, texts);
}

main();
