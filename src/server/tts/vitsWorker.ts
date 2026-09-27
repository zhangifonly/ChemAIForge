// 常驻 VITS 合成进程的管理：懒启动、串行排队、超时与崩溃后自动重启。
//
// 为什么不每句起一个进程：import torch + 加载 951 MB 模型实测约 6 秒，而合成本身
// 只要零点几秒。常驻进程把这 6 秒摊到第一次请求上。
//
// 为什么串行：模型只有一份，且 PyTorch 推理在单进程里并发并不会更快；
// 排队由这里做，Python 端保持最简单的一问一答。
import { spawn, type ChildProcess } from "node:child_process";
import { createInterface, type Interface } from "node:readline";

/** 单句合成超时：比 edge-tts 宽，因为首句要等模型加载 */
const REQUEST_TIMEOUT_MS = 60_000;
/** 启动（加载模型）超时 */
const STARTUP_TIMEOUT_MS = 120_000;
/**
 * 闲置这么久没有请求就退出，释放约 1.3 GB 内存。
 *
 * 取 2 小时而不是永久常驻：部署机 7.8 GB 内存还跑着十几个服务，常驻会一直占着这 1.3 GB；
 * 而原先的 10 分钟又太短 —— 冷启动在纯 CPU 上要 32 秒，一节课中途停顿十几分钟，
 * 学生回来点下一步就要干等半分钟。2 小时覆盖一整节课及课间，夜间自动释放。
 * 可用 VITS_IDLE_MINUTES 覆盖（设 0 表示永不退出）。
 */
const IDLE_EXIT_MS = Number(process.env.VITS_IDLE_MINUTES ?? 120) * 60_000;

interface Pending {
  resolve: () => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout;
}

export interface VitsWorkerOptions {
  python: string;
  script: string;
  modelDir: string;
}

export class VitsWorker {
  private child: ChildProcess | null = null;
  private lines: Interface | null = null;
  private ready: Promise<void> | null = null;
  /** 一问一答：同一时刻只有一个在途请求，其余排在 queue 里 */
  private current: Pending | null = null;
  private queue: Array<() => void> = [];
  private idleTimer: NodeJS.Timeout | null = null;

  constructor(private readonly opts: VitsWorkerOptions) {}

  /** 合成一句到 out（wav） */
  async synthesize(text: string, out: string): Promise<void> {
    await this.start();
    // 排队：等前一个请求完成再发，避免应答错配
    if (this.current) await new Promise<void>((r) => this.queue.push(r));
    this.touchIdle();
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        // 超时说明进程卡死：杀掉重来，下一次请求会重新启动
        this.fail(new Error("VITS 合成超时"));
        this.kill();
      }, REQUEST_TIMEOUT_MS);
      this.current = { resolve, reject, timer };
      this.child!.stdin!.write(`${JSON.stringify({ text, out })}\n`);
    });
  }

  private start(): Promise<void> {
    if (this.ready) return this.ready;
    this.ready = new Promise<void>((resolve, reject) => {
      const child = spawn(this.opts.python, [this.opts.script, this.opts.modelDir], {
        stdio: ["pipe", "pipe", "ignore"],
      });
      this.child = child;
      const lines = createInterface({ input: child.stdout! });
      this.lines = lines;
      const startupTimer = setTimeout(() => {
        reject(new Error("VITS 模型加载超时"));
        this.kill();
      }, STARTUP_TIMEOUT_MS);

      lines.on("line", (line) => {
        let msg: { ready?: boolean; ok?: boolean; error?: string };
        try {
          msg = JSON.parse(line);
        } catch {
          return; // 非协议行（第三方库偶发的输出），忽略
        }
        if (msg.ready) {
          clearTimeout(startupTimer);
          resolve();
          return;
        }
        if (msg.ok) this.settle();
        else this.fail(new Error(msg.error ?? "VITS 合成失败"));
      });

      child.on("exit", () => {
        clearTimeout(startupTimer);
        reject(new Error("VITS 进程启动失败"));
        this.fail(new Error("VITS 进程意外退出"));
        this.reset();
      });
    });
    // 启动失败时允许下次重试，而不是永远缓存一个失败的 Promise
    this.ready.catch(() => this.reset());
    return this.ready;
  }

  private settle(): void {
    const p = this.current;
    if (!p) return;
    clearTimeout(p.timer);
    this.current = null;
    p.resolve();
    this.queue.shift()?.();
  }

  private fail(err: Error): void {
    const p = this.current;
    if (!p) return;
    clearTimeout(p.timer);
    this.current = null;
    p.reject(err);
    this.queue.shift()?.();
  }

  private touchIdle(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (IDLE_EXIT_MS <= 0) return; // 0 = 永不退出
    this.idleTimer = setTimeout(() => this.kill(), IDLE_EXIT_MS);
    this.idleTimer.unref();
  }

  private kill(): void {
    this.child?.kill("SIGKILL");
    this.reset();
  }

  private reset(): void {
    this.lines?.close();
    this.child = null;
    this.lines = null;
    this.ready = null;
  }
}
