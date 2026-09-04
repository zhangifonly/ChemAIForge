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
  MAX_SESSION_ENTRIES,
  appendMeasurement,
  appendStep,
  completeSession,
  createSession,
  getSession,
  listSessionsByUser,
  saveReport,
} from "./service";
import { pendingLockCount } from "./serialize";
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

  // steps/measurements 存成整块 JSON，每次追加都要全量读写；「混合反应」可无限点击，
  // 无上限时单行会被撑到几百 KB，追加越来越慢、报告上下文也会爆。
  it("步骤数达到上限后丢弃最早的记录", async () => {
    const full = Array.from({ length: MAX_SESSION_ENTRIES }, (_, i) => ({
      action: "mix",
      at: `t${i}`,
    }));
    findUnique.mockResolvedValue(row({ steps: JSON.stringify(full) }));
    update.mockResolvedValue(row());
    await appendStep("sess-1", { action: "mix", at: "new" });
    const arg = update.mock.calls[0][0] as { data: { steps: string } };
    const saved = JSON.parse(arg.data.steps) as { at: string }[];
    expect(saved).toHaveLength(MAX_SESSION_ENTRIES);
    expect(saved[0].at).toBe("t1"); // 最早的 t0 被丢掉
    expect(saved[saved.length - 1].at).toBe("new");
  });

  it("读数数达到上限后丢弃最早的记录", async () => {
    const full = Array.from({ length: MAX_SESSION_ENTRIES + 10 }, (_, i) => ({
      ph: 7,
      temperature: 25,
      at: `t${i}`,
    }));
    findUnique.mockResolvedValue(row({ measurements: JSON.stringify(full) }));
    update.mockResolvedValue(row());
    await appendMeasurement("sess-1", { ph: 1, temperature: 99, at: "new" });
    const arg = update.mock.calls[0][0] as { data: { measurements: string } };
    const saved = JSON.parse(arg.data.measurements) as { at: string }[];
    expect(saved).toHaveLength(MAX_SESSION_ENTRIES);
    expect(saved[saved.length - 1].at).toBe("new");
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

describe("并发追加的串行化", () => {
  // steps 存整块 JSON，追加是「读出→改→写回」三步。客户端连点「混合反应」会并发
  // PATCH，两个请求各自读到同一份旧数组，后写回的把先写的那条覆盖掉——记录静默丢失。
  // 这里用一个内存里的假库还原真实读写时序：不串行化则最终只剩 1 条。
  // ⚠️ 延迟必须放在 update（写入侧）而不是 findUnique：Node 在每个 timer 回调后会
  // 清空微任务队列，若只在读取侧 await setTimeout，三个请求反而会被逐个跑完，
  // 制造不出交错，测试就永远是绿的（去掉锁也照样过）。
  it("并发追加三条步骤时一条不丢", async () => {
    let stored = "[]";
    findUnique.mockImplementation(async () => row({ steps: stored }));
    update.mockImplementation(async (arg: { data: { steps: string } }) => {
      // 先让出事件循环，模拟写入 IO：此时未加锁的其它请求已读到旧值
      await new Promise((r) => setTimeout(r, 5));
      stored = arg.data.steps;
      return row({ steps: stored });
    });

    await Promise.all([
      appendStep("sess-1", { action: "mix", at: "t1" }),
      appendStep("sess-1", { action: "mix", at: "t2" }),
      appendStep("sess-1", { action: "mix", at: "t3" }),
    ]);

    const saved = JSON.parse(stored) as { at: string }[];
    expect(saved).toHaveLength(3);
    expect(saved.map((s) => s.at).sort()).toEqual(["t1", "t2", "t3"]);
  });

  // 不同会话之间不应相互排队阻塞
  it("不同会话的写入互不干扰", async () => {
    const store: Record<string, string> = { a: "[]", b: "[]" };
    findUnique.mockImplementation(async (arg: { where: { id: string } }) =>
      row({ id: arg.where.id, steps: store[arg.where.id] }),
    );
    update.mockImplementation(
      async (arg: { where: { id: string }; data: { steps: string } }) => {
        store[arg.where.id] = arg.data.steps;
        return row({ id: arg.where.id, steps: arg.data.steps });
      },
    );

    await Promise.all([
      appendStep("a", { action: "mix", at: "a1" }),
      appendStep("b", { action: "mix", at: "b1" }),
    ]);

    expect(JSON.parse(store.a)).toHaveLength(1);
    expect(JSON.parse(store.b)).toHaveLength(1);
  });

  // 队列 Map 以会话 id 为键，任务跑完必须清理，否则长期运行会随会话数无限增长
  it("写入完成后队列条目被清理", async () => {
    findUnique.mockResolvedValue(row());
    update.mockResolvedValue(row());
    await appendStep("sess-1", { action: "mix", at: "t1" });
    // 清理挂在 next 的 then 上，让出一轮微任务再断言
    await new Promise((r) => setTimeout(r, 0));
    expect(pendingLockCount()).toBe(0);
  });
});
