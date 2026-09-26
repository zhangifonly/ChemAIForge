// 语音缓存的容量控制：超过上限时按最近访问时间淘汰最久没人听的文件。
//
// 为什么必须有：按需合成的缓存会随学生点播只增不减。57 语种 × 男女双声 ×
// 1349 句全部听过一遍约 8.8 GB，占部署机 LAX02 剩余空间（32 GB）的四分之一以上，
// 而那台机器还跑着十几个其他服务。设上限后，常用的句子留在缓存里，
// 冷门语种的冷门句子被挤掉 —— 下次有人点播再合成一次即可，代价只是 1.6 秒。
import { readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

/** 默认上限 1.5 GB：覆盖主力语种的全部常用句绰绰有余，又远离磁盘水位线 */
export const DEFAULT_CACHE_LIMIT_BYTES = 1.5 * 1024 * 1024 * 1024;

/** 淘汰到上限的这个比例为止，留出余量，避免每写一个文件就触发一次淘汰 */
const LOW_WATER_RATIO = 0.8;

export interface CacheFile {
  path: string;
  size: number;
  /** 最近访问时间（毫秒）。命中缓存时由调用方 touch，作为 LRU 依据 */
  atimeMs: number;
}

/**
 * 选出要删除的文件（纯函数，不碰磁盘）。
 * 总量未超上限时返回空；超了则按访问时间从旧到新删，直到降到低水位。
 */
export function selectEvictions(files: CacheFile[], limitBytes: number): CacheFile[] {
  const total = files.reduce((n, f) => n + f.size, 0);
  if (total <= limitBytes) return [];
  const target = limitBytes * LOW_WATER_RATIO;
  const oldestFirst = [...files].sort((a, b) => a.atimeMs - b.atimeMs);
  const out: CacheFile[] = [];
  let remaining = total;
  for (const f of oldestFirst) {
    if (remaining <= target) break;
    out.push(f);
    remaining -= f.size;
  }
  return out;
}

/** 递归列出缓存目录下的 mp3 */
export function listCache(dir: string): CacheFile[] {
  const out: CacheFile[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out; // 缓存目录还不存在
  }
  for (const name of entries) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...listCache(p));
    else if (name.endsWith(".mp3")) out.push({ path: p, size: st.size, atimeMs: st.atimeMs });
  }
  return out;
}

/** 执行一次淘汰，返回删掉的字节数 */
export function pruneCache(dir: string, limitBytes = DEFAULT_CACHE_LIMIT_BYTES): number {
  const victims = selectEvictions(listCache(dir), limitBytes);
  let freed = 0;
  for (const f of victims) {
    rmSync(f.path, { force: true });
    freed += f.size;
  }
  return freed;
}
