import AuthForm from "../AuthForm";

export const metadata = { title: "注册 · ChemAIForge" };

export default function RegisterPage() {
  return (
    <>
      <h2 className="text-xl font-semibold">注册</h2>
      <AuthForm mode="register" />
    </>
  );
}
