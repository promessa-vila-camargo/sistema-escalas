import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { buscarAtribuicoes, buscarObservacoes, buscarMinisteriosResponsaveis } from "@/lib/actions/escala";
import { buscarEventosExtra } from "@/lib/actions/eventoExtra";
import { buscarAtividades } from "@/lib/actions/atividade";
import { isoDate, addDays, CATEGORIAS_ESCALA_EXTRAORDINARIA } from "@/lib/datas";
import TopNav from "@/components/TopNav";
import MonthYearPicker from "@/components/MonthYearPicker";
import EscalaBoard from "@/components/EscalaBoard";
import EventosExtra from "@/components/EventosExtra";

export const metadata = { title: "Minha escala" };

/** Mês/ano atuais — é o que deve abrir por padrão sempre que a tela de escala é acessada sem ano/mês na URL. */
function mesPadrao() {
  const hoje = new Date();
  return { ano: hoje.getFullYear(), mes: hoje.getMonth() };
}

export default async function EscalaVoluntarioPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string; mes?: string }>;
}) {
  const user = await verifySession();
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
  // Busca 1 dia a mais de cada lado — o fim de semana que atravessa a virada do
  // mês (ex.: sábado 31/10 + domingo 01/11) precisa dos dados do dia vizinho
  // pra não aparecer partido na exportação em PDF.
  const buscaDe = addDays(primeiroDia, -1);
  const buscaAte = addDays(ultimoDia, 1);
  const atribuicoes = await buscarAtribuicoes(buscaDe, buscaAte);
  const observacoes = await buscarObservacoes(buscaDe, buscaAte);
  const ministeriosResponsaveis = await buscarMinisteriosResponsaveis(buscaDe, buscaAte);
  const eventosExtra = await buscarEventosExtra();
  const atividades = await buscarAtividades(buscaDe, buscaAte);

  const categorias = categoriasRaw.map((c) => ({ id: c.id, nome: c.nome, ordem: c.ordem, funcoes: c.funcoes }));
  const categoriasExtraordinaria = categorias.filter((c) => CATEGORIAS_ESCALA_EXTRAORDINARIA.includes(c.nome));

  const pessoasRaw = await prisma.user.findMany({ where: { ativo: true }, select: { nome: true }, orderBy: { nome: "asc" } });
  const pessoasCadastradas = pessoasRaw.map((p) => p.nome);

  return (
    <div className="flex min-h-screen flex-col">
      <TopNav
        user={user}
        tabs={[
          { href: "/inicio", label: "Início" },
          { href: "/escala", label: "Escala" },
          ...(user.areasConfirmacao.length > 0 ? [{ href: "/confirmacoes", label: "Confirmações" }] : []),
          { href: "/minhas-escalas", label: "Confirmar escala" },
        ]}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-xl font-extrabold text-ink-900">Minha escala</h1>
            <p className="text-[12.5px] text-ink-600">Digite seu nome nas funções em que você quer servir.</p>
          </div>
          <MonthYearPicker ano={ano} mes={mes} basePath="/escala" />
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
          pessoasCadastradas={pessoasCadastradas}
        />
        <EventosExtra categorias={categoriasExtraordinaria} eventosIniciais={eventosExtra} currentUser={user} />
      </main>
    </div>
  );
}
