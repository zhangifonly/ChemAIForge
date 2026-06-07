// 实验会话客户端封装：在浏览器侧调用 /api/sessions 创建会话、追加步骤/读数与标记完成。
// 设计原则：会话记录是实验操作的「旁路增强」，任何网络/鉴权失败都静默吞掉，
// 不得阻塞或抛错影响画布交互（如未登录 POST 返回 401 时直接放弃记录）。
import type { SessionMeasurement, SessionStep } from "@/server/session/types";

// 创建会话，成功返回会话 id，失败（未登录/实验不存在/网络异常）返回 null
export async function createSessionRemote(
  experimentId: string,
): Promise<string | null> {
  try {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ experimentId }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { id?: string };
    return data.id ?? null;
  } catch {
    return null;
  }
}

// 向会话 PATCH 一段更新（追加 step / measurement / 标记完成），失败静默忽略
async function patchSession(
  id: string,
  body: {
    step?: SessionStep;
    measurement?: SessionMeasurement;
    complete?: true;
  },
): Promise<void> {
  try {
    await fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    // 旁路记录失败不影响实验交互
  }
}

// 追加一条操作步骤
export function appendStepRemote(id: string, step: SessionStep): void {
  void patchSession(id, { step });
}

// 追加一条读数记录
export function appendMeasurementRemote(
  id: string,
  measurement: SessionMeasurement,
): void {
  void patchSession(id, { measurement });
}

// 标记会话完成
export function completeSessionRemote(id: string): void {
  void patchSession(id, { complete: true });
}
