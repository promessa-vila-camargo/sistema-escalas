"use client";

import { useMemo, useState, useTransition } from "react";
import { definirAtribuicao } from "@/lib/actions/escala";
import { buildMonthDays, buildMonthDaysFlat, fmtDDMM, nomeDiaSemana, nomeMes } from "@/lib/datas";
import type { CurrentUser } from "@/lib/auth/dal";

export type FuncaoDTO = { id: string; nome: string; categoriaId: string; ordem: number };
export type CategoriaDTO = { id: string; nome: string; ordem: number; funcoes: FuncaoDTO[] };
export type PessoaDTO = { id: string; nome: string; ativo: boolean; funcaoIds: string[] };
export type AtribuicaoMap = Record<string, Record<string, string | null>>;

const COLUNAS: { key: "qua" | "sab" | "dom"; label: string; diaSemana: number }[] = [
  { key: "qua", label: "Quarta-feira", diaSemana: 3 },
  { key: "sab", label: "Sábado", diaSemana: 6 },
  { key: "dom", label: "Domingo", diaSemana: 0 },
];

export default function EscalaBoard({
  ano,
  mes,
  categorias,
  pessoas,
  atribuicoesIniciais,
  currentUser,
  showExport,
}: {
  ano: number;
  mes: number;
  categorias: CategoriaDTO[];
  pessoas: PessoaDTO[];
  atribuicoesIniciais: AtribuicaoMap;
  currentUser: CurrentUser;
  showExport?: boolean;
}) {
  const [atribuicoes, setAtribuicoes] = useState(atribuicoesIniciais);
  const [, startTransition] = useTransition();
  const [mobileDay, setMobileDay] = useState<"qua" | "sab" | "dom">("qua");
  const [confirmando, setConfirmando] = useState<{ data: string; dia: number; diaSemana: number; faltando: string[] }[] | null>(null);

  const dias = useMemo(() => buildMonthDays(ano, mes), [ano, mes]);
  const totalFuncoes = useMemo(() => categorias.reduce((n, c) => n + c.funcoes.length, 0), [categorias]);
  const isAdmin = currentUser.role === "ADMIN";

  function pessoaById(id: string | null | undefined) {
    return id ? pessoas.find((p) => p.id === id) ?? null : null;
  }

  function missingCount(data: string) {
    let missing = 0;
    for (const cat of categorias) {
      for (const f of cat.funcoes) {
        if (!atribuicoes[data]?.[f.id]) missing++;
      }
    }
    return missing;
  }

  function handleChange(data: string, funcaoId: string, userId: string | null) {
    const prev = atribuicoes;
    setAtribuicoes((old) => ({ ...old, [data]: { ...old[data], [funcaoId]: userId } }));
    startTransition(async () => {
      try {
        await definirAtribuicao(data, funcaoId, userId);
      } catch (e) {
        setAtribuicoes(prev);
        alert(e instanceof Error ? e.message : "Não foi possível salvar.");
      }
    });
  }

  function personOptionsFor(funcaoId: string, currentId: string | null) {
    let candidatas = pessoas.filter((p) => p.ativo && p.funcaoIds.includes(funcaoId));
    if (candidatas.length === 0) candidatas = pessoas.filter((p) => p.ativo);
    if (currentId && !candidatas.some((p) => p.id === currentId)) {
      const atual = pessoaById(currentId);
      if (atual) candidatas = [...candidatas, atual];
    }
    return candidatas;
  }

  function renderCard(data: string, dia: number, diaSemana: number) {
    const missing = missingCount(data);
    const filled = totalFuncoes - missing;

    return (
      <div key={data} className="card !p-3.5">
        <div className="mb-2 flex items-center gap-2.5">
          <div className="flex h-10 w-10 flex-none flex-col items-center justify-center rounded-[10px] bg-orange-50 font-heading font-extrabold text-orange-600">
            <span className="text-[15px] leading-none tabular-nums">{String(dia).padStart(2, "0")}</span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[13.5px] font-bold text-ink-900">{nomeDiaSemana(diaSemana)}</span>
            <span className="text-[11.5px] tabular-nums text-ink-400">
              {fmtDDMM(ano, mes, dia)}/{ano}
            </span>
          </div>
          {totalFuncoes > 0 && (
            <span
              className={
                "ml-auto whitespace-nowrap text-[10.5px] font-bold tabular-nums " +
                (missing === 0 ? "text-green-600" : "text-ink-400")
              }
            >
              {filled}/{totalFuncoes}
            </span>
          )}
        </div>

        {categorias.length === 0 && (
          <p className="text-[11.5px] text-ink-400">Cadastre categorias e funções em Pessoas.</p>
        )}

        {categorias.map((cat) => {
          if (cat.funcoes.length === 0) return null;
          return (
            <div key={cat.id} className="mb-0.5">
              <div className="mt-2 mb-0.5 text-[9.5px] font-extrabold uppercase tracking-wide text-ink-400 first:mt-0">
                {cat.nome}
              </div>
              {cat.funcoes.map((f) => {
                const currentId = atribuicoes[data]?.[f.id] ?? null;
                const sou_eu = currentId === currentUser.id;
                const habilitado = currentUser.funcaoIds.includes(f.id);

                return (
                  <div key={f.id} className="leader-row">
                    <span className="leader-label" title={f.nome}>
                      {f.nome}
                    </span>
                    <span className="leader-fill" />
                    {isAdmin ? (
                      <select
                        className="max-w-[46%] flex-none rounded-md border-none bg-transparent px-1 py-0.5 text-[12px] font-semibold text-ink-900 hover:bg-brand-50 focus:bg-brand-50 focus:outline-none"
                        value={currentId ?? ""}
                        onChange={(e) => handleChange(data, f.id, e.target.value || null)}
                      >
                        <option value="">Selecionar…</option>
                        {personOptionsFor(f.id, currentId).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nome}
                            {!p.ativo ? " (inativo)" : ""}
                          </option>
                        ))}
                      </select>
                    ) : habilitado && (!currentId || sou_eu) ? (
                      <button
                        type="button"
                        onClick={() => handleChange(data, f.id, sou_eu ? null : currentUser.id)}
                        className={
                          "flex-none whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[10.5px] font-bold transition-colors " +
                          (sou_eu
                            ? "border-green-50 bg-green-50 text-green-600"
                            : "border-brand-200 bg-white text-ink-600 hover:border-orange-500 hover:text-orange-600")
                        }
                      >
                        {sou_eu ? "Você ✓" : "Marcar-me"}
                      </button>
                    ) : (
                      <span className="flex-none truncate text-[11.5px] font-medium text-ink-400">
                        {pessoaById(currentId)?.nome ?? "—"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }

  const diasDoMes = useMemo(() => buildMonthDaysFlat(ano, mes), [ano, mes]);
  const cultosCompletos = totalFuncoes > 0 ? diasDoMes.filter((d) => missingCount(d.data) === 0).length : 0;

  function handleExportClick() {
    if (totalFuncoes === 0 || diasDoMes.length === 0) {
      window.print();
      return;
    }
    const pendentes = diasDoMes
      .map((d) => {
        const faltando: string[] = [];
        for (const cat of categorias) {
          for (const f of cat.funcoes) {
            if (!atribuicoes[d.data]?.[f.id]) faltando.push(f.nome);
          }
        }
        return { ...d, faltando };
      })
      .filter((d) => d.faltando.length > 0);

    if (pendentes.length > 0) {
      setConfirmando(pendentes);
    } else {
      window.print();
    }
  }

  return (
    <div>
      {showExport && (
        <div className="no-print mb-4 flex flex-wrap items-center gap-3">
          <span className="mr-auto text-[12.5px] font-semibold text-ink-400">
            {totalFuncoes > 0 && (
              <>
                <b className="text-ink-600">{diasDoMes.length}</b> culto(s) neste mês ·{" "}
                <b className="text-ink-600">{cultosCompletos}</b> completo(s)
              </>
            )}
          </span>
          <button type="button" onClick={handleExportClick} className="btn-primary">
            📄 Exportar PDF
          </button>
        </div>
      )}

      {confirmando && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 p-5">
          <div className="max-h-[82vh] w-full max-w-md overflow-auto rounded-2xl bg-white p-6 shadow-soft-lift">
            <div className="mb-2 flex items-center gap-2.5">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-red-50 text-red-500">
                ⚠
              </span>
              <h3 className="font-heading text-base font-extrabold text-ink-900">Escala incompleta</h3>
            </div>
            <p className="mb-4 text-[12.5px] leading-relaxed text-ink-600">
              Existem funções sem responsável em {nomeMes(mes)}/{ano}. Você pode voltar e preencher, ou exportar
              mesmo assim.
            </p>
            <div className="mb-5 flex max-h-80 flex-col gap-2 overflow-auto">
              {confirmando.map((c) => (
                <div key={c.data} className="rounded-lg bg-brand-50 p-2.5">
                  <div className="mb-0.5 text-[12.5px] font-bold text-ink-900">
                    {nomeDiaSemana(c.diaSemana)} • {fmtDDMM(ano, mes, c.dia)}/{ano}
                  </div>
                  <div className="text-[11.5px] text-red-600">{c.faltando.join(", ")}</div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setConfirmando(null)}>
                Voltar para preencher
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setConfirmando(null);
                  window.print();
                }}
              >
                Continuar mesmo assim
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-4 flex gap-1.5 sm:hidden print:hidden">
        {COLUNAS.map((c) => (
          <button
            key={c.key}
            onClick={() => setMobileDay(c.key)}
            className={
              "flex-1 rounded-lg border px-2 py-2 text-[13px] font-bold transition-colors " +
              (mobileDay === c.key
                ? "border-orange-600 bg-orange-600 text-white"
                : "border-brand-100 bg-white text-ink-600")
            }
          >
            {c.label.replace("-feira", "")}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 print:hidden">
        {COLUNAS.map((col) => (
          <div key={col.key} className={"flex flex-col gap-3.5 " + (mobileDay === col.key ? "" : "hidden sm:flex")}>
            <div className="flex items-baseline justify-between px-0.5">
              <span className="text-[13px] font-extrabold uppercase tracking-wide text-ink-900">{col.label}</span>
              <span className="text-xs font-semibold tabular-nums text-ink-400">{dias[col.key].length}</span>
            </div>
            {dias[col.key].length === 0 ? (
              <div className="empty-state">Nenhum culto neste mês.</div>
            ) : (
              dias[col.key].map((d) => renderCard(d.data, d.dia, d.diaSemana))
            )}
          </div>
        ))}
      </div>

      {showExport && (
        <div className="hidden print:block">
          <div className="mb-4 flex items-center gap-3 border-b-2 border-brand-700 pb-3">
            <img src="/logo-icon.png" alt="" className="h-9 w-9 rounded-full" />
            <div className="flex flex-col">
              <span className="font-heading text-base font-extrabold text-brand-700">
                Escala de Cultos — Promessa Vila Camargo
              </span>
              <span className="text-[11px] font-semibold text-ink-600">
                {nomeMes(mes)} de {ano}
              </span>
            </div>
          </div>
          <div className="columns-2 gap-6">
            {diasDoMes.map((d) => (
              <div key={d.data} className="mb-3 break-inside-avoid border-b border-brand-100 pb-2.5">
                <div className="mb-1 font-heading text-[11.5px] font-extrabold uppercase tracking-wide text-brand-700">
                  {nomeDiaSemana(d.diaSemana)} • {fmtDDMM(ano, mes, d.dia)}/{ano}
                </div>
                {categorias.map((cat) => {
                  if (cat.funcoes.length === 0) return null;
                  return (
                    <div key={cat.id} className="mb-0.5">
                      <div className="mt-1 text-[8.5px] font-extrabold uppercase tracking-wide text-orange-600">
                        {cat.nome}
                      </div>
                      {cat.funcoes.map((f) => {
                        const pessoa = pessoaById(atribuicoes[d.data]?.[f.id] ?? null);
                        return (
                          <div key={f.id} className="leader-row !text-[10.5px]">
                            <span className="leader-label !max-w-[52%]">{f.nome}</span>
                            <span className="leader-fill" />
                            <span
                              className={
                                "flex-none max-w-[46%] truncate text-[10.5px] font-bold " +
                                (pessoa ? "text-ink-900" : "italic font-medium text-ink-400")
                              }
                            >
                              {pessoa ? pessoa.nome : "—"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
