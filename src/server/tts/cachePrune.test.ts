import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { listCache, pruneCache, selectEvictions, type CacheFile } from "./cachePrune";

const f = (name: string, size: number, atimeMs: number): CacheFile => ({ path: name, size, atimeMs });

describe("淘汰选择", () => {
  it("未超上限时不删任何文件", () => {
    expect(selectEvictions([f("a", 100, 1), f("b", 100, 2)], 1000)).toEqual([]);
  });

  it("超上限时从最久没访问的开始删", () => {
    const victims = selectEvictions([f("new", 400, 300), f("old", 400, 100), f("mid", 400, 200)], 1000);
    expect(victims[0].path).toBe("old");
  });

  it("删到上限的 80% 为止，留出余量避免频繁触发", () => {
    // 总 1200、上限 1000 → 目标 800：删掉一个 400 即可
    const victims = selectEvictions([f("a", 400, 1), f("b", 400, 2), f("c", 400, 3)], 1000);
    expect(victims.map((v) => v.path)).toEqual(["a"]);
  });

  it("最近听过的文件保留：LRU 的全部意义", () => {
    const victims = selectEvictions(
      [f("hot", 500, 999), f("cold1", 500, 1), f("cold2", 500, 2)],
      1000,
    );
    expect(victims.map((v) => v.path)).not.toContain("hot");
  });

  it("空缓存不报错", () => {
    expect(selectEvictions([], 1000)).toEqual([]);
  });
});

describe("磁盘上的淘汰", () => {
  let dir = "";
  afterEach(() => dir && rmSync(dir, { recursive: true, force: true }));

  it("按访问时间删掉旧文件、保留新文件，且能递归子目录", () => {
    dir = mkdtempSync(join(tmpdir(), "tts-cache-"));
    const sub = join(dir, "ja", "female");
    mkdirSync(sub, { recursive: true });
    const old = join(sub, "old.mp3");
    const recent = join(sub, "recent.mp3");
    writeFileSync(old, Buffer.alloc(600));
    writeFileSync(recent, Buffer.alloc(600));
    utimesSync(old, new Date(1000), new Date(1000));
    utimesSync(recent, new Date(), new Date());

    expect(listCache(dir)).toHaveLength(2);
    const freed = pruneCache(dir, 1000);
    expect(freed).toBe(600);
    expect(existsSync(old)).toBe(false);
    expect(existsSync(recent)).toBe(true);
  });

  it("缓存目录不存在时视为空", () => {
    expect(listCache(join(tmpdir(), "definitely-not-here-xyz"))).toEqual([]);
  });
});
