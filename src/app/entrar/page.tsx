import Link from "next/link";
import { loginAction } from "../actions";
import { AuthForm } from "../../components/auth-form";

export default function LoginPage() {
  return (
    <div className="stack auth-wrap">
      <AuthForm action={loginAction} title="Entrar" submitLabel="Entrar" />
      <p className="muted">
        Ainda não tem conta? <Link href="/criar-conta">Criar conta</Link>
      </p>
    </div>
  );
}
