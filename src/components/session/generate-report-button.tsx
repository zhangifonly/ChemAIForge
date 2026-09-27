"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

// 报告生成按钮：报告页是服务端组件，生成需要用户主动触发一次 POST，
// 故单独拆出这个客户端组件。生成成功后 router.refresh() 让服务端重新取数据。
export function GenerateReportButton({
  sessionId,
  regenerate = false,
}: {
  sessionId: string;
  regenerate?: boolean;
}) {
  const t = useTranslations("report");
  const locale = useLocale();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/report?locale=${locale}`, {
        method: "POST",
      });
      if (!res.ok) {
        // 接口失败时把服务端给的中文原因显示出来，而不是笼统的"失败"
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? t("generateFailed", { status: res.status }));
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="self-start rounded-full bg-brand-600 px-5 py-2 text-sm font-medium text-white shadow-soft transition-all hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading
          ? t("generating")
          : regenerate
            ? t("regenerate")
            : t("generate")}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
