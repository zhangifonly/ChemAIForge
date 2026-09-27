// 讲解口播的时长估算（纯函数，便于测试）。
//
// 单独成文件是因为本项目的 vitest 没配 JSX 转换，从 .tsx 导出的函数无法被
// 测试导入 —— 而这段逻辑正是最需要测试的：估算偏离会让讲解每步都干等，
// 或者话没说完就翻页。
/** 按文字系统区分每字符耗时 */
const MS_PER_CJK_CHAR = 260;
const MS_PER_LATIN_CHAR = 55;
/** 一步至少停留多久：太短的句子也要给人看清字幕的时间 */
const MIN_MS = 4000;

/** 文本是否以汉字 / 假名 / 谚文为主（一字一音节） */
export function isSyllabicScript(text: string): boolean {
  return /[　-鿿가-힯]/.test(text);
}

/**
 * 估算一句口播的播放时长。
 *
 * 汉字一字一音节约 260ms；拉丁字母一个字母远不到一个音节 ——
 * 同一句话的英译本字符数是中文的五倍（实测全库口播：中文 4.4 万字符、
 * 英文 22.9 万），两者用同一个系数会让英语讲解每步干等一分多钟。
 */
export function estimateNarrationMs(text: string, rate = 1): number {
  const perChar = isSyllabicScript(text) ? MS_PER_CJK_CHAR : MS_PER_LATIN_CHAR;
  return Math.max(MIN_MS, (text.length / rate) * perChar);
}

/**
 * 语音合成的语言标签。
 *
 * 多数语言用 BCP 47 主标签即可，少数需带地区才能让浏览器挑到语音：
 * 中文不写地区可能落到粤语，葡语与巴西葡语发音差别明显。
 */
const SPEECH_LANG: Record<string, string> = {
  zh: "zh-CN",
  en: "en-US",
  pt: "pt-BR",
  ar: "ar-SA",
};

/** 取该语言用于 SpeechSynthesisUtterance.lang 的标签 */
export function speechLang(locale: string): string {
  return SPEECH_LANG[locale] ?? locale;
}
