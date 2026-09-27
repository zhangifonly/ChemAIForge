// 常驻合成进程管理器的行为守卫。
//
// 用一个假的"合成脚本"代替真 VITS：它遵守同一套一问一答协议，但瞬间返回，
// 并能按指令模拟失败、卡死、崩溃。这样不装 torch、不加载 951 MB 模型也能测。
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { VitsWorker } from "./vitsWorker";

let dir = "";
let script = "";

// 假脚本：启动计数写文件，便于断言"只启动了一次"；文本里带指令时模拟异常
const FAKE = `
import json, os, sys
d = sys.argv[1]
with open(os.path.join(d, "starts"), "a") as f: f.write("x")
print(json.dumps({"ready": True}), flush=True)
for line in sys.stdin:
    req = json.loads(line)
    t = req["text"]
    if t == "CRASH": sys.exit(1)
    if t == "HANG": import time; time.sleep(3600)
    if t == "FAIL":
        print(json.dumps({"ok": False, "error": "模拟失败"}), flush=True); continue
    with open(req["out"], "w") as f: f.write(t)
    print(json.dumps({"ok": True}), flush=True)
`;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "vits-worker-"));
  script = join(dir, "fake.py");
  writeFileSync(script, FAKE);
  chmodSync(script, 0o755);
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const make = () => new VitsWorker({ python: "python3", script, modelDir: dir });
const starts = () => (existsSync(join(dir, "starts")) ? readFileSync(join(dir, "starts"), "utf8").length : 0);

describe("常驻合成进程", () => {
  it("合成结果写到指定文件", async () => {
    const w = make();
    const out = join(dir, "a.wav");
    await w.synthesize("你好", out);
    expect(readFileSync(out, "utf8")).toBe("你好");
  });

  it("多次请求只启动一个进程：常驻的全部意义", async () => {
    const before = starts();
    const w = make();
    for (let i = 0; i < 3; i++) await w.synthesize(`第${i}句`, join(dir, `b${i}.wav`));
    expect(starts() - before).toBe(1);
  });

  it("并发请求按序排队，每个应答对应自己的请求", async () => {
    const w = make();
    const outs = [0, 1, 2, 3].map((i) => join(dir, `c${i}.wav`));
    await Promise.all(outs.map((o, i) => w.synthesize(`句${i}`, o)));
    outs.forEach((o, i) => expect(readFileSync(o, "utf8")).toBe(`句${i}`));
  });

  it("单句失败只拒绝那一句，进程继续可用", async () => {
    const w = make();
    await expect(w.synthesize("FAIL", join(dir, "d.wav"))).rejects.toThrow("模拟失败");
    await w.synthesize("恢复", join(dir, "e.wav"));
    expect(readFileSync(join(dir, "e.wav"), "utf8")).toBe("恢复");
  });

  it("进程崩溃后下一次请求自动重启", async () => {
    const w = make();
    await expect(w.synthesize("CRASH", join(dir, "f.wav"))).rejects.toThrow();
    const before = starts();
    await w.synthesize("重启后", join(dir, "g.wav"));
    expect(starts() - before).toBe(1);
    expect(readFileSync(join(dir, "g.wav"), "utf8")).toBe("重启后");
  });
});
