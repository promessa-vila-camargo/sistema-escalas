import { verifyAdmin } from "@/lib/auth/dal";
import { buscarConvitesDoMes } from "@/lib/actions/convite";
import MonthYearPicker from "@/components/MonthYearPicker";
import ConfirmacoesPainel from "@/components/ConfirmacoesPainel";

export const metadata = { title: "Confirmações | Admin" };

export default async function AdminConfirmacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string; mes?: string }>;
}) {
  await verifyAdmin();
  const params = await searchParams;
  const hoje = new Date();
  const ano = params.ano ? Number(params.ano) : hoje.getFullYear();
  const mes = params.mes ? Number(params.mes) : hoje.getMonth();

  const convites = await buscarConvitesDoMes(ano, mes);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-xl font-extrabold text-ink-900">Confirmações</h1>
        <MonthYearPicker ano={ano} mes={mes} basePath="/admin/confirmacoes" />
      </div>
      <p className="mb-5 text-[12.5px] text-ink-600">
        Cada pessoa escalada recebe um link próprio (sem login). Envie pelo WhatsApp e acompanhe as respostas aqui.
      </p>
      <ConfirmacoesPainel convites={convites} />
    </div>
  );
}
