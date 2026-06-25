"use client";

// 实验台容器：在 2D（LabCanvas）与 3D（Lab3DCanvas）视图间切换。
// 仅对登记了 3D 场景的实验显示切换标签；3D 画布按需动态加载（Three.js 不支持 SSR）。
import { useState } from "react";
import dynamic from "next/dynamic";
import { LabCanvas } from "./LabCanvas";
import { has3D } from "./lab3d/registry";

// 3D 画布客户端动态加载，关闭 SSR
const Lab3DCanvas = dynamic(() => import("./lab3d/Lab3DCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[440px] items-center justify-center rounded-2xl bg-foreground/5 text-sm text-foreground/40">
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
  const enable3D = has3D(slug);
  const [mode, setMode] = useState<"2d" | "3d">("2d");

  return (
    <div className="flex flex-col gap-4">
      {enable3D && (
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
              {m === "2d" ? "2D 示意" : "3D 实验台"}
            </button>
          ))}
        </div>
      )}

      {enable3D && mode === "3d" ? (
        <Lab3DCanvas slug={slug} reagents={reagents} />
      ) : (
        <LabCanvas
          experimentId={experimentId}
          reagents={reagents}
          apparatus={apparatus}
        />
      )}
    </div>
  );
}
