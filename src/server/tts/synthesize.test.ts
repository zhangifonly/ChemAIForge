// 按需语音合成的行为守卫。
//
// 不真调 edge-tts（那要联网、每次 1.6 秒），只锁住不依赖外部服务的判定：
// 哪些语种能合成、入参边界在哪里。合成本身的正确性靠接口实测验证。
import { describe, expect, it } from "vitest";
import { canSynthesize } from "./synthesize";
import { voicedLocales } from "./engines";
import { ttsRequestSchema } from "./validation";
import { LOCALE_VOICES } from "@/components/lab/lesson/audioKey";
import { LOCALE_CODES } from "@/lib/i18n/locales";

describe("可合成语种判定", () => {
  it("有 edge-tts 音色的语种可以合成", () => {
    expect(canSynthesize("zh")).toBe(true);
    expect(canSynthesize("ja")).toBe(true);
    // basic 语种同样能合成：按需生成不受"是否预生成过"限制，
    // 这正是它比预生成方案更适合铺开到全部语种的地方
    expect(canSynthesize("sq")).toBe(true);
    expect(canSynthesize("th")).toBe(true);
  });

  it("亚美尼亚语走 Piper、他加禄语走 Multilingual 音色，都可合成", () => {
    expect(canSynthesize("hy")).toBe(true);
    expect(canSynthesize("tl")).toBe(true);
  });

  it("旁遮普语走本地 VITS 模型，可合成", () => {
    expect(canSynthesize("pa")).toBe(true);
  });

  it("未知语言代码不能合成", () => {
    expect(canSynthesize("xx")).toBe(false);
    expect(canSynthesize("")).toBe(false);
  });

  it("全部 60 个规划语种都有语音（58 edge + 1 Piper + 1 VITS），且都在语言清单里", () => {
    const codes = voicedLocales();
    expect(codes).toHaveLength(60);
    expect([...codes].sort()).toEqual([...LOCALE_CODES].sort());
    for (const c of codes) {
      expect(LOCALE_CODES, `${c} 不在语言清单里`).toContain(c);
    }
  });
});

describe("入参校验", () => {
  const ok = { text: "混合试剂", locale: "zh", gender: "female" };

  it("接受合法请求", () => {
    expect(ttsRequestSchema.safeParse(ok).success).toBe(true);
  });

  it("拒绝空文本", () => {
    expect(ttsRequestSchema.safeParse({ ...ok, text: "" }).success).toBe(false);
  });

  it("拒绝超长文本：防止把这个接口当免费 TTS 批量合成长文", () => {
    expect(ttsRequestSchema.safeParse({ ...ok, text: "あ".repeat(1001) }).success).toBe(
      false,
    );
  });

  it("全库最长的口播句仍在限额内", () => {
    // 配位滴定那几条现象描述是最长的，200 字出头
    expect(ttsRequestSchema.safeParse({ ...ok, text: "测".repeat(300) }).success).toBe(
      true,
    );
  });

  it("gender 只接受 female / male", () => {
    expect(ttsRequestSchema.safeParse({ ...ok, gender: "other" }).success).toBe(false);
  });
});
