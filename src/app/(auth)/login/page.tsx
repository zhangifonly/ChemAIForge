import AuthForm from "../AuthForm";

export const metadata = { title: "登录 · ChemAIForge" };

export default function LoginPage() {
  return (
    <>
      <h2 className="text-xl font-semibold">登录</h2>
      <AuthForm mode="login" />
    </>
  );
}
