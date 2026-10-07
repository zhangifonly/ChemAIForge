"use client";

// 碘钟实验台：配 A 液（KI、Na2S2O3、淀粉、H2SO4）、设定恒温温度 → 倒入 B 液（H2O2）开始计时 →
// 溶液突然变蓝时秒表停下。改变 KI 浓度做几次求反应级数，改变温度做几次求活化能。
// 化学只在 model.ts：诱导期、颜色都由 mixture() 算出；场景与图表只读这里的状态。
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SceneShell } from "../SceneShell";
import { useLabStore } from "../../labStore";
import { ClockScene, type ClockPhase } from "./ClockScene";
import { ClockPanel } from "./ClockPanel";
import { KineticsChart, type ClockRun } from "./KineticsChart";
import { inductionTime, measuredTime, mixture, type ClockParams } from "./model";

const INITIAL: ClockParams = { ki: 0.05, h2o2: 0.05, thio: 0.005, tempC: 25, starch: true };
/** 超过这么久仍未变色，提示学生检查配方（硫代硫酸钠过量时永远不会变） */
export const GIVE_UP_S = 300;

export function ClockLab() {
  const record = useLabStore((s) => s.record);
  const [params, setParams] = useState<ClockParams>(INITIAL);
  const [phase, setPhase] = useState<ClockPhase>("ready");
  const [chemT, setChemT] = useState(0);
  const [stopAt, setStopAt] = useState<number | null>(null);
  const [speed, setSpeed] = useState(1);
  const [runs, setRuns] = useState<ClockRun[]>([]);
  const seed = useRef(Math.floor(Math.random() * 1e9));

  const m = useMemo(() => (phase === "running" || phase === "done" ? mixture(params, chemT) : null), [phase, params, chemT]);

  // 化学时间推进：倒完 B 液开始；停表后仍继续几秒，让蓝色加深
  useEffect(() => {
    if (phase !== "running" && phase !== "done") return;
    let raf = 0;
    let last: number | null = null;
    const tick = (now: number) => {
      const dt = last === null ? 0 : Math.min(0.1, (now - last) / 1000);
      last = now;
      setChemT((t) => (phase === "done" && stopAt !== null && t > stopAt + 15 ? t : t + dt * speed));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, speed, stopAt]);

  // 终点判断：有淀粉看蓝色（读数取"秒表"读数，带少量反应时间误差）；没淀粉只能等黄棕色明显
  useEffect(() => {
    if (phase !== "running" || !m) return;
    const seen = params.starch ? m.blue > 0.5 : m.yellow > 0.3;
    if (!seen) return;
    const t = params.starch ? Math.max(chemT * 0.9, measuredTime(params, seed.current + runs.length)) : chemT;
    finish(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, m]);

  const finish = useCallback(
    (t: number | null) => {
      setPhase("done");
      setStopAt(t ?? chemT);
      const run: ClockRun = { ...params, t };
      if (t !== null) setRuns((rs) => [...rs, run]);
      record(
        "clock-stop",
        { ki: params.ki, h2o2: params.h2o2, thio: params.thio, tempC: params.tempC, starch: params.starch,
          seconds: t === null ? null : Math.round(t * 10) / 10, theory: round1(inductionTime(params)) },
        { ph: 1, temperature: params.tempC },
      );
    },
    [params, chemT, record],
  );

  const onPour = useCallback(() => {
    setChemT(0);
    setStopAt(null);
    setPhase("pouring");
    record("clock-mix", { ...params });
  }, [params, record]);

  const onPoured = useCallback(() => setPhase("running"), []);
  const onAgain = useCallback(() => {
    setPhase("ready");
    setChemT(0);
    setStopAt(null);
  }, []);
  const onReset = useCallback(() => {
    onAgain();
    setRuns([]);
    setParams(INITIAL);
    record("clock-reset");
  }, [onAgain, record]);

  const display = phase === "done" && stopAt !== null ? stopAt : phase === "running" ? chemT : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-6">
      <ClockPanel
        params={params}
        phase={phase}
        speed={speed}
        elapsed={display}
        overdue={phase === "running" && chemT > GIVE_UP_S}
        hasRuns={runs.length > 0}
        onParams={(p) => setParams((x) => ({ ...x, ...p }))}
        onSpeed={setSpeed}
        onPour={onPour}
        onStop={() => finish(null)}
        onAgain={onAgain}
        onReset={onReset}
      />
      <SceneShell
        wrapperClassName="order-first lg:order-none"
        camera={[0.9, 1.3, 3.2]}
        target={[0.25, -0.2, 0]}
        autoRotate={false}
        minDistance={1.6}
        maxDistance={7}
        className="h-[380px] sm:h-[460px] lg:h-[560px]"
      >
        <ClockScene phase={phase} tempC={params.tempC} elapsed={display} blue={m?.blue ?? 0} yellow={m?.yellow ?? 0} onPoured={onPoured} />
      </SceneShell>
      <div className="lg:col-span-2">
        <KineticsChart runs={runs} />
      </div>
    </div>
  );
}

function round1(x: number) {
  return Number.isFinite(x) ? Math.round(x * 10) / 10 : null;
}
