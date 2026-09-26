// API 错误消息的按语言取词。
//
// 只覆盖用户真会看到的那几条（如"还没有任何操作记录"）。
// 入参校验失败、实验不存在这类是"不该发生"的情形，翻译它们既无收益，
// 又要让每个路由都处理语言 —— 保持中文，出现时本就是要查日志的。
import { plainT, loadMessagesFor } from "./plainT";

export async function errorText(key: string, locale: string): Promise<string> {
  const messages = await loadMessagesFor(locale);
  return plainT(messages, "errors")(key);
}
