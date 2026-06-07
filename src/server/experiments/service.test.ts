import { beforeEach, describe, expect, it, vi } from "vitest";

// 在导入被测模块前 mock prisma 单例，隔离数据库依赖
const findMany = vi.fn();
const findUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    experiment: {
      findMany: (...args: unknown[]) => findMany(...args),
      findUnique: (...args: unknown[]) => findUnique(...args),
    },
  },
}));

import {
  getExperimentById,
  getExperimentBySlug,
  listExperiments,
} from "./service";

// 构造一条 Prisma 风格的实验行（JSON 字段为字符串）
function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "exp-1",
    slug: "acid-base-titration",
    title: "酸碱中和滴定",
    description: "示例描述",
    category: "ACID_BASE",
    difficulty: "MEDIUM",
    reagents: JSON.stringify(["盐酸", "氢氧化钠"]),
    apparatus: JSON.stringify(["滴定管"]),
    objectives: JSON.stringify(["理解中和滴定"]),
    estimatedMinutes: 45,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  findMany.mockReset();
  findUnique.mockReset();
});

describe("listExperiments - 反序列化与过滤", () => {
  it("应将 JSON 字符串字段反序列化为数组并转 ISO 时间", async () => {
    findMany.mockResolvedValue([row()]);
    const result = await listExperiments();
    expect(result).toHaveLength(1);
    expect(result[0].reagents).toEqual(["盐酸", "氢氧化钠"]);
    expect(result[0].apparatus).toEqual(["滴定管"]);
    expect(result[0].createdAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("应按 category/difficulty/q 构造 where 条件", async () => {
    findMany.mockResolvedValue([]);
    await listExperiments({
      category: "ACID_BASE",
      difficulty: "MEDIUM",
      q: "滴定",
    });
    expect(findMany).toHaveBeenCalledWith({
      where: {
        category: "ACID_BASE",
        difficulty: "MEDIUM",
        title: { contains: "滴定" },
      },
      orderBy: { createdAt: "asc" },
    });
  });

  it("无过滤条件时 where 为空对象", async () => {
    findMany.mockResolvedValue([]);
    await listExperiments();
    expect(findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { createdAt: "asc" },
    });
  });

  it("JSON 字段非法时应安全回退为空数组", async () => {
    findMany.mockResolvedValue([row({ reagents: "not-json" })]);
    const result = await listExperiments();
    expect(result[0].reagents).toEqual([]);
  });
});

describe("getExperimentBySlug / getExperimentById", () => {
  it("命中时返回 DTO", async () => {
    findUnique.mockResolvedValue(row());
    const dto = await getExperimentBySlug("acid-base-titration");
    expect(dto?.slug).toBe("acid-base-titration");
    expect(findUnique).toHaveBeenCalledWith({
      where: { slug: "acid-base-titration" },
    });
  });

  it("未命中 slug 返回 null", async () => {
    findUnique.mockResolvedValue(null);
    expect(await getExperimentBySlug("missing")).toBeNull();
  });

  it("按 id 命中返回 DTO，未命中返回 null", async () => {
    findUnique.mockResolvedValue(row());
    expect((await getExperimentById("exp-1"))?.id).toBe("exp-1");
    findUnique.mockResolvedValue(null);
    expect(await getExperimentById("none")).toBeNull();
  });
});
