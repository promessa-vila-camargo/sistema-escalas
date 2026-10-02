import { verifyAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import CategoriasManager from "./CategoriasManager";
import PessoasManager from "./PessoasManager";

export const metadata = { title: "Pessoas | Admin" };

export default async function AdminPessoasPage() {
  await verifyAdmin();

  const [categoriasRaw, pessoasRaw] = await Promise.all([
    prisma.categoria.findMany({ orderBy: { ordem: "asc" }, include: { funcoes: { orderBy: { ordem: "asc" } } } }),
    prisma.user.findMany({ where: { role: "VOLUNTARIO" }, include: { funcoes: true } }),
  ]);

  const categorias = categoriasRaw.map((c) => ({ id: c.id, nome: c.nome, ordem: c.ordem, funcoes: c.funcoes }));
  const pessoas = pessoasRaw.map((p) => ({
    id: p.id,
    nome: p.nome,
    username: p.username,
    ativo: p.ativo,
    verTudo: p.verTudo,
    podeGerenciarEventoExtra: p.podeGerenciarEventoExtra,
    gerenciaConfirmacao: p.gerenciaConfirmacao,
    funcaoIds: p.funcoes.map((f) => f.funcaoId),
  }));

  return (
    <div>
      <h1 className="mb-5 font-heading text-xl font-extrabold text-ink-900">Pessoas</h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <CategoriasManager categorias={categorias} />
        <PessoasManager categorias={categorias} pessoas={pessoas} />
      </div>
    </div>
  );
}
