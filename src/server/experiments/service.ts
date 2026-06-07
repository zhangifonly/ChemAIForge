// 实验查询服务层 - 封装列表过滤与按 slug 查询详情
// 负责将 DB 中的 JSON 字符串字段反序列化为数组后对外返回
import { prisma } from "@/lib/prisma";
import type {
  ExperimentCategory,
  ExperimentDifficulty,
} from "@/server/experiment/types";
import type { ExperimentDTO, ExperimentFilter } from "@/types/experiment";

// Prisma 查询出的 Experiment 行
type ExperimentRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  reagents: string;
  apparatus: string;
  objectives: string;
  estimatedMinutes: number;
  createdAt: Date;
};

// 安全解析 JSON 字符串数组，异常时回退为空数组
function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

// 将 DB 行映射为对外 DTO
function toDTO(row: ExperimentRow): ExperimentDTO {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    category: row.category as ExperimentCategory,
    difficulty: row.difficulty as ExperimentDifficulty,
    reagents: parseStringArray(row.reagents),
    apparatus: parseStringArray(row.apparatus),
    objectives: parseStringArray(row.objectives),
    estimatedMinutes: row.estimatedMinutes,
    createdAt: row.createdAt.toISOString(),
  };
}

// 按分类/难度过滤并按 title 模糊匹配查询实验列表
export async function listExperiments(
  filter: ExperimentFilter = {},
): Promise<ExperimentDTO[]> {
  const { category, difficulty, q } = filter;
  const rows = await prisma.experiment.findMany({
    where: {
      ...(category ? { category } : {}),
      ...(difficulty ? { difficulty } : {}),
      ...(q ? { title: { contains: q } } : {}),
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toDTO);
}

// 按 slug 查询实验详情，不存在返回 null
export async function getExperimentBySlug(
  slug: string,
): Promise<ExperimentDTO | null> {
  const row = await prisma.experiment.findUnique({ where: { slug } });
  return row ? toDTO(row) : null;
}

// 按 id 查询实验详情，不存在返回 null（供会话创建校验实验归属）
export async function getExperimentById(
  id: string,
): Promise<ExperimentDTO | null> {
  const row = await prisma.experiment.findUnique({ where: { id } });
  return row ? toDTO(row) : null;
}
