"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Mode = "login" | "register";

interface AuthFormProps {
  mode: Mode;
}

// 登录/注册共享表单组件
export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isRegister = mode === "register";
  const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = {
      email: form.get("email"),
      password: form.get("password"),
    };
    if (isRegister) {
      const name = form.get("name");
      if (name) payload.name = name;
      payload.role = form.get("role");
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "操作失败，请重试");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        邮箱
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded border border-foreground/20 bg-transparent px-3 py-2"
        />
      </label>

      {isRegister && (
        <>
          <label className="flex flex-col gap-1 text-sm">
            昵称（可选）
            <input
              name="name"
              type="text"
              maxLength={50}
              className="rounded border border-foreground/20 bg-transparent px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            身份
            <select
              name="role"
              defaultValue="STUDENT"
              className="rounded border border-foreground/20 bg-transparent px-3 py-2"
            >
              <option value="STUDENT">学生</option>
              <option value="TEACHER">教师</option>
            </select>
          </label>
        </>
      )}

      <label className="flex flex-col gap-1 text-sm">
        密码
        <input
          name="password"
          type="password"
          required
          minLength={isRegister ? 8 : 1}
          autoComplete={isRegister ? "new-password" : "current-password"}
          className="rounded border border-foreground/20 bg-transparent px-3 py-2"
        />
      </label>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded bg-foreground px-4 py-2 text-background disabled:opacity-50"
      >
        {loading ? "处理中…" : isRegister ? "注册" : "登录"}
      </button>

      <p className="text-center text-sm text-foreground/60">
        {isRegister ? (
          <>
            已有账号？{" "}
            <Link href="/login" className="underline">
              去登录
            </Link>
          </>
        ) : (
          <>
            还没有账号？{" "}
            <Link href="/register" className="underline">
              去注册
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
