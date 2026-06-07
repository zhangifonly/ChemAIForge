import { NextResponse } from "next/server";
import { listExperiments } from "@/server/experiments/service";
import {
  ExperimentCategory,
  ExperimentDifficulty,
} from "@/server/experiment/types";
import type {
  ExperimentCategory as Category,
  ExperimentDifficulty as Difficulty,
} from "@/server/experiment/types";

// 仅当取值属于合法枚举时才作为过滤条件，否则忽略
function asCategory(value: string | null): Category | undefined {
  return value && value in ExperimentCategory ? (value as Category) : undefined;
}

function asDifficulty(value: string | null): Difficulty | undefined {
  return value && value in ExperimentDifficulty
    ? (value as Difficulty)
    : undefined;
}

// GET /api/experiments —— 支持 category / difficulty / q(title 模糊) 过滤
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || undefined;

  const experiments = await listExperiments({
    category: asCategory(searchParams.get("category")),
    difficulty: asDifficulty(searchParams.get("difficulty")),
    q,
  });

  return NextResponse.json(experiments);
}
