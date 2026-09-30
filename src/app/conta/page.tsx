import { verifySession } from "@/lib/auth/dal";
import TopNav from "@/components/TopNav";
import ChangePasswordForm from "./ChangePasswordForm";

export default async function ContaPage() {
  const user = await verifySession();

  return (
    <div className="flex min-h-screen flex-col">
      <TopNav user={user} />
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-10">
        <h1 className="mb-1 font-heading text-xl font-extrabold text-ink-900">Minha conta</h1>
        <p className="mb-6 text-sm text-ink-600">
          Usuário: <b className="text-ink-900">{user.username ?? "—"}</b>
        </p>
        <div className="card">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-ink-600">Trocar senha</h2>
          <ChangePasswordForm />
        </div>
      </main>
    </div>
  );
}
