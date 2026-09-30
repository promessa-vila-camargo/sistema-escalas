"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { definirAtribuicao } from "@/lib/actions/escala";
import { buildMonthDays, buildMonthDaysFlat, fmtDDMM, nomeDiaSemana, nomeMes } from "@/lib/datas";
import type { CurrentUser } from "@/lib/auth/dal";

export type FuncaoDTO = { id: string; nome: string; categoriaId: string; ordem: number };
export type CategoriaDTO = { id: string; nome: string; ordem: number; funcoes: FuncaoDTO[] };
export type AtribuicaoMap = Record<string, Record<string, string | null>>;

type DiaInfo = { data: string; dia: number; diaSemana: number };
type PrintTarget = "mes" | DiaInfo;

const COLUNAS: { key: "qua" | "sab" | "dom"; label: string; diaSemana: number }[] = [
  { key: "qua", label: "Quarta-feira", diaSemana: 3 },
  { key: "sab", label: "Sábado", diaSemana: 6 },
  { key: "dom", label: "Domingo", diaSemana: 0 },
];

const SAVE_DEBOUNCE_MS = 600;

export default function EscalaBoard({
  ano,
  mes,
  categorias,
  atribuicoesIniciais,
  currentUser,
  showExport,
}: {
  ano: number;
  mes: number;
  categorias: CategoriaDTO[];
  atribuicoesIniciais: AtribuicaoMap;
  currentUser: CurrentUser;
  showExport?: boolean;
}) {
  const [atribuicoes, setAtribuicoes] = useState(atribuicoesIniciais);
  const [, startTransition] = useTransition();
  const [mobileDay, setMobileDay] = useState<"qua" | "sab" | "dom">("qua");
  const [confirmando, setConfirmando] = useState<{
    alvo: PrintTarget;
    pendentes: { data: string; dia: number; diaSemana: number; faltando: string[] }[];
  } | null>(null);
  const [printTarget, setPrintTarget] = useState<PrintTarget | null>(null);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dias = useMemo(() => buildMonthDays(ano, mes), [ano, mes]);
  const totalFuncoes = useMemo(() => categorias.reduce((n, c) => n + c.funcoes.length, 0), [categorias]);
  const isAdmin = currentUser.role === "ADMIN";

  function missingList(data: string) {
    const out: string[] = [];
    for (const cat of categorias) {
      for (const f of cat.funcoes) {
        if (!atribuicoes[data]?.[f.id]?.trim()) out.push(f.nome);
      }
    }
    return out;
  }

  function commitSave(data: string, funcaoId: string, nome: string | null) {
    startTransition(async () => {
      try {
        await definirAtribuicao(data, funcaoId, nome);
      } catch (e) {
        alert(e instanceof Error ? e.message : "Não foi possível salvar.");
      }
    });
  }

  function handleTextChange(data: string, funcaoId: string, value: string) {
    setAtribuicoes((old) => ({ ...old, [data]: { ...old[data], [funcaoId]: value } }));
    const key = `${data}:${funcaoId}`;
    if (saveTimers.current[key]) clearTimeout(saveTimers.current[key]);
    saveTimers.current[key] = setTimeout(() => commitSave(data, funcaoId, value), SAVE_DEBOUNCE_MS);
  }

  function handleBlurCommit(data: string, funcaoId: string, value: string) {
    const key = `${data}:${funcaoId}`;
    if (saveTimers.current[key]) {
      clearTimeout(saveTimers.current[key]);
      delete saveTimers.current[key];
    }
    commitSave(data, funcaoId, value);
  }

  function renderCard(data: string, dia: number, diaSemana: number) {
    const faltando = missingList(data);
    const filled = totalFuncoes - faltando.length;
    const completa = totalFuncoes > 0 && faltando.length === 0;

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
                "ml-auto whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums " +
                (completa ? "bg-green-50 text-green-600" : "bg-ink-900/5 text-ink-400")
              }
            >
              {completa ? "Completa" : `${filled}/${totalFuncoes}`}
            </span>
          )}
          {isAdmin && (
            <button
              type="button"
              title="Gerar PDF desta escala"
              onClick={() => handleExportClick({ data, dia, diaSemana })}
              className="flex-none rounded-md p-1 text-ink-400 hover:bg-brand-50 hover:text-orange-600"
            >
              🖨
            </button>
          )}
        </div>

        {categorias.length === 0 && (
          <p className="text-[11.5px] text-ink-400">Cadastre ministérios e funções em Pessoas.</p>
        )}

        {categorias.map((cat) => {
          if (cat.funcoes.length === 0) return null;
          return (
            <div key={cat.id} className="mb-0.5">
              <div className="mt-2 mb-0.5 text-[9.5px] font-extrabold uppercase tracking-wide text-ink-400 first:mt-0">
                {cat.nome}
              </div>
              {cat.funcoes.map((f) => {
                const valor = atribuicoes[data]?.[f.id] ?? "";
                const preenchido = valor.trim().length > 0;
                const meuNome = currentUser.nome.trim().toLowerCase();
                const souEu = valor.trim().toLowerCase() === meuNome;
                const habilitado = currentUser.funcaoIds.includes(f.id);
                const editavel = isAdmin || (habilitado && (!preenchido || souEu));

                return (
                  <div key={f.id} className="leader-row">
                    <span className="leader-label" title={f.nome}>
                      {f.nome}
                    </span>
                    <span className="leader-fill" />
                    {editavel ? (
                      <input
                        type="text"
                        placeholder="Digite o nome..."
                        value={valor}
                        onChange={(e) => handleTextChange(data, f.id, e.target.value)}
                        onBlur={(e) => handleBlurCommit(data, f.id, e.target.value)}
                        className="max-w-[48%] flex-none rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-right text-[12px] font-semibold text-ink-900 outline-none placeholder:font-normal placeholder:italic placeholder:text-ink-400 hover:border-brand-200 hover:bg-brand-50 focus:border-orange-500 focus:bg-white"
                      />
                    ) : (
                      <span className="flex-none truncate text-[11.5px] font-medium text-ink-400">
                        {valor.trim() || "—"}
                      </span>
                    )}
                    <span
                      className={"flex-none text-[11px] " + (preenchido ? "text-green-600" : "text-orange-500")}
                      title={preenchido ? "Preenchido" : "Sem responsável"}
                    >
                      {preenchido ? "✓" : "⚠"}
                    </span>
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
  const cultosCompletos = totalFuncoes > 0 ? diasDoMes.filter((d) => missingList(d.data).length === 0).length : 0;

  function handleExportClick(alvo: PrintTarget) {
    if (totalFuncoes === 0) {
      setPrintTarget(alvo);
      setTimeout(() => window.print(), 30);
      return;
    }
    const diasParaChecar = alvo === "mes" ? diasDoMes : [alvo];
    const pendentes = diasParaChecar
      .map((d) => ({ ...d, faltando: missingList(d.data) }))
      .filter((d) => d.faltando.length > 0);

    if (pendentes.length > 0) {
      setConfirmando({ alvo, pendentes });
    } else {
      setPrintTarget(alvo);
      setTimeout(() => window.print(), 30);
    }
  }

  function renderMinisterioBloco(item: DiaInfo, compact: boolean) {
    return categorias.map((cat) => {
      if (cat.funcoes.length === 0) return null;
      return (
        <div key={cat.id} className={compact ? "mb-0.5" : "mb-4"}>
          <div
            className={
              compact
                ? "mt-1 text-[8.5px] font-extrabold uppercase tracking-wide text-orange-600"
                : "mb-2 border-b-2 border-orange-500 pb-1 font-heading text-[13px] font-extrabold uppercase tracking-wide text-brand-700"
            }
          >
            {cat.nome}
          </div>
          {cat.funcoes.map((f) => {
            const nome = (atribuicoes[item.data]?.[f.id] ?? "").trim();
            if (compact) {
              return (
                <div key={f.id} className="leader-row !text-[10.5px]">
                  <span className="leader-label !max-w-[52%]">{f.nome}</span>
                  <span className="leader-fill" />
                  <span
                    className={
                      "flex-none max-w-[46%] truncate text-[10.5px] font-bold " +
                      (nome ? "text-ink-900" : "italic font-medium text-ink-400")
                    }
                  >
                    {nome || "—"}
                  </span>
                </div>
              );
            }
            return (
              <div key={f.id} className="mb-2.5 flex items-baseline justify-between gap-4 border-b border-dotted border-brand-200 pb-1.5">
                <span className="text-[13px] font-semibold text-ink-600">{f.nome}</span>
                <span className={"text-right text-[14px] font-bold " + (nome ? "text-ink-900" : "italic font-medium text-ink-400")}>
                  {nome || "não preenchido"}
                </span>
              </div>
            );
          })}
        </div>
      );
    });
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
          <button type="button" onClick={() => handleExportClick("mes")} className="btn-primary">
            📄 Exportar PDF do mês
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
              Existem funções sem responsável
              {confirmando.alvo === "mes" ? ` em ${nomeMes(mes)}/${ano}` : ""}. Você pode voltar e preencher, ou
              exportar mesmo assim.
            </p>
            <div className="mb-5 flex max-h-80 flex-col gap-2 overflow-auto">
              {confirmando.pendentes.map((c) => (
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
                  const alvo = confirmando.alvo;
                  setConfirmando(null);
                  setPrintTarget(alvo);
                  setTimeout(() => window.print(), 30);
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

      {/* ---- PDF do mês inteiro (compacto, 2 colunas) ---- */}
      {printTarget === "mes" && (
        <div className="hidden print:block">
          <div className="mb-4 flex items-center gap-3 border-b-2 border-brand-700 pb-3">
            <img src="/logo-icon.png" alt="" className="h-9 w-9 rounded-full" />
            <div className="flex flex-col">
              <span className="font-heading text-base font-extrabold text-brand-700">
                Escala de Ministérios — Promessa Vila Camargo
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
                {renderMinisterioBloco(d, true)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- PDF de um único culto (documento oficial, espaçoso) ---- */}
      {printTarget && printTarget !== "mes" && (
        <div className="hidden print:block">
          <div className="mb-6 flex items-center gap-4 border-b-4 border-brand-700 pb-4">
            <img src="/logo-icon.png" alt="" className="h-16 w-16 rounded-full" />
            <div className="flex flex-col">
              <span className="font-heading text-[10px] font-bold uppercase tracking-[0.15em] text-orange-600">
                Promessa Vila Camargo
              </span>
              <span className="font-heading text-2xl font-extrabold text-brand-700">Escala de Ministérios</span>
            </div>
            <div className="ml-auto text-right">
              <div className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Data</div>
              <div className="font-heading text-lg font-extrabold text-ink-900">
                {fmtDDMM(ano, mes, printTarget.dia)}/{ano}
              </div>
              <div className="text-[12px] font-semibold text-ink-600">{nomeDiaSemana(printTarget.diaSemana)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-10">{renderMinisterioBloco(printTarget, false)}</div>

          <div className="mt-10 border-t border-brand-100 pt-3 text-center text-[10px] text-ink-400">
            Escala de Ministérios · Promessa Vila Camargo · gerado em{" "}
            {new Date().toLocaleDateString("pt-BR")}
          </div>
        </div>
      )}
    </div>
  );
}
