// 语音合成引擎路由：每个语种由哪个引擎、哪个声音来念。
//
// 为什么不止 edge-tts：它的 322 个音色覆盖 57 个规划语种，剩下三个要另想办法。
// 选型全部靠客观评测（scripts/tts-eval.mjs：合成 → whisper large-v3-turbo 转写 →
// 与原文比对），而不是凭听感 —— 这几种语言我们没人听得懂。
//
//   tl 他加禄语  edge Multilingual 音色直接朗读    CER 2.6% / 3.2%（借印尼语音色 7.8%）
//   hy 亚美尼亚语 Piper hy_AM-gor（本地 ONNX 推理）  两句评测里第二句近乎逐字正确；
//                espeak-ng 同句被识别成乱码，故不用
//   pa 旁遮普语  VITS-OpenBible-Punjabi（Coqui，CC-BY-SA 4.0 可商用须署名）
//                三句口播全部可懂，读音与 Google 参照接近。Indic-Parler-TTS 需逐账号审批；
//                MMS-TTS 为 CC-BY-NC 不可商用；espeak-ng 识别不回原文
import { LOCALE_VOICES, PIPER_LOCALES, VITS_LOCALES, type VoiceGender } from "@/components/lab/lesson/audioKey";

export type EngineRoute =
  | { engine: "edge"; voice: string }
  | { engine: "piper"; model: string }
  | { engine: "vits"; model: string };

/**
 * Piper 模型。只有一个说话人，男女声共用 —— 界面上仍给出男女声选择，
 * 选哪个都是同一个声音，比隐藏选项让界面在不同语种间跳变更好。
 */
const PIPER_MODELS: Record<(typeof PIPER_LOCALES)[number], string> = {
  hy: "hy/hy_AM/gor/medium/hy_AM-gor-medium.onnx",
};

/** VITS 模型目录名（相对 VITS_MODEL_DIR）。同样是单说话人，男女声共用 */
const VITS_MODELS: Record<(typeof VITS_LOCALES)[number], string> = {
  pa: "pa-vits",
};

/** 该语种该性别由谁来念；返回 null 表示没有任何引擎可用 */
export function routeFor(locale: string, gender: VoiceGender): EngineRoute | null {
  const edge = LOCALE_VOICES[locale];
  if (edge) return { engine: "edge", voice: edge[gender] };
  const piper = PIPER_MODELS[locale as (typeof PIPER_LOCALES)[number]];
  if (piper) return { engine: "piper", model: piper };
  const vits = VITS_MODELS[locale as (typeof VITS_LOCALES)[number]];
  if (vits) return { engine: "vits", model: vits };
  return null;
}

/** 是否有引擎能念这个语种 */
export function hasVoice(locale: string): boolean {
  return routeFor(locale, "female") !== null;
}

/** 全部有语音的语种（供测试与生成脚本使用） */
export function voicedLocales(): string[] {
  return [
    ...new Set([
      ...Object.keys(LOCALE_VOICES),
      ...Object.keys(PIPER_MODELS),
      ...Object.keys(VITS_MODELS),
    ]),
  ];
}
