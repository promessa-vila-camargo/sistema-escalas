import { verifyAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { buscarAtribuicoes } from "@/lib/actions/escala";
import { isoDate } from "@/lib/datas";
import MonthYearPicker from "@/components/MonthYearPicker";
import EscalaBoard from "@/components/EscalaBoard";

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
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-xl font-extrabold text-ink-900">Escala</h1>
        <MonthYearPicker ano={ano} mes={mes} basePath="/admin/escala" />
      </div>
      <EscalaBoard
        ano={ano}
        mes={mes}
        categorias={categorias}
        pessoas={pessoas}
        atribuicoesIniciais={atribuicoes}
        currentUser={user}
        showExport
      />
    </div>
  );
}
