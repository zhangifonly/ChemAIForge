// 报告接口对空会话的防护：一步操作都没有时不能调 AI。
// 打开实验页就会建会话，本地库 277 条里 212 条是空的；原先对这类会话照样生成报告，
// 模型只能凭实验简介编一份结论 —— 白耗配额，还给学生一份与操作无关的"评估"。
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionDTO } from "@/server/session/types";

const getSession = vi.fn();
const saveReport = vi.fn();
const getExperimentById = vi.fn();
const generateReport = vi.fn();

vi.mock("@/server/session", async () => {
  const types = await vi.importActual<typeof import("@/server/session/types")>(
    "@/server/session/types",
  );
  return {
    hasActivity: types.hasActivity,
    getSession: (...a: unknown[]) => getSession(...a),
    saveReport: (...a: unknown[]) => saveReport(...a),
  };
});
vi.mock("@/server/experiments/service", () => ({
  getExperimentById: (...a: unknown[]) => getExperimentById(...a),
}));
vi.mock("@/server/ai/report", () => ({
  generateReport: (...a: unknown[]) => generateReport(...a),
}));

import { POST } from "./route";

function session(overrides: Partial<SessionDTO> = {}): SessionDTO {
  return {
    id: "s1",
    userId: "u1",
    experimentId: "e1",
    status: "IN_PROGRESS",
    steps: [],
    measurements: [],
    report: null,
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

const call = () => POST(new Request("http://x/api/sessions/s1/report", { method: "POST" }), { params: { id: "s1" } });

beforeEach(() => {
  for (const f of [getSession, saveReport, getExperimentById, generateReport]) f.mockReset();
  getExperimentById.mockResolvedValue({ id: "e1", title: "t" });
});

describe("POST /api/sessions/[id]/report", () => {
  it("空会话返回 422，且根本不调用 AI", async () => {
    getSession.mockResolvedValue(session());
    const res = await call();
    expect(res.status).toBe(422);
    expect((await res.json()).error).toContain("没有任何操作记录");
    expect(generateReport).not.toHaveBeenCalled();
    expect(saveReport).not.toHaveBeenCalled();
  });

  it("有操作记录的会话正常生成并保存", async () => {
    const s = session({ steps: [{ action: "add", at: "t" }] });
    getSession.mockResolvedValue(s);
    generateReport.mockResolvedValue({ conclusion: "c" });
    saveReport.mockResolvedValue({ ...s, report: { conclusion: "c" } });
    const res = await call();
    expect(res.status).toBe(200);
    expect(generateReport).toHaveBeenCalledOnce();
    expect(saveReport).toHaveBeenCalledOnce();
  });

  it("只有读数没有步骤也算有内容（滴定台只记关键读数）", async () => {
    const s = session({ measurements: [{ ph: 7, temperature: 25, at: "t" }] });
    getSession.mockResolvedValue(s);
    generateReport.mockResolvedValue({ conclusion: "c" });
    saveReport.mockResolvedValue({ ...s, report: { conclusion: "c" } });
    const res = await call();
    expect(res.status).toBe(200);
  });

  it("会话不存在仍是 404", async () => {
    getSession.mockResolvedValue(null);
    expect((await call()).status).toBe(404);
  });
});
