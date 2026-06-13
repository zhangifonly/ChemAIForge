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

// 预生成音频的公开路径（public/ 下，浏览器可直接请求）
export function audioSrc(text: string): string {
  return `/audio/lesson/${audioKey(text)}.mp3`;
}
