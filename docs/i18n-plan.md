# ChemAIForge 国际化方案

语种口径按 OpenAI 界面语言清单（59 种 + 英语 = 60），架构按 60 语种设计，
首批落地 9 个主力语种：中（源）英日韩西法德俄阿。加语种只跑翻译脚本，不改代码。

## 一、实测规模（非估算）

| 待译部分 | 中文字符 | 条数 | 位置 |
|---|---|---|---|
| 501 个实验的 title/description/objectives | 47,135 | 6,629 | `src/data/experiments/*.ts`（38 文件） |
| 化学引擎现象描述 | 8,033 | 703 | `src/lib/chem/rules/*.ts`（24 文件）+ `reactions.ts` |
| UI 界面文案 | 5,087 | 584 | `src/components/**`、`src/app/**` |
| 讲解模板句 | ~1,800 | 72 | `src/components/lab/lesson/buildLesson.ts` |
| **合计** | **~62,000** | **~8,000** | |

另有 59,453 字是代码注释，不翻译。

9 语种译文量 49.7 万字，约 1600 次批量 API 调用（每批 40 条）。

## 二、三条硬约束

### 1. 实验数据的中文名是逻辑匹配键，不可翻译

- `resolveSubstance(label)`（`src/components/lab/reagents.ts:26`）按 `REAGENT_RULES`
  的 150+ 条中文关键词最长匹配解析化学式
- `apparatus` 被 13 处正则匹配（`operations.ts` 决定有哪些操作按钮、
  `vesselGeom.ts:hasHeatSource` 决定画不画火焰、`scenePlan.ts` 决定 3D 器皿造型）
- `probe.reagentKeys` 按中文名取试剂做全库一致性测试

**结论**：`reagents` / `apparatus` 保持中文作为内部键，译文只作用于展示层。
译错会让 501 个实验的反应引擎、3D 场景、操作按钮全部失效。

### 2. 音频 122 MB 已入 git，必须先迁出

- `public/audio` 122 MB / 2858 个 mp3（xiaoxiao、yunxi 各 1429）
- `.git` 已 132 MB，基本全是它；音频只在 3 次提交里出现过，历史改写代价可控
- 每语种单音色 +61 MB 进版本历史，不可删不可压。9 语种 ≈ 549 MB
- `git-lfs` 本机已装（3.2.0）

### 3. 讲解文本是拼接生成的，不是整句

`buildLesson.ts:110` 形如 `` `${er.cathode.observation}；${er.anode.observation}` ``。
中文靠「；」「。」直接粘就通顺，其他语言语序、连接词、标点都不同。
需按语言提供拼接规则，不能只替换词条。

## 三、实施步骤

### 第 0 步：音频迁出 git（阻塞项，先做）

1. `git lfs track "public/audio/**/*.mp3"`，`.gitattributes` 入库
2. 用 `git filter-repo` 把音频从历史剥离（或新建干净分支重来）
3. 清掉 79 个孤儿音频（文案改动残留，`scripts/tts-missing.mjs` 可列出）
4. 线上 chem.whaty.org 的 nginx 直接托管 LFS 拉下的文件，部署流程加 `git lfs pull`

### 第 1 步：i18n 基础设施

- 装 `next-intl`（App Router 官方推荐，支持 RTL）
- 路由改 `src/app/[locale]/**`，middleware 按 `Accept-Language` 首访跳转，
  选择存 cookie。实验页现为 `ƒ Dynamic`（无 `generateStaticParams`），
  加 locale 层不增加构建产物
- `src/lib/i18n/locales.ts`：60 语种清单（code / 原生名 / 文字方向 / edge-tts 音色）
- 阿拉伯语需 `dir="rtl"`，Tailwind 用逻辑属性（`ps-*`/`pe-*` 替代 `pl-*`/`pr-*`）

### 第 2 步：术语表（质量地基）

320 个唯一试剂/仪器名，其中 26 个易错（铬酸钾↔重铬酸钾、硫酸亚铁↔硫酸铁、
亚硫酸钠↔硫酸钠、小苏打↔苏打——差一字就是不同物质）。

实测 Claude 对这 10 个抽样术语全译对（含 Ferrous/Ferric 的区分），
但「酸式滴定管」日语给出「酸性ビュレット」（应为「酸用ビュレット」）。
故建 `src/lib/i18n/glossary/<locale>.json`，翻译时作为强约束注入 prompt，
并人工校对这 320 条——这是全部译文的质量地基。

### 第 3 步：抽取与翻译

1. `scripts/i18n-extract.mjs`：扫源码抽出待译串，产出 `messages/zh.json`
   （UI 文案用命名 key；实验数据按 slug 组织；引擎描述按规则 id 组织）
2. `scripts/i18n-translate.mjs`：复用 `getClaudeApiConfig()`（禁止硬编码 Key），
   按 40 条一批调用，注入术语表约束，产出 `messages/<locale>.json`
   - 断点续传：已译条目跳过，中断可重跑
   - 校验：占位符（`{count}`、`${}`）数量必须一致，否则该条标记失败重试
   - 实测该 provider 注入了大量系统提示（10 条词条输入就 4755 token），
     必须合批，不可逐条调用
3. 源码改造：写死中文替换为 `t("key")`；实验数据经 `experimentText(slug, locale)`
   取译文、回退中文

### 第 4 步：AI 层按 locale 出语言

`report.ts:86` 与 `tutor.ts:97` 写死「请用简体中文撰写」，改为按 locale 注入
目标语言名。AI 生成内容天然多语言，不需要预翻译。

### 第 5 步：TTS 多语言

- `audioKey.ts` 的 `audioSrc` 加 locale 维度：`/audio/lesson/<locale>/<voice>/<hash>.mp3`
- `VOICE_EDGE` 扩成 locale → 音色表。edge-tts 覆盖 75 语言 322 音色，
  另有 12 个 Multilingual 音色可跨语言朗读，能压缩音色矩阵
- 9 个主力语种预生成 mp3（每语种 1350 句），其余语种走浏览器 `speechSynthesis`
  （现有回退逻辑已在 `LessonPlayer.tsx:120-139`）
- 两个必踩的小坑：`estimateMs()` 写死中文 260ms/字（拉丁字母语言不成立）、
  回退路径硬编码 `u.lang = "zh-CN"`
- 生成前先确认 edge-tts 网络连通（本机当前对 `speech.platform.bing.com` 不稳定）

### 第 6 步：验证

- 新增测试：60 语种清单完整性、每个 locale 的词条 key 与 zh 完全对齐、
  占位符一致性、术语表覆盖 320 条、RTL 语种的 dir 属性
- 保持现有 4813 个测试全绿
- 浏览器实测：中英日阿四语种（阿拉伯语验 RTL 布局不塌）

## 四、不做的事

- 不翻译代码注释（5.9 万字，面向开发者）
- 不翻译 `reagents`/`apparatus` 字段本身（见约束 1）
- 不做运行时按需翻译（化学术语译错需事先校对，且首访延迟不可接受）
- 60 语种不全量预生成 TTS（约 3.6 GB，不可行）
