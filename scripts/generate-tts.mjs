// TTS 预生成脚本：遍历全部实验，用 buildLesson 收集唯一口播文本，
// 调用 edge-tts（微软 Edge 在线 TTS，晓晓音色）生成 mp3 到 public/audio/lesson/。
// 与 mathviz 同源方案；文件名由 audioKey() 决定，与客户端播放端一致。
//
// 用法：node scripts/generate-tts.mjs [--voice zh-CN-XiaoxiaoNeural] [--force]
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { allExperiments } from "../src/data/experiments/index.ts";
import { buildLesson } from "../src/components/lab/lesson/buildLesson.ts";
import { audioKey } from "../src/components/lab/lesson/audioKey.ts";

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public", "audio", "lesson");

const args = process.argv.slice(2);
const VOICE =
  args.includes("--voice") ? args[args.indexOf("--voice") + 1] : "zh-CN-XiaoxiaoNeural";
const FORCE = args.includes("--force");

// 收集全部唯一口播文本
function collectTexts() {
  const set = new Set();
  for (const exp of allExperiments) {
    for (const step of buildLesson(exp)) set.add(step.narration);
  }
  return [...set];
}

// 为单句生成 mp3（已存在且非 --force 则跳过）
async function genOne(text) {
  const out = join(OUT_DIR, `${audioKey(text)}.mp3`);
  if (existsSync(out) && !FORCE) return "skip";
  await run("edge-tts", ["--voice", VOICE, "--text", text, "--write-media", out]);
  return "ok";
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const texts = collectTexts();
  console.log(`唯一口播 ${texts.length} 句，音色 ${VOICE}，输出 ${OUT_DIR}`);
  let ok = 0,
    skip = 0,
    fail = 0;
  // 串行限流，避免触发 Edge TTS 服务限频
  for (let i = 0; i < texts.length; i++) {
    try {
      const r = await genOne(texts[i]);
      r === "ok" ? ok++ : skip++;
    } catch (e) {
      fail++;
      console.error(`✗ [${i}] ${texts[i].slice(0, 24)}… ${e.message ?? e}`);
    }
    if ((i + 1) % 25 === 0) console.log(`  进度 ${i + 1}/${texts.length}`);
  }
  console.log(`完成：生成 ${ok}、跳过 ${skip}、失败 ${fail}`);
  if (fail > 0) process.exitCode = 1;
}

main();
