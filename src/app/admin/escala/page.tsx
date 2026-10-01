import { verifyAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { buscarAtribuicoes, buscarObservacoes, buscarMinisteriosResponsaveis } from "@/lib/actions/escala";
import { buscarEventosExtra } from "@/lib/actions/eventoExtra";
import { buscarAtividades } from "@/lib/actions/atividade";
import { isoDate, CATEGORIAS_ESCALA_EXTRAORDINARIA } from "@/lib/datas";
import MonthYearPicker from "@/components/MonthYearPicker";
import EscalaBoard from "@/components/EscalaBoard";
import EventosExtra from "@/components/EventosExtra";

export const metadata = { title: "Escala | Admin" };

function mesPadrao() {
  const hoje = new Date();
  const proximo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
  return { ano: proximo.getFullYear(), mes: proximo.getMonth() };
}

export default async function AdminEscalaPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string; mes?: string }>;
}) {
  const user = await verifyAdmin();
  const params = await searchParams;
  const padrao = mesPadrao();
  const ano = params.ano ? Number(params.ano) : padrao.ano;
  const mes = params.mes ? Number(params.mes) : padrao.mes;

  const categoriasRaw = await prisma.categoria.findMany({
    orderBy: { ordem: "asc" },
    include: { funcoes: { orderBy: { ordem: "asc" } } },
  });

  const primeiroDia = isoDate(ano, mes, 1);
  const ultimoDia = isoDate(ano, mes, new Date(ano, mes + 1, 0).getDate());
  const atribuicoes = await buscarAtribuicoes(primeiroDia, ultimoDia);
  const observacoes = await buscarObservacoes(primeiroDia, ultimoDia);
  const ministeriosResponsaveis = await buscarMinisteriosResponsaveis(primeiroDia, ultimoDia);
  const eventosExtra = await buscarEventosExtra();
  const atividades = await buscarAtividades(primeiroDia, ultimoDia);

  const categorias = categoriasRaw.map((c) => ({ id: c.id, nome: c.nome, ordem: c.ordem, funcoes: c.funcoes }));
  const categoriasExtraordinaria = categorias.filter((c) => CATEGORIAS_ESCALA_EXTRAORDINARIA.includes(c.nome));

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-xl font-extrabold text-ink-900">Escala</h1>
        <MonthYearPicker ano={ano} mes={mes} basePath="/admin/escala" />
      </div>
      <div className="mb-3">
        <span className="badge-positive">🟢 Escala oficial</span>
      </div>
      <EscalaBoard
        ano={ano}
        mes={mes}
        categorias={categorias}
        atribuicoesIniciais={atribuicoes}
        observacoesIniciais={observacoes}
        ministeriosResponsaveisIniciais={ministeriosResponsaveis}
        atividadesIniciais={atividades}
        currentUser={user}
        showExport
      />
      <EventosExtra categorias={categoriasExtraordinaria} eventosIniciais={eventosExtra} currentUser={user} />
    </div>
  );
}
