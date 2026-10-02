import { buscarConvite, buscarConviteMes } from "@/lib/actions/convite";
import ConfirmarEscala from "@/components/ConfirmarEscala";
import ConfirmarMes from "@/components/ConfirmarMes";

export const metadata = { title: "Confirmação de escala" };

function decodificar(valor: string) {
  try {
    return decodeURIComponent(valor);
  } catch {
    return valor;
  }
}

function LinkInvalido() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="font-heading text-[13px] font-extrabold tracking-[0.25em] text-ink-900">ESCALA VC</div>
      <h1 className="mt-6 font-heading text-xl font-extrabold text-ink-900">Link não encontrado</h1>
      <p className="mt-2 text-[14px] text-ink-600">
        Este link não é válido ou a escala foi alterada. Peça um novo link ao responsável pela escala.
      </p>
    </div>
  );
}

export default async function ConfirmarPage({
  params,
  searchParams,
}: {
  params: Promise<{ data: string; nome: string }>;
  searchParams: Promise<{ k?: string }>;
}) {
  const { data: dataParam, nome: nomeParam } = await params;
  const { k } = await searchParams;
  const data = decodificar(dataParam);
  const nome = decodificar(nomeParam);

  // "2026-10" = link mensal (todas as datas da pessoa no mês); "2026-10-14" = link de uma data só.
  const ehMensal = /^\d{4}-\d{2}$/.test(data);

  let conteudo: React.ReactNode = <LinkInvalido />;
  if (k) {
    if (ehMensal) {
      const mes = await buscarConviteMes(data, nome, k);
      if (mes) conteudo = <ConfirmarMes key={mes.mes} mes={mes.mes} nome={mes.nome} k={k} itensIniciais={mes.itens} />;
    } else {
      const convite = await buscarConvite(data, nome, k);
      if (convite) conteudo = <ConfirmarEscala convite={convite} k={k} />;
    }
  }

  return <div className="min-h-screen bg-[#f6f6f7]">{conteudo}</div>;
}
