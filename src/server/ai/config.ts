// AI 导师 Claude API 配置读取
// 严禁硬编码 apiKey：优先从 CC Switch 数据库（~/.cc-switch/cc-switch.db）
// 读取当前激活（is_current=1）的 claude provider 配置，
// 读取失败时回退到环境变量，两者皆缺失则抛出可读错误。
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

// 默认模型：性价比最高的 Sonnet 4.6
export const DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-6";

// 对外暴露的 Claude API 配置
export interface ClaudeApiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

// CC Switch provider.settings_config 的相关字段结构
interface CcSwitchSettings {
  model?: string;
  env?: {
    ANTHROPIC_BASE_URL?: string;
    ANTHROPIC_AUTH_TOKEN?: string;
  };
}

// 默认 cc-switch 数据库路径，可用 CC_SWITCH_DB 覆盖（便于测试/部署）
function getDbPath(): string {
  return process.env.CC_SWITCH_DB ?? join(homedir(), ".cc-switch", "cc-switch.db");
}

// 通过 sqlite3 CLI 读取当前激活的 claude provider settings_config
// 任意异常（无 sqlite3 / 无库文件 / 无激活项）返回 null，由调用方回退
function readActiveSettings(): CcSwitchSettings | null {
  try {
    const raw = execFileSync(
      "sqlite3",
      [
        getDbPath(),
        "SELECT settings_config FROM providers WHERE app_type='claude' AND is_current=1 LIMIT 1;",
      ],
      { encoding: "utf8", timeout: 5000 },
    ).trim();
    if (!raw) return null;
    return JSON.parse(raw) as CcSwitchSettings;
  } catch {
    return null;
  }
}

// 获取 Claude API 配置：CC Switch 优先，环境变量兜底。
// baseUrl/apiKey 任一缺失则抛出可读错误，避免下游空配置崩溃。
export function getClaudeApiConfig(): ClaudeApiConfig {
  const settings = readActiveSettings();

  const baseUrl =
    settings?.env?.ANTHROPIC_BASE_URL?.trim() ||
    process.env.ANTHROPIC_BASE_URL?.trim() ||
    "";
  const apiKey =
    settings?.env?.ANTHROPIC_AUTH_TOKEN?.trim() ||
    process.env.ANTHROPIC_AUTH_TOKEN?.trim() ||
    "";
  const model =
    settings?.model?.trim() ||
    process.env.ANTHROPIC_MODEL?.trim() ||
    DEFAULT_CLAUDE_MODEL;

  if (!baseUrl || !apiKey) {
    const missing = [!baseUrl && "baseUrl", !apiKey && "apiKey"]
      .filter(Boolean)
      .join("、");
    throw new Error(
      `未找到可用的 Claude API 配置（缺少 ${missing}）。` +
        `请在 CC Switch 中激活一个 claude provider，` +
        `或设置 ANTHROPIC_BASE_URL / ANTHROPIC_AUTH_TOKEN 环境变量。`,
    );
  }

  return { baseUrl, apiKey, model };
}
