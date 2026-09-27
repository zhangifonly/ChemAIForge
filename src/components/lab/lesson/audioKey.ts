// 口播文本 → 稳定音频文件名的映射（纯函数）。客户端与 TTS 生成脚本共用，
// 保证两端命名一致：同一句文本永远对应同一个 mp3 文件。
// 采用 FNV-1a 32 位哈希转 8 位十六进制，无依赖、确定、足够低碰撞。

export function audioKey(text: string): string {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    // FNV prime 16777619，用 Math.imul 做 32 位无符号乘法
    hash = Math.imul(hash, 0x01000193);
  }
  // 转为无符号并补齐 8 位十六进制
  return (hash >>> 0).toString(16).padStart(8, "0");
}

// 讲解语音音色（与 mathviz 一致：晓晓女声 / 云希男声）
export type VoiceRole = "xiaoxiao" | "yunxi";

// 音色 → 微软 Edge TTS 声音名（生成脚本用）
export const VOICE_EDGE: Record<VoiceRole, string> = {
  xiaoxiao: "zh-CN-XiaoxiaoNeural",
  yunxi: "zh-CN-YunxiNeural",
};

/**
 * 各语言的一男一女音色（Edge TTS 声音名）。
 *
 * 覆盖 57 个规划语种 —— edge-tts 的 322 个音色里，亚美尼亚语、旁遮普语、
 * 菲律宾语没有对应声音，这三个走浏览器内置合成（见 hasPregeneratedVoice）。
 *
 * 地区变体按该语言最主流的一支取（中文 zh-CN、英语 en-US、葡语 pt-BR…），
 * 有 Multilingual 音色时优先用它（音质更好、跨语言语调一致）。
 * 中文必须保持 Xiaoxiao/Yunxi：现有 2700 个 mp3 是用它们生成的，
 * 换音色会让全部文件失配、必须重跑。
 */
export const LOCALE_VOICES: Record<string, { female: string; male: string }> = {
  am: { female: "am-ET-MekdesNeural", male: "am-ET-AmehaNeural" },
  ar: { female: "ar-SA-ZariyahNeural", male: "ar-SA-HamedNeural" },
  bg: { female: "bg-BG-KalinaNeural", male: "bg-BG-BorislavNeural" },
  bn: { female: "bn-BD-NabanitaNeural", male: "bn-BD-PradeepNeural" },
  bs: { female: "bs-BA-VesnaNeural", male: "bs-BA-GoranNeural" },
  ca: { female: "ca-ES-JoanaNeural", male: "ca-ES-EnricNeural" },
  cs: { female: "cs-CZ-VlastaNeural", male: "cs-CZ-AntoninNeural" },
  da: { female: "da-DK-ChristelNeural", male: "da-DK-JeppeNeural" },
  de: { female: "de-DE-SeraphinaMultilingualNeural", male: "de-DE-FlorianMultilingualNeural" },
  el: { female: "el-GR-AthinaNeural", male: "el-GR-NestorasNeural" },
  en: { female: "en-US-AvaMultilingualNeural", male: "en-US-AndrewMultilingualNeural" },
  es: { female: "es-ES-XimenaNeural", male: "es-ES-AlvaroNeural" },
  et: { female: "et-EE-AnuNeural", male: "et-EE-KertNeural" },
  fa: { female: "fa-IR-DilaraNeural", male: "fa-IR-FaridNeural" },
  fi: { female: "fi-FI-NooraNeural", male: "fi-FI-HarriNeural" },
  fr: { female: "fr-FR-VivienneMultilingualNeural", male: "fr-FR-RemyMultilingualNeural" },
  gu: { female: "gu-IN-DhwaniNeural", male: "gu-IN-NiranjanNeural" },
  hi: { female: "hi-IN-SwaraNeural", male: "hi-IN-MadhurNeural" },
  hr: { female: "hr-HR-GabrijelaNeural", male: "hr-HR-SreckoNeural" },
  hu: { female: "hu-HU-NoemiNeural", male: "hu-HU-TamasNeural" },
  id: { female: "id-ID-GadisNeural", male: "id-ID-ArdiNeural" },
  is: { female: "is-IS-GudrunNeural", male: "is-IS-GunnarNeural" },
  it: { female: "it-IT-ElsaNeural", male: "it-IT-GiuseppeMultilingualNeural" },
  ja: { female: "ja-JP-NanamiNeural", male: "ja-JP-KeitaNeural" },
  ka: { female: "ka-GE-EkaNeural", male: "ka-GE-GiorgiNeural" },
  kk: { female: "kk-KZ-AigulNeural", male: "kk-KZ-DauletNeural" },
  kn: { female: "kn-IN-SapnaNeural", male: "kn-IN-GaganNeural" },
  ko: { female: "ko-KR-SunHiNeural", male: "ko-KR-HyunsuMultilingualNeural" },
  lt: { female: "lt-LT-OnaNeural", male: "lt-LT-LeonasNeural" },
  lv: { female: "lv-LV-EveritaNeural", male: "lv-LV-NilsNeural" },
  mk: { female: "mk-MK-MarijaNeural", male: "mk-MK-AleksandarNeural" },
  ml: { female: "ml-IN-SobhanaNeural", male: "ml-IN-MidhunNeural" },
  mn: { female: "mn-MN-YesuiNeural", male: "mn-MN-BataaNeural" },
  mr: { female: "mr-IN-AarohiNeural", male: "mr-IN-ManoharNeural" },
  ms: { female: "ms-MY-YasminNeural", male: "ms-MY-OsmanNeural" },
  my: { female: "my-MM-NilarNeural", male: "my-MM-ThihaNeural" },
  nb: { female: "nb-NO-PernilleNeural", male: "nb-NO-FinnNeural" },
  nl: { female: "nl-NL-ColetteNeural", male: "nl-NL-MaartenNeural" },
  pl: { female: "pl-PL-ZofiaNeural", male: "pl-PL-MarekNeural" },
  pt: { female: "pt-BR-ThalitaMultilingualNeural", male: "pt-BR-AntonioNeural" },
  ro: { female: "ro-RO-AlinaNeural", male: "ro-RO-EmilNeural" },
  ru: { female: "ru-RU-SvetlanaNeural", male: "ru-RU-DmitryNeural" },
  sk: { female: "sk-SK-ViktoriaNeural", male: "sk-SK-LukasNeural" },
  sl: { female: "sl-SI-PetraNeural", male: "sl-SI-RokNeural" },
  so: { female: "so-SO-UbaxNeural", male: "so-SO-MuuseNeural" },
  sq: { female: "sq-AL-AnilaNeural", male: "sq-AL-IlirNeural" },
  sr: { female: "sr-RS-SophieNeural", male: "sr-RS-NicholasNeural" },
  sv: { female: "sv-SE-SofieNeural", male: "sv-SE-MattiasNeural" },
  sw: { female: "sw-KE-ZuriNeural", male: "sw-KE-RafikiNeural" },
  ta: { female: "ta-IN-PallaviNeural", male: "ta-IN-ValluvarNeural" },
  te: { female: "te-IN-ShrutiNeural", male: "te-IN-MohanNeural" },
  th: { female: "th-TH-PremwadeeNeural", male: "th-TH-NiwatNeural" },
  // 他加禄语 edge-tts 没有原生音色，借 Multilingual 音色直接朗读他加禄语文本。
  // 选型靠客观评测而非听感（scripts/tts-eval.mjs：合成后用 whisper large-v3-turbo
  // 转写回文本比对）：Brian 2.6%、Ava 3.2% 字符错误率，远好于借印尼语(7.8%)、
  // 马来语(17.5%)、西语(18.8%)音色。
  tl: { female: "en-US-AvaMultilingualNeural", male: "en-US-BrianMultilingualNeural" },
  tr: { female: "tr-TR-EmelNeural", male: "tr-TR-AhmetNeural" },
  uk: { female: "uk-UA-PolinaNeural", male: "uk-UA-OstapNeural" },
  // 乌尔都语取 ur-PK 而非 ur-IN：它是巴基斯坦国语，印度只是少数语言之一。
  // 自动挑选时两地音色数相同，按字母序落到了 IN —— 口音就偏了
  ur: { female: "ur-PK-UzmaNeural", male: "ur-PK-AsadNeural" },
  vi: { female: "vi-VN-HoaiMyNeural", male: "vi-VN-NamMinhNeural" },
  zh: { female: "zh-CN-XiaoxiaoNeural", male: "zh-CN-YunxiNeural" },
};


/** 音色性别。界面上的选择是"男声/女声"，与具体是哪个声音无关 */
export type VoiceGender = "female" | "male";

/**
 * 不走 edge-tts、由本地 Piper 模型合成的语种（见 src/server/tts/engines.ts 的评测记录）。
 * 放在这里而不是只放服务端：播放器要据此决定"显示男女声选择"还是"提示暂无语音"，
 * 两边判定不一致就会出现"界面说有语音、点了却不出声"。
 */
export const PIPER_LOCALES = ["hy"] as const;

/** 由本地 VITS 模型（Coqui）合成的语种，理由同上 */
export const VITS_LOCALES = ["pa"] as const;

/** 该语种是否有语音（任一引擎）。客户端与服务端共用这一个判定 */
export function hasVoice(locale: string): boolean {
  return (
    locale in LOCALE_VOICES ||
    (PIPER_LOCALES as readonly string[]).includes(locale) ||
    (VITS_LOCALES as readonly string[]).includes(locale)
  );
}

/**
 * 全部有语音的语种（edge + Piper + VITS）。
 *
 * 翻译脚本的 --voiced 与内容类守卫测试都必须用这个，而不是 Object.keys(LOCALE_VOICES)：
 * 后者只含 edge 语种，漏掉亚美尼亚语与旁遮普语 —— 它们于是没有内容译文，
 * 页面显示英文，讲解则用亚美尼亚语音色去念英文，TTS 形同虚设。
 */
export function voicedLocaleCodes(): string[] {
  return [...Object.keys(LOCALE_VOICES), ...PIPER_LOCALES, ...VITS_LOCALES];
}

/** @deprecated 旧名，等同 hasVoice */
export const hasPregeneratedVoice = hasVoice;

/**
 * 预生成音频的公开路径。
 *
 * 中文沿用原来的 `<voice>/<hash>.mp3` 不带语言层：已有 2700 个文件在那里，
 * 为加语言维度而全部挪位置，除了制造一次大规模改动之外没有别的好处。
 * 其余语种用 `<locale>/<gender>/<hash>.mp3`。
 */
export function audioSrc(
  text: string,
  gender: VoiceGender = "female",
  locale = "zh",
): string {
  const key = audioKey(text);
  if (locale === "zh") {
    return `/audio/lesson/${gender === "female" ? "xiaoxiao" : "yunxi"}/${key}.mp3`;
  }
  return `/audio/lesson/${locale}/${gender}/${key}.mp3`;
}
