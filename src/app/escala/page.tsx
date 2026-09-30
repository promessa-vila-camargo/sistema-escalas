import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { buscarAtribuicoes } from "@/lib/actions/escala";
import { isoDate } from "@/lib/datas";
import TopNav from "@/components/TopNav";
import MonthYearPicker from "@/components/MonthYearPicker";
import EscalaBoard from "@/components/EscalaBoard";

export const metadata = { title: "Minha escala" };

function mesPadrao() {
  const hoje = new Date();
  const proximo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
  return { ano: proximo.getFullYear(), mes: proximo.getMonth() };
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

  const [categoriasRaw, pessoasRaw] = await Promise.all([
    prisma.categoria.findMany({ orderBy: { ordem: "asc" }, include: { funcoes: { orderBy: { ordem: "asc" } } } }),
    prisma.user.findMany({ where: { role: "VOLUNTARIO" }, include: { funcoes: true }, orderBy: { nome: "asc" } }),
  ]);

  const primeiroDia = isoDate(ano, mes, 1);
  const ultimoDia = isoDate(ano, mes, new Date(ano, mes + 1, 0).getDate());
  const atribuicoes = await buscarAtribuicoes(primeiroDia, ultimoDia);

  const categorias = categoriasRaw.map((c) => ({ id: c.id, nome: c.nome, ordem: c.ordem, funcoes: c.funcoes }));
  const pessoas = pessoasRaw.map((p) => ({
    id: p.id,
    nome: p.nome,
    ativo: p.ativo,
    funcaoIds: p.funcoes.map((f) => f.funcaoId),
  }));

  return (
    <div className="flex min-h-screen flex-col">
      <TopNav user={user} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-xl font-extrabold text-ink-900">Minha escala</h1>
            <p className="text-[12.5px] text-ink-600">
              Toque em <b>Marcar-me</b> nas funções em que você quer servir.
            </p>
          </div>
          <MonthYearPicker ano={ano} mes={mes} basePath="/escala" />
        </div>
        <EscalaBoard
          ano={ano}
          mes={mes}
          categorias={categorias}
          pessoas={pessoas}
          atribuicoesIniciais={atribuicoes}
          currentUser={user}
        />
      </main>
    </div>
  );
}
