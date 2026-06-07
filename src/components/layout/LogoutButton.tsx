"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// 登出按钮：调用 /api/auth/logout 清除会话 cookie 后刷新并回到首页
export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="text-foreground/70 hover:text-foreground disabled:opacity-50"
    >
      {loading ? "登出中…" : "登出"}
    </button>
  );
}
