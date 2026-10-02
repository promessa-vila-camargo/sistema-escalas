import Link from "next/link";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { buscarAtribuicoes, buscarObservacoes } from "@/lib/actions/escala";
import { isoDate, parseIsoDate, buildMonthDaysFlat, nomeDiaSemana, nomeMes, fmtDDMM, labelFuncao } from "@/lib/datas";
import { emojiMinisterio } from "@/lib/emojis";
import TopNav from "@/components/TopNav";

export const metadata = { title: "Início" };

export default async function InicioPage() {
  const user = await verifySession();
  if (user.role === "ADMIN") redirect("/admin");

  const minhasFuncoes = await prisma.funcao.findMany({
    where: { id: { in: user.funcaoIds } },
    include: { categoria: true },
    orderBy: { ordem: "asc" },
  });

  const hoje = new Date();
  const hojeIso = isoDate(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const candidatos = [
    ...buildMonthDaysFlat(hoje.getFullYear(), hoje.getMonth()),
    ...buildMonthDaysFlat(hoje.getFullYear(), hoje.getMonth() + 1),
  ];
  const proxima = candidatos.find(
    (c) => c.data >= hojeIso && minhasFuncoes.some((f) => f.diasSemana.includes(c.diaSemana))
  );

  let anoP = hoje.getFullYear();
  let mesP = hoje.getMonth();
  if (proxima) {
    const parsed = parseIsoDate(proxima.data);
    anoP = parsed.y;
    mesP = parsed.m;
  }
  const atribuicoes = proxima ? await buscarAtribuicoes(proxima.data, proxima.data) : {};
  const observacoes = proxima ? await buscarObservacoes(proxima.data, proxima.data) : {};

  const minhasFuncoesProxima = proxima ? minhasFuncoes.filter((f) => f.diasSemana.includes(proxima.diaSemana)) : [];
  const linkEscala = proxima ? `/escala?ano=${anoP}&mes=${mesP}` : "/escala";

  return (
    <div className="flex min-h-screen flex-col">
      <TopNav
        user={user}
        tabs={[
          { href: "/inicio", label: "Início" },
          { href: "/escala", label: "Escala" },
          { href: "/minhas-escalas", label: "Confirmar escala" },
        ]}
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-7">
        <h1 className="mb-1 font-heading text-xl font-extrabold text-ink-900">Olá, {user.nome} 👋</h1>
        <p className="mb-6 text-sm text-ink-600">Aqui está o que você precisa saber sobre sua escala.</p>

        <div className="card mb-5">
          <h2 className="mb-4 text-[13px] font-extrabold uppercase tracking-wide text-ink-600">Próxima escala</h2>

          {!proxima ? (
            <p className="empty-state">Você não tem nenhuma função escalada nos próximos dias.</p>
          ) : minhasFuncoesProxima.length === 0 ? (
            <p className="empty-state">Nenhuma das suas funções acontece no próximo culto.</p>
          ) : (
            <>
              <div className="mb-3 badge-neutral inline-flex">
                🗓️ {nomeDiaSemana(proxima.diaSemana)}, {fmtDDMM(anoP, mesP, proxima.dia)} de {nomeMes(mesP)}
              </div>
              {(observacoes[proxima.data] ?? "").trim() && (
                <p className="mb-3 rounded-lg bg-orange-50 px-3 py-2 text-[12.5px] text-orange-700">
                  📝 {observacoes[proxima.data]}
                </p>
              )}
              <div className="flex flex-col gap-1.5">
                {minhasFuncoesProxima.map((f) => {
                  const nome = (atribuicoes[proxima.data]?.[f.id] ?? "").trim();
                  return (
                    <div
                      key={f.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-brand-100 bg-brand-50/60 px-3 py-2"
                    >
                      <span className="text-[13px] font-medium text-ink-900">
                        {emojiMinisterio(f.categoria.nome)} {labelFuncao(f.nome, proxima.diaSemana)}
                      </span>
                      <span className={"text-[13px] font-bold uppercase " + (nome ? "text-brand-700" : "italic font-medium normal-case text-ink-400")}>
                        {nome || "não preenchido"}
                      </span>
                    </div>
                  );
                })}
              </div>
              <Link href={linkEscala} className="btn-primary mt-4 w-full sm:w-auto">
                Preencher escala →
              </Link>
            </>
          )}
        </div>

        <div className="card">
          <h2 className="mb-3 text-[13px] font-extrabold uppercase tracking-wide text-ink-600">Minhas responsabilidades</h2>
          {minhasFuncoes.length === 0 ? (
            <p className="empty-state">Você ainda não tem nenhuma função habilitada. Fale com o administrador.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {minhasFuncoes.map((f) => (
                <span key={f.id} className="badge-neutral">
                  {emojiMinisterio(f.categoria.nome)} {f.nome}
                </span>
              ))}
            </div>
          )}
          <Link href="/escala" className="link mt-4 inline-block">
            Ver minha escala completa →
          </Link>
        </div>
      </main>
    </div>
  );
}
