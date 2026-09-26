// 响应头体积守卫。
//
// 线上曾因此全站 502：next-intl 默认把 60 个语种的互链写进 Link 响应头，
// 单这一条就 5.7 KB，超过 nginx 默认 4 KB 的代理头缓冲（upstream sent too big header）。
// 本地直连 dev server 完全正常，只有经过 nginx 才暴露 —— 靠浏览器实测发现不了。
// 语言每加一种，这条头就长一截，故在这里锁死：中间件不许输出语言互链。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LOCALE_CODES } from "./locales";

const middleware = readFileSync(join(__dirname, "../../middleware.ts"), "utf8");

describe("响应头不能随语种数增长", () => {
  it("中间件关闭了 Link 头里的语言互链", () => {
    expect(middleware).toMatch(/alternateLinks:\s*false/);
  });

  it("若开启互链，头长度会超过 nginx 默认缓冲 —— 说明为什么必须关", () => {
    // 按 next-intl 的格式估算一条互链的长度
    const sample = (l: string) =>
      `<https://chem.whaty.org/${l}/experiments/hcl-naoh-neutralization>; rel="alternate"; hreflang="${l}"`;
    const header = LOCALE_CODES.map(sample).join(", ");
    const NGINX_DEFAULT_PROXY_BUFFER = 4096;
    expect(header.length).toBeGreaterThan(NGINX_DEFAULT_PROXY_BUFFER);
  });
});
