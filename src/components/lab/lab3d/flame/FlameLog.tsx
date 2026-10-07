"use client";

// 观察记录表：每次"蘸取 → 灼烧"自动记一行（用不用钴玻璃各记一行），
// 带实际看到的焰色色块。没洗铂丝就换样品时，这一行会被标出"受钠污染"。
import { useTranslations } from "next-intl";
import { FORMULA } from "./samples";
import type { Observation } from "./FlamePanel";

export function FlameLog({ obs }: { obs: Observation[] }) {
  const t = useTranslations("flameLab.log");
  const te = useTranslations("flameLab.el");
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-foreground/10 bg-surface/60 p-4">
      <h3 className="text-sm font-semibold text-foreground/80">{t("title")}</h3>
      {obs.length === 0 ? (
        <p className="text-xs text-foreground/60">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-xs" data-testid="flame-log">
            <thead className="text-foreground/60">
              <tr>
                <th className="py-1 text-start font-normal">{t("sample")}</th>
                <th className="font-normal">{t("cobalt")}</th>
                <th className="font-normal">{t("color")}</th>
                <th className="text-start font-normal">{t("seen")}</th>
              </tr>
            </thead>
            <tbody>
              {obs.map((o, i) => {
                const [r, g, b] = o.rgb.map((v) => Math.round(Math.min(1, v) * 255));
                return (
                  <tr key={i} className="border-t border-foreground/5" data-contaminated={o.contaminated}>
                    <td className="py-1.5 font-mono">{FORMULA[o.sample]}</td>
                    <td className="text-center">{o.cobalt ? "✓" : ""}</td>
                    <td className="text-center">
                      <span
                        className="inline-block h-4 w-8 rounded"
                        style={{ background: o.visible.length ? `rgb(${r},${g},${b})` : "#3c5fd0", boxShadow: "0 0 8px rgba(0,0,0,.15) inset" }}
                      />
                    </td>
                    <td>
                      {o.visible.length ? o.visible.map((e) => te(e)).join(" + ") : t("nothing")}
                      {o.contaminated ? <span className="ms-1 rounded bg-amber-500/20 px-1 text-amber-700 dark:text-amber-300">{t("contaminated")}</span> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
