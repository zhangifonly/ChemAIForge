# ChemAIForge

AI 驱动的化学研究平台。浏览器优先的全栈应用。

## 技术栈

- **框架**: Next.js 14（App Router）
- **语言**: TypeScript（strict 模式）
- **样式**: Tailwind CSS
- **数据库**: PostgreSQL + Prisma ORM
- **状态管理**: Zustand

## 目录结构

```
src/
├── app/          # Next.js App Router 页面与布局
├── components/    # 可复用 UI 组件
├── lib/           # 通用工具与客户端（prisma、store 等）
├── server/        # 服务端业务逻辑
└── types/         # 共享类型定义
prisma/            # Prisma schema 与迁移
```

## 开发

```bash
npm install          # 安装依赖
npm run dev          # 启动开发服务器 (http://localhost:3000)
npm run build        # 生产构建
npm run start        # 启动生产服务器
npm run typecheck    # TypeScript 类型检查 (tsc --noEmit)
npm run lint         # ESLint 检查
npm run format       # Prettier 格式化
```

## 环境变量

复制 `.env.example` 为 `.env` 并填写：

```bash
cp .env.example .env
```

- `DATABASE_URL`: PostgreSQL 连接字符串

## 数据库

```bash
npm run db:generate  # 生成 Prisma Client
npm run db:push      # 同步 schema 到数据库
npm run db:migrate   # 创建并应用迁移
```
