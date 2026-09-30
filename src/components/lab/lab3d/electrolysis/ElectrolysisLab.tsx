"use client";

// 电解硫酸铜实验台：持有电解状态（累计电量、阳极材料、电流、时间倍率、是否通电），
// 左侧为参数与读数，右侧为 3D 场景。所有读数由 model.readings() 从累计电量算出，
// 3D 画面也只吃这一份读数 —— 画面与数字不可能对不上。
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { SceneShell } from "../SceneShell";
import { ElectrolysisScene } from "./ElectrolysisScene";
import { ElectrolysisPanel } from "./ElectrolysisPanel";
import { useLabStore } from "../../labStore";
import {
  advance,
  isDepleted,
  readings as readingsOf,
  weighCathode,
  type AnodeMaterial,
  type ElectrolysisState,
} from "./model";

const ZERO: ElectrolysisState = { chargeC: 0, seconds: 0 };

export function ElectrolysisLab({ initialAnode = "graphite" }: { initialAnode?: AnodeMaterial }) {
  const t = useTranslations("electrolysisLab");
  const record = useLabStore((s) => s.record);

  const [state, setState] = useState<ElectrolysisState>(ZERO);
  const [anode, setAnode] = useState<AnodeMaterial>(initialAnode);
  const [current, setCurrent] = useState(1.0);
  const [timeScale, setTimeScale] = useState<number>(120);
  const [energized, setEnergized] = useState(false);
  const [microView, setMicroView] = useState(false);
  const [weighed, setWeighed] = useState<{ measuredG: number; efficiency: number } | null>(null);
  // 每次重置换一个种子：同一次实验反复称量读数一致，换一次实验误差不同
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));

  const r = useMemo(() => readingsOf(state, anode), [state, anode]);
  const depleted = isDepleted(state, anode);

  // 通电计时：requestAnimationFrame 而非 setInterval —— 切到后台标签页时自动暂停，
  // 回来不会一次性补上几分钟的电量。单帧 dt 夹到 0.1 s 同理。
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (!energized) {
      last.current = null;
      return;
    }
    let raf = 0;
    const tick = (now: number) => {
      const prev = last.current ?? now;
      last.current = now;
      const dt = Math.min(0.1, (now - prev) / 1000) * timeScale;
      setState((s) => advance(s, current, dt));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [energized, current, timeScale]);

  // 铜离子耗尽自动断电：继续电解阴极会转为析氢，本实验台不模拟那一段
  useEffect(() => {
    if (energized && depleted) {
      setEnergized(false);
      record("electrolysis-depleted", { anode, seconds: Math.round(state.seconds) }, snapshot(r));
    }
  }, [energized, depleted, anode, state.seconds, r, record]);

  const togglePower = useCallback(() => {
    const on = !energized;
    setEnergized(on);
    setWeighed(null);
    // 断电时把读数写进会话：它是报告里"做了多少、得到多少"的依据
    record(
      on ? "electrolysis-power-on" : "electrolysis-power-off",
      { anode, currentA: current, timeScale, seconds: Math.round(state.seconds) },
      on ? undefined : snapshot(r),
    );
  }, [energized, anode, current, timeScale, state.seconds, r, record]);

  const onWeigh = useCallback(() => {
    const w = weighCathode(r.copperDepositedG, seed);
    setWeighed(w);
    record(
      "electrolysis-weigh",
      {
        measuredG: round4(w.measuredG),
        theoreticalG: round4(r.copperDepositedG),
        efficiency: Math.round(w.efficiency * 1000) / 10,
        chargeC: Math.round(state.chargeC),
      },
      snapshot(r),
    );
  }, [r, seed, state.chargeC, record]);

  const onReset = useCallback(() => {
    setEnergized(false);
    setState(ZERO);
    setWeighed(null);
    setSeed(Math.floor(Math.random() * 1e9));
    record("electrolysis-reset");
  }, [record]);

  // 换阳极材料等于换一套实验：已有的电量归零，否则石墨下析出的铜会被算到铜阳极头上
  const onAnode = useCallback(
    (a: AnodeMaterial) => {
      if (a === anode) return;
      setAnode(a);
      setEnergized(false);
      setState(ZERO);
      setWeighed(null);
      record("electrolysis-anode", { anode: a });
    },
    [anode, record],
  );

  return (
    // 手机上画布排在面板之前（order-first）：参数 + 读数 + 称量整块面板约 900px 高，
    // 排在前面时电解槽落到首屏之外，学生看到的只是一堆按钮。宽屏两栏时面板在左
    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-6">
      <ElectrolysisPanel
        state={state}
        readings={r}
        anode={anode}
        current={current}
        timeScale={timeScale}
        energized={energized}
        microView={microView}
        depleted={depleted}
        weighed={weighed}
        onAnode={onAnode}
        onCurrent={setCurrent}
        onTimeScale={setTimeScale}
        onTogglePower={togglePower}
        onMicroView={() => setMicroView((v) => !v)}
        onWeigh={onWeigh}
        onReset={onReset}
      />
      <SceneShell
        wrapperClassName="order-first lg:order-none"
        camera={[2.6, 1.9, 4.6]}
        target={[0, 0.2, -0.2]}
        autoRotate={false}
        minDistance={3}
        maxDistance={9}
        className="h-[380px] sm:h-[460px] lg:h-[560px]"
      >
        <ElectrolysisScene
          readings={r}
          anode={anode}
          current={current}
          energized={energized}
          timeScale={timeScale}
          microView={microView}
          cathodeLifted={weighed !== null}
        />
      </SceneShell>
      <p className="text-xs text-foreground/65 lg:col-span-2">{t("scaleNote", { scale: timeScale, conc: 0.5, volume: 100 })}</p>
    </div>
  );
}

/** 会话里的测量点：pH 与温度沿用通用字段，电解特有量放 detail */
function snapshot(r: ReturnType<typeof readingsOf>) {
  // 电解本身会放热，但 1 A 量级升温不到 1 ℃，按室温记
  return { ph: Math.round(r.ph * 100) / 100, temperature: 25 };
}

function round4(x: number) {
  return Math.round(x * 10000) / 10000;
}
