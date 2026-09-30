import Link from "next/link";
import { deleteSession } from "@/lib/auth/session";

export default async function LogoutExpiredPage() {
  await deleteSession();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-heading text-xl font-extrabold text-ink-900">Sessão encerrada</h1>
      <p className="max-w-sm text-sm text-ink-600">
        Sua conta foi desativada ou removida. Fale com o administrador se isso não era esperado.
      </p>
      <Link href="/login" className="btn-primary">
        Voltar para o login
      </Link>
    </div>
  );
}
