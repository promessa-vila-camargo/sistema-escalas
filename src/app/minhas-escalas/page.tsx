import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { logout } from "@/lib/actions/auth";
import { buscarMinhasEscalas } from "@/lib/actions/confirmacao";
import { parseIsoDate, nomeMesAbrev, nomeMes, nomeDiaSemana } from "@/lib/datas";
import EscalaConfirmacaoCard from "@/components/EscalaConfirmacaoCard";

export const metadata = { title: "Confirmação de escala" };

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

export default async function MinhasEscalasPage() {
  const user = await verifySession();
  const escalas = await buscarMinhasEscalas();

  const hoje = new Date();
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();
  const doMesAtual = escalas.filter((e) => {
    const { y, m } = parseIsoDate(e.data);
    return y === anoAtual && m === mesAtual;
  });
  const confirmadas = doMesAtual.filter((e) => e.status === "CONFIRMADO").length;
  const aguardando = doMesAtual.filter((e) => e.status === "AGUARDANDO").length;
  const trocas = doMesAtual.filter((e) => e.status === "TROCA_SOLICITADA").length;

  return (
    <div className="min-h-screen bg-[#f6f6f7] pb-10">
      <header className="no-print flex items-center justify-between border-b border-ink-900/10 bg-white px-5 py-4">
        <span className="font-heading text-[15px] font-extrabold text-ink-900">PROMESSA VILA CAMARGO</span>
        <form action={logout}>
          <button type="submit" className="text-[12.5px] font-semibold text-ink-400 hover:text-ink-900">
            Sair
          </button>
        </form>
      </header>

      <main className="mx-auto w-full max-w-md px-4 py-6">
        <h1 className="mb-1 text-center font-heading text-lg font-extrabold uppercase tracking-wide text-ink-900">
          Confirmação de escala
        </h1>
        <p className="mb-5 text-center text-[13px] text-ink-600">
          Olá, {user.nome.split(" ")[0]}! 👋
          <br />
          Confira suas participações e informe se poderá cumprir cada escala.
        </p>

        <div className="mb-6 rounded-2xl bg-ink-900 px-4 py-4 text-white">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">
            {nomeMes(mesAtual)} {anoAtual}
          </div>
          <div className="mb-1 text-[14px] font-bold">{doMesAtual.length} participação(ões)</div>
          <div className="flex flex-col gap-0.5 text-[12.5px] text-white/80">
            {confirmadas > 0 && <span>🟢 {confirmadas} confirmada(s)</span>}
            {aguardando > 0 && <span>🟡 {aguardando} aguardando</span>}
            {trocas > 0 && <span>🔴 {trocas} troca(s) solicitada(s)</span>}
          </div>
        </div>

        <h2 className="mb-3 text-[12px] font-extrabold uppercase tracking-wide text-ink-400">Minhas escalas</h2>

        {escalas.length === 0 ? (
          <p className="empty-state">Você não tem nenhuma escala vinculada ao seu login no momento.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {escalas.map((e) => {
              const { d } = parseIsoDate(e.data);
              const mesDaEscala = parseIsoDate(e.data).m;
              const dataLabel = `${pad2(d)} ${nomeMesAbrev(mesDaEscala)} • ${nomeDiaSemana(e.diaSemana).toUpperCase()}`;
              return <EscalaConfirmacaoCard key={e.id} escala={e} dataLabel={dataLabel} />;
            })}
          </div>
        )}

        <p className="mt-8 text-center text-[11.5px] text-ink-400">
          Precisa editar sua escala por completo? <Link href="/escala" className="link">Acessar a escala</Link>
        </p>
      </main>
    </div>
  );
}
