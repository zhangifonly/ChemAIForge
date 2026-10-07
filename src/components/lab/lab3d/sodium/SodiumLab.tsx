"use client";

// 钠与水实验台：选块大小 → 切去氧化层 → （可选）滴酚酞 → 镊子投入 → 观察"浮熔游响红"。
// 化学状态只在这里：model.ts 推进、readings() 读出；场景、面板、产气曲线都吃同一份读数。
// 每做完一块记一条产气曲线，换不同大小再做，就能看出反应时长 ∝ m^(1/3)。
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SceneShell } from "../SceneShell";
import { useLabStore } from "../../labStore";
import { useNoiseSound } from "../showcase/useNoiseSound";
import { SodiumScene, type SodiumPhase } from "./SodiumScene";
import { SodiumPanel, type Observed } from "./SodiumPanel";
import { H2Chart, type Run } from "./H2Chart";
import { PIECES, advance, initialState, phenolphthaleinPink, readings, type PieceSize } from "./model";

export function SodiumLab() {
  const record = useLabStore((s) => s.record);
  const [size, setSize] = useState<PieceSize>("small");
  const [phase, setPhase] = useState<SodiumPhase>("prep");
  const [cutAt, setCutAt] = useState<number | null>(null);
  const [phenol, setPhenol] = useState(false);
  const [state, setState] = useState(() => initialState(PIECES.small));
  const [runs, setRuns] = useState<Run[]>([]);
  const [muted, setMuted] = useState(false);
  const curve = useRef<[number, number][]>([]);
  const sound = useNoiseSound();

  const r = useMemo(() => readings(state), [state]);
  const meltT = state.seconds;

  // 反应推进：rAF，单帧 dt 夹到 0.1 s（切后台不补算）
  useEffect(() => {
    if (phase !== "reacting") return;
    let raf = 0;
    let last: number | null = null;
    const tick = (now: number) => {
      const dt = last === null ? 0 : Math.min(0.1, (now - last) / 1000);
      last = now;
      setState((s) => advance(s, dt));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // 采样产气曲线、驱动嘶嘶声、判断结束
  useEffect(() => {
    if (phase !== "reacting") return;
    const c = curve.current;
    if (!c.length || state.seconds - c[c.length - 1][0] >= 0.2) c.push([state.seconds, r.h2mL]);
    sound.level(muted ? 0 : Math.sqrt(r.rateGps / 0.045));
    if (r.done) {
      sound.level(0);
      if (state.naInitialG >= 0.3 && !muted) sound.pop();
      c.push([state.seconds, r.h2mL]);
      setRuns((rs) => [...rs, { size, massG: state.naInitialG, seconds: state.seconds, curve: [...c] }]);
      setPhase("done");
      record(
        "sodium-done",
        { massG: state.naInitialG, seconds: round(state.seconds, 1), h2mL: round(r.h2mL, 1), tempC: round(r.tempC, 1), phenolphthalein: phenol },
        { ph: round(r.ph, 2), temperature: round(r.tempC, 1) },
      );
    }
  }, [phase, state, r, size, muted, phenol, record, sound]);

  const observed: Observed = {
    float: phase !== "prep" && phase !== "falling",
    melt: meltT > 0.8,
    swim: meltT > 1.5,
    hiss: meltT > 0.4,
    pink: phenol && phenolphthaleinPink(r.ph) > 0.2,
  };

  const onCut = useCallback(() => {
    setCutAt(performance.now());
    record("sodium-cut", { massG: PIECES[size] });
  }, [record, size]);

  const onDrop = useCallback(() => {
    sound.start();
    curve.current = [];
    setState(initialState(PIECES[size]));
    setPhase("falling");
    record("sodium-drop", { massG: PIECES[size], phenolphthalein: phenol });
  }, [record, size, phenol, sound]);

  const onLanded = useCallback(() => setPhase("reacting"), []);

  /** 换一杯清水、取新的一块（保留已做的曲线用于对比） */
  const onNext = useCallback(() => {
    sound.level(0);
    setPhase("prep");
    setCutAt(null);
    setState(initialState(PIECES[size]));
  }, [size, sound]);

  const onReset = useCallback(() => {
    onNext();
    setRuns([]);
    setPhenol(false);
    record("sodium-reset");
  }, [onNext, record]);

  const onSize = useCallback(
    (s: PieceSize) => {
      setSize(s);
      setCutAt(null);
      setState(initialState(PIECES[s]));
    },
    [],
  );

  const onPhenol = useCallback(() => {
    setPhenol(true);
    record("sodium-phenolphthalein");
  }, [record]);

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-6">
      <SodiumPanel
        size={size}
        phase={phase}
        cut={cutAt !== null}
        phenol={phenol}
        muted={muted}
        readings={r}
        seconds={state.seconds}
        observed={observed}
        hasRuns={runs.length > 0}
        onSize={onSize}
        onCut={onCut}
        onPhenol={onPhenol}
        onDrop={onDrop}
        onNext={onNext}
        onReset={onReset}
        onMute={() => setMuted((m) => !m)}
      />
      <SceneShell
        wrapperClassName="order-first lg:order-none"
        camera={[0.55, 2.2, 4.4]}
        target={[0.6, -0.7, 0]}
        autoRotate={false}
        minDistance={1.6}
        maxDistance={7}
        fov={42}
        className="h-[380px] sm:h-[460px] lg:h-[560px]"
      >
        <SodiumScene
          phase={phase}
          readings={r}
          massG={PIECES[size]}
          phenol={phenol}
          cutAt={cutAt}
          meltT={meltT}
          onLanded={onLanded}
        />
      </SceneShell>
      <div className="lg:col-span-2">
        <H2Chart runs={runs} live={phase === "reacting" ? { size, curve: curve.current, seconds: state.seconds, h2mL: r.h2mL } : null} />
      </div>
    </div>
  );
}

function round(x: number, d: number) {
  const k = 10 ** d;
  return Math.round(x * k) / k;
}
