"use client";

// 现象译文表的客户端载体。
//
// 现象描述出现在实验台（客户端组件）里：混合后的现象条、电极观察、讲解口播。
// 这些地方拿到的是引擎刚算出的中文文本，需要同步换成当前语言 ——
// 异步查表会让现象文字比画面晚一帧出现，看起来像闪烁。
//
// 表由服务端组件装载后注入：整张表约 550 条，只有当前语言那一份会进客户端包，
// 60 个语种不会都打进去。
import { createContext, useContext, type ReactNode } from "react";
import { localizePhraseWith } from "./phenomena";

type Phrases = Record<string, string>;

const PhenomenaContext = createContext<Phrases | null>(null);

/**
 * 当前语言的试剂 / 仪器术语表（中文名 → 译名）。
 *
 * 与现象表同走一个 Provider：两者都是"引擎给出中文、展示层换成当前语言"，
 * 且都只在实验台页面用到。拆成两个 Provider 只是多一层嵌套。
 */
const TermsContext = createContext<Phrases | null>(null);

export function PhenomenaProvider({
  phrases,
  terms = null,
  children,
}: {
  phrases: Phrases | null;
  terms?: Phrases | null;
  children: ReactNode;
}) {
  return (
    <PhenomenaContext.Provider value={phrases}>
      <TermsContext.Provider value={terms}>{children}</TermsContext.Provider>
    </PhenomenaContext.Provider>
  );
}

/** 取当前语言的术语表；源语言或未注入时为 null（调用方原样显示中文名） */
export function useTerms(): Phrases | null {
  return useContext(TermsContext);
}

/** 取一个把中文试剂 / 仪器名换成当前语言的函数 */
export function useTerm(): (zh: string) => string {
  const map = useContext(TermsContext);
  return (zh: string) => map?.[zh] ?? zh;
}

/**
 * 取一个把中文现象文本换成当前语言的函数。
 *
 * 查不到就原样返回中文 —— 规则文案改过、或该语种还没翻译完时都会这样，
 * 显示中文原文比显示空白或键名有用。
 */
export function usePhrase(): (text: string | undefined) => string {
  const map = useContext(PhenomenaContext);
  // 接受 undefined：现象描述在"未反应"等情形下本就可能缺省，
  // 让每个调用点各写一遍 ?? "" 只是把同一件事重复十遍
  return (text: string | undefined) => (text ? localizePhraseWith(text, map) : "");
}
