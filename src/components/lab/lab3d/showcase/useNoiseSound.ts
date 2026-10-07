"use client";

// 程序化音效：白噪声经带通滤波得到"嘶嘶"声（钠与水、酒精灯火焰），音量随强度实时变化；
// 另有一次性的"噗/啪"短噪声。全部用 Web Audio 现场合成，不需要音频文件。
// 浏览器要求音频由用户手势启动：start() 必须在点击回调里调用。
import { useCallback, useEffect, useMemo, useRef } from "react";

export function useNoiseSound({ freq = 3800, q = 0.9 }: { freq?: number; q?: number } = {}) {
  const ctx = useRef<AudioContext | null>(null);
  const gain = useRef<GainNode | null>(null);

  const start = useCallback(() => {
    if (ctx.current || typeof window === "undefined") return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const c = new AC();
    const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = freq;
    bp.Q.value = q;
    const g = c.createGain();
    g.gain.value = 0;
    src.connect(bp).connect(g).connect(c.destination);
    src.start();
    ctx.current = c;
    gain.current = g;
  }, [freq, q]);

  /** 设置持续音量 0..1（平滑过渡，避免咔哒声） */
  const level = useCallback((v: number) => {
    const c = ctx.current, g = gain.current;
    if (!c || !g) return;
    g.gain.setTargetAtTime(Math.max(0, Math.min(1, v)) * 0.22, c.currentTime, 0.08);
  }, []);

  /** 一次性爆鸣：低通噪声 + 快速衰减包络 */
  const pop = useCallback((loud = 1) => {
    const c = ctx.current;
    if (!c) return;
    const n = Math.floor(c.sampleRate * 0.25);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (n * 0.12));
    const src = c.createBufferSource();
    src.buffer = buf;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1400;
    const g = c.createGain();
    g.gain.value = 0.6 * loud;
    src.connect(lp).connect(g).connect(c.destination);
    src.start();
  }, []);

  useEffect(() => () => void ctx.current?.close(), []);
  return useMemo(() => ({ start, level, pop }), [start, level, pop]);
}
