// 实验会话服务层 - 封装会话创建、步骤/读数追加与完成标记
// 负责将 DB 中的 JSON 字符串字段（steps/measurements）反序列化为数组后对外返回
import { prisma } from "@/lib/prisma";
import {
  SessionStatus,
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
  startedAt: Date;
  completedAt: Date | null;
};

// 安全解析 JSON 字符串数组，异常时回退为空数组
function parseArray<T>(value: string): T[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
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

// 向会话追加一条操作步骤（读写均在应用层序列化 JSON）
export async function appendStep(
  id: string,
  step: SessionStep,
): Promise<SessionDTO | null> {
  const current = await prisma.experimentSession.findUnique({ where: { id } });
  if (!current) return null;
  const steps = parseArray<SessionStep>(current.steps);
  steps.push(step);
  const row = await prisma.experimentSession.update({
    where: { id },
    data: { steps: JSON.stringify(steps) },
  });
  return toDTO(row);
}

// 向会话追加一条读数记录
export async function appendMeasurement(
  id: string,
  measurement: SessionMeasurement,
): Promise<SessionDTO | null> {
  const current = await prisma.experimentSession.findUnique({ where: { id } });
  if (!current) return null;
  const measurements = parseArray<SessionMeasurement>(current.measurements);
  measurements.push(measurement);
  const row = await prisma.experimentSession.update({
    where: { id },
    data: { measurements: JSON.stringify(measurements) },
  });
  return toDTO(row);
}

// 标记会话完成：置 COMPLETED 状态并记录完成时间
export async function completeSession(
  id: string,
): Promise<SessionDTO | null> {
  const current = await prisma.experimentSession.findUnique({ where: { id } });
  if (!current) return null;
  const row = await prisma.experimentSession.update({
    where: { id },
    data: { status: SessionStatus.COMPLETED, completedAt: new Date() },
  });
  return toDTO(row);
}
