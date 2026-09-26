import { describe, expect, it } from "vitest";
import { estimateNarrationMs, isSyllabicScript, speechLang } from "./speechTiming";

describe("文字系统判定", () => {
  it("汉字、假名、谚文按音节文字处理", () => {
    expect(isSyllabicScript("取用盐酸")).toBe(true);
    expect(isSyllabicScript("フェノールフタレイン")).toBe(true);
    expect(isSyllabicScript("산염기 중화 적정")).toBe(true);
  });

  it("拉丁、西里尔、阿拉伯文不按音节文字处理", () => {
    expect(isSyllabicScript("Mix the reagents")).toBe(false);
    expect(isSyllabicScript("Кислотно-основное титрование")).toBe(false);
    expect(isSyllabicScript("معايرة حمض-قاعدة")).toBe(false);
  });
});

describe("口播时长估算", () => {
  it("同一句话的中英文估算都落在正常朗读区间", () => {
    const zh = estimateNarrationMs("取用0.1 mol/L 盐酸标准液，加入锥形瓶中。");
    const en = estimateNarrationMs(
      "Take 0.1 mol/L standard hydrochloric acid solution and add it to Erlenmeyer Flask.",
    );
    // 都该在 4~12 秒：这是一句话读完的合理范围
    expect(zh).toBeGreaterThan(4000);
    expect(zh).toBeLessThan(12000);
    expect(en).toBeGreaterThan(4000);
    expect(en).toBeLessThan(12000);
  });

  it("拉丁字母不能沿用汉字的每字系数，否则英语讲解会干等", () => {
    const text = "a".repeat(80);
    // 按 260ms/字 会算出 20.8 秒；按 55ms 约 4.4 秒
    expect(estimateNarrationMs(text)).toBeLessThan(8000);
  });

  it("倍速缩短时长", () => {
    const text = "取用盐酸，加入锥形瓶中，充分混合后观察现象与温度变化。";
    expect(estimateNarrationMs(text, 2)).toBeLessThan(estimateNarrationMs(text, 1));
  });

  it("极短句子也保底 4 秒，留出看清字幕的时间", () => {
    expect(estimateNarrationMs("混合")).toBe(4000);
    expect(estimateNarrationMs("Mix")).toBe(4000);
  });
});

describe("语音合成语言标签", () => {
  it("需要地区的语言给出完整标签", () => {
    // 中文不带地区可能落到粤语，葡语区分欧洲与巴西
    expect(speechLang("zh")).toBe("zh-CN");
    expect(speechLang("pt")).toBe("pt-BR");
  });

  it("其余语言用主标签，不必逐个登记", () => {
    expect(speechLang("ja")).toBe("ja");
    expect(speechLang("de")).toBe("de");
    // 未登记的 basic 语种同样可用：它们全靠浏览器合成出声
    expect(speechLang("sq")).toBe("sq");
  });
});
