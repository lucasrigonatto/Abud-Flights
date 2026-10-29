import Link from "next/link";
import { registerAction } from "../actions";
import { AuthForm } from "../../components/auth-form";

export default function RegisterPage() {
  return (
    <div className="stack auth-wrap">
      <AuthForm action={registerAction} title="Criar conta" submitLabel="Criar conta" includeName />
      <p className="muted">
        Já tem conta? <Link href="/entrar">Entrar</Link>
      </p>
    </div>
  );
}
