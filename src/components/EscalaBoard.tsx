"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { definirAtribuicao, definirObservacao, definirMinisterioResponsavel } from "@/lib/actions/escala";
import type { AtividadeDTO } from "@/lib/actions/atividade";
import {
  buildMonthDays,
  buildMonthDaysFlat,
  fmtDDMM,
  nomeDiaSemana,
  nomeMes,
  FUNCOES_SEM_REPETICAO_DOMINGO,
  MINISTERIOS_RESPONSAVEIS,
} from "@/lib/datas";
import type { CurrentUser } from "@/lib/auth/dal";
import { emojiMinisterio, emojiFuncao } from "@/lib/emojis";
import AtividadesDoDia from "./AtividadesDoDia";

/** Checkbox grande com suporte a estado "indeterminado" (parte das funções da categoria selecionada) — só dá pra setar via DOM, não como prop do React. */
function CheckboxTriState({
  checked,
  indeterminate,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <label className="flex cursor-pointer select-none items-center gap-2.5 py-0.5">
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-5 w-5 flex-none accent-orange-600"
      />
      <span className="text-[13px] font-medium text-ink-900">{label}</span>
    </label>
  );
}

export type FuncaoDTO = { id: string; nome: string; categoriaId: string; ordem: number; diasSemana: number[] };
export type CategoriaDTO = { id: string; nome: string; ordem: number; funcoes: FuncaoDTO[] };
export type AtribuicaoMap = Record<string, Record<string, string | null>>;
export type ObservacaoMap = Record<string, string>;
export type MinisterioResponsavelMap = Record<string, string>;

type DiaInfo = { data: string; dia: number; diaSemana: number };
type PrintTarget = "mes" | DiaInfo;
type ParFds = { sab: DiaInfo | null; dom: DiaInfo | null };

const SAVE_DEBOUNCE_MS = 600;

export default function EscalaBoard({
  ano,
  mes,
  categorias,
  atribuicoesIniciais,
  observacoesIniciais,
  ministeriosResponsaveisIniciais,
  atividadesIniciais,
  currentUser,
  showExport,
}: {
  ano: number;
  mes: number;
  categorias: CategoriaDTO[];
  atribuicoesIniciais: AtribuicaoMap;
  observacoesIniciais?: ObservacaoMap;
  ministeriosResponsaveisIniciais?: MinisterioResponsavelMap;
  atividadesIniciais?: Record<string, AtividadeDTO[]>;
  currentUser: CurrentUser;
  showExport?: boolean;
}) {
  const [atribuicoes, setAtribuicoes] = useState(atribuicoesIniciais);
  const [observacoes, setObservacoes] = useState<ObservacaoMap>(observacoesIniciais ?? {});
  const [ministeriosResponsaveis, setMinisteriosResponsaveis] = useState<MinisterioResponsavelMap>(
    ministeriosResponsaveisIniciais ?? {}
  );
  const [atividades, setAtividades] = useState<Record<string, AtividadeDTO[]>>(atividadesIniciais ?? {});
  const [, startTransition] = useTransition();
  const [confirmando, setConfirmando] = useState<{
    alvo: PrintTarget;
    acao: "preview" | "baixar";
    pendentes: { data: string; dia: number; diaSemana: number; faltando: string[] }[];
  } | null>(null);
  const [printTarget, setPrintTarget] = useState<PrintTarget | null>(null);
  const [previewAberto, setPreviewAberto] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [salvandoTudo, setSalvandoTudo] = useState(false);
  const [modalExportAlvo, setModalExportAlvo] = useState<PrintTarget | null>(null);
  const [selecaoExport, setSelecaoExport] = useState<Record<string, boolean>>({});
  const [categoriasExpandidas, setCategoriasExpandidas] = useState<Record<string, boolean>>({});
  const [incluirAtividadesExport, setIncluirAtividadesExport] = useState(true);
  const [erroSelecaoExport, setErroSelecaoExport] = useState<string | null>(null);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const obsTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
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

  /** Todas as funções do sistema (pro "Selecionar todas"/"Limpar seleção" do modal de exportação). */
  const todasFuncaoIdsExport = useMemo(() => categorias.flatMap((c) => c.funcoes.map((f) => f.id)), [categorias]);

  /** Selecionada por padrão até o usuário mexer no modal — não existe uma "seleção anterior" persistida. */
  function isSelecionadaExport(funcaoId: string) {
    return selecaoExport[funcaoId] ?? true;
  }

  /** "checked" (todas as funções marcadas), "unchecked" (nenhuma) ou "indeterminate" (só algumas) — pro checkbox da categoria no modal de exportação. */
  function estadoCategoriaExport(cat: CategoriaDTO): "checked" | "unchecked" | "indeterminate" {
    if (cat.funcoes.length === 0) return "unchecked";
    const marcadas = cat.funcoes.filter((f) => isSelecionadaExport(f.id)).length;
    if (marcadas === cat.funcoes.length) return "checked";
    if (marcadas === 0) return "unchecked";
    return "indeterminate";
  }

  /** Clicar na categoria (fora do indeterminado) alterna todas as funções dela de uma vez; no indeterminado, marca todas. */
  function toggleCategoriaExport(cat: CategoriaDTO) {
    const marcarTudo = estadoCategoriaExport(cat) !== "checked";
    setSelecaoExport((old) => {
      const next = { ...old };
      for (const f of cat.funcoes) next[f.id] = marcarTudo;
      return next;
    });
    setErroSelecaoExport(null);
  }

  function toggleFuncaoExport(funcaoId: string) {
    setSelecaoExport((old) => ({ ...old, [funcaoId]: !isSelecionadaExport(funcaoId) }));
    setErroSelecaoExport(null);
  }

  function selecionarTodasExport() {
    setSelecaoExport(Object.fromEntries(todasFuncaoIdsExport.map((id) => [id, true])));
    setErroSelecaoExport(null);
  }

  function limparSelecaoExport() {
    setSelecaoExport(Object.fromEntries(todasFuncaoIdsExport.map((id) => [id, false])));
  }

  function toggleCategoriaExpandida(catId: string) {
    setCategoriasExpandidas((old) => ({ ...old, [catId]: !(old[catId] ?? true) }));
  }

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

  /** Atualiza o estado local — e, se for sábado de uma função que também vale no domingo, espelha no domingo também (o servidor já faz essa cópia; aqui é só pra tela não esperar um reload pra mostrar). Não vale pras funções em FUNCOES_SEM_REPETICAO_DOMINGO. */
  function applyLocalChange(data: string, funcaoId: string, value: string) {
    setAtribuicoes((old) => {
      const next = { ...old, [data]: { ...old[data], [funcaoId]: value } };
      const diaSemana = new Date(data).getUTCDay();
      const funcao = funcaoById(funcaoId);
      if (diaSemana === 6 && funcao?.diasSemana.includes(0) && !FUNCOES_SEM_REPETICAO_DOMINGO.includes(funcao.nome)) {
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

  function commitObservacao(data: string, texto: string) {
    startTransition(async () => {
      try {
        await definirObservacao(data, texto || null);
      } catch (e) {
        alert(e instanceof Error ? e.message : "Não foi possível salvar a observação.");
      }
    });
  }

  function handleObsChange(data: string, value: string) {
    setObservacoes((old) => ({ ...old, [data]: value }));
    if (obsTimers.current[data]) clearTimeout(obsTimers.current[data]);
    obsTimers.current[data] = setTimeout(() => commitObservacao(data, value), SAVE_DEBOUNCE_MS);
  }

  function handleObsBlur(data: string, value: string) {
    if (obsTimers.current[data]) {
      clearTimeout(obsTimers.current[data]);
      delete obsTimers.current[data];
    }
    commitObservacao(data, value);
  }

  /** Ministério/departamento responsável por organizar o culto (só sábado/domingo) — commit direto, sem debounce (é um select, não texto). */
  function handleMinisterioResponsavelChange(data: string, valor: string) {
    setMinisteriosResponsaveis((old) => ({ ...old, [data]: valor }));
    startTransition(async () => {
      try {
        await definirMinisterioResponsavel(data, valor || null);
      } catch (e) {
        alert(e instanceof Error ? e.message : "Não foi possível salvar o ministério responsável.");
      }
    });
  }

  function handleAtividadesChange(data: string, novas: AtividadeDTO[]) {
    setAtividades((old) => ({ ...old, [data]: novas }));
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
              onClick={() => handleAbrirModalExport({ data, dia, diaSemana })}
              className="flex-none rounded-md p-1 text-[15px] text-ink-400 hover:bg-brand-50 hover:text-orange-600"
            >
              🖨️
            </button>
          )}
        </div>

        {(diaSemana === 6 || diaSemana === 0) && (isAdmin || ministeriosResponsaveis[data]) && (
          <div className="mb-2.5 flex items-center gap-2 border-b border-brand-100 pb-2">
            <span className="text-[11px] font-semibold text-ink-600">🏛️</span>
            {isAdmin ? (
              <select
                value={ministeriosResponsaveis[data] ?? ""}
                onChange={(e) => handleMinisterioResponsavelChange(data, e.target.value)}
                className="flex-1 rounded-md border border-brand-200 bg-white px-2 py-1 text-[11px] font-semibold text-ink-900 outline-none focus:border-orange-500"
              >
                <option value="">Ministério responsável — selecionar</option>
                {MINISTERIOS_RESPONSAVEIS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            ) : (
              <span className="badge-neutral">{ministeriosResponsaveis[data]}</span>
            )}
          </div>
        )}

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

        {(isAdmin || (observacoes[data] ?? "").trim()) && (
          <div className="mt-2.5 border-t border-brand-100 pt-2">
            {isAdmin ? (
              <textarea
                rows={2}
                placeholder="📝 Observação (ex: também teremos culto à noite às 19h)..."
                value={observacoes[data] ?? ""}
                onChange={(e) => handleObsChange(data, e.target.value)}
                onBlur={(e) => handleObsBlur(data, e.target.value)}
                className="w-full resize-none rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[11.5px] leading-snug text-ink-600 outline-none placeholder:italic placeholder:text-ink-400 hover:border-brand-200 hover:bg-brand-50 focus:border-orange-500 focus:bg-white"
              />
            ) : (
              <p className="px-1.5 text-[11.5px] leading-snug text-ink-600">📝 {observacoes[data]}</p>
            )}
          </div>
        )}

        <AtividadesDoDia
          data={data}
          atividades={atividades[data] ?? []}
          onChange={(novas) => handleAtividadesChange(data, novas)}
          isAdmin={isAdmin}
        />
      </div>
    );
  }

  const diasDoMes = useMemo(() => buildMonthDaysFlat(ano, mes), [ano, mes]);
  const cultosCompletos = temAlgumaFuncao
    ? diasDoMes.filter((d) => missingList(d.data, d.diaSemana).length === 0).length
    : 0;

  /** Abre o modal "Selecionar conteúdo da escala" — a exportação de verdade só começa depois de confirmar lá. Seleção sempre começa com tudo marcado, nunca herda a de uma exportação anterior. */
  function handleAbrirModalExport(alvo: PrintTarget) {
    setSelecaoExport(Object.fromEntries(todasFuncaoIdsExport.map((id) => [id, true])));
    setCategoriasExpandidas({});
    setErroSelecaoExport(null);
    setModalExportAlvo(alvo);
  }

  function handleConfirmarSelecaoExport(acao: "preview" | "baixar") {
    const temAlgumaSelecionada = todasFuncaoIdsExport.some((id) => isSelecionadaExport(id));
    if (!temAlgumaSelecionada) {
      setErroSelecaoExport("Selecione pelo menos uma categoria ou função para gerar a escala.");
      return;
    }
    const alvo = modalExportAlvo;
    setModalExportAlvo(null);
    if (alvo) handleExportClick(alvo, acao);
  }

  function finalizarExport(alvo: PrintTarget, acao: "preview" | "baixar") {
    setPrintTarget(alvo);
    if (acao === "preview") {
      setPreviewAberto(true);
    } else {
      setTimeout(() => window.print(), 30);
    }
  }

  function handleExportClick(alvo: PrintTarget, acao: "preview" | "baixar" = "baixar") {
    if (!temAlgumaFuncao) {
      finalizarExport(alvo, acao);
      return;
    }
    const diasParaChecar = alvo === "mes" ? diasDoMes : [alvo];
    const pendentes = diasParaChecar
      .map((d) => ({ ...d, faltando: missingListExport(d.data, d.diaSemana) }))
      .filter((d) => d.faltando.length > 0);

    if (pendentes.length > 0) {
      setConfirmando({ alvo, acao, pendentes });
    } else {
      finalizarExport(alvo, acao);
    }
  }

  /** Monta e abre uma mensagem de WhatsApp com a escala do mês inteiro (como vocês costumam enviar), um culto após o outro. */
  function handleCompartilharMesWhatsapp() {
    const linhas: string[] = [`📋 *Escala — ${nomeMes(mes)} de ${ano}*`, ""];
    for (const d of diasDoMes) {
      const categoriasDia = categoriasDoDia(d.diaSemana);
      if (categoriasDia.length === 0) continue;

      linhas.push(`*${nomeDiaSemana(d.diaSemana)} · ${fmtDDMM(ano, mes, d.dia)}*`);
      const ministerio = ministeriosResponsaveis[d.data];
      if (ministerio) linhas.push(`🏛️ ${ministerio}`);
      for (const cat of categoriasDia) {
        for (const f of cat.funcoes) {
          const nome = (atribuicoes[d.data]?.[f.id] ?? "").trim();
          linhas.push(`${emojiFuncao(f.nome)} ${f.nome}: ${nome || "❌ (pendente)"}`);
        }
      }
      const nota = (observacoes[d.data] ?? "").trim();
      if (nota) linhas.push(`📝 ${nota}`);
      linhas.push("");
    }
    const texto = linhas.join("\n");
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener,noreferrer");
  }

  /** Botão "Salvar": força o commit imediato de tudo que ainda estava esperando o debounce e avisa com um toast. */
  async function handleSalvarTudo() {
    const pendentes = Object.entries(saveTimers.current);
    for (const [key, timer] of pendentes) {
      clearTimeout(timer);
      delete saveTimers.current[key];
    }
    const pendentesObs = Object.entries(obsTimers.current);
    for (const [data, timer] of pendentesObs) {
      clearTimeout(timer);
      delete obsTimers.current[data];
    }
    setSalvandoTudo(true);
    try {
      await Promise.all([
        ...pendentes.map(([key]) => {
          const [data, funcaoId] = key.split(":");
          const valor = (atribuicoes[data]?.[funcaoId] ?? "").trim().toUpperCase();
          return definirAtribuicao(data, funcaoId, valor || null);
        }),
        ...pendentesObs.map(([data]) => definirObservacao(data, observacoes[data] ?? "")),
      ]);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast("Escala salva com sucesso! ✅");
      toastTimer.current = setTimeout(() => setToast(null), 3000);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Não foi possível salvar tudo.");
    } finally {
      setSalvandoTudo(false);
    }
  }

  /** Usada só na exportação — além do dia da semana, respeita o que foi escolhido no modal "Selecionar conteúdo da escala". */
  function categoriasDoDiaCompleto(diaSemana: number) {
    return categorias
      .map((c) => ({
        ...c,
        funcoes: c.funcoes.filter((f) => f.diasSemana.includes(diaSemana) && isSelecionadaExport(f.id)),
      }))
      .filter((c) => c.funcoes.length > 0);
  }

  /** Mesma ideia de missingList, mas só considera o que foi selecionado pra exportar (pra não avisar de função que o usuário excluiu de propósito). */
  function missingListExport(data: string, diaSemana: number) {
    const out: string[] = [];
    for (const cat of categoriasDoDiaCompleto(diaSemana)) {
      for (const f of cat.funcoes) {
        if (!atribuicoes[data]?.[f.id]?.trim()) out.push(f.nome);
      }
    }
    return out;
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

  type LinhaTabela = { tipo: "fds"; sab: DiaInfo | null; dom: DiaInfo | null } | { tipo: "qua"; dia: DiaInfo };

  /** Todas as linhas do mês (fim de semana + quarta), em ordem cronológica — base da tabela de programação. */
  function construirLinhasTabela(): LinhaTabela[] {
    const linhas: LinhaTabela[] = [
      ...fdsPares.map((par): LinhaTabela => ({ tipo: "fds", sab: par.sab, dom: par.dom })),
      ...dias.qua.map((d): LinhaTabela => ({ tipo: "qua", dia: d })),
    ];
    return linhas.sort((a, b) => {
      const da = a.tipo === "fds" ? (a.sab ?? a.dom)!.data : a.dia.data;
      const db = b.tipo === "fds" ? (b.sab ?? b.dom)!.data : b.dia.data;
      return da < db ? -1 : da > db ? 1 : 0;
    });
  }

  /** Uma única linha, pro PDF de um culto/fim de semana específico (em vez do mês inteiro). */
  function linhaParaAlvo(alvo: DiaInfo): LinhaTabela {
    if (alvo.diaSemana === 3) return { tipo: "qua", dia: alvo };
    const par = encontrarParDeFds(alvo);
    if (par) return { tipo: "fds", sab: par.sab, dom: par.dom };
    return alvo.diaSemana === 6 ? { tipo: "fds", sab: alvo, dom: null } : { tipo: "fds", sab: null, dom: alvo };
  }

  /** Categorias/funções que vão virar colunas — já filtradas pelo que foi escolhido no modal de exportação. */
  function categoriasTabela() {
    return categorias
      .map((c) => ({ ...c, funcoes: c.funcoes.filter((f) => isSelecionadaExport(f.id)) }))
      .filter((c) => c.funcoes.length > 0);
  }

  function valorFuncao(data: string | null, funcaoId: string) {
    if (!data) return "";
    return (atribuicoes[data]?.[funcaoId] ?? "").trim();
  }

  /** Célula de uma categoria numa linha de fim de semana — empilha sábado/domingo; função vazia nos dois dias nem aparece. */
  function renderCelulaFds(cat: CategoriaDTO, sab: DiaInfo | null, dom: DiaInfo | null) {
    const funcoesAplicaveis = cat.funcoes.filter(
      (f) => (sab && f.diasSemana.includes(6)) || (dom && f.diasSemana.includes(0))
    );
    const linhasFuncao = funcoesAplicaveis
      .map((f) => ({
        f,
        vSab: sab && f.diasSemana.includes(6) ? valorFuncao(sab.data, f.id) : "",
        vDom: dom && f.diasSemana.includes(0) ? valorFuncao(dom.data, f.id) : "",
      }))
      .filter((l) => l.vSab || l.vDom);
    if (linhasFuncao.length === 0) return null;
    const multiplas = funcoesAplicaveis.length > 1;

    return (
      <div className="flex flex-col gap-1.5">
        {linhasFuncao.map(({ f, vSab, vDom }) => (
          <div key={f.id} className="flex flex-col gap-0.5">
            {multiplas && (
              <span className="text-[6.5px] font-bold uppercase leading-tight tracking-wide text-ink-400">
                {emojiFuncao(f.nome)} {f.nome}
              </span>
            )}
            {sab && vSab && <span className="text-[9.5px] font-bold uppercase leading-tight text-ink-900">{vSab}</span>}
            {dom && vDom && <span className="text-[9.5px] font-bold uppercase leading-tight text-ink-900">{vDom}</span>}
          </div>
        ))}
      </div>
    );
  }

  /** Célula de uma categoria numa linha de quarta-feira — um valor só, sem par sábado/domingo. */
  function renderCelulaQua(cat: CategoriaDTO, dia: DiaInfo) {
    const linhasFuncao = cat.funcoes
      .filter((f) => f.diasSemana.includes(3))
      .map((f) => ({ f, valor: valorFuncao(dia.data, f.id) }))
      .filter((l) => l.valor);
    if (linhasFuncao.length === 0) return null;
    const multiplas = linhasFuncao.length > 1;

    return (
      <div className="flex flex-col gap-1">
        {linhasFuncao.map(({ f, valor }) => (
          <div key={f.id} className="flex items-baseline gap-1">
            {multiplas && (
              <span className="text-[6.5px] font-bold uppercase leading-tight text-ink-400">{emojiFuncao(f.nome)}</span>
            )}
            <span className="text-[9.5px] font-bold uppercase leading-tight text-ink-900">{valor}</span>
          </div>
        ))}
      </div>
    );
  }

  /** Observação + atividades das datas de uma linha, numa faixa fininha embaixo da linha (não entra nas colunas). */
  function renderNotasLinha(datas: (string | null)[]) {
    const partes: { chave: string; texto: string }[] = [];
    for (const data of datas) {
      if (!data) continue;
      const ministerio = ministeriosResponsaveis[data];
      if (ministerio) partes.push({ chave: `min-${data}`, texto: `🏛️ ${ministerio}` });
      const nota = (observacoes[data] ?? "").trim();
      if (nota) partes.push({ chave: `nota-${data}`, texto: `📝 ${nota}` });
      if (incluirAtividadesExport) {
        for (const a of atividades[data] ?? []) {
          partes.push({
            chave: a.id,
            texto: `🎉 ${a.horario ? `${a.horario} ` : ""}${a.titulo}${a.ministerio ? ` · ${a.ministerio}` : ""}`,
          });
        }
      }
    }
    if (partes.length === 0) return null;
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-t border-dashed border-ink-900/15 px-2.5 py-1 text-[7.5px] italic text-ink-600">
        {partes.map((p) => (
          <span key={p.chave}>{p.texto}</span>
        ))}
      </div>
    );
  }

  const CORES_FAIXA = [
    "bg-brand-50",
    "bg-orange-50",
    "bg-[var(--color-pdfband-purple)]",
    "bg-green-50",
  ];

  /** Linha de cabeçalho — uma pílula por categoria, alinhada com as colunas das linhas abaixo. */
  function renderCabecalhoTabela(cats: CategoriaDTO[]) {
    return (
      <div
        className="mb-2 grid items-stretch gap-x-2"
        style={{ gridTemplateColumns: `62px 62px repeat(${cats.length}, minmax(0,1fr))` }}
      >
        <div />
        <div />
        {cats.map((cat) => (
          <div
            key={cat.id}
            className="flex items-center justify-center rounded-full bg-gradient-to-r from-pdfblue to-pdforange px-2 py-1.5 text-center"
          >
            <span className="font-heading text-[9px] font-extrabold uppercase leading-tight tracking-wide text-white">
              {emojiMinisterio(cat.nome)} {cat.nome}
            </span>
          </div>
        ))}
      </div>
    );
  }

  /** Uma linha completa da tabela (fim de semana ou quarta), com a faixa de cor e as notas embaixo. */
  function renderLinhaTabela(linha: LinhaTabela, cats: CategoriaDTO[], cor: string) {
    const chave = linha.tipo === "fds" ? (linha.sab ?? linha.dom)!.data : linha.dia.data;
    const datasDaLinha = linha.tipo === "fds" ? [linha.sab?.data ?? null, linha.dom?.data ?? null] : [linha.dia.data];

    return (
      <div key={chave} className={"mb-2 break-inside-avoid rounded-xl " + cor}>
        <div
          className="grid items-center gap-x-2 px-2 py-2"
          style={{ gridTemplateColumns: `62px 62px repeat(${cats.length}, minmax(0,1fr))` }}
        >
          {linha.tipo === "fds" ? (
            <>
              <div className="flex flex-col items-center justify-center rounded-lg bg-white/70 px-1 py-1.5">
                {linha.sab && (
                  <>
                    <span className="text-[7px] font-bold uppercase text-ink-600">Sábado</span>
                    <span className="font-heading text-[17px] font-extrabold leading-none text-ink-900">
                      {String(linha.sab.dia).padStart(2, "0")}
                    </span>
                  </>
                )}
              </div>
              <div className="flex flex-col items-center justify-center rounded-lg bg-white/70 px-1 py-1.5">
                {linha.dom && (
                  <>
                    <span className="text-[7px] font-bold uppercase text-ink-600">Domingo</span>
                    <span className="font-heading text-[17px] font-extrabold leading-none text-ink-900">
                      {String(linha.dom.dia).padStart(2, "0")}
                    </span>
                  </>
                )}
              </div>
              {cats.map((cat) => (
                <div key={cat.id} className="flex items-center justify-center text-center">
                  {renderCelulaFds(cat, linha.sab, linha.dom)}
                </div>
              ))}
            </>
          ) : (
            <>
              <div
                style={{ gridColumn: "1 / span 2" }}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-white/70 px-1 py-1.5"
              >
                <span className="text-[8px] font-bold uppercase text-ink-600">4ª feira</span>
                <span className="font-heading text-[17px] font-extrabold leading-none text-ink-900">
                  {String(linha.dia.dia).padStart(2, "0")}
                </span>
              </div>
              {cats.map((cat) => (
                <div key={cat.id} className="flex items-center justify-center text-center">
                  {renderCelulaQua(cat, linha.dia)}
                </div>
              ))}
            </>
          )}
        </div>
        {renderNotasLinha(datasDaLinha)}
      </div>
    );
  }

  /** Monta a tabela inteira (cabeçalho + linhas, cor alternando a cada fim de semana) pras linhas dadas. */
  function renderTabelaProgramacao(linhas: LinhaTabela[]) {
    const cats = categoriasTabela();
    let corIndex = -1;
    return (
      <div>
        {renderCabecalhoTabela(cats)}
        {linhas.map((linha) => {
          if (linha.tipo === "fds" || corIndex === -1) corIndex = (corIndex + 1) % CORES_FAIXA.length;
          return renderLinhaTabela(linha, cats, CORES_FAIXA[corIndex]);
        })}
      </div>
    );
  }

  /**
   * Conteúdo do PDF — usado tanto no bloco escondido que vira a impressão
   * real quanto dentro do modal de pré-visualização. É a MESMA função
   * chamada nos dois lugares, então o que o admin vê no "Visualizar" é
   * exatamente o que sai no "Baixar PDF" — não existem dois componentes
   * divergentes.
   */
  function renderPrintContent() {
    if (!printTarget) return null;
    const linhas = printTarget === "mes" ? construirLinhasTabela() : [linhaParaAlvo(printTarget)];

    return (
      <div>
        <div className="mb-5 flex items-center gap-4 border-b-4 border-pdfblue pb-3">
          <div className="flex flex-col">
            <span className="font-heading text-[10px] font-bold uppercase tracking-[0.3em] text-pdforange">
              Promessa Vila Camargo
            </span>
            <span className="font-heading text-[22px] font-extrabold uppercase tracking-wide text-pdfblue">
              Programação de Cultos — {nomeMes(mes)} {ano}
            </span>
          </div>
          <img src="/logo-icon.png" alt="" className="ml-auto h-12 w-12 flex-none rounded-full" />
        </div>

        {renderTabelaProgramacao(linhas)}

        <div className="mt-4 border-t border-pdfgray pt-2 text-center text-[9px] text-ink-400">
          Programação de Cultos · Promessa Vila Camargo · gerado em {new Date().toLocaleDateString("pt-BR")}
        </div>
      </div>
    );
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
          <button type="button" onClick={handleCompartilharMesWhatsapp} className="btn-secondary">
            📲 Compartilhar mês no WhatsApp
          </button>
        )}
        {showExport && (
          <button type="button" onClick={() => handleAbrirModalExport("mes")} className="btn-primary">
            📄 Exportar PDF do mês
          </button>
        )}
      </div>

      {modalExportAlvo && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 p-5">
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-soft-lift">
            <div className="border-b border-brand-100 px-6 py-4">
              <h3 className="font-heading text-base font-extrabold text-ink-900">Selecionar conteúdo da escala</h3>
              <p className="mt-0.5 text-[12px] text-ink-600">
                Escolha o que vai aparecer neste PDF — isso não muda a escala, só o que é exportado.
              </p>
            </div>

            <div className="flex items-center gap-3 border-b border-brand-100 px-6 py-2.5">
              <button type="button" onClick={selecionarTodasExport} className="link">
                Selecionar todas
              </button>
              <span className="text-ink-300">·</span>
              <button type="button" onClick={limparSelecaoExport} className="link">
                Limpar seleção
              </button>
              <span className="ml-auto text-[12px] font-semibold text-ink-600">
                {(() => {
                  const totalSelecionadas = todasFuncaoIdsExport.filter((id) => isSelecionadaExport(id)).length;
                  const categoriasComSelecao = categorias.filter((c) =>
                    c.funcoes.some((f) => isSelecionadaExport(f.id))
                  ).length;
                  if (totalSelecionadas === 0) return "Nada selecionado";
                  return `${totalSelecionadas} função(ões) selecionada(s) em ${categoriasComSelecao} categoria(s)`;
                })()}
              </span>
            </div>

            <div className="border-b border-brand-100 px-6 py-2.5">
              <label className="flex items-center gap-2 text-[12.5px] font-medium text-ink-900">
                <input
                  type="checkbox"
                  checked={incluirAtividadesExport}
                  onChange={(e) => setIncluirAtividadesExport(e.target.checked)}
                  className="h-4 w-4 accent-orange-600"
                />
                🎉 Incluir atividades adicionais
              </label>
            </div>

            <div className="flex-1 overflow-auto px-6 py-3">
              {categorias.map((cat) => {
                if (cat.funcoes.length === 0) return null;
                const estado = estadoCategoriaExport(cat);
                const expandida = categoriasExpandidas[cat.id] ?? true;
                return (
                  <div key={cat.id} className="mb-2.5 rounded-xl border border-brand-100">
                    <div className="flex items-center gap-1.5 px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => toggleCategoriaExpandida(cat.id)}
                        className="flex h-6 w-6 flex-none items-center justify-center text-ink-400 hover:text-ink-900"
                        aria-label={expandida ? "Recolher" : "Expandir"}
                      >
                        {expandida ? "▾" : "▸"}
                      </button>
                      <CheckboxTriState
                        checked={estado === "checked"}
                        indeterminate={estado === "indeterminate"}
                        onChange={() => toggleCategoriaExport(cat)}
                        label={`${emojiMinisterio(cat.nome)} ${cat.nome}`}
                      />
                    </div>
                    {expandida && (
                      <div className="flex flex-col gap-1 border-t border-brand-100 py-2 pl-12 pr-3">
                        {cat.funcoes.map((f) => (
                          <CheckboxTriState
                            key={f.id}
                            checked={isSelecionadaExport(f.id)}
                            indeterminate={false}
                            onChange={() => toggleFuncaoExport(f.id)}
                            label={`${emojiFuncao(f.nome)} ${f.nome}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {erroSelecaoExport && (
              <p className="border-t border-brand-100 px-6 py-2.5 text-[12.5px] font-medium text-red-600">
                {erroSelecaoExport}
              </p>
            )}

            <div className="flex justify-end gap-2 border-t border-brand-100 px-6 py-4">
              <button type="button" className="btn-ghost" onClick={() => setModalExportAlvo(null)}>
                Cancelar
              </button>
              <button type="button" className="btn-secondary" onClick={() => handleConfirmarSelecaoExport("preview")}>
                👁️ Visualizar
              </button>
              <button type="button" className="btn-primary" onClick={() => handleConfirmarSelecaoExport("baixar")}>
                ⬇️ Baixar PDF
              </button>
            </div>
          </div>
        </div>
      )}

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
                  const { alvo, acao } = confirmando;
                  setConfirmando(null);
                  finalizarExport(alvo, acao);
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

      <div className="hidden print:block">{renderPrintContent()}</div>

      {previewAberto && (
        <div className="no-print fixed inset-0 z-50 overflow-auto bg-ink-900/70 p-4 sm:p-8">
          <div className="sticky top-0 z-10 mb-4 flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-soft-lift">
            <span className="text-[13px] font-extrabold text-ink-900">👁️ Pré-visualização — igual ao PDF final</span>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost" onClick={() => setPreviewAberto(false)}>
                Fechar
              </button>
              <button type="button" className="btn-primary" onClick={() => window.print()}>
                🖨️ Baixar PDF
              </button>
            </div>
          </div>
          <div className="mx-auto max-w-[1150px] rounded-2xl bg-white p-6 shadow-soft-lift sm:p-10">
            {renderPrintContent()}
          </div>
        </div>
      )}
    </div>
  );
}
