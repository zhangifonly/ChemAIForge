import { NextResponse } from "next/server";
import { getExperimentBySlug } from "@/server/experiments/service";

// GET /api/experiments/[slug] —— 命中返回详情，未命中返回 404
export async function GET(
  _request: Request,
  { params }: { params: { slug: string } },
) {
  const experiment = await getExperimentBySlug(params.slug);
  if (!experiment) {
    return NextResponse.json({ error: "实验不存在" }, { status: 404 });
  }
  return NextResponse.json(experiment);
}
