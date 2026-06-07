import { beforeEach, describe, expect, it, vi } from "vitest";

// 在导入被测模块前 mock prisma 单例，隔离数据库依赖
const create = vi.fn();
const findUnique = vi.fn();
const findMany = vi.fn();
const update = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    experimentSession: {
      create: (...args: unknown[]) => create(...args),
      findUnique: (...args: unknown[]) => findUnique(...args),
      findMany: (...args: unknown[]) => findMany(...args),
      update: (...args: unknown[]) => update(...args),
    },
  },
}));

import {
  appendMeasurement,
  appendStep,
  completeSession,
  createSession,
  getSession,
  listSessionsByUser,
  saveReport,
} from "./service";
import { SessionStatus, type ExperimentReport } from "./types";

// 构造一条 Prisma 风格的会话行（steps/measurements 为 JSON 字符串）
function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "sess-1",
    userId: "user-1",
    experimentId: "exp-1",
    status: "IN_PROGRESS",
    steps: "[]",
    measurements: "[]",
    report: null,
    startedAt: new Date("2026-01-01T00:00:00.000Z"),
    completedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  create.mockReset();
  findUnique.mockReset();
  findMany.mockReset();
  update.mockReset();
});

describe("createSession", () => {
  it("以 IN_PROGRESS 创建并反序列化空数组", async () => {
    create.mockResolvedValue(row());
    const dto = await createSession("user-1", "exp-1");
    expect(create).toHaveBeenCalledWith({
      data: { userId: "user-1", experimentId: "exp-1" },
    });
    expect(dto.status).toBe(SessionStatus.IN_PROGRESS);
    expect(dto.steps).toEqual([]);
    expect(dto.measurements).toEqual([]);
    expect(dto.report).toBeNull();
  });
});

describe("getSession / listSessionsByUser", () => {
  it("命中返回 DTO，未命中返回 null", async () => {
    findUnique.mockResolvedValue(row());
    expect((await getSession("sess-1"))?.id).toBe("sess-1");
    findUnique.mockResolvedValue(null);
    expect(await getSession("none")).toBeNull();
  });

  it("按 userId 倒序列出会话", async () => {
    findMany.mockResolvedValue([row()]);
    const list = await listSessionsByUser("user-1");
    expect(list).toHaveLength(1);
    expect(findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { startedAt: "desc" },
    });
  });
});

describe("appendStep / appendMeasurement", () => {
  it("追加步骤到现有数组并序列化回写", async () => {
    findUnique.mockResolvedValue(
      row({ steps: JSON.stringify([{ action: "add", at: "t0" }]) }),
    );
    update.mockResolvedValue(
      row({
        steps: JSON.stringify([
          { action: "add", at: "t0" },
          { action: "mix", at: "t1" },
        ]),
      }),
    );
    const dto = await appendStep("sess-1", { action: "mix", at: "t1" });
    expect(dto?.steps).toHaveLength(2);
    const arg = update.mock.calls[0][0] as { data: { steps: string } };
    expect(JSON.parse(arg.data.steps)).toHaveLength(2);
  });

  it("会话不存在时 appendStep 返回 null 且不更新", async () => {
    findUnique.mockResolvedValue(null);
    expect(await appendStep("none", { action: "add", at: "t0" })).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it("追加读数记录", async () => {
    findUnique.mockResolvedValue(row());
    update.mockResolvedValue(
      row({
        measurements: JSON.stringify([{ ph: 7, temperature: 25, at: "t0" }]),
      }),
    );
    const dto = await appendMeasurement("sess-1", {
      ph: 7,
      temperature: 25,
      at: "t0",
    });
    expect(dto?.measurements).toHaveLength(1);
    expect(dto?.measurements[0].ph).toBe(7);
  });
});

describe("saveReport / completeSession", () => {
  const report: ExperimentReport = {
    conclusion: "完成中和滴定",
    errorAnalysis: "读数无明显波动",
    improvements: ["控制滴定速度"],
    knowledgeAssessment: "掌握良好",
    generatedAt: "2026-01-01T00:00:00.000Z",
  };

  it("保存报告后可反序列化回对象", async () => {
    findUnique.mockResolvedValue(row());
    update.mockResolvedValue(row({ report: JSON.stringify(report) }));
    const dto = await saveReport("sess-1", report);
    expect(dto?.report?.conclusion).toBe("完成中和滴定");
  });

  it("completeSession 置 COMPLETED 并记录完成时间", async () => {
    findUnique.mockResolvedValue(row());
    update.mockResolvedValue(
      row({
        status: "COMPLETED",
        completedAt: new Date("2026-01-02T00:00:00.000Z"),
      }),
    );
    const dto = await completeSession("sess-1");
    expect(dto?.status).toBe(SessionStatus.COMPLETED);
    expect(dto?.completedAt).toBe("2026-01-02T00:00:00.000Z");
    const arg = update.mock.calls[0][0] as { data: { status: string } };
    expect(arg.data.status).toBe(SessionStatus.COMPLETED);
  });

  it("会话不存在时 saveReport/completeSession 返回 null", async () => {
    findUnique.mockResolvedValue(null);
    expect(await saveReport("none", report)).toBeNull();
    expect(await completeSession("none")).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });
});
