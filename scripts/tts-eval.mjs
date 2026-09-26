// 客观评估"某个音色念某种语言念得准不准"：合成 → 语音识别转写 → 与原文比对字符错误率。
//
// 为什么需要：edge-tts 没有他加禄语、亚美尼亚语、旁遮普语的原生音色，只能借别的
// 音色（印尼语、马来语、Multilingual）或换引擎（espeak-ng、Piper）。
// 哪个最好不能靠感觉 —— 这几种语言我们没人听得懂，只能用识别模型当"耳朵"：
// 能被正确转写回原文的，就是念得清楚的。
//
// 用法：node scripts/tts-eval.mjs
// 依赖：whisper-cli（whisper.cpp）与 ~/.cache/whisper-cpp/ggml-large-v3-turbo.bin
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const MODEL = join(homedir(), ".cache/whisper-cpp/ggml-large-v3-turbo.bin");
if (!existsSync(MODEL)) {
  console.error(`缺识别模型：${MODEL}`);
  process.exit(1);
}

/** 评测句：取自讲解口播的典型句式（取用、混合、观察现象、安全提醒） */
const SAMPLES = {
  tl: [
    "Kumuha ng hydrochloric acid at ilagay sa beaker.",
    "Haluin nang mabuti ang mga reagent at obserbahan ang pagbabago ng kulay.",
    "Ang sodium hydroxide ay matapang na base at nakakasunog ng balat.",
  ],
  hy: [
    "Վերցրեք աղաթթու և ավելացրեք բաժակի մեջ։",
    "Լավ խառնեք ռեագենտները և դիտեք գույնի փոփոխությունը։",
  ],
  pa: [
    "ਹਾਈਡ੍ਰੋਕਲੋਰਿਕ ਐਸਿਡ ਲਓ ਅਤੇ ਬੀਕਰ ਵਿੱਚ ਪਾਓ।",
    "ਰੀਏਜੈਂਟਾਂ ਨੂੰ ਚੰਗੀ ਤਰ੍ਹਾਂ ਮਿਲਾਓ ਅਤੇ ਰੰਗ ਵਿੱਚ ਤਬਦੀਲੀ ਦੇਖੋ।",
  ],
};

/** 候选合成方式：返回一个 (text, outPath) => void 的函数 */
const edge = (voice) => (text, out) =>
  execFileSync("edge-tts", ["--voice", voice, "--text", text, "--write-media", out], {
    timeout: 60_000,
  });
const espeak = (voice) => (text, out) =>
  execFileSync("espeak-ng", ["-v", voice, "-w", out, text], { timeout: 30_000 });

const CANDIDATES = {
  tl: {
    "edge 印尼语 Gadis": edge("id-ID-GadisNeural"),
    "edge 马来语 Yasmin": edge("ms-MY-YasminNeural"),
    "edge 西语 Ximena": edge("es-ES-XimenaNeural"),
    "edge 多语种 Ava": edge("en-US-AvaMultilingualNeural"),
    "edge 多语种 Andrew": edge("en-US-AndrewMultilingualNeural"),
    "edge 多语种 Emma": edge("en-US-EmmaMultilingualNeural"),
    "edge 多语种 Brian": edge("en-US-BrianMultilingualNeural"),
  },
  hy: { "espeak-ng hy": espeak("hy") },
  pa: { "espeak-ng pa": espeak("pa") },
};

/** 归一化后比对：忽略大小写、标点与空白，只看字符序列 */
function norm(s) {
  return s.toLowerCase().normalize("NFC").replace(/[\p{P}\p{S}\s]+/gu, "");
}

/** 编辑距离 */
function levenshtein(a, b) {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

function transcribe(wavOrMp3, lang, dir) {
  // whisper.cpp 只吃 16kHz 单声道 wav，先转码
  const wav = join(dir, "in16k.wav");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", wavOrMp3, "-ar", "16000", "-ac", "1", wav]);
  // 转写写到 .txt（-otxt），不从 stdout 取：whisper.cpp 会把 Metal 初始化日志
  // 打到 stdout，混进来会让错误率虚高到 150%
  execFileSync("whisper-cli", ["-m", MODEL, "-l", lang, "-nt", "-np", "-otxt", "-of", join(dir, "out"), "-f", wav], {
    stdio: "ignore",
    timeout: 120_000,
  });
  return readFileSync(join(dir, "out.txt"), "utf8").trim();
}

const dir = mkdtempSync(join(tmpdir(), "tts-eval-"));
try {
  const only = process.argv[2];
  for (const [lang, sentences] of Object.entries(SAMPLES)) {
    if (only && lang !== only) continue;
    console.log(`\n[${lang}]`);
    for (const [name, synth] of Object.entries(CANDIDATES[lang])) {
      let errs = 0;
      let chars = 0;
      for (const s of sentences) {
        const audio = join(dir, `a.${name.startsWith("espeak") ? "wav" : "mp3"}`);
        try {
          synth(s, audio);
          const heard = transcribe(audio, lang, dir);
          errs += levenshtein(norm(s), norm(heard));
        } catch {
          errs += norm(s).length; // 合成失败按全错计
        }
        chars += norm(s).length;
      }
      const cer = (errs / chars) * 100;
      console.log(`  ${name.padEnd(22)} 字符错误率 ${cer.toFixed(1)}%`);
    }
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
