"use client";

// 语言切换器：导航栏里的下拉面板，切换后停在当前页面的同一路径上。
//
// 为什么不用一个 <select>：60 个语种排成一列要滚很久，故分组 + 搜索。
// 分组依据：全部 60 种都有实验内容译文与语音讲解；9 个主力语种（FULL_LOCALES）
// 额外经过术语人工校对与方程式复核，其余为机器翻译。标注出来，
// 让用户对译文质量有合理预期，而不是默认每种都同等精校。
//
// 切换保留当前路径：正在看某个实验的实验台时换语言，应该还在那个实验台上，
// 而不是被弹回首页。
import { useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FULL_LOCALES, LOCALES, localeMeta } from "@/lib/i18n/locales";
import { usePathname, useRouter } from "@/lib/i18n/navigation";

/** 超过这个数量才显示搜索框：9 个主力语种一眼能看完，51 个就得能搜 */
const SEARCH_THRESHOLD = 12;

export default function LocaleSwitcher() {
  const t = useTranslations("locale");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  const current = localeMeta(locale);

  // 分两组：内容完整的主力语种、仅界面翻译的其余语种
  const { full, basic } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (code: string) => {
      if (!q) return true;
      const m = localeMeta(code);
      // 同时匹配自称名、英文名与代码：不懂日语的人也该能靠 "japanese" 搜到
      return (
        m.nativeName.toLowerCase().includes(q) ||
        m.englishName.toLowerCase().includes(q) ||
        m.code.includes(q)
      );
    };
    return {
      full: LOCALES.filter((l) => l.tier === "full" && match(l.code)),
      basic: LOCALES.filter((l) => l.tier !== "full" && match(l.code)),
    };
  }, [query]);

  function pick(code: string) {
    setOpen(false);
    setQuery("");
    // 停在同一路径：replace 而非 push，避免在历史里堆出一串同页不同语言的记录
    router.replace(pathname, { locale: code });
  }

  return (
    <div ref={boxRef} className="relative ms-auto shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={t("switchLabel")}
        // 与导航链接同为 text-sm：原先 text-xs 比旁边的「实验库」还小一号，加上透明背景，
        // 用户找不到切换入口。改用品牌色描边与浅底，让它在导航栏里一眼可见。
        // 不用 bg-surface/60：--surface 是十六进制变量，Tailwind 的 /60 透明度修饰对它不生效，
        // 实际渲染成完全透明
        className="flex items-center gap-2 rounded-full border border-brand-500/40 bg-brand-500/10 px-3.5 py-1.5 text-sm font-medium text-brand-700 transition-colors hover:border-brand-500/70 hover:bg-brand-500/15 dark:text-brand-200"
      >
        <span aria-hidden className="text-base leading-none">🌐</span>
        <span>{current.nativeName}</span>
        <span aria-hidden className="hidden text-xs opacity-60 sm:inline">
          ▾
        </span>
      </button>

      {open ? (
        <>
          {/* 点击面板外关闭。用一层透明遮罩而不是 document 监听：
              遮罩天然吃掉那一次点击，不会顺带触发背后的按钮 */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            role="listbox"
            aria-label={t("switchLabel")}
            className="absolute end-0 top-full z-50 mt-1.5 max-h-[70vh] w-64 overflow-y-auto rounded-xl border border-foreground/12 bg-surface shadow-lg backdrop-blur"
          >
            {LOCALES.length > SEARCH_THRESHOLD ? (
              <div className="sticky top-0 border-b border-foreground/8 bg-surface/95 p-2 backdrop-blur">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  aria-label={t("searchPlaceholder")}
                  // 面板一打开就聚焦搜索框：想换语言的人多半知道要找哪个
                  autoFocus
                  className="w-full rounded-lg border border-foreground/12 bg-background/60 px-2.5 py-1.5 text-xs outline-none transition-colors focus:border-brand-400"
                />
              </div>
            ) : null}

            {full.length > 0 ? (
              <Group label={t("groupFull")}>
                {full.map((l) => (
                  <Option
                    key={l.code}
                    code={l.code}
                    name={l.nativeName}
                    english={l.englishName}
                    active={l.code === locale}
                    onPick={pick}
                  />
                ))}
              </Group>
            ) : null}

            {basic.length > 0 ? (
              <Group label={t("groupBasic")} hint={t("groupBasicHint")}>
                {basic.map((l) => (
                  <Option
                    key={l.code}
                    code={l.code}
                    name={l.nativeName}
                    english={l.englishName}
                    active={l.code === locale}
                    onPick={pick}
                  />
                ))}
              </Group>
            ) : null}

            {full.length === 0 && basic.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-foreground/65">
                {t("noMatch")}
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

// 分组标题 + 组内选项
function Group({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-1">
      <p className="px-3 pb-1 pt-1.5 text-[10px] font-medium uppercase tracking-wider text-foreground/65">
        {label}
      </p>
      {hint ? (
        <p className="px-3 pb-1 text-[10px] leading-snug text-foreground/65">{hint}</p>
      ) : null}
      {children}
    </div>
  );
}

// 单个语言项：自称名为主、英文名为辅
function Option({
  code,
  name,
  english,
  active,
  onPick,
}: {
  code: string;
  name: string;
  english: string;
  active: boolean;
  onPick: (code: string) => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onClick={() => onPick(code)}
      // lang 属性让浏览器给该语言选对字体、也让屏幕阅读器用对发音
      lang={code}
      className={`flex w-full items-baseline gap-2 px-3 py-1.5 text-start text-xs transition-colors ${
        active
          ? "bg-brand-500/10 font-medium text-brand-700 dark:text-brand-300"
          : "text-foreground/75 hover:bg-foreground/5"
      }`}
    >
      <span>{name}</span>
      {/* 英文名并列显示：自称名认不出时还有个参照 */}
      {english !== name ? (
        <span className="text-[10px] text-foreground/65">{english}</span>
      ) : null}
      {active ? (
        <span aria-hidden className="ms-auto text-brand-500">
          ✓
        </span>
      ) : null}
    </button>
  );
}
