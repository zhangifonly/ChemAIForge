"use client";

// 实验画布交互组件：试剂面板以「彩色试剂瓶」呈现，支持点击即加 / 拖拽两种方式，
// 容器内试剂以可移除标签显示，液面随试剂量上升；点击混合触发反应引擎，
// 由 Glassware 按实验仪器以立体 SVG（烧杯/锥形瓶/试管）渲染变色/气泡/沉淀/蒸汽与读数。
// 反应判定一律委托 src/lib/chem/engine，本组件不含任何反应规则。
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { totalVolume, useLabStore } from "./labStore";
import { resolveSubstance } from "./reagents";
import { ReagentShelf } from "./ReagentShelf";
import { CATEGORY_COLOR, shelfEntries } from "./shelfEntries";
import { InstrumentDeck, ReadingHud } from "./InstrumentDeck";
import { Glassware } from "./Glassware";
import { GasCollection } from "./GasCollection";
import { GasDelivery } from "./GasDelivery";
import { FlameTest } from "./FlameTest";
import { ElectrolysisCell } from "./ElectrolysisCell";
import { GalvanicCell } from "./GalvanicCell";
import { ConductivityTester } from "./ConductivityTester";
import { ElectroLab } from "./ElectroLab";
import { resolveLabMode } from "./labMode";
import {
  usesGasCollection,
  usesGasDelivery,
  usesFlameTest,
  isInertAnode,
  hasHeatSource,
} from "./vesselGeom";
// 器皿选型用 3D 与讲解共用的那一份，2D 不再自成一套（否则同一实验切视图会换器皿）
import { chooseVessel, planRig, pickFlameSample } from "@/lib/chem/scenePlan";
// 溶质色表用 3D 共用的那一份（原本这里有个只 13 项的私有副本）
import { SOLUTION_TINT } from "@/lib/chem/appearance";
import { electrolyze, isElectrolyte } from "@/lib/chem/electrolysis";
import { galvanicCell, isGalvanicMetal } from "@/lib/chem/galvanic";
import { conductivity } from "@/lib/chem/conductivity";
import { ControlPanel } from "./ControlPanel";
import { safetyNotes, operationHint } from "./safety";
import { usePhrase, useTerm, useTerms } from "@/lib/i18n/PhenomenaProvider";

const DRAG_KEY = "application/x-reagent";

// 试剂瓶类别配色与试剂架条目构造在 shelfEntries.ts，与 3D 视图共用。

// 溶质特征色不在本文件维护：这里原有一份只 13 项的私有副本，
// 而 appearance.ts 的共用表有 90 多项且 3D 用的就是它。差集里最扎眼的是溴水
// （Br₂，涉及 12 个实验）—— 橙棕在 2D 里被画成无色澄清，而「溴水褪色」正是
// 这些实验的全部看点：反应前后都无色，学生什么也看不出来，切到 3D 又是对的。
// 共计 58 个实验因这份副本在两个视图里颜色不一致。

export function LabCanvas({
  reagents,
  apparatus,
}: {
  reagents: string[];
  apparatus: string[];
}) {
  const {
    contents,
    result,
    readings,
    completed,
    sessionId,
    addReagent,
    removeReagent,
    setTemperature,
    energized,
    setEnergized,
    mix,
    reset,
    complete,
  } = useLabStore();
  const t = useTranslations("lab");
  const tElectro = useTranslations("electro");
  const tRig = useTranslations("rig");
  const phrase = usePhrase();
  const terms = useTerms();
  const term = useTerm();
  // 拖拽悬停高亮容器
  const [dragOver, setDragOver] = useState(false);

  // 会话绑定已上移到 LabWorkbench（3D 视图下本组件不挂载，放这里会漏），
  // 本组件只负责 2D 画布的呈现与交互。

  // 解析标签并入容器（试剂架 / 拖拽共用）；dose 省略时按规格默认量
  const pour = (label: string, dose?: number) =>
    addReagent(resolveSubstance(label), dose);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const label = e.dataTransfer.getData(DRAG_KEY);
    if (label) pour(label);
  };

  // 容器内首个具有特征色的溶质决定液体色泽（混合前即呈现真实色彩）。
  // 保持返回 undefined 而不用 mixedTint：Glassware 靠 tint 是否存在来区分
  // 「有特征色」与「无色」，无色时它走自己的默认淡蓝，且 reacted && !tint
  // 那条分支也依赖这个区分。mixedTint 无色时返回 CLEAR_TINT（真值）会把两者混为一谈。
  const tint = contents.map((c) => SOLUTION_TINT[c.formula]).find(Boolean);

  // 按实验仪器与装置类型选择器皿造型（试管 / 锥形瓶 / 烧杯），与 3D 场景同源
  const vessel = chooseVessel(apparatus, planRig(apparatus).kind);

  // 器皿容量（mL）：液面按「实际体积 / 容量」算，不再按试剂个数跳台阶。
  // 原来 0.28 + 个数×0.16 意味着"加 2 mL 和加 25 mL 一样高"，
  // 这正是定量做不真的地方 —— 学生看不出自己取多了还是取少了。
  const capacity = vessel === "tube" ? 20 : vessel === "flask" ? 150 : 100;
  const volume = totalVolume(contents);
  // 固体不占体积，但只有固体时也要看得见：给个最低可见液面
  const fill =
    contents.length === 0
      ? 0
      : Math.max(0.12, Math.min(0.88, volume / capacity));
  // 产气类实验：显示排水法集气装置，反应产气时联动收集
  const gasSetup = usesGasCollection(apparatus);
  const collecting = Boolean(result?.reacted && result.producesGas);
  // 导气→吸收/检验类：主容器产气经导管通入接收瓶吸收液
  const deliverySetup = usesGasDelivery(apparatus, reagents);
  // 焰色反应：铂丝蘸金属盐灼烧，火焰随所选金属离子变色
  const flameSetup = usesFlameTest(apparatus);
  // 「正在外部加热」= 配有热源 且 体系已到明显高温。只看温度会让中和热测定这类
  // 无热源实验在拖动温度滑块时凭空冒出一盏酒精灯。
  const heating = hasHeatSource(apparatus) && readings.temperature >= 55;
  // 焰色样品必须挑「含焰色金属的那一个」，不能取 contents[0]。
  // 焰色实验的试剂架里除金属盐外总还有盐酸（洗铂丝的标准操作）或蒸馏水，
  // 取首个投入的试剂时，学生先点盐酸就永久看到酒精灯蓝色本色 ——
  // 氯化锂焰色那个实验只有「氯化锂 + 蒸馏水」两味，先点水就全无看点。
  // 用 3D 那边同一个 pickFlameSample，两个视图的焰色才不会各说一套。
  const flameSample = pickFlameSample(contents) ?? undefined;
  // 接收瓶吸收液名称（从仪器/试剂里识别）
  const absorbentLabel =
    [...apparatus, ...reagents].find((s) =>
      /饱和碳酸钠|碳酸钠溶液|石灰水|氢氧化钙|溴水|硝酸银|高锰酸钾溶液|品红/.test(s),
    ) ?? t("absorbent");

  // 试剂架条目：中文标签 + 解析出的规格（浓度/密度/摩尔质量）+ 类别配色
  const shelf = shelfEntries(reagents, terms);

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
        infoLine={tElectro("conductivityDesc")}
        device={<ConductivityTester solutions={solutions} powered={energized} />}
        caption={tElectro(energized ? "conductivityActive" : "conductivityIdle")}
        notes={solutions.map((s) => (
          <span key={s.formula}>{conductivity(s).note}</span>
        ))}
        toggleIdleLabel={tElectro("conductivityOn")}
        toggleActiveLabel={tElectro("powerOff")}
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
        infoLine={tElectro(inert ? "electrolyteInert" : "electrolyteActive", { name: elyteName, formula: electrolyte })}
        device={<ElectrolysisCell electrolyte={electrolyte} inertAnode={inert} powered={energized} />}
        caption={tElectro(energized ? "electrolysisActive" : "electrolysisIdle")}
        notes={
          er ? (
            <>
              <span className="font-medium text-foreground/80">{phrase(er.overall)}</span>
              <span>{tElectro("cathode")}：{phrase(er.cathode.observation)}</span>
              <span>{tElectro("anode")}：{phrase(er.anode.observation)}</span>
              {er.colorFades && <span>{tElectro("copperFading")}</span>}
            </>
          ) : undefined
        }
        toggleIdleLabel={tElectro("powerOn")}
        toggleActiveLabel={tElectro("powerOff")}
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
    const electrolyte = acidR ?? saltR ?? { formula: "NaCl", name: tElectro("brine") };
    const gr = galvanicCell(
      galvanicMetals.map((m) => m.formula),
      electrolyte,
    );
    return (
      <ElectroLab
        apparatus={apparatus}
        infoLine={tElectro("electrolyte", { name: electrolyte.name })}
        device={
          <GalvanicCell
            metals={galvanicMetals.map((m) => m.formula)}
            electrolyte={electrolyte}
            connected={energized}
          />
        }
        caption={tElectro(energized ? "cellActive" : "cellIdle")}
        notes={
          gr ? (
            <>
              <span>{tElectro("negative")}：{phrase(gr.negative.observation)}</span>
              <span>{tElectro("positive")}：{phrase(gr.positive.observation)}</span>
              <span>{phrase(gr.electronFlow)}；{gr.current}</span>
            </>
          ) : undefined
        }
        toggleIdleLabel={tElectro("cellOn")}
        toggleActiveLabel={tElectro("cellOff")}
        energized={energized}
        onToggle={() => setEnergized(!energized)}
        onComplete={complete}
        completed={completed}
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[248px_minmax(0,1fr)]">
      {/* —— 试剂面板 —— */}
      <aside className="flex min-w-0 flex-col gap-3">
        <ReagentShelf
          entries={shelf}
          contents={contents}
          onTake={(e, dose) => pour(e.label, dose)}
        />

        {/* 仪器清单仍以标签呈现（它是实验配备的说明），但可做的动作已由它派生到
            台面下方的「实验操作」栏 —— 标签本身不再假装可点。 */}
        <h2 className="mt-2 text-sm font-semibold text-foreground/70">
          {t("apparatusList")}
        </h2>
        <ul className="flex flex-wrap gap-1.5">
          {apparatus.map((label) => (
            <li
              key={label}
              className="rounded-md border border-foreground/12 bg-surface/40 px-2 py-0.5 text-[11px] text-foreground/60"
            >
              {term(label)}
            </li>
          ))}
        </ul>
      </aside>

      {/* —— 实验台主区 —— */}
      <section className="flex min-w-0 flex-col gap-4">
        {/* 台面是画面主角：原先器皿区只有约 390px 宽、器皿 200px 高，
            挤在层层卡片里像个缩略图。现在台面占满主列、器皿放大到 340px，
            仪表叠在台面一角，操作时视线不必离开器皿。 */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`relative flex min-h-[320px] flex-col items-center justify-end gap-3 overflow-hidden rounded-2xl border px-4 pb-5 pt-16 transition-colors sm:min-h-[380px] sm:px-6 lg:min-h-[480px] ${
            dragOver
              ? "border-brand-400 bg-brand-500/8"
              : "border-foreground/12 bg-gradient-to-b from-slate-100 via-slate-50 to-surface dark:from-slate-900 dark:via-slate-900/70 dark:to-surface"
          }`}
        >
          {/* 台面：一条带高光的实验桌面，器皿立在上面而不是悬浮在卡片里。
              高度对齐器皿底座：SVG 底部留有 44/244 的火焰区，按 260 / 340px 两档
              器皿高度折算，桌面线正好落在杯底投影处 */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[98px] sm:h-[112px] lg:h-[130px] border-t border-foreground/10 bg-gradient-to-b from-foreground/[0.06] to-foreground/[0.02]" />
          <ReadingHud className="absolute start-4 top-4 z-10" />
          <div className="relative z-[1] flex items-end justify-center gap-2 [&_svg]:h-[220px] [&_svg]:w-auto sm:[&_svg]:h-[260px] lg:[&_svg]:h-[340px]">
            {!deliverySetup && !flameSetup && (
              <Glassware
                kind={vessel}
                result={result}
                fill={fill}
                tint={tint}
                hot={heating}
              />
            )}
            {flameSetup && <FlameTest sample={flameSample} />}
            {gasSetup && <GasCollection collecting={collecting} />}
            {deliverySetup && (
              <GasDelivery
                delivering={collecting}
                hot={heating}
                absorbentLabel={absorbentLabel}
              />
            )}
          </div>
          {/* 容器内试剂标签（可移除）：立在台面上，和器皿同处一个视野 */}
          <div className="relative z-[1] flex min-h-[2rem] flex-wrap items-center justify-center gap-2">
            {contents.length === 0 ? (
              <p className="text-xs text-foreground/65">
                {/* 触屏没有拖放，「或拖拽试剂至此」是做不到的操作 */}
                <span className="[@media(pointer:coarse)]:hidden">{t("emptyContainer")}</span>
                <span className="hidden [@media(pointer:coarse)]:inline">{t("emptyContainerTouch")}</span>
              </p>
            ) : (
              contents.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => removeReagent(c.formula)}
                  title={t("removeItem")}
                  className="group flex items-center gap-1.5 rounded-full border border-foreground/15 bg-surface/90 px-3 py-1 text-xs shadow-soft transition-colors hover:border-rose-400/50 hover:bg-rose-500/5"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: CATEGORY_COLOR[c.category] }}
                  />
                  {term(c.name)}
                  {/* 用量与物质的量随标签一起显示：容器里"有什么"和"有多少"
                      在定量实验里是同一个信息，分开呈现学生就得来回对照 */}
                  <span className="tabular-nums text-foreground/65">
                    {c.dose} {c.spec.unit}
                    {c.amount !== undefined
                      ? ` · ${c.amount.toFixed(3)} mol`
                      : ""}
                  </span>
                  <span className="text-foreground/65 transition-colors group-hover:text-rose-500">
                    ×
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
        {/* 主操作紧贴台面：混合是这张台上最核心的一步，不该沉到曲线和表格之下 */}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={mix}
            disabled={contents.length < 2}
            className="rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-5 py-2.5 text-sm font-medium text-white shadow-soft transition-all hover:shadow-glow active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-soft"
          >
            {t("mix")}
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-xl border border-foreground/20 px-5 py-2.5 text-sm font-medium transition-colors hover:border-brand-400/50 hover:bg-brand-500/5 active:scale-[0.98]"
          >
            {t("reset")}
          </button>
          <button
            type="button"
            onClick={complete}
            disabled={completed || !result}
            className="rounded-xl border border-emerald-500/40 px-5 py-2.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-500/10 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 dark:text-emerald-300"
          >
            {completed ? t("completed") : t("complete")}
          </button>
          {/* 完成后给出去报告页的出口：否则用户点完「完成实验」只看到按钮变灰，
              不知道 AI 报告在哪。会话未建立（记录接口失败）时不显示，避免死链。 */}
          {completed && sessionId ? (
            <Link
              href={`/sessions/${sessionId}/report`}
              className="rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-soft transition-all hover:shadow-glow active:scale-[0.98]"
            >
              {t("viewReport")}
            </Link>
          ) : null}
        </div>

        {/* 现象描述 */}
        {result && (
          <p
            className={`rounded-lg px-4 py-3 text-sm ${
              result.reacted
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "bg-foreground/5 text-foreground/60"
            }`}
          >
            {result.equation ? `${phrase(result.equation)}　` : ""}
            {phrase(result.description)}
          </p>
        )}

        {/* 安全提醒：加入危险试剂时给出真实安全规范 */}
        {notes.length > 0 && (
          <ul className="flex flex-col gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/8 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
            {notes.map((n) => (
              <li key={n} className="flex gap-2">
                <span aria-hidden>⚠️</span>
                <span>{phrase(n)}</span>
              </li>
            ))}
          </ul>
        )}

        {/* 操作提示：混合无反应时的引导 */}
        {hint && (
          <p className="flex gap-2 rounded-lg border border-sky-500/25 bg-sky-500/8 px-4 py-3 text-sm text-sky-700 dark:text-sky-300">
            <span aria-hidden>💡</span>
            <span>{phrase(hint)}</span>
          </p>
        )}

        {/* 实验操作 + 过程曲线 + 数据记录表（与 3D 视图共用） */}
        <InstrumentDeck apparatus={apparatus} />

        {/* 体系温度：阶梯式的加热/冷却交给操作按钮，这里保留精确设定能力 */}
        <ControlPanel
          title={t("conditions")}
          params={[
            {
              key: "temperature",
              label: t("temperature"),
              value: readings.temperature,
              min: 0,
              max: 100,
              step: 1,
              unit: "℃",
            },
          ]}
          onChange={(_, v) => setTemperature(v)}
        />
      </section>
    </div>
  );
}
