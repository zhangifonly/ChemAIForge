"use client";

// 实验台容器：在 2D（LabCanvas）与 3D（Lab3DCanvas）视图间切换。
// 仅对登记了 3D 场景的实验显示切换标签；3D 画布按需动态加载（Three.js 不支持 SSR）。
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { LabCanvas } from "./LabCanvas";
import { useLabStore } from "./labStore";
import { has3D } from "./lab3d/registry";
import { useTranslations } from "next-intl";

// 3D 画布客户端动态加载，关闭 SSR
const Lab3DCanvas = dynamic(() => import("./lab3d/Lab3DCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[440px] items-center justify-center rounded-2xl bg-foreground/5 text-sm text-foreground/65">
      正在加载 3D 实验台…
    </div>
  ),
});

export function LabWorkbench({
  experimentId,
  slug,
  reagents,
  apparatus,
}: {
  experimentId: string;
  slug: string;
  reagents: string[];
  apparatus: string[];
}) {
  const t = useTranslations("workbench");
  // 通用 3D 场景已能按反应引擎结果自动组装现象，故所有实验都提供 3D 视图；
  // registry 登记的是"有专用手写场景"的实验（表现更精细），非 3D 的开关。
  const refined3D = has3D(slug);
  const [mode, setMode] = useState<"2d" | "3d">("2d");

  // 会话绑定与换实验清空放在工作台层，而不是 2D 画布里：
  // 3D 视图下 LabCanvas 未挂载，若在 3D 下切换实验，store 得不到通知，
  // 新实验会带着上一个实验的残留试剂与读数，操作也记不进自己的会话。
  const initSession = useLabStore((s) => s.initSession);
  useEffect(() => {
    initSession(experimentId);
  }, [experimentId, initSession]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1 self-start rounded-full bg-foreground/5 p-1 text-sm">
          {(["2d", "3d"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-full px-4 py-1 font-medium transition-colors ${
                mode === m
                  ? "bg-brand-500 text-white shadow-soft"
                  : "text-foreground/60 hover:text-foreground/90"
              }`}
            >
              {m === "2d" ? t("view2d") : refined3D ? t("view3dRefined") : t("view3d")}
            </button>
          ))}
      </div>

      {mode === "3d" ? (
        <Lab3DCanvas slug={slug} reagents={reagents} apparatus={apparatus} />
      ) : (
        <LabCanvas reagents={reagents} apparatus={apparatus} />
      )}
    </div>
  );
}
