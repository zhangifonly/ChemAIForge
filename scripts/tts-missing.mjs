// 排查用小工具：列出某音色缺失的口播文本（按 audioKey 反查原句），
// 并报告已无人引用的孤儿音频（口播文案改动后残留，会被打进构建产物）。
// 只读不删：删文件交由使用者决定。
// 用法：npx tsx scripts/tts-missing.mjs [voice]  默认 yunxi
import { readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { allExperiments } from "../src/data/experiments/index.ts";
import { buildLesson } from "../src/components/lab/lesson/buildLesson.ts";
import { audioKey } from "../src/components/lab/lesson/audioKey.ts";

const voice = process.argv[2] ?? "yunxi";
const BASE = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "audio", "lesson");
const have = new Set(readdirSync(join(BASE, voice)).map((f) => f.replace(/\.mp3$/, "")));

const texts = new Set();
for (const exp of allExperiments) for (const s of buildLesson(exp)) texts.add(s.narration);

const missing = [...texts].filter((t) => !have.has(audioKey(t)));
console.log(`缺失 ${missing.length} / ${texts.size}`);
for (const t of missing) console.log(`${audioKey(t)}\t${t}`);

// 孤儿：文件在、但没有任何实验的口播会用到它
const keys = new Set([...texts].map(audioKey));
const orphans = [...have].filter((k) => !keys.has(k));
if (orphans.length) {
  const bytes = orphans.reduce((n, k) => n + statSync(join(BASE, voice, `${k}.mp3`)).size, 0);
  console.log(`\n孤儿音频 ${orphans.length} 个（${(bytes / 1024 / 1024).toFixed(1)} MB），已无口播引用：`);
  console.log(orphans.join(" "));
  console.log(`删除：cd ${join("public", "audio", "lesson", voice)} && rm ${orphans.length > 6 ? "<上列文件>" : orphans.map((k) => k + ".mp3").join(" ")}`);
}
