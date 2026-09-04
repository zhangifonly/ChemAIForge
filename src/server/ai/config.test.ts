// Claude API 配置读取：重点是「不硬编码密钥」与「不反复同步 spawn 子进程」。
// 读配置走 execFileSync 启 sqlite3，同步调用会阻塞 Node 事件循环，
// 而每条 AI 请求要读两次 —— 不缓存的话一个学生提问就能让全站请求排队。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const execFileSync = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ execFileSync }));

import { clearConfigCache, DEFAULT_CLAUDE_MODEL, getClaudeApiConfig } from "./config";

const SETTINGS = JSON.stringify({
  model: "claude-opus-4-6",
  env: {
    ANTHROPIC_BASE_URL: "https://example.invalid/api",
    ANTHROPIC_AUTH_TOKEN: "token-from-cc-switch",
  },
});

beforeEach(() => {
  clearConfigCache();
  execFileSync.mockReset();
  execFileSync.mockReturnValue(SETTINGS);
  delete process.env.ANTHROPIC_BASE_URL;
  delete process.env.ANTHROPIC_AUTH_TOKEN;
  delete process.env.ANTHROPIC_MODEL;
});

afterEach(() => clearConfigCache());

describe("配置来源", () => {
  it("优先取 CC Switch 中激活的 provider", () => {
    const c = getClaudeApiConfig();
    expect(c.apiKey).toBe("token-from-cc-switch");
    expect(c.baseUrl).toBe("https://example.invalid/api");
    expect(c.model).toBe("claude-opus-4-6");
  });

  it("CC Switch 不可用时回退环境变量", () => {
    execFileSync.mockImplementation(() => {
      throw new Error("no sqlite3");
    });
    process.env.ANTHROPIC_BASE_URL = "https://env.invalid";
    process.env.ANTHROPIC_AUTH_TOKEN = "token-from-env";
    const c = getClaudeApiConfig();
    expect(c.apiKey).toBe("token-from-env");
    expect(c.model).toBe(DEFAULT_CLAUDE_MODEL);
  });

  it("两处都没有配置时抛出可读错误，而不是带着空密钥去请求上游", () => {
    execFileSync.mockReturnValue("");
    expect(() => getClaudeApiConfig()).toThrow(/未找到可用的 Claude API 配置/);
  });
});

describe("缓存", () => {
  it("连续读取只 spawn 一次 sqlite3", () => {
    getClaudeApiConfig();
    getClaudeApiConfig();
    getClaudeApiConfig();
    expect(execFileSync).toHaveBeenCalledTimes(1);
  });

  it("清空缓存后重新读取，保证换 provider 后能生效", () => {
    getClaudeApiConfig();
    clearConfigCache();
    getClaudeApiConfig();
    expect(execFileSync).toHaveBeenCalledTimes(2);
  });
});
