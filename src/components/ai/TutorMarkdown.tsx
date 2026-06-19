"use client";

// AI 导师回答的 Markdown 渲染：把模型输出的 markdown 渲染为带格式的富文本
// （标题/列表/表格/代码/加粗等），用 Tailwind Typography(prose) 美化，适配品牌色与暗色。
// 流式场景下随增量文本重渲染。
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function TutorMarkdown({ content }: { content: string }) {
  return (
    <div
      className="prose prose-sm max-w-none dark:prose-invert
        prose-p:my-1.5 prose-p:leading-relaxed
        prose-headings:mt-3 prose-headings:mb-1.5 prose-headings:font-semibold
        prose-h1:text-base prose-h2:text-[15px] prose-h3:text-sm
        prose-ul:my-1.5 prose-ul:pl-5 prose-ol:my-1.5 prose-ol:pl-5
        prose-li:my-0.5 prose-li:marker:text-brand-500
        prose-strong:text-foreground prose-strong:font-semibold
        prose-a:text-brand-600 dark:prose-a:text-brand-300 prose-a:no-underline hover:prose-a:underline
        prose-code:rounded prose-code:bg-foreground/8 prose-code:px-1 prose-code:py-0.5
        prose-code:text-[0.85em] prose-code:font-normal prose-code:before:content-none prose-code:after:content-none
        prose-pre:my-2 prose-pre:rounded-lg prose-pre:bg-foreground/5 prose-pre:text-foreground
        prose-blockquote:border-l-2 prose-blockquote:border-brand-400/50 prose-blockquote:pl-3
        prose-blockquote:text-foreground/70 prose-blockquote:not-italic
        prose-table:my-2 prose-table:text-xs
        prose-th:border prose-th:border-foreground/15 prose-th:bg-foreground/5 prose-th:px-2 prose-th:py-1
        prose-td:border prose-td:border-foreground/10 prose-td:px-2 prose-td:py-1
        prose-hr:my-3 prose-hr:border-foreground/10"
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
