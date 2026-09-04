// 实验会话服务层 - 封装会话创建、步骤/读数追加与完成标记
// 负责将 DB 中的 JSON 字符串字段（steps/measurements）反序列化为数组后对外返回
import { prisma } from "@/lib/prisma";
import { withSessionLock } from "./serialize";
import {
  SessionStatus,
  type ExperimentReport,
  type SessionDTO,
  type SessionMeasurement,
  type SessionStep,
} from "./types";

// Prisma 查询出的 ExperimentSession 行
type SessionRow = {
  id: string;
  userId: string;
  experimentId: string;
  status: string;
  steps: string;
  measurements: string;
  report: string | null;
  startedAt: Date;
  completedAt: Date | null;
};

/**
 * 单条会话保留的 steps / measurements 上限。
 *
 * steps 与 measurements 存成整块 JSON 字符串，每次追加都要全量反序列化再序列化写回。
 * 「混合反应」按钮可无限点击，一场会话就能把这一行撑到几百 KB —— 越写越慢，
 * 报告生成时喂给 AI 的上下文也会爆。超限时丢最早的记录：实验回顾关心的是近期操作。
 */
export const MAX_SESSION_ENTRIES = 500;

// 追加一条并裁到上限（超出时丢弃最早的记录）
function appendCapped<T>(list: T[], entry: T): T[] {
  list.push(entry);
  return list.length > MAX_SESSION_ENTRIES
    ? list.slice(list.length - MAX_SESSION_ENTRIES)
    : list;
}

// 安全解析 JSON 字符串数组，异常时回退为空数组
function parseArray<T>(value: string): T[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

// 安全解析报告 JSON 对象，缺失或异常时回退为 null
function parseReport(value: string | null): ExperimentReport | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as ExperimentReport;
  } catch {
    return null;
  }
}

// 将 DB 行映射为对外 DTO
function toDTO(row: SessionRow): SessionDTO {
  return {
    id: row.id,
    userId: row.userId,
    experimentId: row.experimentId,
    status: row.status as SessionStatus,
    steps: parseArray<SessionStep>(row.steps),
    measurements: parseArray<SessionMeasurement>(row.measurements),
    report: parseReport(row.report),
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  };
}

// 创建一次实验会话，初始状态为 IN_PROGRESS，steps/measurements 为空数组
export async function createSession(
  userId: string,
  experimentId: string,
): Promise<SessionDTO> {
  const row = await prisma.experimentSession.create({
    data: { userId, experimentId },
  });
  return toDTO(row);
}

// 查询会话（含归属信息），不存在返回 null
export async function getSession(id: string): Promise<SessionDTO | null> {
  const row = await prisma.experimentSession.findUnique({ where: { id } });
  return row ? toDTO(row) : null;
}

// 列出指定用户的全部会话，按开始时间倒序（最新在前），供「我的会话」页使用
export async function listSessionsByUser(
  userId: string,
): Promise<SessionDTO[]> {
  const rows = await prisma.experimentSession.findMany({
    where: { userId },
    orderBy: { startedAt: "desc" },
  });
  return rows.map(toDTO);
}

// 向会话追加一条操作步骤（读写均在应用层序列化 JSON）
// 用 withSessionLock 串行化：「读出→改→写回」非原子，客户端连点会并发 PATCH，
// 不排队的话后写的请求会覆盖先写的那条步骤，记录静默丢失。
export async function appendStep(
  id: string,
  step: SessionStep,
): Promise<SessionDTO | null> {
  return withSessionLock(id, async () => {
    const current = await prisma.experimentSession.findUnique({ where: { id } });
    if (!current) return null;
    const steps = appendCapped(parseArray<SessionStep>(current.steps), step);
    const row = await prisma.experimentSession.update({
      where: { id },
      data: { steps: JSON.stringify(steps) },
    });
    return toDTO(row);
  });
}

// 向会话追加一条读数记录（同 appendStep，需串行化）
export async function appendMeasurement(
  id: string,
  measurement: SessionMeasurement,
): Promise<SessionDTO | null> {
  return withSessionLock(id, async () => {
    const current = await prisma.experimentSession.findUnique({ where: { id } });
    if (!current) return null;
    const measurements = appendCapped(
      parseArray<SessionMeasurement>(current.measurements),
      measurement,
    );
    const row = await prisma.experimentSession.update({
      where: { id },
      data: { measurements: JSON.stringify(measurements) },
    });
    return toDTO(row);
  });
}

// 持久化 AI 生成的结构化实验报告（序列化为 JSON 字符串存入 report 字段）
export async function saveReport(
  id: string,
  report: ExperimentReport,
): Promise<SessionDTO | null> {
  return withSessionLock(id, async () => {
    const current = await prisma.experimentSession.findUnique({ where: { id } });
    if (!current) return null;
    const row = await prisma.experimentSession.update({
      where: { id },
      data: { report: JSON.stringify(report) },
    });
    return toDTO(row);
  });
}

// 标记会话完成：置 COMPLETED 状态并记录完成时间
// 与追加操作排在同一队列：否则「完成实验」可能与最后几条步骤的写回交错，
// 返回给前端的 DTO 里少掉刚记录的步骤。
export async function completeSession(
  id: string,
): Promise<SessionDTO | null> {
  return withSessionLock(id, async () => {
    const current = await prisma.experimentSession.findUnique({ where: { id } });
    if (!current) return null;
    const row = await prisma.experimentSession.update({
      where: { id },
      data: { status: SessionStatus.COMPLETED, completedAt: new Date() },
    });
    return toDTO(row);
  });
}
