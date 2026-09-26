// audioKey 契约测试：哈希必须稳定（同文本→同文件名），保证 TTS 生成脚本与
// 客户端播放端命名一致；不同文本不应轻易碰撞。
import { describe, it, expect } from "vitest";
import {
  audioKey,
  audioSrc,
  hasPregeneratedVoice,
  LOCALE_VOICES,
} from "./audioKey";

describe("audioKey", () => {
  it("同一文本得到稳定哈希（锁定具体值，防实现漂移）", () => {
    // 该值由 FNV-1a 实现固定；若改动算法此断言会提示同步重生成音频
    expect(audioKey("将烧杯中的试剂充分混合，反应随即开始。")).toBe("0c71d711");
  });

  it("总是 8 位十六进制", () => {
    for (const t of ["a", "实验原理", "x".repeat(200)]) {
      expect(audioKey(t)).toMatch(/^[0-9a-f]{8}$/);
    }
  });

  it("不同文本不碰撞（小样本）", () => {
    const texts = ["取用盐酸，加入烧杯中。", "取用氢氧化钠，加入烧杯中。", "接通电源，开始电解。"];
    expect(new Set(texts.map(audioKey)).size).toBe(texts.length);
  });

  it("audioSrc 按性别指向 public 下的 mp3 路径", () => {
    // 中文不带语言层：已有 2700 个文件在 xiaoxiao/yunxi 下，
    // 为加语言维度而全部挪位置没有实际好处（见 audioKey.ts 的说明）
    expect(audioSrc("实验原理")).toBe(`/audio/lesson/xiaoxiao/${audioKey("实验原理")}.mp3`);
    expect(audioSrc("实验原理", "male")).toBe(`/audio/lesson/yunxi/${audioKey("实验原理")}.mp3`);
  });

  it("其余语种带语言层，按性别分目录", () => {
    const k = audioKey("実験の原理");
    expect(audioSrc("実験の原理", "female", "ja")).toBe(`/audio/lesson/ja/female/${k}.mp3`);
    expect(audioSrc("実験の原理", "male", "ja")).toBe(`/audio/lesson/ja/male/${k}.mp3`);
  });

  it("同一句文本在各语种下的文件名一致：哈希只看文本，不看语言", () => {
    const text = "Mix the reagents";
    expect(audioSrc(text, "female", "en").split("/").pop()).toBe(
      audioSrc(text, "female", "de").split("/").pop(),
    );
  });

  it("58 个语种有 edge-tts 音色（含借 Multilingual 音色的他加禄语）", () => {
    expect(Object.keys(LOCALE_VOICES)).toHaveLength(58);
    expect(hasPregeneratedVoice("ja")).toBe(true);
    expect(hasPregeneratedVoice("ar")).toBe(true);
    expect(hasPregeneratedVoice("sq")).toBe(true);
    // 亚美尼亚语走本地 Piper，同样算有语音
    expect(hasPregeneratedVoice("hy")).toBe(true);
    expect(hasPregeneratedVoice("tl")).toBe(true);
    // 旁遮普语走本地 VITS（见 src/server/tts/engines.ts）
    expect(hasPregeneratedVoice("pa")).toBe(true);
  });

  it("音色表只列规划内的语种，且地区标签与语言一致", () => {
    // 他加禄语是有意借用的 Multilingual 音色（评测记录见 engines.ts），不做前缀校验
    const CROSS = new Set(["tl"]);
    for (const [locale, v] of Object.entries(LOCALE_VOICES)) {
      if (CROSS.has(locale)) {
        expect(v.female).toMatch(/Multilingual/);
        expect(v.male).toMatch(/Multilingual/);
        continue;
      }
      // 音色名形如 ja-JP-NanamiNeural，前缀必须是该语言
      expect(v.female.startsWith(`${locale}-`), `${locale} 女声语言不符`).toBe(true);
      expect(v.male.startsWith(`${locale}-`), `${locale} 男声语言不符`).toBe(true);
    }
  });

  it("中文沿用 Xiaoxiao / Yunxi：换音色会让已生成的 2700 个 mp3 全部失配", () => {
    expect(LOCALE_VOICES.zh.female).toBe("zh-CN-XiaoxiaoNeural");
    expect(LOCALE_VOICES.zh.male).toBe("zh-CN-YunxiNeural");
  });

  it("每个预生成语种都配了一男一女两个音色", () => {
    for (const [locale, v] of Object.entries(LOCALE_VOICES)) {
      expect(v.female, `${locale} 缺女声`).toBeTruthy();
      expect(v.male, `${locale} 缺男声`).toBeTruthy();
      // 音色名须带该语言的地区标签，否则 edge-tts 会用错语言朗读
      if (locale !== "tl") expect(v.female.startsWith(locale === "zh" ? "zh-" : `${locale}-`)).toBe(true);
    }
  });
});
