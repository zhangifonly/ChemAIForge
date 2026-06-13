"use client";

// 实验画布交互组件：试剂面板以「彩色试剂瓶」呈现，支持点击即加 / 拖拽两种方式，
// 容器内试剂以可移除标签显示，液面随试剂量上升；点击混合触发反应引擎，
// 由 Glassware 按实验仪器以立体 SVG（烧杯/锥形瓶/试管）渲染变色/气泡/沉淀/蒸汽与读数。
// 反应判定一律委托 src/lib/chem/engine，本组件不含任何反应规则。
import { useEffect, useState } from "react";
import type { SubstanceCategory } from "@/lib/chem/engine";
import { useLabStore } from "./labStore";
import { resolveSubstance } from "./reagents";
import { Glassware } from "./Glassware";
import { GasCollection } from "./GasCollection";
import { ElectrolysisCell } from "./ElectrolysisCell";
import { GalvanicCell } from "./GalvanicCell";
import { ConductivityTester } from "./ConductivityTester";
import { ElectroLab } from "./ElectroLab";
import { resolveLabMode } from "./labMode";
import { chooseVessel, usesGasCollection, isInertAnode } from "./vesselGeom";
import { electrolyze, isElectrolyte } from "@/lib/chem/electrolysis";
import { galvanicCell, isGalvanicMetal } from "@/lib/chem/galvanic";
import { conductivity } from "@/lib/chem/conductivity";
import { ControlPanel } from "./ControlPanel";
import { safetyNotes, operationHint } from "./safety";

const DRAG_KEY = "application/x-reagent";

// 试剂瓶液体配色：按物质类别给出直观的色彩提示（仅用于界面，与反应无关）
const CATEGORY_COLOR: Record<SubstanceCategory, string> = {
  acid: "#f29393",
  base: "#94b8f0",
  salt: "#c4d2e0",
  carbonate: "#dcd4c2",
  metal: "#b6bec9",
  oxide: "#e0ad7e",
  gas: "#d2e7ec",
  water: "#a9d8f5",
  indicator: "#e29bdb",
  oxidizer: "#f1c25e",
  reducer: "#a3d9aa",
  organic: "#cadc97",
  other: "#d3dae1",
};

// 溶质特征色：常见有色离子 / 物质的真实溶液色泽（仅用于可视化）。
// 键为化学式，按容器内试剂匹配，混合前即呈现真实色彩。
const SOLUTION_TINT: Record<string, { top: string; bottom: string }> = {
  CuSO4: { top: "#7cc0ea", bottom: "#2f7fc7" }, // 硫酸铜·蓝
  CuCl2: { top: "#7fcadf", bottom: "#2f9bbf" }, // 氯化铜·蓝绿
  "Cu(NO3)2": { top: "#7cc0ea", bottom: "#2f7fc7" }, // 硝酸铜·蓝
  FeCl3: { top: "#e0b56a", bottom: "#b9772c" }, // 氯化铁·黄棕
  "Fe(NO3)3": { top: "#e0b56a", bottom: "#b9772c" },
  FeCl2: { top: "#bfe0b6", bottom: "#7fbf86" }, // 氯化亚铁·浅绿
  FeSO4: { top: "#bfe0b6", bottom: "#7fbf86" },
  KMnO4: { top: "#c08fe0", bottom: "#7a2fb0" }, // 高锰酸钾·紫
  K2Cr2O7: { top: "#f0b06a", bottom: "#d9722c" }, // 重铬酸钾·橙
  K2CrO4: { top: "#f5d96a", bottom: "#e0b62c" }, // 铬酸钾·黄
  I2: { top: "#c9a06a", bottom: "#8a5a2c" }, // 碘·棕
  CoCl2: { top: "#f0a0b8", bottom: "#d95a82" }, // 氯化钴·粉红
  NiSO4: { top: "#9fd9a8", bottom: "#4fae5e" }, // 硫酸镍·绿
};

export function LabCanvas({
  experimentId,
  reagents,
  apparatus,
}: {
  experimentId: string;
  reagents: string[];
  apparatus: string[];
}) {
  const {
    contents,
    result,
    readings,
    completed,
    initSession,
    addReagent,
    removeReagent,
    setTemperature,
    energized,
    setEnergized,
    mix,
    reset,
    complete,
  } = useLabStore();
  // 拖拽悬停高亮容器
  const [dragOver, setDragOver] = useState(false);

  // 挂载时绑定实验并创建会话（未登录则静默无会话）
  useEffect(() => {
    initSession(experimentId);
  }, [experimentId, initSession]);

  // 解析标签并入容器（点击 / 拖拽共用）
  const pour = (label: string) => addReagent(resolveSubstance(label));
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const label = e.dataTransfer.getData(DRAG_KEY);
    if (label) pour(label);
  };

  // 液面比例：随容器内试剂数量增长，空杯为 0
  const fill =
    contents.length === 0 ? 0 : Math.min(0.82, 0.28 + contents.length * 0.16);

  // 容器内首个具有特征色的溶质决定液体色泽（混合前即呈现真实色彩）
  const tint = contents
    .map((c) => SOLUTION_TINT[c.formula])
    .find(Boolean);

  // 按实验仪器选择器皿造型（试管 / 锥形瓶 / 烧杯）
  const vessel = chooseVessel(apparatus);
  // 产气类实验：显示排水法集气装置，反应产气时联动收集
  const gasSetup = usesGasCollection(apparatus);
  const collecting = Boolean(result?.reacted && result.producesGas);

  // 安全提醒与操作提示（教学反馈）
  const notes = safetyNotes(contents);
  const hint = operationHint(contents, result);

  // 实验台模式（导电性 / 电解 / 原电池 / 混合），决定操作界面形态
  const mode = resolveLabMode(
    apparatus,
    reagents.map((r) => resolveSubstance(r)),
  );

  // 导电性对比模式：电导率仪实验，并排比较强 / 弱电解质灯泡亮度
  if (mode === "conductivity") {
    const solutions = reagents
      .map((r) => resolveSubstance(r))
      .filter((s) => s.category !== "metal" && s.category !== "other");
    return (
      <ElectroLab
        apparatus={apparatus}
        infoLine="相同浓度下比较溶液的导电能力（灯泡亮度反映离子浓度）。"
        device={<ConductivityTester solutions={solutions} powered={energized} />}
        caption={energized ? "通电检测中：灯泡越亮，导电能力越强" : "点击「通电检测」，比较各溶液的导电能力"}
        notes={solutions.map((s) => (
          <span key={s.formula}>{conductivity(s).note}</span>
        ))}
        toggleIdleLabel="💡 通电检测"
        toggleActiveLabel="断电"
        energized={energized}
        onToggle={() => setEnergized(!energized)}
        onComplete={complete}
        completed={completed}
      />
    );
  }

  // 电解模式：外加直流电源实验，用电解槽替代混合台
  const electrolyte = reagents
    .map((r) => resolveSubstance(r).formula)
    .find(isElectrolyte);

  if (mode === "electrolysis" && electrolyte) {
    const inert = isInertAnode(apparatus);
    const er = electrolyze(electrolyte, { inertAnode: inert });
    const elyteName = resolveSubstance(
      reagents.find((r) => resolveSubstance(r).formula === electrolyte) ?? "",
    ).name;
    return (
      <ElectroLab
        apparatus={apparatus}
        infoLine={`电解液：${elyteName}（${electrolyte}）·阳极${inert ? "惰性（碳）" : "活性（金属，会溶解）"}`}
        device={<ElectrolysisCell electrolyte={electrolyte} inertAnode={inert} powered={energized} />}
        caption={energized ? "电解进行中…" : "点击「通电」开始电解，观察两极现象"}
        notes={
          er ? (
            <>
              <span className="font-medium text-foreground/80">{er.overall}</span>
              <span>阴极（−）：{er.cathode.observation}</span>
              <span>阳极（＋）：{er.anode.observation}</span>
              {er.colorFades && <span>溶液：蓝色逐渐变浅（铜离子被消耗）</span>}
            </>
          ) : undefined
        }
        toggleIdleLabel="⚡ 通电"
        toggleActiveLabel="断电"
        energized={energized}
        onToggle={() => setEnergized(!energized)}
        onComplete={complete}
        completed={completed}
      />
    );
  }

  // 原电池 / 电化学腐蚀模式：两金属 + 电解液，「连接电路」自发放电
  const galvanicMetals = reagents
    .map((r) => resolveSubstance(r))
    .filter((s) => isGalvanicMetal(s.formula));
  if (mode === "galvanic") {
    const acidR = reagents
      .map((r) => resolveSubstance(r))
      .find((s) => s.category === "acid");
    const saltR = reagents
      .map((r) => resolveSubstance(r))
      .find((s) => /食盐|盐水/.test(s.name) || s.formula === "NaCl");
    const electrolyte = acidR ?? saltR ?? { formula: "NaCl", name: "食盐水" };
    const gr = galvanicCell(
      galvanicMetals.map((m) => m.formula),
      electrolyte,
    );
    return (
      <ElectroLab
        apparatus={apparatus}
        infoLine={`电解质：${electrolyte.name}`}
        device={
          <GalvanicCell
            metals={galvanicMetals.map((m) => m.formula)}
            electrolyte={electrolyte}
            connected={energized}
          />
        }
        caption={energized ? "电路接通，电流计偏转，原电池放电中…" : "点击「接通电路」，观察电流计偏转与两极现象"}
        notes={
          gr ? (
            <>
              <span>负极（−）：{gr.negative.observation}</span>
              <span>正极（＋）：{gr.positive.observation}</span>
              <span>{gr.electronFlow}；{gr.current}</span>
            </>
          ) : undefined
        }
        toggleIdleLabel="🔌 接通电路"
        toggleActiveLabel="断开电路"
        energized={energized}
        onToggle={() => setEnergized(!energized)}
        onComplete={complete}
        completed={completed}
      />
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-[240px_1fr]">
      {/* —— 试剂面板 —— */}
      <aside className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground/70">试剂架</h2>
        <ul className="flex flex-col gap-2">
          {reagents.map((label) => {
            const color = CATEGORY_COLOR[resolveSubstance(label).category];
            const inUse = contents.some(
              (c) => c.formula === resolveSubstance(label).formula,
            );
            return (
              <li key={label}>
                <button
                  type="button"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData(DRAG_KEY, label)}
                  onClick={() => pour(label)}
                  className={`group flex w-full cursor-grab items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm shadow-soft transition-all active:scale-[0.98] active:cursor-grabbing ${
                    inUse
                      ? "border-brand-400/50 bg-brand-500/8"
                      : "border-foreground/15 bg-surface/70 hover:border-brand-400/50 hover:bg-brand-500/5"
                  }`}
                >
                  <BottleIcon color={color} />
                  <span className="flex-1">{label}</span>
                  <span className="text-xs text-brand-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-brand-300">
                    {inUse ? "已加" : "+ 加入"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <h2 className="mt-2 text-sm font-semibold text-foreground/70">仪器</h2>
        <ul className="flex flex-wrap gap-2">
          {apparatus.map((label) => (
            <li
              key={label}
              className="rounded-full border border-foreground/15 bg-surface/50 px-2.5 py-1 text-xs text-foreground/70"
            >
              {label}
            </li>
          ))}
        </ul>
      </aside>

      {/* —— 画布主区 —— */}
      <section className="flex flex-col gap-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl border p-6 transition-all ${
            dragOver
              ? "border-brand-400 bg-brand-500/8 scale-[1.01]"
              : "border-foreground/12 bg-gradient-to-b from-surface/30 to-brand-500/[0.04]"
          }`}
        >
          {/* 实验台台面投影 */}
          <div className="pointer-events-none absolute bottom-9 h-4 w-44 rounded-[100%] bg-foreground/10 blur-md" />
          <div className="flex items-end justify-center gap-1">
            <Glassware
              kind={vessel}
              result={result}
              fill={fill}
              tint={tint}
              hot={readings.temperature >= 55}
            />
            {gasSetup && <GasCollection collecting={collecting} />}
          </div>

          {/* 容器内试剂标签（可移除） */}
          <div className="flex min-h-[2rem] flex-wrap items-center justify-center gap-2">
            {contents.length === 0 ? (
              <p className="text-xs text-foreground/45">
                点击左侧试剂瓶或拖拽至此加入容器
              </p>
            ) : (
              contents.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => removeReagent(c.formula)}
                  title="点击移除"
                  className="group flex items-center gap-1.5 rounded-full border border-foreground/15 bg-surface/80 px-3 py-1 text-xs shadow-soft transition-colors hover:border-rose-400/50 hover:bg-rose-500/5"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: CATEGORY_COLOR[c.category] }}
                  />
                  {c.name}
                  <span className="text-foreground/30 transition-colors group-hover:text-rose-500">
                    ×
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* 实时读数 */}
        <div className="grid grid-cols-2 gap-3">
          <Reading label="pH" value={readings.ph.toFixed(1)} />
          <Reading label="温度" value={`${readings.temperature} ℃`} />
        </div>

        {/* 操作参数：加热 / 冷却体系温度（借鉴 mathviz 参数面板） */}
        <ControlPanel
          title="操作参数"
          params={[
            {
              key: "temperature",
              label: "加热温度",
              value: readings.temperature,
              min: 0,
              max: 100,
              step: 1,
              unit: "℃",
            },
          ]}
          onChange={(_, v) => setTemperature(v)}
        />

        {/* 安全提醒：加入危险试剂时给出真实安全规范 */}
        {notes.length > 0 && (
          <ul className="flex flex-col gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/8 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
            {notes.map((n) => (
              <li key={n} className="flex gap-2">
                <span aria-hidden>⚠️</span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
        )}

        {/* 操作提示：混合无反应时的引导 */}
        {hint && (
          <p className="flex gap-2 rounded-lg border border-sky-500/25 bg-sky-500/8 px-4 py-3 text-sm text-sky-700 dark:text-sky-300">
            <span aria-hidden>💡</span>
            <span>{hint}</span>
          </p>
        )}

        {/* 现象描述 */}
        {result && (
          <p
            className={`rounded-lg px-4 py-3 text-sm ${
              result.reacted
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "bg-foreground/5 text-foreground/60"
            }`}
          >
            {result.equation ? `${result.equation}　` : ""}
            {result.description}
          </p>
        )}

        {/* 操作按钮 */}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={mix}
            disabled={contents.length < 2}
            className="rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-5 py-2.5 text-sm font-medium text-white shadow-soft transition-all hover:shadow-glow active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-soft"
          >
            混合反应
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-xl border border-foreground/20 px-5 py-2.5 text-sm font-medium transition-colors hover:border-brand-400/50 hover:bg-brand-500/5 active:scale-[0.98]"
          >
            清空容器
          </button>
          <button
            type="button"
            onClick={complete}
            disabled={completed || !result}
            className="rounded-xl border border-emerald-500/40 px-5 py-2.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-500/10 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 dark:text-emerald-300"
          >
            {completed ? "实验已完成" : "完成实验"}
          </button>
        </div>
      </section>
    </div>
  );
}

// 试剂瓶迷你图标：玻璃瓶内盛对应颜色液体
function BottleIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="22" viewBox="0 0 18 22" aria-hidden="true">
      <path
        d="M6 1 h6 v4 l3 6 v8 a2 2 0 0 1 -2 2 H5 a2 2 0 0 1 -2 -2 v-8 l3 -6 Z"
        fill="rgba(255,255,255,0.5)"
        stroke="currentColor"
        strokeWidth="1"
        className="text-foreground/40"
      />
      <path
        d="M4 13 h10 v6 a2 2 0 0 1 -2 2 H6 a2 2 0 0 1 -2 -2 Z"
        fill={color}
      />
    </svg>
  );
}

// 单个读数卡片
function Reading({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-foreground/15 bg-surface/60 px-4 py-3 shadow-soft">
      <span className="text-xs text-foreground/50">{label}</span>
      <span className="bg-gradient-to-r from-brand-500 to-brand-700 bg-clip-text text-2xl font-semibold tabular-nums text-transparent">
        {value}
      </span>
    </div>
  );
}
