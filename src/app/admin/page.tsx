import Link from "next/link";
import { verifyAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/prisma";
import { buscarAtribuicoes, buscarObservacoes } from "@/lib/actions/escala";
import { isoDate, parseIsoDate, buildMonthDaysFlat, nomeDiaSemana, nomeMes, fmtDDMM, labelFuncao } from "@/lib/datas";
import { emojiMinisterio } from "@/lib/emojis";

export const metadata = { title: "Início | Admin" };

export default async function AdminHomePage() {
  await verifyAdmin();

  const categoriasRaw = await prisma.categoria.findMany({
    orderBy: { ordem: "asc" },
    include: { funcoes: { orderBy: { ordem: "asc" } } },
  });
  const totalFuncoes = categoriasRaw.reduce((acc, c) => acc + c.funcoes.length, 0);

  const hoje = new Date();
  const hojeIso = isoDate(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const candidatos = [
    ...buildMonthDaysFlat(hoje.getFullYear(), hoje.getMonth()),
    ...buildMonthDaysFlat(hoje.getFullYear(), hoje.getMonth() + 1),
  ];
  const proxima = candidatos.find((c) => c.data >= hojeIso) ?? null;

  const totalPessoas = await prisma.user.count({ where: { role: "VOLUNTARIO", ativo: true } });

  let anoP = hoje.getFullYear();
  let mesP = hoje.getMonth();
  if (proxima) {
    const parsed = parseIsoDate(proxima.data);
    anoP = parsed.y;
    mesP = parsed.m;
  }
  const primeiroDiaMes = isoDate(anoP, mesP, 1);
  const ultimoDiaMes = isoDate(anoP, mesP, new Date(anoP, mesP + 1, 0).getDate());
  const atribuicoesMes = await buscarAtribuicoes(primeiroDiaMes, ultimoDiaMes);
  const observacoesMes = await buscarObservacoes(primeiroDiaMes, ultimoDiaMes);

  const diasDoMes = buildMonthDaysFlat(anoP, mesP);
  let totalSlotsMes = 0;
  let preenchidosMes = 0;
  const pendenciasMes: { data: string; catNome: string; funcaoNome: string }[] = [];
  for (const dia of diasDoMes) {
    for (const cat of categoriasRaw) {
      for (const f of cat.funcoes) {
        if (!f.diasSemana.includes(dia.diaSemana)) continue;
        totalSlotsMes++;
        const preenchido = (atribuicoesMes[dia.data]?.[f.id] ?? "").trim();
        if (preenchido) preenchidosMes++;
        else if (dia.data >= hojeIso) pendenciasMes.push({ data: dia.data, catNome: cat.nome, funcaoNome: f.nome });
      }
    }
  }

  const funcoesProxima = proxima
    ? categoriasRaw.flatMap((cat) =>
        cat.funcoes
          .filter((f) => f.diasSemana.includes(proxima.diaSemana))
          .map((f) => ({ catNome: cat.nome, funcaoId: f.id, funcaoNome: f.nome }))
      )
    : [];
  const preenchidasProxima = funcoesProxima.filter((f) => (atribuicoesMes[proxima?.data ?? ""]?.[f.funcaoId] ?? "").trim());
  const pendentesProxima = funcoesProxima.filter((f) => !(atribuicoesMes[proxima?.data ?? ""]?.[f.funcaoId] ?? "").trim());
  const pctProxima = funcoesProxima.length > 0 ? Math.round((preenchidasProxima.length / funcoesProxima.length) * 100) : 0;
  const statusEmoji = funcoesProxima.length === 0 ? "⚪" : pctProxima === 100 ? "🟢" : pctProxima === 0 ? "🔴" : "🟠";

  const linkEscalaProxima = proxima ? `/admin/escala?ano=${anoP}&mes=${mesP}` : "/admin/escala";

  let linkWhatsapp: string | null = null;
  if (proxima && funcoesProxima.length > 0) {
    const linhas = funcoesProxima.map((f) => {
      const nome = (atribuicoesMes[proxima.data]?.[f.funcaoId] ?? "").trim();
      return `${emojiMinisterio(f.catNome)} ${labelFuncao(f.funcaoNome, proxima.diaSemana)}: ${nome || "❌ (pendente)"}`;
    });
    const nota = (observacoesMes[proxima.data] ?? "").trim();
    const texto = [
      `📋 *Escala — ${nomeDiaSemana(proxima.diaSemana)}, ${fmtDDMM(anoP, mesP, proxima.dia)}*`,
      "",
      ...linhas,
      ...(nota ? ["", `📝 ${nota}`] : []),
    ].join("\n");
    linkWhatsapp = `https://wa.me/?text=${encodeURIComponent(texto)}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-xl font-extrabold text-ink-900">Início</h1>

      <div className="card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[13px] font-extrabold uppercase tracking-wide text-ink-600">Próxima escala</h2>
          {proxima && (
            <span className="badge-neutral">
              {statusEmoji} {nomeDiaSemana(proxima.diaSemana)}, {fmtDDMM(anoP, mesP, proxima.dia)} de {nomeMes(mesP)}
            </span>
          )}
        </div>

        {!proxima ? (
          <p className="empty-state">Nenhum culto encontrado nos próximos dias.</p>
        ) : (
          <>
            <div className="mb-1.5 flex items-baseline justify-between text-sm">
              <span className="font-semibold text-ink-900">
                {preenchidasProxima.length}/{funcoesProxima.length} funções preenchidas
              </span>
              <span className="text-ink-600">{pctProxima}%</span>
            </div>
            <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-brand-50">
              <div
                className={"h-full rounded-full transition-all " + (pctProxima === 100 ? "bg-green-600" : "bg-orange-500")}
                style={{ width: `${pctProxima}%` }}
              />
            </div>

            {(observacoesMes[proxima.data] ?? "").trim() && (
              <p className="mb-3 rounded-lg bg-orange-50 px-3 py-2 text-[12.5px] text-orange-700">
                📝 {observacoesMes[proxima.data]}
              </p>
            )}

            {pendentesProxima.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {pendentesProxima.map((f) => (
                  <div
                    key={f.funcaoId}
                    className="flex items-center justify-between gap-3 rounded-lg border border-brand-100 bg-brand-50/60 px-3 py-2"
                  >
                    <span className="text-[13px] font-medium text-ink-900">
                      {emojiMinisterio(f.catNome)} {labelFuncao(f.funcaoNome, proxima?.diaSemana ?? -1)}
                      <span className="ml-1.5 text-ink-400">— {f.catNome}</span>
                    </span>
                    <Link href={linkEscalaProxima} className="link whitespace-nowrap">
                      Preencher →
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] font-medium text-green-600">✅ Tudo preenchido para este culto.</p>
            )}

            {linkWhatsapp && (
              <a href={linkWhatsapp} target="_blank" rel="noopener noreferrer" className="btn-primary mt-4 w-full sm:w-auto">
                📲 Compartilhar no WhatsApp
              </a>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-4 sm:p-5">
          <div className="text-[10.5px] font-bold uppercase tracking-wide text-ink-400">Equipe</div>
          <div className="mt-1 font-heading text-2xl font-extrabold text-ink-900">👥 {totalPessoas}</div>
        </div>
        <div className="card p-4 sm:p-5">
          <div className="text-[10.5px] font-bold uppercase tracking-wide text-ink-400">Funções</div>
          <div className="mt-1 font-heading text-2xl font-extrabold text-ink-900">🧩 {totalFuncoes}</div>
        </div>
        <div className="card p-4 sm:p-5">
          <div className="text-[10.5px] font-bold uppercase tracking-wide text-ink-400">Preenchidas no mês</div>
          <div className="mt-1 font-heading text-2xl font-extrabold text-ink-900">
            ✅ {preenchidosMes}/{totalSlotsMes}
          </div>
        </div>
        <div className="card p-4 sm:p-5">
          <div className="text-[10.5px] font-bold uppercase tracking-wide text-ink-400">Pendências</div>
          <div className="mt-1 font-heading text-2xl font-extrabold text-ink-900">⚠️ {pendenciasMes.length}</div>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 text-[13px] font-extrabold uppercase tracking-wide text-ink-600">Gestão rápida</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            href="/admin/escala"
            className="flex items-center gap-3 rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3.5 transition-colors hover:bg-brand-50"
          >
            <span className="text-xl">🗓️</span>
            <div>
              <div className="text-sm font-bold text-ink-900">Gerenciar escala</div>
              <div className="text-[12px] text-ink-600">Preencher e revisar os cultos do mês</div>
            </div>
          </Link>
          <Link
            href="/admin/pessoas"
            className="flex items-center gap-3 rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3.5 transition-colors hover:bg-brand-50"
          >
            <span className="text-xl">👤</span>
            <div>
              <div className="text-sm font-bold text-ink-900">Gerenciar pessoas</div>
              <div className="text-[12px] text-ink-600">Ministérios, funções e logins</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
