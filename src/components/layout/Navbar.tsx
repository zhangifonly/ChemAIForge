import Link from "next/link";
import { getCurrentSession } from "@/server/auth";
import LogoutButton from "./LogoutButton";

// 全局顶部导航：服务端读取会话，根据登录态切换登录/登出入口
// 登录后展示「我的会话」入口，未登录仅展示登录链接
export default async function Navbar() {
  const session = await getCurrentSession();

  return (
    <nav className="flex items-center gap-6 border-b border-foreground/10 px-8 py-4 text-sm">
      <Link href="/" className="font-semibold">
        ChemAIForge
      </Link>
      <Link
        href="/experiments"
        className="text-foreground/70 hover:text-foreground"
      >
        实验库
      </Link>
      {session ? (
        <Link
          href="/sessions"
          className="text-foreground/70 hover:text-foreground"
        >
          我的会话
        </Link>
      ) : null}

      <div className="ml-auto flex items-center gap-4">
        {session ? (
          <>
            <span className="text-foreground/50">{session.email}</span>
            <LogoutButton />
          </>
        ) : (
          <Link
            href="/login"
            className="text-foreground/70 hover:text-foreground"
          >
            登录
          </Link>
        )}
      </div>
    </nav>
  );
}
