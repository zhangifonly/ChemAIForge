// 服务端语音合成：按需调用 edge-tts，产物落盘缓存。
//
// 为什么按需生成而不全量预生成：57 个语种 × 男女双声 × 1349 句约 8.8 GB、
// 16 万个文件。放进 git 会废掉仓库（现在 .git 才 132 MB，且音频不可压不可删），
// 放部署机也装不下（LAX02 只剩 32 GB 还跑着十几个服务）。
// 按需生成 + 落盘缓存则只占学生真正听过的那部分，实测单句 1.6 秒，
// 配合客户端预取下一步，听起来是连续的。
//
// 为什么用 CLI 而不直连 WebSocket：微软要求 Sec-MS-GEC 签名头，算法会变；
// edge-tts 这个 Python 包在跟进它。自己实现协议等于承担对方随时改版的风险。
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, mkdirSync, readdirSync, statSync, rmSync, utimesSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { audioKey, type VoiceGender } from "@/components/lab/lesson/audioKey";
import { DEFAULT_CACHE_LIMIT_BYTES, pruneCache } from "./cachePrune";
import { routeFor, type EngineRoute } from "./engines";
import { VitsWorker } from "./vitsWorker";
import { homedir } from "node:os";

/**
 * Piper 的运行环境。它是本机工具链（ONNX 推理 + Python），不属于应用依赖，
 * 故路径可配：部署机上装在哪里由环境变量告诉我们。
 */
const PIPER_BIN =
  process.env.PIPER_BIN ?? join(homedir(), ".local/share/chemaiforge-tts/.venv/bin/piper");
const PIPER_MODEL_DIR = process.env.PIPER_MODEL_DIR ?? "";

/**
 * VITS（Coqui）运行环境：Python 解释器、常驻合成脚本、模型目录。
 * 与 Piper 同理放在应用之外，路径由环境变量配置。
 */
const TTS_ROOT = join(homedir(), ".local/share/chemaiforge-tts");
const VITS_PYTHON = process.env.VITS_PYTHON ?? join(TTS_ROOT, ".venv/bin/python");
const VITS_MODEL_DIR = process.env.VITS_MODEL_DIR ?? join(TTS_ROOT, "models");
const VITS_SCRIPT = join(process.cwd(), "scripts/tts-vits-worker.py");

/**
 * 每个模型一个常驻进程，懒创建：没人听旁遮普语就不占那 1.5 GB 内存。
 *
 * 必须挂在 globalThis 上：Next.js 会把路由模块实例化不止一次（开发态热重载、
 * 生产态不同路由各自打包），模块级的 Map 每次都是新的 —— 实测每个请求都
 * 新起一个 Python 进程加载 951 MB 模型，常驻等于白做，还在不停泄漏进程。
 */
const g = globalThis as typeof globalThis & { __vitsWorkers?: Map<string, VitsWorker> };
const vitsWorkers = (g.__vitsWorkers ??= new Map<string, VitsWorker>());
function vitsWorker(model = "pa-vits"): VitsWorker {
  let w = vitsWorkers.get(model);
  if (!w) {
    w = new VitsWorker({
      python: VITS_PYTHON,
      script: VITS_SCRIPT,
      modelDir: join(VITS_MODEL_DIR, model),
    });
    vitsWorkers.set(model, w);
  }
  return w;
}

const run = promisify(execFile);

/** 缓存根目录。放 public 之外：这些是运行期产物，不该被打进构建 */
const CACHE_DIR = join(process.cwd(), ".tts-cache");

/** 单次合成超时。edge-tts 偶发会永久挂住（历史记录里挂过 44 分钟） */
const TIMEOUT_MS = 30_000;

/** 同时进行的合成上限：超出的请求直接拒绝，避免一次课堂并发把机器压垮 */
const MAX_INFLIGHT = 8;
let inflight = 0;

/** 缓存容量上限，可用 TTS_CACHE_LIMIT_MB 覆盖（见 cachePrune 的说明） */
const CACHE_LIMIT = process.env.TTS_CACHE_LIMIT_MB
  ? Number(process.env.TTS_CACHE_LIMIT_MB) * 1024 * 1024
  : DEFAULT_CACHE_LIMIT_BYTES;

/**
 * 每写入这么多个新文件检查一次容量。
 * 每次都扫描会拖慢合成（缓存满时有上万个文件）；隔 N 次扫一次就够了，
 * 超额也只会超出几十个文件、几 MB。
 */
const PRUNE_EVERY = 50;
let writesSincePrune = 0;

/**
 * 标记一次命中。显式改时间戳而不是依赖文件系统的 atime：
 * 大多数 Linux 以 noatime / relatime 挂载，读文件不会更新 atime，
 * 那样 LRU 就退化成按写入时间淘汰 —— 最常听的句子反而最先被删。
 */
function touch(p: string): void {
  const now = new Date();
  try {
    utimesSync(p, now, now);
  } catch {
    /* 文件恰好被淘汰掉了，无妨 */
  }
}

/** 正在合成的同一句只跑一次，后来者等它 */
const pending = new Map<string, Promise<Buffer>>();

function cachePath(locale: string, gender: VoiceGender, text: string): string {
  return join(CACHE_DIR, locale, gender, `${audioKey(text)}.mp3`);
}

function isValid(p: string): boolean {
  return existsSync(p) && statSync(p).size > 0;
}

/** 该语种能否合成（任一引擎可用即可） */
export function canSynthesize(locale: string): boolean {
  return routeFor(locale, "female") !== null;
}

/** Piper 模型的绝对路径：显式配置优先，否则取 HF 缓存里的 piper-voices 快照 */
function piperModelPath(rel: string): string {
  if (PIPER_MODEL_DIR) return join(PIPER_MODEL_DIR, rel);
  const snaps = join(homedir(), ".cache/huggingface/hub/models--rhasspy--piper-voices/snapshots");
  const dirs = existsSync(snaps) ? readdirSync(snaps) : [];
  return dirs.length ? join(snaps, dirs[0], rel) : join(snaps, rel);
}

/**
 * 按路由调用引擎，产物写到 out。
 * Piper 输出 wav，这里统一转成 mp3：缓存、Content-Type、客户端解码都只认一种格式。
 */
async function runEngine(route: EngineRoute, text: string, out: string): Promise<void> {
  if (route.engine === "edge") {
    await run("edge-tts", ["--voice", route.voice, "--text", text, "--write-media", out], {
      timeout: TIMEOUT_MS,
      killSignal: "SIGKILL",
    });
    return;
  }
  const wav = `${out}.wav`;
  try {
    if (route.engine === "vits") {
      await vitsWorker(route.model).synthesize(text, wav);
    } else {
      await runWithStdin(PIPER_BIN, ["-m", piperModelPath(route.model), "-f", wav], text);
    }
    await run("ffmpeg", ["-y", "-loglevel", "error", "-i", wav, "-b:a", "48k", out], {
      timeout: TIMEOUT_MS,
    });
  } finally {
    rmSync(wav, { force: true });
  }
}

/** Piper 从标准输入读文本 */
function runWithStdin(bin: string, args: string[], input: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = execFile(bin, args, { timeout: TIMEOUT_MS, killSignal: "SIGKILL" }, (err) =>
      err ? reject(err) : resolve(),
    );
    child.stdin?.end(input);
  });
}

/**
 * 预热：把 VITS 模型载入常驻进程。
 *
 * 不能用"合成一句"来预热：那句话一旦进了缓存，synthesize 直接读文件返回，
 * 根本不会碰模型 —— 预热从第二次重启起就静默失效（实测 .tts-cache 里已有该句，进程没起来）。
 * 这里绕过缓存，直接让常驻进程合成到临时文件。
 */
export async function prewarmVits(): Promise<void> {
  const tmp = join(CACHE_DIR, `.prewarm-${process.pid}.wav`);
  mkdirSync(CACHE_DIR, { recursive: true });
  try {
    await vitsWorker().synthesize("ਤਿਆਰ", tmp);
  } finally {
    rmSync(tmp, { force: true });
  }
}

export class TtsBusyError extends Error {}
export class TtsUnsupportedError extends Error {}

/**
 * 取一句口播的语音，缓存命中直接返回。
 *
 * 预生成的文件（public/audio/lesson 下那批中文）不走这里 —— 客户端会先试
 * 静态路径，失败才回落到本接口，故这里只管"还没有的"。
 */
export async function synthesize(
  text: string,
  locale: string,
  gender: VoiceGender,
): Promise<Buffer> {
  if (!canSynthesize(locale)) {
    throw new TtsUnsupportedError(`${locale} 没有可用音色`);
  }
  const out = cachePath(locale, gender, text);
  if (isValid(out)) {
    touch(out);
    return readFile(out);
  }

  // 同一句并发请求只合成一次：一个班同时点播同一步时，
  // 不做这层去重就会起几十个子进程做同一件事
  const key = `${locale}/${gender}/${audioKey(text)}`;
  const running = pending.get(key);
  if (running) return running;

  if (inflight >= MAX_INFLIGHT) {
    // 宁可让客户端退回浏览器语音，也不要把请求堆在队列里拖成超时
    throw new TtsBusyError("合成队列已满");
  }

  const task = (async () => {
    inflight += 1;
    try {
      mkdirSync(join(CACHE_DIR, locale, gender), { recursive: true });
      const route = routeFor(locale, gender);
      if (!route) throw new TtsUnsupportedError(`${locale} 没有可用音色`);
      await runEngine(route, text, out);
      if (!isValid(out)) throw new Error("edge-tts 返回了空音频");
      const buf = await readFile(out);
      if (++writesSincePrune >= PRUNE_EVERY) {
        writesSincePrune = 0;
        // 淘汰放在读完之后：刚合成的文件时间戳最新，不会被这一轮删掉
        pruneCache(CACHE_DIR, CACHE_LIMIT);
      }
      return buf;
    } catch (err) {
      // 清掉空/半截文件，否则下次会被 isValid 当成有效缓存返回
      rmSync(out, { force: true });
      throw err;
    } finally {
      inflight -= 1;
      pending.delete(key);
    }
  })();

  pending.set(key, task);
  return task;
}
