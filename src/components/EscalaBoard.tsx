"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { definirAtribuicao, definirObservacao, definirMinisterioResponsavel } from "@/lib/actions/escala";
import type { AtividadeDTO } from "@/lib/actions/atividade";
import {
  buildMonthDays,
  buildMonthDaysFlat,
  fmtDDMM,
  nomeDiaSemanaLongo,
  nomeMes,
  parseIsoDate,
  labelFuncao,
  FUNCOES_SEM_REPETICAO_DOMINGO,
  MINISTERIOS_RESPONSAVEIS,
} from "@/lib/datas";
import {
  cabecalhoDocumento,
  cultosExportaveis,
  mensagemWhatsapp,
  pendenciasDoDia,
  CONTEUDO_COMPLETO,
  type ConteudoExportacao,
  type DadosEscala,
} from "@/lib/exportacao";
import type { CurrentUser } from "@/lib/auth/dal";
import AtividadesDoDia from "./AtividadesDoDia";
import MonthYearPicker from "./MonthYearPicker";
import Icon, { Spinner } from "./ui/Icon";
import Modal from "./ui/Modal";
import type { ItemMenu } from "./ui/Menu";
import Impressao, { abrirImpressao } from "./ui/Impressao";
import CultoCard from "./escala/CultoCard";
import FuncaoLinha, { DivisorMinisterio, type StatusConfirmacao } from "./escala/FuncaoLinha";
import SeletorExportacao, { type AcaoExportacao } from "./escala/SeletorExportacao";
import DocumentoEscala from "./escala/DocumentoEscala";

export type FuncaoDTO = { id: string; nome: string; categoriaId: string; ordem: number; diasSemana: number[] };
export type CategoriaDTO = { id: string; nome: string; ordem: number; funcoes: FuncaoDTO[] };
export type AtribuicaoMap = Record<string, Record<string, string | null>>;
export type ObservacaoMap = Record<string, string>;
export type MinisterioResponsavelMap = Record<string, string>;
export type ConfirmacaoMap = Record<string, Record<string, StatusConfirmacao>>;

type DiaInfo = { data: string; dia: number; diaSemana: number };
type ParFds = { sab: DiaInfo | null; dom: DiaInfo | null };
/** Um pedido de exportação já decidido: quais datas e qual conteúdo — o PDF é gerado só a partir disso. */
type Exportacao = { datas: string[]; conteudo: ConteudoExportacao };

const SAVE_DEBOUNCE_MS = 600;

function normalizar(v: string | null | undefined) {
  return (v ?? "").trim().toUpperCase();
}

export default function EscalaBoard({
  ano,
  mes,
  basePath,
  rotulo = "Escala oficial",
  descricao,
  categorias,
  atribuicoesIniciais,
  observacoesIniciais,
  ministeriosResponsaveisIniciais,
  atividadesIniciais,
  confirmacoesIniciais,
  currentUser,
  showExport,
  pessoasCadastradas,
}: {
  ano: number;
  mes: number;
  /** Rota da página (pra navegação de mês). */
  basePath: string;
  rotulo?: string;
  descricao?: string;
  categorias: CategoriaDTO[];
  atribuicoesIniciais: AtribuicaoMap;
  observacoesIniciais?: ObservacaoMap;
  ministeriosResponsaveisIniciais?: MinisterioResponsavelMap;
  atividadesIniciais?: Record<string, AtividadeDTO[]>;
  /** Status de confirmação (Som, Datashow, Mídia, Transmissão) de quem tem login — só leitura aqui. */
  confirmacoesIniciais?: ConfirmacaoMap;
  currentUser: CurrentUser;
  showExport?: boolean;
  /** Nomes dos logins ativos — vira sugestão de autocompletar no campo de texto livre "escalado". Digitar exatamente um desses nomes é o que liga essa atribuição à tela de confirmação da pessoa. */
  pessoasCadastradas?: string[];
}) {
  const [atribuicoes, setAtribuicoes] = useState(atribuicoesIniciais);
  const [observacoes, setObservacoes] = useState<ObservacaoMap>(observacoesIniciais ?? {});
  const [ministeriosResponsaveis, setMinisteriosResponsaveis] = useState<MinisterioResponsavelMap>(
    ministeriosResponsaveisIniciais ?? {}
  );
  const [atividades, setAtividades] = useState<Record<string, AtividadeDTO[]>>(atividadesIniciais ?? {});
  const [aviso, setAviso] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);
  const [salvandoTudo, setSalvandoTudo] = useState(false);
  const [ultimoSalvamento, setUltimoSalvamento] = useState<Date | null>(null);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const obsTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const avisoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Último valor (normalizado) enviado ao servidor por campo — sair de um campo sem ter mudado nada não regrava. */
  const ultimoEnviado = useRef<Record<string, string>>({});

  // ---- exportação / compartilhamento ----
  const cultosExport = useMemo(() => cultosExportaveis(ano, mes), [ano, mes]);
  /** Datas marcadas no seletor — começa com o mês inteiro e fica guardada enquanto a tela está aberta. */
  const [datasSelecionadas, setDatasSelecionadas] = useState<string[]>(() => cultosExport.map((c) => c.data));
  const [funcoesExcluidas, setFuncoesExcluidas] = useState<Set<string>>(() => new Set());
  const [incluirAtividades, setIncluirAtividades] = useState(true);
  const [seletorAberto, setSeletorAberto] = useState<null | "pdf" | "whatsapp">(null);
  const [exportacao, setExportacao] = useState<Exportacao | null>(null);
  const [pendentesExport, setPendentesExport] = useState<{
    exp: Exportacao;
    acao: "baixar" | "visualizar";
    dias: { data: string; faltando: string[] }[];
  } | null>(null);
  const [previewAberto, setPreviewAberto] = useState(false);
  const [imprimindo, setImprimindo] = useState(false);

  /**
   * Indicador global de autosave — reflete o estado de QUALQUER campo sendo
   * digitado/salvo no momento. "digitando" enquanto há um debounce pendente,
   * "salvando" enquanto a requisição está em voo, "erro" quando a última
   * tentativa falhou (e aí o próprio commitComRetry reagenda sozinho — não é
   * o usuário quem precisa tentar de novo), "salvo" depois que tudo que
   * estava pendente terminou com sucesso.
   */
  const [saveStatus, setSaveStatus] = useState<"idle" | "digitando" | "salvando" | "salvo" | "erro">("idle");
  const inflightRef = useRef(0);
  const tentativasErro = useRef<Record<string, number>>({});

  function temPendenciaDeDigitacao() {
    return Object.keys(saveTimers.current).length > 0 || Object.keys(obsTimers.current).length > 0;
  }

  /** Chamado depois que uma requisição termina (sucesso) — decide se ainda há outra coisa em fila ou se já pode mostrar "Salvo". */
  function atualizarStatusAposRequisicao() {
    if (inflightRef.current > 0) return;
    if (temPendenciaDeDigitacao()) {
      setSaveStatus("digitando");
    } else {
      setSaveStatus("salvo");
      setUltimoSalvamento(new Date());
    }
  }

  // Avisa antes de fechar/recarregar a aba se ainda há algo não salvo.
  useEffect(() => {
    function antesDeSair(e: BeforeUnloadEvent) {
      if (inflightRef.current > 0 || temPendenciaDeDigitacao()) e.preventDefault();
    }
    window.addEventListener("beforeunload", antesDeSair);
    return () => window.removeEventListener("beforeunload", antesDeSair);
  }, []);

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

  function mostrarAviso(tipo: "sucesso" | "erro", texto: string) {
    if (avisoTimer.current) clearTimeout(avisoTimer.current);
    setAviso({ tipo, texto });
    avisoTimer.current = setTimeout(() => setAviso(null), tipo === "erro" ? 6000 : 3000);
  }

  /**
   * Executa um salvamento com retry automático — se falhar (rede caiu, API
   * fora do ar), não perde o texto digitado nem exige que o usuário tente de
   * novo: reagenda sozinho com backoff crescente (até 10s) e continua
   * tentando indefinidamente, pra pegar a conexão assim que ela voltar.
   * `key` identifica o campo (pra uma nova digitação nele cancelar um retry
   * antigo que esteja esperando pra disparar).
   */
  function commitComRetry(key: string, salvar: () => Promise<void>) {
    inflightRef.current++;
    setSaveStatus("salvando");
    salvar()
      .then(() => {
        delete tentativasErro.current[key];
        inflightRef.current--;
        atualizarStatusAposRequisicao();
      })
      .catch(() => {
        inflightRef.current--;
        setSaveStatus("erro");
        const tentativa = (tentativasErro.current[key] ?? 0) + 1;
        tentativasErro.current[key] = tentativa;
        const espera = Math.min(2000 * tentativa, 10000);
        saveTimers.current[key] = setTimeout(() => {
          delete saveTimers.current[key];
          commitComRetry(key, salvar);
        }, espera);
      });
  }

  function valorEnviado(data: string, funcaoId: string) {
    const key = `${data}:${funcaoId}`;
    return key in ultimoEnviado.current ? ultimoEnviado.current[key] : normalizar(atribuicoesIniciais[data]?.[funcaoId]);
  }

  function commitSave(data: string, funcaoId: string, nome: string | null) {
    const key = `${data}:${funcaoId}`;
    ultimoEnviado.current[key] = normalizar(nome);
    commitComRetry(key, () => definirAtribuicao(data, funcaoId, nome));
  }

  function handleTextChange(data: string, funcaoId: string, value: string) {
    applyLocalChange(data, funcaoId, value);
    const key = `${data}:${funcaoId}`;
    if (saveTimers.current[key]) clearTimeout(saveTimers.current[key]);
    delete tentativasErro.current[key];
    setSaveStatus("digitando");
    saveTimers.current[key] = setTimeout(() => {
      delete saveTimers.current[key];
      commitSave(data, funcaoId, value);
    }, SAVE_DEBOUNCE_MS);
  }

  function handleBlurCommit(data: string, funcaoId: string, value: string) {
    const key = `${data}:${funcaoId}`;
    const tinhaPendente = Boolean(saveTimers.current[key]);
    if (tinhaPendente) {
      clearTimeout(saveTimers.current[key]);
      delete saveTimers.current[key];
    }
    // Nomes são sempre salvos em caixa alta — já reflete isso na tela ao
    // sair do campo, sem esperar o servidor/reload pra mostrar certo.
    const maiuscula = value.trim().toUpperCase();
    if (maiuscula !== value) applyLocalChange(data, funcaoId, maiuscula);
    if (!tinhaPendente && maiuscula === valorEnviado(data, funcaoId)) return;
    commitSave(data, funcaoId, maiuscula);
  }

  function commitObservacao(data: string, texto: string) {
    const key = `obs:${data}`;
    commitComRetry(key, () => definirObservacao(data, texto || null));
  }

  function handleObsChange(data: string, value: string) {
    setObservacoes((old) => ({ ...old, [data]: value }));
    if (obsTimers.current[data]) clearTimeout(obsTimers.current[data]);
    delete tentativasErro.current[`obs:${data}`];
    setSaveStatus("digitando");
    obsTimers.current[data] = setTimeout(() => {
      delete obsTimers.current[data];
      commitObservacao(data, value);
    }, SAVE_DEBOUNCE_MS);
  }

  function handleObsBlur(data: string, value: string) {
    if (!obsTimers.current[data]) return;
    clearTimeout(obsTimers.current[data]);
    delete obsTimers.current[data];
    commitObservacao(data, value);
  }

  /** Ministério/departamento responsável por organizar o culto (só sábado/domingo) — commit direto, sem debounce (é um select, não texto), mas com o mesmo retry automático dos outros campos. */
  function handleMinisterioResponsavelChange(data: string, valor: string) {
    setMinisteriosResponsaveis((old) => ({ ...old, [data]: valor }));
    commitComRetry(`min:${data}`, () => definirMinisterioResponsavel(data, valor || null));
  }

  function handleAtividadesChange(data: string, novas: AtividadeDTO[]) {
    setAtividades((old) => ({ ...old, [data]: novas }));
  }

  /** Botão "Salvar": força o commit imediato de tudo que ainda estava esperando o debounce. */
  async function handleSalvarTudo() {
    const pendentes = Object.entries(saveTimers.current).filter(([key]) => !key.startsWith("min:") && !key.startsWith("obs:"));
    for (const [key, timer] of pendentes) {
      clearTimeout(timer);
      delete saveTimers.current[key];
      delete tentativasErro.current[key];
    }
    const pendentesObs = Object.entries(obsTimers.current);
    for (const [data, timer] of pendentesObs) {
      clearTimeout(timer);
      delete obsTimers.current[data];
      delete tentativasErro.current[`obs:${data}`];
    }
    setSalvandoTudo(true);
    try {
      await Promise.all([
        ...pendentes.map(([key]) => {
          const [data, funcaoId] = key.split(":");
          const valor = normalizar(atribuicoes[data]?.[funcaoId]);
          ultimoEnviado.current[key] = valor;
          return definirAtribuicao(data, funcaoId, valor || null);
        }),
        ...pendentesObs.map(([data]) => definirObservacao(data, observacoes[data] ?? "")),
      ]);
      mostrarAviso("sucesso", "Escala salva");
      if (inflightRef.current === 0) {
        setSaveStatus("salvo");
        setUltimoSalvamento(new Date());
      }
    } catch (e) {
      mostrarAviso("erro", e instanceof Error ? e.message : "Não foi possível salvar tudo.");
      setSaveStatus("erro");
    } finally {
      setSalvandoTudo(false);
    }
  }

  // ---- exportação: PDF e WhatsApp a partir das datas escolhidas ----

  const dadosEscala: DadosEscala = {
    categorias,
    atribuicoes,
    observacoes,
    ministerios: ministeriosResponsaveis,
    atividades,
  };

  const progressoExport = useMemo(() => {
    const out: Record<string, { preenchidas: number; total: number }> = {};
    for (const c of cultosExport) {
      const funcoes = categorias.flatMap((cat) => cat.funcoes.filter((f) => f.diasSemana.includes(c.diaSemana)));
      out[c.data] = {
        total: funcoes.length,
        preenchidas: funcoes.filter((f) => (atribuicoes[c.data]?.[f.id] ?? "").trim()).length,
      };
    }
    return out;
  }, [cultosExport, categorias, atribuicoes]);

  function conteudoDoSeletor(): ConteudoExportacao {
    if (funcoesExcluidas.size === 0) return { funcoes: null, incluirAtividades };
    const incluidas = categorias.flatMap((c) => c.funcoes.map((f) => f.id)).filter((id) => !funcoesExcluidas.has(id));
    return { funcoes: new Set(incluidas), incluirAtividades };
  }

  function executar(acao: AcaoExportacao, exp: Exportacao) {
    if (exp.datas.length === 0) return;
    if (acao === "whatsapp") {
      const texto = mensagemWhatsapp(dadosEscala, exp.datas, exp.conteudo, ano, mes);
      window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener,noreferrer");
      return;
    }
    const dias = [...exp.datas]
      .sort()
      .map((data) => ({ data, faltando: pendenciasDoDia(dadosEscala, data, exp.conteudo) }))
      .filter((d) => d.faltando.length > 0);
    if (dias.length > 0) {
      setPendentesExport({ exp, acao, dias });
      return;
    }
    gerarPdf(exp, acao);
  }

  function gerarPdf(exp: Exportacao, acao: "baixar" | "visualizar") {
    setExportacao(exp);
    if (acao === "visualizar") setPreviewAberto(true);
    else imprimir(exp);
  }

  /**
   * Imprime só o documento: o bloco de impressão existe apenas durante a
   * impressão (some no "afterprint"), então nunca se mistura com a impressão
   * de uma escala extraordinária. O título da aba vira o nome sugerido do PDF.
   */
  function imprimir(exp: Exportacao) {
    setExportacao(exp);
    setImprimindo(true);
    abrirImpressao(cabecalhoDocumento(exp.datas, ano, mes).nomeArquivo, () => setImprimindo(false));
  }

  function confirmarSeletor(acao: AcaoExportacao) {
    const exp: Exportacao = { datas: [...datasSelecionadas], conteudo: conteudoDoSeletor() };
    setSeletorAberto(null);
    executar(acao, exp);
  }

  /** Ações do menu de cada card — sempre só aquele culto (ou aquele fim de semana), com todas as funções. */
  function acoesDoCulto(data: string, diaSemana: number) {
    const so = { datas: [data], conteudo: CONTEUDO_COMPLETO };
    const itens: ItemMenu[] = [
      { rotulo: "Baixar PDF deste culto", icone: "download", onSelect: () => executar("baixar", so) },
      { rotulo: "Visualizar PDF", icone: "eye", onSelect: () => executar("visualizar", so) },
      { rotulo: "Enviar no WhatsApp", icone: "message", onSelect: () => executar("whatsapp", so) },
    ];
    if (diaSemana === 6 || diaSemana === 0) {
      const sab = diaSemana === 6 ? data : addDiasIso(data, -1);
      const fds = { datas: [sab, addDiasIso(sab, 1)], conteudo: CONTEUDO_COMPLETO };
      itens.push({
        rotulo: "PDF do fim de semana",
        icone: "file",
        onSelect: () => executar("baixar", fds),
      });
    }
    return showExport ? itens : [];
  }

  function addDiasIso(data: string, delta: number) {
    const d = new Date(data);
    d.setUTCDate(d.getUTCDate() + delta);
    return d.toISOString().slice(0, 10);
  }

  // ---- render ----

  const confirmacoes = confirmacoesIniciais ?? {};

  function renderCard({ data, diaSemana }: DiaInfo) {
    const categoriasCard = categoriasDoDia(diaSemana);
    const totalCard = categoriasCard.reduce((n, c) => n + c.funcoes.length, 0);
    const faltando = missingList(data, diaSemana);
    const ehFds = diaSemana === 6 || diaSemana === 0;
    const ministerio = ministeriosResponsaveis[data] ?? "";
    const obs = observacoes[data] ?? "";
    const temRodape = isAdmin || obs.trim() || (atividades[data] ?? []).length > 0;

    return (
      <CultoCard
        key={data}
        data={data}
        diaSemana={diaSemana}
        preenchidas={totalCard - faltando.length}
        total={totalCard}
        acoes={acoesDoCulto(data, diaSemana)}
        responsavel={
          ehFds && (isAdmin || ministerio) ? (
            <label className="flex items-center gap-2.5 rounded-[10px] bg-paper px-3 py-1.5">
              <Icon name="building" size={16} className="text-ink-400" />
              <span className="text-[12px] whitespace-nowrap text-ink-500">Responsável</span>
              {isAdmin ? (
                <span className="relative min-w-0 flex-1">
                  <select
                    value={ministerio}
                    onChange={(e) => handleMinisterioResponsavelChange(data, e.target.value)}
                    className={
                      "h-8 w-full cursor-pointer appearance-none truncate rounded-[7px] bg-transparent pr-6 pl-1.5 text-[16px] font-semibold outline-none hover:bg-ink-100 focus-visible:ring-3 focus-visible:ring-brand-100 sm:text-[12.5px] " +
                      (ministerio ? "text-ink-900" : "font-normal text-ink-400")
                    }
                  >
                    <option value="">Selecionar ministério</option>
                    {MINISTERIOS_RESPONSAVEIS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <Icon
                    name="chevronDown"
                    size={14}
                    className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 text-ink-400"
                  />
                </span>
              ) : (
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink-900">{ministerio}</span>
              )}
            </label>
          ) : undefined
        }
        rodape={
          temRodape ? (
            <div className="flex flex-col gap-2.5">
              {(isAdmin || obs.trim()) && (
                <div className="flex items-start gap-2.5">
                  <Icon name="note" size={16} className="mt-[7px] text-ink-400" />
                  {isAdmin ? (
                    <textarea
                      rows={1}
                      placeholder="Observação do culto (ex.: também teremos culto à noite às 19h)"
                      value={obs}
                      onChange={(e) => handleObsChange(data, e.target.value)}
                      onBlur={(e) => handleObsBlur(data, e.target.value)}
                      aria-label="Observação do culto"
                      className="field-sizing-content min-h-8 w-full resize-none rounded-[8px] border border-transparent bg-transparent px-2 py-1.5 text-[16px] leading-snug text-ink-700 outline-none placeholder:text-ink-400 hover:bg-white focus:border-brand-600 focus:bg-white focus:ring-3 focus:ring-brand-100 sm:text-[13px]"
                    />
                  ) : (
                    <p className="py-1.5 text-[13px] leading-snug text-ink-700">{obs}</p>
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
          ) : undefined
        }
      >
        {categoriasCard.length === 0 ? (
          <p className="py-1 text-[13px] text-ink-500">
            {!temAlgumaFuncao
              ? "Cadastre ministérios e funções em Pessoas."
              : isAdmin
                ? "Nenhuma função vale para este dia."
                : "Nenhuma função foi atribuída ao seu login ainda (ou nenhuma das suas vale neste dia)."}
          </p>
        ) : (
          categoriasCard.map((cat) => (
            <div key={cat.id} className="pt-3.5 first:pt-0">
              <DivisorMinisterio nome={cat.nome} />
              {cat.funcoes.map((f) => {
                const valor = atribuicoes[data]?.[f.id] ?? "";
                const editavel = isAdmin || currentUser.funcaoIds.includes(f.id);
                // Status só vale enquanto o nome continua o mesmo que veio do servidor — editar o nome volta pra "aguardando".
                const status =
                  normalizar(valor) === normalizar(atribuicoesIniciais[data]?.[f.id])
                    ? (confirmacoes[data]?.[f.id] ?? null)
                    : null;
                return (
                  <FuncaoLinha
                    key={f.id}
                    label={labelFuncao(f.nome, diaSemana)}
                    valor={valor}
                    editavel={editavel}
                    onChange={(v) => handleTextChange(data, f.id, v)}
                    onBlur={(v) => handleBlurCommit(data, f.id, v)}
                    listaSugestoes={pessoasCadastradas && pessoasCadastradas.length > 0 ? "pessoas-cadastradas" : undefined}
                    status={status}
                  />
                );
              })}
            </div>
          ))
        )}
      </CultoCard>
    );
  }

  const diasDoMes = useMemo(() => buildMonthDaysFlat(ano, mes), [ano, mes]);
  const resumoMes = diasDoMes.reduce(
    (acc, d) => {
      const total = categoriasDoDia(d.diaSemana).reduce((n, c) => n + c.funcoes.length, 0);
      const faltando = missingList(d.data, d.diaSemana).length;
      acc.funcoes += total;
      acc.preenchidas += total - faltando;
      if (total > 0 && faltando === 0) acc.completos++;
      return acc;
    },
    { funcoes: 0, preenchidas: 0, completos: 0 }
  );
  const pctMes = resumoMes.funcoes > 0 ? Math.round((resumoMes.preenchidas / resumoMes.funcoes) * 100) : 0;
  const hora = ultimoSalvamento?.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const estadoSalvamento = {
    idle: { icone: <Icon name="checkCircle" size={15} />, texto: "Salvamento automático", cor: "text-ink-500" },
    digitando: { icone: <Icon name="note" size={15} />, texto: "Alterações pendentes…", cor: "text-ink-500" },
    salvando: { icone: <Spinner size={14} />, texto: "Salvando…", cor: "text-ink-600" },
    salvo: { icone: <Icon name="checkCircle" size={15} />, texto: hora ? `Salvo às ${hora}` : "Salvo", cor: "text-green-700" },
    erro: { icone: <Icon name="alert" size={15} />, texto: "Erro ao salvar — tentando de novo", cor: "text-red-600" },
  }[saveStatus];

  const docPreview = exportacao && (
    <DocumentoEscala dados={dadosEscala} datas={exportacao.datas} conteudo={exportacao.conteudo} ano={ano} mes={mes} />
  );

  return (
    <div>
      {pessoasCadastradas && pessoasCadastradas.length > 0 && (
        <datalist id="pessoas-cadastradas">
          {pessoasCadastradas.map((nome) => (
            <option key={nome} value={nome} />
          ))}
        </datalist>
      )}

      <div className="print:hidden">
        {/* 1–2. Título e mês */}
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="eyebrow flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              {rotulo}
            </div>
            <h1 className="mt-2 font-heading text-[30px] leading-[1.05] font-bold text-ink-900 sm:text-[36px]">
              {nomeMes(mes)} <span className="font-semibold text-ink-300">{ano}</span>
            </h1>
            {descricao && <p className="mt-2 max-w-xl text-[13.5px] text-ink-600">{descricao}</p>}
          </div>
          <MonthYearPicker ano={ano} mes={mes} basePath={basePath} />
        </header>

        {/* 3–4. Resumo e ações */}
        <div className="mt-6 flex flex-col gap-4 rounded-[14px] border border-line bg-white p-4 shadow-[0_1px_2px_rgb(20_34_53/0.04)] sm:p-5 lg:flex-row lg:items-center lg:gap-8">
          {temAlgumaFuncao ? (
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <dl className="flex items-stretch gap-5 sm:gap-7">
                <div>
                  <dt className="text-[12px] text-ink-500">Cultos</dt>
                  <dd className="font-heading text-[22px] leading-tight font-bold text-ink-900 tabular-nums">
                    {diasDoMes.length}
                  </dd>
                </div>
                <div className="w-px bg-line" />
                <div>
                  <dt className="text-[12px] text-ink-500">Completos</dt>
                  <dd className="font-heading text-[22px] leading-tight font-bold text-ink-900 tabular-nums">
                    {resumoMes.completos}
                    <span className="text-[14px] font-semibold text-ink-300">/{diasDoMes.length}</span>
                  </dd>
                </div>
                <div className="w-px bg-line" />
                <div className="min-w-0">
                  <dt className="text-[12px] text-ink-500">Funções preenchidas</dt>
                  <dd className="font-heading text-[22px] leading-tight font-bold text-ink-900 tabular-nums">
                    {pctMes}%
                  </dd>
                </div>
              </dl>
              <div className="flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100" role="presentation">
                  <div
                    className={
                      "h-full rounded-full transition-[width] duration-500 ease-premium " +
                      (pctMes === 100 ? "bg-green-500" : "bg-brand-700")
                    }
                    style={{ width: `${pctMes}%` }}
                  />
                </div>
                <span className="text-[12px] whitespace-nowrap text-ink-500 tabular-nums">
                  {resumoMes.preenchidas} de {resumoMes.funcoes}
                </span>
              </div>
            </div>
          ) : (
            <p className="flex-1 text-[13.5px] text-ink-600">Nenhuma função cadastrada ainda.</p>
          )}

          <div className="flex flex-col gap-2.5 border-t border-line pt-4 lg:items-end lg:border-t-0 lg:pt-0">
            <div className="flex items-center justify-between gap-3">
              <span
                className={"flex items-center gap-1.5 text-[12.5px] font-medium " + estadoSalvamento.cor}
                aria-live="polite"
              >
                {estadoSalvamento.icone}
                {estadoSalvamento.texto}
              </span>
              {/* Celular: "Salvar" fica na linha do status, as duas ações principais ganham a linha de baixo inteira. */}
              <button
                type="button"
                onClick={handleSalvarTudo}
                disabled={salvandoTudo}
                className="btn-ghost btn-sm text-brand-700 sm:hidden"
              >
                {salvandoTudo ? <Spinner size={14} /> : <Icon name="save" size={15} />}
                {salvandoTudo ? "Salvando…" : "Salvar agora"}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button
                type="button"
                onClick={handleSalvarTudo}
                disabled={salvandoTudo}
                className="btn-secondary hidden sm:inline-flex"
                title="Salvar agora"
              >
                {salvandoTudo ? <Spinner size={16} /> : <Icon name="save" size={17} className="text-ink-500" />}
                {salvandoTudo ? "Salvando…" : "Salvar"}
              </button>
              {showExport && (
                <button type="button" onClick={() => setSeletorAberto("whatsapp")} className="btn-secondary px-3">
                  <Icon name="message" size={17} className="text-ink-500" />
                  Compartilhar
                </button>
              )}
              {showExport && (
                <button type="button" onClick={() => setSeletorAberto("pdf")} className="btn-primary px-3">
                  <Icon name="file" size={17} />
                  Exportar PDF
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 5. Escala */}
        <section className="mt-10">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="font-heading text-[17px] font-bold text-ink-900">Fim de semana</h2>
            <span className="text-[12.5px] text-ink-500">
              {fdsPares.length} {fdsPares.length === 1 ? "fim de semana" : "fins de semana"}
            </span>
            <span className="h-px flex-1 bg-line" />
          </div>
          {fdsPares.length === 0 ? (
            <div className="empty-state">Nenhum culto de fim de semana neste mês.</div>
          ) : (
            <div className="flex flex-col gap-4 md:gap-5">
              {fdsPares.map((par) => (
                <div key={(par.sab ?? par.dom)!.data} className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
                  {par.sab ? renderCard(par.sab) : <div className="hidden md:block" />}
                  {par.dom ? renderCard(par.dom) : <div className="hidden md:block" />}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-10">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="font-heading text-[17px] font-bold text-ink-900">Quarta-feira</h2>
            <span className="text-[12.5px] text-ink-500">
              {dias.qua.length} {dias.qua.length === 1 ? "culto" : "cultos"}
            </span>
            <span className="h-px flex-1 bg-line" />
          </div>
          {dias.qua.length === 0 ? (
            <div className="empty-state">Nenhum culto de meio de semana neste mês.</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">{dias.qua.map((d) => renderCard(d))}</div>
          )}
        </section>
      </div>

      {/* Bloco de impressão: só existe enquanto o PDF está sendo gerado. */}
      {imprimindo && exportacao && <Impressao>{docPreview}</Impressao>}

      {seletorAberto && (
        <SeletorExportacao
          ano={ano}
          mes={mes}
          modo={seletorAberto}
          cultos={cultosExport}
          progresso={progressoExport}
          datas={datasSelecionadas}
          onDatasChange={setDatasSelecionadas}
          categorias={categorias}
          funcoesExcluidas={funcoesExcluidas}
          onFuncoesExcluidasChange={setFuncoesExcluidas}
          incluirAtividades={incluirAtividades}
          onIncluirAtividadesChange={setIncluirAtividades}
          onCancelar={() => setSeletorAberto(null)}
          onConfirmar={confirmarSeletor}
        />
      )}

      {pendentesExport && (
        <Modal
          largura="sm"
          onClose={() => setPendentesExport(null)}
          titulo="Há funções sem responsável"
          descricao="Elas não aparecem no PDF. Você pode voltar e preencher, ou gerar mesmo assim."
          rodape={
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className="btn-ghost h-10" onClick={() => setPendentesExport(null)}>
                Voltar para preencher
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  const { exp, acao } = pendentesExport;
                  setPendentesExport(null);
                  gerarPdf(exp, acao);
                }}
              >
                Gerar mesmo assim
              </button>
            </div>
          }
        >
          <ul className="flex flex-col gap-2 px-5 py-4 sm:px-6">
            {pendentesExport.dias.map((c) => {
              const { y, m, d } = parseIsoDate(c.data);
              return (
                <li key={c.data} className="rounded-[10px] border border-line bg-paper/60 px-3.5 py-2.5">
                  <div className="text-[13px] font-semibold text-ink-900">
                    {nomeDiaSemanaLongo(new Date(y, m, d).getDay())} · {fmtDDMM(y, m, d)}
                  </div>
                  <div className="mt-0.5 flex items-start gap-1.5 text-[12.5px] text-orange-700">
                    <span className="mt-[5px] h-[7px] w-[7px] flex-none rounded-full border-[1.5px] border-orange-500" />
                    {c.faltando.join(", ")}
                  </div>
                </li>
              );
            })}
          </ul>
        </Modal>
      )}

      {previewAberto && exportacao && (
        <PreviewDocumento
          titulo={cabecalhoDocumento(exportacao.datas, ano, mes).titulo}
          onFechar={() => setPreviewAberto(false)}
          onBaixar={() => imprimir(exportacao)}
        >
          {docPreview}
        </PreviewDocumento>
      )}

      {aviso && (
        <div
          role="status"
          className={
            "no-print fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 animate-rise-in items-center gap-2 rounded-full px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-soft-lift sm:left-auto sm:right-6 sm:translate-x-0 " +
            (aviso.tipo === "sucesso" ? "bg-ink-900" : "bg-red-600")
          }
        >
          <Icon name={aviso.tipo === "sucesso" ? "checkCircle" : "alert"} size={17} />
          {aviso.texto}
        </div>
      )}
      {!aviso && saveStatus === "erro" && (
        <div
          role="alert"
          className="no-print fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 animate-rise-in items-center gap-2 rounded-full bg-red-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow-soft-lift sm:left-auto sm:right-6 sm:translate-x-0"
        >
          <Icon name="alert" size={17} />
          Sem conexão — tentando salvar de novo
        </div>
      )}
    </div>
  );
}

/** Pré-visualização do PDF numa folha A4 — encolhe proporcionalmente em telas estreitas (sem rolagem lateral). */
function PreviewDocumento({
  titulo,
  onFechar,
  onBaixar,
  children,
}: {
  titulo: string;
  onFechar: () => void;
  onBaixar: () => void;
  children: React.ReactNode;
}) {
  const LARGURA_A4 = 794;
  const [escala, setEscala] = useState(1);
  const areaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function medir() {
      // clientWidth já desconta a barra de rolagem; 24px = respiro lateral (px-3).
      const largura = (areaRef.current?.clientWidth ?? window.innerWidth) - 24;
      setEscala(Math.min(1, largura / LARGURA_A4));
    }
    medir();
    window.addEventListener("resize", medir);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    document.addEventListener("keydown", tecla);
    return () => {
      window.removeEventListener("resize", medir);
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = overflow;
    };
  }, [onFechar]);

  return (
    <div className="no-print fixed inset-0 z-50 flex animate-fade-in flex-col bg-ink-950/80 backdrop-blur-[2px]">
      <div className="flex flex-none items-center gap-3 border-b border-white/10 bg-ink-950 px-4 py-3 text-white sm:px-6">
        <Icon name="eye" size={18} className="text-white/60" />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold tracking-[0.14em] text-white/50 uppercase">Pré-visualização</div>
          <div className="truncate text-[14px] font-semibold">{titulo}</div>
        </div>
        <button
          type="button"
          className="inline-flex h-10 items-center rounded-[10px] px-3 text-[13.5px] font-semibold text-white/80 hover:bg-white/10 hover:text-white"
          onClick={onFechar}
        >
          Fechar
        </button>
        <button type="button" className="btn-primary !bg-white !text-ink-900 hover:!bg-ink-100" onClick={onBaixar}>
          <Icon name="download" size={17} />
          <span className="hidden sm:inline">Baixar PDF</span>
          <span className="sm:hidden">PDF</span>
        </button>
      </div>
      <div ref={areaRef} className="flex-1 overflow-x-hidden overflow-y-auto px-3 py-6 sm:py-10">
        <div className="mx-auto" style={{ width: LARGURA_A4 * escala }}>
          <div
            className="origin-top-left rounded-[4px] bg-white p-[42px] shadow-soft-lift"
            style={{ width: LARGURA_A4, zoom: escala }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
