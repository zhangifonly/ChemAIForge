"use client";

// 手持分光镜视图：把火焰发出的光按波长展开成线状光谱。
// 焰色只是"混在一起的颜色"，分光后每种元素是几条固定位置的亮线 —— 这才是元素的"指纹"，
// 也是光谱分析能发现铯、铷等新元素的原理。数据直接取自 model.ts 的谱线表，和火焰颜色同源。
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { ELEMENTS, LINES, spectrumAt, wavelengthRGB, type Element, type TaggedLine } from "./model";

const NM0 = 380, NM1 = 780, W = 400, H = 56;

export function Spectroscope({ lines, cobalt, visible }: { lines: TaggedLine[]; cobalt: boolean; visible: Element[] }) {
  const t = useTranslations("flameLab.spectro");
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.fillStyle = "#07090c";
    ctx.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x++) {
      const nm = NM0 + ((NM1 - NM0) * x) / W;
      // 0.5 nm 内取两次样，免得 1 nm 宽的原子线落在像素缝里漏掉
      const s = Math.max(spectrumAt(lines, nm, cobalt), spectrumAt(lines, nm + 0.5, cobalt));
      // s 是谱线密度（每 nm），分子带宽、峰值低，增益要足够大才看得见；钠线会饱和成白芯，正符合它的亮度
      const v = 1 - Math.exp(-s * 12);
      const [r, g, b] = wavelengthRGB(nm);
      // 底下铺一条很暗的连续彩带作波长参照
      const k = Math.max(v, 0.06);
      ctx.fillStyle = `rgb(${(r * 255 * k) | 0},${(g * 255 * k) | 0},${(b * 255 * k) | 0})`;
      ctx.fillRect(x, 0, 1, H);
      if (v > 0.6) {
        // 过曝的亮线中心发白，模拟眼睛里强谱线的样子
        ctx.fillStyle = `rgba(255,255,255,${(v - 0.6) * 1.2})`;
        ctx.fillRect(x, H * 0.2, 1, H * 0.6);
      }
    }
  }, [lines, cobalt]);

  const px = (nm: number) => `${((nm - NM0) / (NM1 - NM0)) * 100}%`;
  const present = ELEMENTS.filter((e) => lines.some((l) => l.el === e));

  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-foreground/10 bg-surface/60 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground/80">{t("title")}</h3>
        {cobalt ? <span className="text-xs text-blue-600 dark:text-blue-300">{t("throughCobalt")}</span> : null}
      </div>
      <div className="relative w-full max-w-2xl">
        <canvas ref={ref} width={W} height={H} className="h-14 w-full rounded-md" data-testid="spectrum" />
        <div className="relative h-4 text-[10px] text-foreground/55">
          {[400, 450, 500, 550, 600, 650, 700, 750].map((nm) => (
            <span key={nm} className="absolute -translate-x-1/2 font-mono" style={{ left: px(nm) }}>{nm}</span>
          ))}
        </div>
        {/* 主要谱线的元素标注：只标当前火焰里有的元素 */}
        <div className="relative h-4 text-[10px]">
          {present.flatMap((e) =>
            LINES[e].filter((l) => l.i >= 0.5).map((l) => (
              <span
                key={e + l.nm}
                className={`absolute -translate-x-1/2 font-semibold ${visible.includes(e) ? "text-foreground/85" : "text-foreground/35"}`}
                style={{ left: px(l.nm) }}
              >
                {e}
              </span>
            )),
          )}
        </div>
      </div>
      <p className="text-xs text-foreground/65">{lines.length ? t("explain") : t("empty")}</p>
    </section>
  );
}
