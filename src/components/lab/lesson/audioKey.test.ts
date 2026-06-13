// audioKey 契约测试：哈希必须稳定（同文本→同文件名），保证 TTS 生成脚本与
// 客户端播放端命名一致；不同文本不应轻易碰撞。
import { describe, it, expect } from "vitest";
import { audioKey, audioSrc } from "./audioKey";

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

  it("audioSrc 按音色指向 public 下的 mp3 路径", () => {
    expect(audioSrc("实验原理")).toBe(`/audio/lesson/xiaoxiao/${audioKey("实验原理")}.mp3`);
    expect(audioSrc("实验原理", "yunxi")).toBe(`/audio/lesson/yunxi/${audioKey("实验原理")}.mp3`);
  });
});
