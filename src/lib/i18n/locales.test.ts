import { describe, expect, it } from "vitest";
import {
  FULL_LOCALES,
  LOCALES,
  LOCALE_CODES,
  SOURCE_LOCALE,
  isLocale,
  localeMeta,
  negotiateLocale,
} from "./locales";

describe("语言清单", () => {
  it("覆盖 OpenAI 界面语言的全部 60 种", () => {
    expect(LOCALES).toHaveLength(60);
  });

  it("语言代码不重复", () => {
    expect(new Set(LOCALE_CODES).size).toBe(LOCALE_CODES.length);
  });

  it("源语言在清单里", () => {
    expect(isLocale(SOURCE_LOCALE)).toBe(true);
  });

  it("每个语种都有自称名与英文名，且自称名不能等于英文名的凑数填充", () => {
    for (const l of LOCALES) {
      expect(l.nativeName.length, `${l.code} 缺自称名`).toBeGreaterThan(0);
      expect(l.englishName.length, `${l.code} 缺英文名`).toBeGreaterThan(0);
    }
  });

  it("阿拉伯语、波斯语、乌尔都语标记为 RTL", () => {
    for (const code of ["ar", "fa", "ur"]) {
      expect(localeMeta(code).dir, `${code} 应为 rtl`).toBe("rtl");
    }
  });

  it("其余语种为 LTR：RTL 只有这三种，多标一个就会让整页布局镜像翻转", () => {
    const rtl = LOCALES.filter((l) => l.dir === "rtl").map((l) => l.code);
    expect(rtl.sort()).toEqual(["ar", "fa", "ur"]);
  });
});

describe("投入程度分级", () => {
  it("FULL_LOCALES 里的语种都在清单中", () => {
    for (const code of FULL_LOCALES) {
      expect(isLocale(code), `${code} 不在 LOCALES 里`).toBe(true);
    }
  });

  it("tier 由 FULL_LOCALES 单一决定，两处不会打架", () => {
    for (const l of LOCALES) {
      const expected = (FULL_LOCALES as readonly string[]).includes(l.code)
        ? "full"
        : "basic";
      expect(l.tier, `${l.code} 的 tier 不一致`).toBe(expected);
    }
  });

  it("首批全量语种覆盖汉字/假名/谚文/拉丁/西里尔/阿拉伯六种文字系统", () => {
    expect(FULL_LOCALES).toContain("zh");
    expect(FULL_LOCALES).toContain("ja");
    expect(FULL_LOCALES).toContain("ko");
    expect(FULL_LOCALES).toContain("en");
    expect(FULL_LOCALES).toContain("ru");
    expect(FULL_LOCALES).toContain("ar");
  });
});

describe("按浏览器语言协商", () => {
  it("精确匹配", () => {
    expect(negotiateLocale("ja")).toBe("ja");
  });

  it("带地区的标签取主标签：zh-CN 与 zh-TW 读同一份界面文案", () => {
    expect(negotiateLocale("zh-CN")).toBe("zh");
    expect(negotiateLocale("en-GB,en;q=0.9")).toBe("en");
  });

  it("按 q 值排序，不是按出现顺序", () => {
    expect(negotiateLocale("de;q=0.3,ja;q=0.9")).toBe("ja");
  });

  it("缺省 q 视为 1，优先于显式低权重项", () => {
    expect(negotiateLocale("ko,fr;q=0.8")).toBe("ko");
  });

  it("跳过不支持的语种，取下一个能匹配的", () => {
    expect(negotiateLocale("xx-YY,tlh;q=0.9,fr;q=0.5")).toBe("fr");
  });

  it("q=0 表示明确拒绝，不该被选中", () => {
    expect(negotiateLocale("ja;q=0,de;q=0.5")).toBe("de");
  });

  it("空值或全不匹配时回退源语言（内容以中文为准，中文才是完整的那份）", () => {
    expect(negotiateLocale(null)).toBe(SOURCE_LOCALE);
    expect(negotiateLocale("")).toBe(SOURCE_LOCALE);
    expect(negotiateLocale("xx,yy")).toBe(SOURCE_LOCALE);
  });

  it("q 值畸形不抛异常，按最低优先级处理", () => {
    expect(negotiateLocale("ja;q=abc,de;q=0.5")).toBe("de");
  });

  it("大小写不敏感：浏览器可能发 ZH-cn", () => {
    expect(negotiateLocale("JA-JP")).toBe("ja");
  });
});

describe("元信息查询", () => {
  it("未知代码回退源语言，调用方不必各自兜底", () => {
    expect(localeMeta("nonexistent").code).toBe(SOURCE_LOCALE);
  });

  it("已知代码返回自身", () => {
    expect(localeMeta("ar").nativeName).toBe("العربية");
  });
});
