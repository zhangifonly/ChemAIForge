import { NextResponse } from "next/server";
import { listExperiments } from "@/server/experiments/service";
import { localizeExperiments, searchableText } from "@/lib/i18n/content";
import { isLocale, SOURCE_LOCALE } from "@/lib/i18n/locales";
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

// GET /api/experiments —— 支持 category / difficulty / q(标题与描述模糊) / locale 过滤
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || undefined;
  const rawLocale = searchParams.get("locale");
  const locale = rawLocale && isLocale(rawLocale) ? rawLocale : SOURCE_LOCALE;

  // 关键词过滤不能交给数据库：库里只有中文原文，日语用户搜「滴定」
  // 在 title LIKE 上一条都匹配不到。故按 category/difficulty 查库，
  // 关键词在应用层比对「原文 + 该语种译文」（见 searchableText）。
  const rows = await listExperiments({
    category: asCategory(searchParams.get("category")),
    difficulty: asDifficulty(searchParams.get("difficulty")),
  });

  if (!q) return NextResponse.json(await localizeExperiments(rows, locale));

  // 必须先在原文行上匹配、再本地化：searchableText 会把原文与译文拼起来，
  // 好让英语界面里搜中文关键词也能命中。若先本地化，传进去的 title 已是译文，
  // 中文原文就丢了 —— 那正是此前「英语界面搜"滴定"返回 0 条」的原因。
  const needle = q.toLowerCase();
  const hits = [];
  for (const exp of rows) {
    if ((await searchableText(exp, locale)).includes(needle)) hits.push(exp);
  }
  return NextResponse.json(await localizeExperiments(hits, locale));
}
