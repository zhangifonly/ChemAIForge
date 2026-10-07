"use client";

// 焰色反应实验台：点燃本生灯 → 铂丝蘸盐酸灼烧至无色（洗净）→ 蘸样品 → 放入外焰观察，
// 可举起钴玻璃、可看分光镜里的线状光谱；最后鉴定一份未知样品。
// 铂丝上的残留（含不清洗带来的钠污染）由 model.ts 推进，火焰颜色、光谱、记录表都从它算出。
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { SceneShell } from "../SceneShell";
import { useLabStore } from "../../labStore";
import { FlameScene, type WirePose } from "./FlameScene";
import { FlamePanel, type Observation } from "./FlamePanel";
import { Spectroscope } from "./Spectroscope";
import { FlameLog } from "./FlameLog";
import type { FlameLook } from "./BunsenFlame";
import { burn, dip, dipAcid, emission, flameColor, isClean, newWire, visibleElements, type Element } from "./model";
import { elementsOf, pickUnknown, type Sample } from "./samples";

/** 进入外焰后样品蒸气充满火焰所需时间 */
const ARRIVE_S = 0.3;
/** 在火焰中稳定观察多久记一条观察记录 */
const OBSERVE_S = 1.2;

export function FlameLab() {
  const record = useLabStore((s) => s.record);
  const [wire, setWire] = useState(newWire);
  const [pose, setPose] = useState<WirePose>("rest");
  const [lit, setLit] = useState(false);
  const [cobalt, setCobalt] = useState(false);
  const [dipped, setDipped] = useState<{ id: number; sample: Sample | "acid" } | null>(null);
  const [obs, setObs] = useState<Observation[]>([]);
  const [unknown, setUnknown] = useState<Element[]>(() => pickUnknown());
  const [guess, setGuess] = useState<{ answer: string; correct: boolean } | null>(null);
  const [burnT, setBurnT] = useState(0);
  const [wireIn, setWireIn] = useState(false);
  const look = useRef<FlameLook>({ tint: new THREE.Color("#4f7bff"), amount: 0 });
  const logged = useRef(new Set<string>());

  const burning = lit && wireIn;
  const lines = useMemo(() => (burning && burnT > ARRIVE_S ? emission(wire) : []), [burning, burnT, wire]);
  const visible = useMemo(() => visibleElements(lines, cobalt), [lines, cobalt]);

  // 火焰外观：焰色由光谱积分得到，染色程度按亮度饱和
  const fc = useMemo(() => flameColor(lines, cobalt), [lines, cobalt]);
  // 混入 30% 白：火焰是发光体，焰色看上去总比色块淡（钾焰是"浅紫"而不是品红）
  look.current.tint.setRGB(0.3 + 0.7 * fc.r, 0.3 + 0.7 * fc.g, 0.3 + 0.7 * fc.b);
  look.current.amount = 1 - Math.exp(-fc.luminance * 12);

  // 灼烧推进
  useEffect(() => {
    if (!burning) {
      setBurnT(0);
      return;
    }
    let raf = 0;
    let last: number | null = null;
    let t = 0;
    const tick = (now: number) => {
      const dt = last === null ? 0 : Math.min(0.1, (now - last) / 1000);
      last = now;
      t += dt;
      if (t > ARRIVE_S) setWire((w) => burn(w, dt));
      setBurnT(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [burning]);

  // 记录观察：每次蘸取 × 是否用钴玻璃，各记一条
  useEffect(() => {
    if (!dipped || dipped.sample === "acid" || burnT < ARRIVE_S + OBSERVE_S) return;
    const key = `${dipped.id}-${cobalt}`;
    if (logged.current.has(key)) return;
    logged.current.add(key);
    const expected = dipped.sample === "unknown" ? null : elementsOf(dipped.sample, unknown);
    const o: Observation = {
      sample: dipped.sample,
      cobalt,
      visible,
      rgb: [fc.r, fc.g, fc.b],
      contaminated: expected ? visible.some((e) => !expected.includes(e)) : false,
    };
    setObs((xs) => [...xs, o]);
    record("flame-observe", { sample: o.sample, cobalt, visible: visible.join("+") || "none", contaminated: o.contaminated });
  }, [dipped, burnT, cobalt, visible, fc, unknown, record]);

  const dipId = useRef(0);
  const onDip = useCallback(
    (s: Sample) => {
      setPose(s);
      setWire((w) => dip(w, elementsOf(s, unknown)));
      setDipped({ id: ++dipId.current, sample: s });
      record("flame-dip", { sample: s });
    },
    [unknown, record],
  );
  const onAcid = useCallback(() => {
    setPose("acid");
    setWire(dipAcid);
    setDipped({ id: ++dipId.current, sample: "acid" });
    record("flame-acid");
  }, [record]);
  const onFlame = useCallback(() => setPose((p) => (p === "flame" ? "rest" : "flame")), []);
  const onLight = useCallback(() => {
    setLit((l) => !l);
    record("flame-burner");
  }, [record]);

  const onGuess = useCallback(
    (answer: string) => {
      const correct = answer === unknown.join("+");
      setGuess({ answer, correct });
      record("flame-identify", { answer, truth: unknown.join("+"), correct });
    },
    [unknown, record],
  );

  const onReset = useCallback(() => {
    setWire(newWire());
    setPose("rest");
    setCobalt(false);
    setDipped(null);
    setObs([]);
    setGuess(null);
    setUnknown(pickUnknown());
    logged.current.clear();
    record("flame-reset");
  }, [record]);

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-6">
      <FlamePanel
        lit={lit}
        pose={pose}
        cobalt={cobalt}
        clean={isClean(wire)}
        burning={burning && burnT > ARRIVE_S}
        visible={visible}
        guess={guess}
        hasObs={obs.length > 0}
        onLight={onLight}
        onAcid={onAcid}
        onDip={onDip}
        onFlame={onFlame}
        onCobalt={() => setCobalt((c) => !c)}
        onGuess={onGuess}
        onReset={onReset}
      />
      <SceneShell
        wrapperClassName="order-first lg:order-none"
        mood="dim"
        camera={[0.9, 1.15, 3.3]}
        target={[0.4, -0.35, 0.25]}
        autoRotate={false}
        minDistance={1.2}
        maxDistance={6}
        className="h-[380px] sm:h-[460px] lg:h-[560px]"
      >
        <FlameScene pose={pose} lit={lit} cobalt={cobalt} look={look} onInFlame={setWireIn} />
      </SceneShell>
      <div className="flex flex-col gap-4 lg:col-span-2">
        <Spectroscope lines={lines} cobalt={cobalt} visible={visible} />
        <FlameLog obs={obs} />
      </div>
    </div>
  );
}
