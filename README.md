# ChemAIForge

AI 驱动的化学研究平台。浏览器优先的全栈应用。

## 技术栈

- **框架**: Next.js 14（App Router）
- **语言**: TypeScript（strict 模式）
- **样式**: Tailwind CSS
- **数据库**: SQLite + Prisma ORM（零配置本地开发）
- **状态管理**: Zustand
- **AI 导师**: Claude API（通过 CC Switch 读取配置）
- **测试**: Vitest

## 目录结构

```
src/
├── app/          # Next.js App Router 页面与布局
├── components/    # 可复用 UI 组件
├── lib/           # 通用工具与客户端（prisma、store 等）
├── server/        # 服务端业务逻辑（experiments、session、ai 等）
└── types/         # 共享类型定义
prisma/            # Prisma schema、seed 与迁移
```

## 快速开始

```bash
# 1. 安装依赖（postinstall 会自动执行 prisma generate）
npm install

# 2. 准备环境变量
cp .env.example .env

# 3. 初始化数据库并写入示例实验数据
npm run db:push     # 同步 schema 到 SQLite
npm run db:seed     # 写入示例化学实验种子数据

# 4. 启动开发服务器 (http://localhost:3000)
npm run dev
```

## 环境变量

复制 `.env.example` 为 `.env` 并按需填写：

```bash
cp .env.example .env
```

- `DATABASE_URL`: SQLite 连接字符串，默认 `file:./dev.db`（相对 `prisma/` 目录），开箱即用。

### AI 导师配置（CC Switch 依赖）

AI 导师调用 Claude API。**严禁硬编码 API Key**，配置按以下优先级读取：

1. **CC Switch（推荐）**：自动读取 `~/.cc-switch/cc-switch.db` 中当前激活
   （`is_current=1`）的 claude provider，无需额外配置。
   可用 `CC_SWITCH_DB` 环境变量覆盖数据库路径（便于测试/部署）。
2. **环境变量兜底**：未配置 CC Switch 时，可设置以下变量：
   - `ANTHROPIC_BASE_URL`: Claude API 基础地址
   - `ANTHROPIC_AUTH_TOKEN`: API 鉴权 Token
   - `ANTHROPIC_MODEL`: 模型名（可选，默认 `claude-sonnet-4-6`）

两者皆缺失时，AI 导师接口会返回可读的配置错误提示。

## 常用脚本

```bash
npm run dev          # 启动开发服务器 (http://localhost:3000)
npm run build        # 生产构建
npm run start        # 启动生产服务器
npm run test         # 运行 Vitest 单元测试
npm run typecheck    # TypeScript 类型检查 (tsc --noEmit)
npm run lint         # ESLint 检查
npm run format       # Prettier 格式化
```

## 数据库

```bash
npm run db:generate  # 生成 Prisma Client
npm run db:push      # 同步 schema 到数据库
npm run db:seed      # 写入示例实验种子数据
npm run db:migrate   # 创建并应用迁移
npm run db:studio    # 打开 Prisma Studio 可视化管理
```
