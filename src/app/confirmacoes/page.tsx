import { verifyConfirmacoes } from "@/lib/auth/dal";
import { buscarConvitesDoMes } from "@/lib/actions/convite";
import { fmtDDMM, nomeMes } from "@/lib/datas";
import TopNav from "@/components/TopNav";
import MonthYearPicker from "@/components/MonthYearPicker";
import ConfirmacoesPainel from "@/components/ConfirmacoesPainel";

export const metadata = { title: "Confirmações" };

export default async function ConfirmacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string; mes?: string }>;
}) {
  // ADMIN ou qualquer login com pelo menos uma área liberada — não exige ser admin.
  const user = await verifyConfirmacoes();
  const params = await searchParams;
  const hoje = new Date();
  const ano = params.ano ? Number(params.ano) : hoje.getFullYear();
  const mes = params.mes ? Number(params.mes) : hoje.getMonth();

  const convites = await buscarConvitesDoMes(ano, mes);

  const tabs =
    user.role === "ADMIN"
      ? [
          { href: "/admin", label: "Início" },
          { href: "/admin/escala", label: "Escala" },
          { href: "/confirmacoes", label: "Confirmações" },
          { href: "/admin/pessoas", label: "Pessoas" },
        ]
      : [
          { href: "/inicio", label: "Início" },
          { href: "/escala", label: "Escala" },
          { href: "/confirmacoes", label: "Confirmações" },
          { href: "/minhas-escalas", label: "Confirmar escala" },
        ];

  return (
    <div className="flex min-h-screen flex-col">
      <TopNav user={user} tabs={tabs} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-7">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-heading text-xl font-extrabold text-ink-900">Confirmações</h1>
          <MonthYearPicker ano={ano} mes={mes} basePath="/confirmacoes" />
        </div>
        <p className="mb-5 text-[12.5px] text-ink-600">
          Áreas que você acompanha: <b className="text-ink-900">{user.areasConfirmacao.join(", ")}</b>. Cada pessoa recebe um
          link próprio (sem login) — envie pelo WhatsApp e acompanhe as respostas aqui.
        </p>
        <ConfirmacoesPainel
          key={`${ano}-${mes}`}
          convites={convites}
          areas={user.areasConfirmacao}
          mesLabel={`${nomeMes(mes)} ${ano}`}
          intervaloLabel={`${fmtDDMM(ano, mes, 1)} a ${fmtDDMM(ano, mes, new Date(ano, mes + 1, 0).getDate())}`}
        />
      </main>
    </div>
  );
}
