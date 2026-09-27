import { NextResponse } from "next/server";
import { getExperimentBySlug } from "@/server/experiments/service";
import { localizeExperiment } from "@/lib/i18n/content";
import { isLocale, SOURCE_LOCALE } from "@/lib/i18n/locales";

// GET /api/experiments/[slug] —— 命中返回详情，未命中返回 404
export async function GET(
  request: Request,
  { params }: { params: { slug: string } },
) {
  const experiment = await getExperimentBySlug(params.slug);
  if (!experiment) {
    return NextResponse.json({ error: "实验不存在" }, { status: 404 });
  }
  const raw = new URL(request.url).searchParams.get("locale");
  const locale = raw && isLocale(raw) ? raw : SOURCE_LOCALE;
  return NextResponse.json(await localizeExperiment(experiment, locale));
}
