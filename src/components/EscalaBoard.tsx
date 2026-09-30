"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { definirAtribuicao } from "@/lib/actions/escala";
import { buildMonthDays, buildMonthDaysFlat, fmtDDMM, nomeDiaSemana, nomeMes } from "@/lib/datas";
import type { CurrentUser } from "@/lib/auth/dal";

const EMOJI_MINISTERIO: Record<string, string> = {
  "Direção": "⛪",
  "Palavra e Pregação": "🎤",
  "Mídia": "📱",
  "Datashow": "💻",
  "Transmissão": "🖥️",
  "Som": "🎚️",
};
const EMOJI_FUNCAO: Record<string, string> = {
  "Diretor(a)": "⛪",
  "Palavra Pastoral": "🎤",
  "Pregador": "🎤",
  "Mídia": "📱",
  "Datashow": "💻",
  "Operador de Transmissão": "🖥️",
  "Câmera Fixa": "📹",
  "Câmera Móvel 1": "📹",
  "Câmera Móvel 2": "📹",
  "Mesa de Som": "🎚️",
  "Som da Transmissão": "🎚️",
};
function emojiMinisterio(nome: string) {
  return EMOJI_MINISTERIO[nome] ?? "🏛️";
}
function emojiFuncao(nome: string) {
  return EMOJI_FUNCAO[nome] ?? "•";
}

export type FuncaoDTO = { id: string; nome: string; categoriaId: string; ordem: number; diasSemana: number[] };
export type CategoriaDTO = { id: string; nome: string; ordem: number; funcoes: FuncaoDTO[] };
export type AtribuicaoMap = Record<string, Record<string, string | null>>;

type DiaInfo = { data: string; dia: number; diaSemana: number };
type PrintTarget = "mes" | DiaInfo;
type ParFds = { sab: DiaInfo | null; dom: DiaInfo | null };

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
  const [confirmando, setConfirmando] = useState<{
    alvo: PrintTarget;
    pendentes: { data: string; dia: number; diaSemana: number; faltando: string[] }[];
  } | null>(null);
  const [printTarget, setPrintTarget] = useState<PrintTarget | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [salvandoTudo, setSalvandoTudo] = useState(false);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dias = useMemo(() => buildMonthDays(ano, mes), [ano, mes]);

  /** Agrupa sábado com o domingo seguinte — pra aparecerem lado a lado, como um fim de semana só. */
  const fdsPares = useMemo(() => {
    const domPorData = new Map(dias.dom.map((d) => [d.data, d]));
    const usados = new Set<string>();
    const pares: ParFds[] = [];
    for (const s of dias.sab) {
      const domStr = domingoSeguinte(s.data);
      const d = domPorData.get(domStr) ?? null;
      if (d) usados.add(d.data);
      pares.push({ sab: s, dom: d });
    }
    for (const d of dias.dom) {
      if (!usados.has(d.data)) pares.push({ sab: null, dom: d });
    }
    return pares.sort((a, b) => {
      const da = (a.sab ?? a.dom)!.data;
      const db = (b.sab ?? b.dom)!.data;
      return da < db ? -1 : da > db ? 1 : 0;
    });
  }, [dias]);
  const isAdmin = currentUser.role === "ADMIN";
  const temAlgumaFuncao = categorias.some((c) => c.funcoes.length > 0);

  /**
   * "Ver apenas minha responsabilidade" (padrão): só aparece o que foi
   * atribuído ao login. "Ver tudo": enxerga a escala inteira como o admin,
   * mas só EDITA as próprias funções (as outras aparecem travadas, só
   * leitura) — ver renderCard mais abaixo.
   */
  const podeVerTudo = isAdmin || currentUser.verTudo;
  const categoriasVisiveis = useMemo(() => {
    if (podeVerTudo) return categorias;
    return categorias
      .map((c) => ({ ...c, funcoes: c.funcoes.filter((f) => currentUser.funcaoIds.includes(f.id)) }))
      .filter((c) => c.funcoes.length > 0);
  }, [categorias, podeVerTudo, currentUser.funcaoIds]);

  /** Dentro do que a pessoa pode ver, ainda filtra pelas funções que valem naquele dia da semana (ex.: Datashow não entra na quarta). */
  function categoriasDoDia(diaSemana: number) {
    return categoriasVisiveis
      .map((c) => ({ ...c, funcoes: c.funcoes.filter((f) => f.diasSemana.includes(diaSemana)) }))
      .filter((c) => c.funcoes.length > 0);
  }

  function missingList(data: string, diaSemana: number) {
    const out: string[] = [];
    for (const cat of categoriasDoDia(diaSemana)) {
      for (const f of cat.funcoes) {
        if (!atribuicoes[data]?.[f.id]?.trim()) out.push(f.nome);
      }
    }
    return out;
  }

  function funcaoById(funcaoId: string) {
    for (const cat of categorias) {
      const f = cat.funcoes.find((x) => x.id === funcaoId);
      if (f) return f;
    }
    return null;
  }

  /** Domingo seguinte de uma data de sábado, como string "YYYY-MM-DD" (UTC, sem deslocar dia). */
  function domingoSeguinte(data: string) {
    const d = new Date(data);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  /** Atualiza o estado local — e, se for sábado de uma função que também vale no domingo, espelha no domingo também (o servidor já faz essa cópia; aqui é só pra tela não esperar um reload pra mostrar). */
  function applyLocalChange(data: string, funcaoId: string, value: string) {
    setAtribuicoes((old) => {
      const next = { ...old, [data]: { ...old[data], [funcaoId]: value } };
      const diaSemana = new Date(data).getUTCDay();
      const funcao = funcaoById(funcaoId);
      if (diaSemana === 6 && funcao?.diasSemana.includes(0)) {
        const dom = domingoSeguinte(data);
        next[dom] = { ...next[dom], [funcaoId]: value };
      }
      return next;
    });
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
    applyLocalChange(data, funcaoId, value);
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
    // Nomes são sempre salvos em caixa alta — já reflete isso na tela ao
    // sair do campo, sem esperar o servidor/reload pra mostrar certo.
    const maiuscula = value.trim().toUpperCase();
    if (maiuscula !== value) applyLocalChange(data, funcaoId, maiuscula);
    commitSave(data, funcaoId, maiuscula);
  }

  function renderCard(data: string, dia: number, diaSemana: number) {
    const categoriasCard = categoriasDoDia(diaSemana);
    const totalCard = categoriasCard.reduce((n, c) => n + c.funcoes.length, 0);
    const faltando = missingList(data, diaSemana);
    const filled = totalCard - faltando.length;
    const completa = totalCard > 0 && faltando.length === 0;

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
          {totalCard > 0 && (
            <span
              className={
                "ml-auto whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums " +
                (completa ? "bg-green-50 text-green-600" : "bg-ink-900/5 text-ink-400")
              }
            >
              {completa ? "Completa" : `${filled}/${totalCard}`}
            </span>
          )}
          {isAdmin && (
            <button
              type="button"
              title="Gerar PDF desta escala"
              onClick={() => handleExportClick({ data, dia, diaSemana })}
              className="flex-none rounded-md p-1 text-[15px] text-ink-400 hover:bg-brand-50 hover:text-orange-600"
            >
              🖨️
            </button>
          )}
        </div>

        {categoriasCard.length === 0 && (
          <p className="text-[11.5px] text-ink-400">
            {!temAlgumaFuncao
              ? "Cadastre ministérios e funções em Pessoas."
              : isAdmin
                ? "Nenhuma função vale para este dia."
                : "Nenhuma função foi atribuída ao seu login ainda (ou nenhuma das suas vale neste dia)."}
          </p>
        )}

        {categoriasCard.map((cat) => {
          if (cat.funcoes.length === 0) return null;
          return (
            <div key={cat.id} className="mb-0.5">
              <div className="mt-2 mb-0.5 text-[9.5px] font-extrabold uppercase tracking-wide text-ink-400 first:mt-0">
                {emojiMinisterio(cat.nome)} {cat.nome}
              </div>
              {cat.funcoes.map((f) => {
                const valor = atribuicoes[data]?.[f.id] ?? "";
                const preenchido = valor.trim().length > 0;
                const souEu = isAdmin ? false : currentUser.funcaoIds.includes(f.id);
                const editavel = isAdmin || souEu;

                return (
                  <div key={f.id} className="leader-row">
                    <span className="leader-label" title={f.nome}>
                      {emojiFuncao(f.nome)} {f.nome}
                    </span>
                    <span className="leader-fill" />
                    {editavel ? (
                      <input
                        type="text"
                        placeholder="Digite o nome..."
                        value={valor}
                        onChange={(e) => handleTextChange(data, f.id, e.target.value)}
                        onBlur={(e) => handleBlurCommit(data, f.id, e.target.value)}
                        className="max-w-[48%] flex-none rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-right text-[12px] font-semibold uppercase text-ink-900 outline-none placeholder:font-normal placeholder:italic placeholder:normal-case placeholder:text-ink-400 hover:border-brand-200 hover:bg-brand-50 focus:border-orange-500 focus:bg-white"
                      />
                    ) : (
                      <span className="max-w-[48%] flex-none truncate text-right text-[12px] font-semibold uppercase text-ink-400">
                        {valor.trim() || "—"}
                      </span>
                    )}
                    <span
                      className={"flex-none text-[13px] " + (preenchido ? "" : "opacity-70")}
                      title={preenchido ? "Preenchido" : "Sem responsável"}
                    >
                      {preenchido ? "✅" : "⚠️"}
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
  const cultosCompletos = temAlgumaFuncao
    ? diasDoMes.filter((d) => missingList(d.data, d.diaSemana).length === 0).length
    : 0;

  function handleExportClick(alvo: PrintTarget) {
    if (!temAlgumaFuncao) {
      setPrintTarget(alvo);
      setTimeout(() => window.print(), 30);
      return;
    }
    const diasParaChecar = alvo === "mes" ? diasDoMes : [alvo];
    const pendentes = diasParaChecar
      .map((d) => ({ ...d, faltando: missingList(d.data, d.diaSemana) }))
      .filter((d) => d.faltando.length > 0);

    if (pendentes.length > 0) {
      setConfirmando({ alvo, pendentes });
    } else {
      setPrintTarget(alvo);
      setTimeout(() => window.print(), 30);
    }
  }

  /** Botão "Salvar": força o commit imediato de tudo que ainda estava esperando o debounce e avisa com um toast. */
  async function handleSalvarTudo() {
    const pendentes = Object.entries(saveTimers.current);
    for (const [key, timer] of pendentes) {
      clearTimeout(timer);
      delete saveTimers.current[key];
    }
    setSalvandoTudo(true);
    try {
      await Promise.all(
        pendentes.map(([key]) => {
          const [data, funcaoId] = key.split(":");
          const valor = (atribuicoes[data]?.[funcaoId] ?? "").trim().toUpperCase();
          return definirAtribuicao(data, funcaoId, valor || null);
        })
      );
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast("Escala salva com sucesso! ✅");
      toastTimer.current = setTimeout(() => setToast(null), 3000);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Não foi possível salvar tudo.");
    } finally {
      setSalvandoTudo(false);
    }
  }

  function categoriasDoDiaCompleto(diaSemana: number) {
    return categorias
      .map((c) => ({ ...c, funcoes: c.funcoes.filter((f) => f.diasSemana.includes(diaSemana)) }))
      .filter((c) => c.funcoes.length > 0);
  }

  /** Bloco compacto (PDF do mês inteiro — muitos cultos na mesma folha). */
  function renderMinisterioCompacto(item: DiaInfo) {
    return categoriasDoDiaCompleto(item.diaSemana).map((cat) => (
      <div key={cat.id} className="mb-0.5">
        <div className="mt-1 text-[8px] font-extrabold uppercase tracking-wide text-pdforange">
          {emojiMinisterio(cat.nome)} {cat.nome}
        </div>
        {cat.funcoes.map((f) => {
          const nome = (atribuicoes[item.data]?.[f.id] ?? "").trim();
          return (
            <div key={f.id} className="leader-row !text-[10.5px]">
              <span className="leader-label !max-w-[52%]">
                {emojiFuncao(f.nome)} {f.nome}
              </span>
              <span className="leader-fill" />
              <span
                className={
                  "flex-none max-w-[46%] truncate text-[10.5px] font-bold uppercase " +
                  (nome ? "text-pdfblue" : "italic font-medium normal-case text-ink-400")
                }
              >
                {nome || "—"}
              </span>
            </div>
          );
        })}
      </div>
    ));
  }

  /** Coluna espaçosa (PDF de um culto/fim de semana) — um cartão por ministério, com ícone. */
  function renderColunaCulto(item: DiaInfo) {
    const categoriasDia = categoriasDoDiaCompleto(item.diaSemana);
    return categoriasDia.map((cat) => (
      <div key={cat.id} className="mb-3 break-inside-avoid rounded-xl bg-pdfgray p-3.5">
        <div className="mb-2 flex items-center gap-2 text-pdfblue">
          <span className="text-[17px] leading-none">{emojiMinisterio(cat.nome)}</span>
          <span className="font-heading text-[12.5px] font-extrabold uppercase tracking-wide">{cat.nome}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {cat.funcoes.map((f, i) => {
            const nome = (atribuicoes[item.data]?.[f.id] ?? "").trim();
            return (
              <div
                key={f.id}
                className={"flex items-baseline justify-between gap-3 pb-1.5 " + (i < cat.funcoes.length - 1 ? "border-b border-white" : "")}
              >
                <span className="text-[11px] font-semibold text-ink-600">
                  {emojiFuncao(f.nome)} {f.nome}
                </span>
                <span className={"text-right text-[12.5px] font-extrabold uppercase " + (nome ? "text-pdfblue" : "italic font-medium normal-case text-ink-400")}>
                  {nome || "não preenchido"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    ));
  }

  /** Encontra o outro dia do mesmo fim de semana (sábado <-> domingo seguinte), se existir no mês. */
  function encontrarParDeFds(item: DiaInfo): { sab: DiaInfo; dom: DiaInfo } | null {
    if (item.diaSemana === 6) {
      const domStr = domingoSeguinte(item.data);
      const dom = dias.dom.find((d) => d.data === domStr);
      return dom ? { sab: item, dom } : null;
    }
    if (item.diaSemana === 0) {
      const sab = dias.sab.find((s) => domingoSeguinte(s.data) === item.data);
      return sab ? { sab, dom: item } : null;
    }
    return null;
  }

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center gap-3">
        {showExport && (
          <span className="mr-auto text-[12.5px] font-semibold text-ink-400">
            {temAlgumaFuncao && (
              <>
                <b className="text-ink-600">{diasDoMes.length}</b> culto(s) neste mês ·{" "}
                <b className="text-ink-600">{cultosCompletos}</b> completo(s)
              </>
            )}
          </span>
        )}
        <button
          type="button"
          onClick={handleSalvarTudo}
          disabled={salvandoTudo}
          className={showExport ? "btn-secondary" : "btn-primary ml-auto"}
        >
          {salvandoTudo ? "Salvando..." : "💾 Salvar"}
        </button>
        {showExport && (
          <button type="button" onClick={() => handleExportClick("mes")} className="btn-primary">
            📄 Exportar PDF do mês
          </button>
        )}
      </div>

      {toast && (
        <div className="no-print fixed bottom-5 right-5 z-50 rounded-xl bg-ink-900 px-4 py-3 text-sm font-semibold text-white shadow-soft-lift">
          {toast}
        </div>
      )}

      {confirmando && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 p-5">
          <div className="max-h-[82vh] w-full max-w-md overflow-auto rounded-2xl bg-white p-6 shadow-soft-lift">
            <div className="mb-2 flex items-center gap-2.5">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-red-50 text-[18px]">
                ⚠️
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

      <div className="print:hidden">
        <div className="mb-3 flex items-baseline justify-between px-0.5">
          <span className="text-[13px] font-extrabold uppercase tracking-wide text-ink-900">Fim de Semana</span>
          <span className="text-xs font-semibold tabular-nums text-ink-400">{fdsPares.length} fim(ns) de semana</span>
        </div>
        {fdsPares.length === 0 ? (
          <div className="empty-state mb-6">Nenhum culto de fim de semana neste mês.</div>
        ) : (
          <div className="mb-6 flex flex-col gap-4">
            {fdsPares.map((par) => (
              <div key={(par.sab ?? par.dom)!.data} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {par.sab ? renderCard(par.sab.data, par.sab.dia, par.sab.diaSemana) : <div />}
                {par.dom ? renderCard(par.dom.data, par.dom.dia, par.dom.diaSemana) : <div />}
              </div>
            ))}
          </div>
        )}

        <div className="mb-3 flex items-baseline justify-between px-0.5">
          <span className="text-[13px] font-extrabold uppercase tracking-wide text-ink-900">Meio de Semana</span>
          <span className="text-xs font-semibold tabular-nums text-ink-400">{dias.qua.length}</span>
        </div>
        {dias.qua.length === 0 ? (
          <div className="empty-state">Nenhum culto de meio de semana neste mês.</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {dias.qua.map((d) => renderCard(d.data, d.dia, d.diaSemana))}
          </div>
        )}
      </div>

      {/* ---- PDF do mês inteiro (compacto, 2 colunas) ---- */}
      {printTarget === "mes" && (
        <div className="hidden print:block">
          <div className="mb-4 flex items-center gap-3 border-b-2 border-pdfblue pb-3">
            <img src="/logo-icon.png" alt="" className="h-9 w-9 rounded-full" />
            <div className="flex flex-col">
              <span className="font-heading text-base font-extrabold text-pdfblue">
                Escala de Serviço — Promessa Vila Camargo
              </span>
              <span className="text-[11px] font-semibold text-ink-600">
                {nomeMes(mes)} de {ano}
              </span>
            </div>
          </div>
          <div className="columns-2 gap-6">
            {diasDoMes.map((d) => (
              <div key={d.data} className="mb-3 break-inside-avoid border-b border-pdfgray pb-2.5">
                <div className="mb-1 font-heading text-[11.5px] font-extrabold uppercase tracking-wide text-pdfblue">
                  {nomeDiaSemana(d.diaSemana)} • {fmtDDMM(ano, mes, d.dia)}/{ano}
                </div>
                {renderMinisterioCompacto(d)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- PDF de um culto / fim de semana (documento oficial, espaçoso) ---- */}
      {printTarget && printTarget !== "mes" && (
        <div className="hidden print:block">
          <div className="mb-7 flex items-center gap-4 border-b-4 border-pdfblue pb-4">
            <img src="/logo-icon.png" alt="" className="h-16 w-16 rounded-full" />
            <div className="flex flex-col">
              <span className="font-heading text-[10px] font-bold uppercase tracking-[0.2em] text-pdforange">
                Promessa Vila Camargo
              </span>
              <span className="font-heading text-[26px] font-extrabold text-pdfblue">Escala de Serviço</span>
            </div>
            <div className="ml-auto text-right">
              {(() => {
                const par = encontrarParDeFds(printTarget);
                if (par) {
                  return (
                    <>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Fim de semana</div>
                      <div className="font-heading text-lg font-extrabold text-pdfblue">
                        {fmtDDMM(ano, mes, par.sab.dia)} – {fmtDDMM(ano, mes, par.dom.dia)}/{ano}
                      </div>
                    </>
                  );
                }
                return (
                  <>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Data</div>
                    <div className="font-heading text-lg font-extrabold text-pdfblue">
                      {fmtDDMM(ano, mes, printTarget.dia)}/{ano}
                    </div>
                    <div className="text-[12px] font-semibold text-ink-600">{nomeDiaSemana(printTarget.diaSemana)}</div>
                  </>
                );
              })()}
            </div>
          </div>

          {(() => {
            const par = encontrarParDeFds(printTarget);
            if (par) {
              return (
                <div className="grid grid-cols-2 gap-x-8">
                  <div>
                    <div className="mb-3 rounded-full bg-pdfblue px-4 py-1.5 text-center font-heading text-[13px] font-extrabold uppercase tracking-wide text-white">
                      Sábado · {fmtDDMM(ano, mes, par.sab.dia)}
                    </div>
                    {renderColunaCulto(par.sab)}
                  </div>
                  <div>
                    <div className="mb-3 rounded-full bg-pdforange px-4 py-1.5 text-center font-heading text-[13px] font-extrabold uppercase tracking-wide text-white">
                      Domingo · {fmtDDMM(ano, mes, par.dom.dia)}
                    </div>
                    {renderColunaCulto(par.dom)}
                  </div>
                </div>
              );
            }
            return (
              <div className="mx-auto max-w-md">
                <div className="mb-3 rounded-full bg-pdfblue px-4 py-1.5 text-center font-heading text-[13px] font-extrabold uppercase tracking-wide text-white">
                  4ª feira · {fmtDDMM(ano, mes, printTarget.dia)}
                </div>
                {renderColunaCulto(printTarget)}
              </div>
            );
          })()}

          <div className="mt-10 border-t border-pdfgray pt-3 text-center text-[10px] text-ink-400">
            Escala de Serviço · Promessa Vila Camargo · gerado em {new Date().toLocaleDateString("pt-BR")}
          </div>
        </div>
      )}
    </div>
  );
}
