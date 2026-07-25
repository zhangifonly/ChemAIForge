"use client";

// 酸碱中和滴定实验台：持有滴定状态（是否装液、已放出体积、旋塞开度、摇瓶、是否已判定终点），
// 左侧为定量操作面板，右侧为 3D 场景。滴定量的唯一来源是"落下的滴数"，
// 因此界面读数与 3D 里看到的液滴严格一致。
import { useState, useCallback } from "react";
import { SceneShell } from "./SceneShell";
import { TitrationScene } from "./TitrationScene";
import { TitrationData, TitrationControls } from "./titration/TitrationPanel";
import { DROP_ML, TITRATION, verdictAt } from "./titration/model";

export function TitrationLab() {
  const [ready, setReady] = useState(false);
  const [deliveredMl, setDelivered] = useState(0);
  const [openness, setOpenness] = useState(0);
  const [swirl, setSwirl] = useState(false);
  const [finished, setFinished] = useState(false);

  // 每落下一滴累加体积；放完 50 mL 自动关闭旋塞
  const onDrop = useCallback(() => {
    setDelivered((v) => {
      const next = Math.min(TITRATION.buretteCapacityMl, v + DROP_ML);
      if (next >= TITRATION.buretteCapacityMl) setOpenness(0);
      return next;
    });
  }, []);

  // 手动补半滴：临近终点时的标准操作（悬滴靠瓶壁引下）
  const onHalfDrop = useCallback(() => {
    setDelivered((v) => Math.min(TITRATION.buretteCapacityMl, v + DROP_ML / 2));
  }, []);

  const onReset = useCallback(() => {
    setReady(false);
    setDelivered(0);
    setOpenness(0);
    setSwirl(false);
    setFinished(false);
  }, []);

  const onFinish = useCallback(() => {
    setOpenness(0);
    setFinished(true);
  }, []);

  // 判定终点后关闭旋塞，防止继续滴入干扰读数
  const effectiveOpenness = finished ? 0 : openness;

  const panelProps = {
    ready,
    deliveredMl,
    openness: effectiveOpenness,
    swirl,
    finished,
    onPrepare: () => setReady(true),
    onHalfDrop,
    onSwirlToggle: () => setSwirl((s) => !s),
    onFinish,
    onReset,
  };

  // 滴定装置是竖高构型（台面到管顶约 5.6 单位），画布须占满宽度才有足够纵向视野，
  // 故面板改置于画布下方横排，而非侧栏。
  return (
    <div className="flex flex-col gap-4">
      <aside className="order-2 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* 操作列 */}
        <div className="flex flex-col gap-3">
          <TitrationControls {...panelProps} />
        </div>
        {/* 数据列 */}
        <TitrationData {...panelProps} />
        {/* 说明列 */}
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-foreground/15 bg-surface/70 px-3 py-2 text-xs leading-relaxed text-foreground/70">
            <p className="font-medium text-foreground/85">操作要点</p>
            <p className="mt-1">
              拖动 3D 场景中滴定管的旋塞控制滴速；接近终点改用「加半滴」。
              终点为粉红<strong>刚好褪去</strong>且半分钟不复色。
            </p>
          </div>
          {ready && !finished && <LiveHint deliveredMl={deliveredMl} />}
        </div>
      </aside>

      <SceneShell
        // 装置竖向跨度约 5.6 单位（台面到管顶），视线中心取管身中部，略偏右看清旋塞
        camera={[2.4, 1.5, 7.2]}
        target={[0, 1.2, 0]}
        fov={46}
        shadowY={-1.595}
        autoRotate={false}
        minDistance={4.5}
        maxDistance={15}
        className="h-[640px]"
        hint="拖拽旋转 · 滚轮缩放 · 拖动旋塞控制滴速"
      >
        <TitrationScene
          ready={ready}
          deliveredMl={deliveredMl}
          openness={effectiveOpenness}
          swirl={swirl}
          onDrop={onDrop}
          onOpennessChange={setOpenness}
        />
      </SceneShell>
    </div>
  );
}

/** 实时提示：只给操作层面的提醒，不直接报出终点体积（否则失去判断训练意义） */
function LiveHint({ deliveredMl }: { deliveredMl: number }) {
  const v = verdictAt(deliveredMl);
  if (v === "before") {
    return (
      <p className="rounded-lg bg-sky-500/10 px-3 py-2 text-xs text-sky-700 dark:text-sky-300">
        溶液仍显粉红，可继续滴加。颜色变浅、褪色变慢时应放慢至逐滴。
      </p>
    );
  }
  return (
    <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
      粉红已褪去。若半分钟内不复色即可判定终点并读数。
    </p>
  );
}
