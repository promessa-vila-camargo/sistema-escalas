/**
 * Regras da exportação (PDF) e do compartilhamento (WhatsApp) da escala —
 * funções puras, sem React, pra que o que sai no arquivo dependa só das
 * datas e do conteúdo escolhidos, nunca do que está aberto na tela.
 *
 * Regra principal: só entra no documento/mensagem o que foi selecionado.
 * Selecionar um sábado gera só o sábado (o domingo não vem junto "de brinde");
 * sábado e domingo só aparecem lado a lado quando os dois foram escolhidos.
 */
import {
  addDays,
  buildMonthDays,
  diaSemanaDe,
  fmtDDMM,
  fmtDataExtenso,
  labelFuncao,
  nomeDiaSemanaLongo,
  nomeMes,
  parseIsoDate,
} from "./datas";
import { emojiFuncao } from "./emojis";

export type CultoExportavel = {
  data: string;
  dia: number;
  diaSemana: number;
  mes: number;
  ano: number;
  /** Parceiro de fim de semana que cai no mês vizinho (ex.: domingo 01/11 do sábado 31/10). */
  vizinho: boolean;
};

/**
 * Todos os cultos que podem entrar na exportação do mês: os do próprio mês e,
 * na virada, o outro dia do fim de semana que cai no mês vizinho — um fim de
 * semana nunca sai partido só porque atravessou a troca de mês.
 */
export function cultosExportaveis(ano: number, mes: number): CultoExportavel[] {
  const g = buildMonthDays(ano, mes);
  const doMes = new Set([...g.qua, ...g.sab, ...g.dom].map((d) => d.data));
  const extras = new Set<string>();
  for (const s of g.sab) {
    const dom = addDays(s.data, 1);
    if (!doMes.has(dom)) extras.add(dom);
  }
  for (const d of g.dom) {
    const sab = addDays(d.data, -1);
    if (!doMes.has(sab)) extras.add(sab);
  }
  return [...doMes, ...extras].sort().map((data) => {
    const { y, m, d } = parseIsoDate(data);
    return { data, dia: d, diaSemana: diaSemanaDe(data), mes: m, ano: y, vizinho: !(y === ano && m === mes) };
  });
}

export type BlocoDocumento = { tipo: "fds"; sab: string; dom: string } | { tipo: "unico"; data: string };

/**
 * Organiza as datas selecionadas em ordem cronológica. Sábado + domingo
 * seguinte viram um bloco de fim de semana (lado a lado) apenas quando as
 * duas datas estão na seleção. Nunca acrescenta uma data não selecionada.
 */
export function agruparDatas(datas: string[]): BlocoDocumento[] {
  const ordenadas = [...new Set(datas)].sort();
  const selecionadas = new Set(ordenadas);
  const usadas = new Set<string>();
  const blocos: BlocoDocumento[] = [];
  for (const data of ordenadas) {
    if (usadas.has(data)) continue;
    if (diaSemanaDe(data) === 6) {
      const dom = addDays(data, 1);
      if (selecionadas.has(dom)) {
        blocos.push({ tipo: "fds", sab: data, dom });
        usadas.add(dom);
        continue;
      }
    }
    blocos.push({ tipo: "unico", data });
  }
  return blocos;
}

export type CabecalhoDocumento = { rotulo: string; titulo: string; nomeArquivo: string };

function ddmmaaaa(iso: string) {
  const { y, m, d } = parseIsoDate(iso);
  return `${fmtDDMM(y, m, d)}/${y}`;
}

/** Título do PDF/mensagem conforme a seleção: um culto, um fim de semana, o mês inteiro ou uma seleção avulsa. */
export function cabecalhoDocumento(datas: string[], ano: number, mes: number): CabecalhoDocumento {
  const ordenadas = [...new Set(datas)].sort();
  const mesAno = `${nomeMes(mes)} de ${ano}`;
  const todas = cultosExportaveis(ano, mes).map((c) => c.data);
  const ehMesInteiro = ordenadas.length === todas.length && todas.every((d) => ordenadas.includes(d));

  if (ordenadas.length === 1) {
    const data = ordenadas[0];
    const titulo = `${nomeDiaSemanaLongo(diaSemanaDe(data))}, ${fmtDataExtenso(data)}`;
    return {
      rotulo: "Escala do culto",
      titulo,
      nomeArquivo: `Escala ${nomeDiaSemanaLongo(diaSemanaDe(data))} ${ddmmaaaa(data).replaceAll("/", "-")}`,
    };
  }

  const blocos = agruparDatas(ordenadas);
  if (blocos.length === 1 && blocos[0].tipo === "fds") {
    const { sab, dom } = blocos[0];
    const s = parseIsoDate(sab);
    const d = parseIsoDate(dom);
    const titulo =
      s.m === d.m
        ? `${s.d} e ${d.d} de ${nomeMes(d.m).toLowerCase()} de ${d.y}`
        : `${s.d} de ${nomeMes(s.m).toLowerCase()} e ${fmtDataExtenso(dom)}`;
    return {
      rotulo: "Escala do fim de semana",
      titulo,
      nomeArquivo: `Escala fim de semana ${ddmmaaaa(sab).replaceAll("/", "-")}`,
    };
  }

  if (ehMesInteiro) {
    return { rotulo: "Escala do mês", titulo: mesAno, nomeArquivo: `Escala ${nomeMes(mes)} ${ano}` };
  }

  return {
    rotulo: `Escala · ${ordenadas.length} cultos selecionados`,
    titulo: mesAno,
    nomeArquivo: `Escala ${nomeMes(mes)} ${ano} (${ordenadas.length} cultos)`,
  };
}

// ---------------------------------------------------------------------------
// Conteúdo de cada dia (compartilhado por PDF e WhatsApp)

export type FuncaoBase = { id: string; nome: string; diasSemana: number[] };
export type CategoriaBase = { id: string; nome: string; funcoes: FuncaoBase[] };
export type AtividadeBase = { titulo: string; horario: string | null; ministerio: string | null };

export type DadosEscala = {
  categorias: CategoriaBase[];
  atribuicoes: Record<string, Record<string, string | null>>;
  observacoes: Record<string, string>;
  ministerios: Record<string, string>;
  atividades: Record<string, AtividadeBase[]>;
};

/** O que vai no arquivo além das datas: quais funções e se as atividades do dia entram. `funcoes = null` significa todas. */
export type ConteudoExportacao = { funcoes: Set<string> | null; incluirAtividades: boolean };

export const CONTEUDO_COMPLETO: ConteudoExportacao = { funcoes: null, incluirAtividades: true };

export type LinhaFuncao = { id: string; nome: string; label: string; valor: string };
export type GrupoFuncoes = { categoria: string; funcoes: LinhaFuncao[] };

/** Funções que valem naquele dia da semana e estão incluídas na exportação, agrupadas por ministério (vazias inclusive). */
export function funcoesDoDia(dados: DadosEscala, data: string, conteudo: ConteudoExportacao): GrupoFuncoes[] {
  const diaSemana = diaSemanaDe(data);
  const grupos: GrupoFuncoes[] = [];
  for (const cat of dados.categorias) {
    const funcoes = cat.funcoes
      .filter((f) => f.diasSemana.includes(diaSemana) && (!conteudo.funcoes || conteudo.funcoes.has(f.id)))
      .map((f) => ({
        id: f.id,
        nome: f.nome,
        label: labelFuncao(f.nome, diaSemana),
        valor: (dados.atribuicoes[data]?.[f.id] ?? "").trim(),
      }));
    if (funcoes.length > 0) grupos.push({ categoria: cat.nome, funcoes });
  }
  return grupos;
}

/** Funções incluídas na exportação que estão sem ninguém naquele dia — pro aviso de escala incompleta. */
export function pendenciasDoDia(dados: DadosEscala, data: string, conteudo: ConteudoExportacao): string[] {
  return funcoesDoDia(dados, data, conteudo).flatMap((g) => g.funcoes.filter((f) => !f.valor).map((f) => f.label));
}

function linhaAtividade(a: AtividadeBase) {
  return `${a.horario ? `${a.horario} — ` : ""}${a.titulo}${a.ministerio ? ` / ${a.ministerio}` : ""}`;
}

/** Ministério responsável, observação e (se incluídas) atividades do dia — a parte "extra" de cada culto. */
export function notasDoDia(dados: DadosEscala, data: string, conteudo: ConteudoExportacao) {
  return {
    ministerio: dados.ministerios[data] ?? "",
    observacao: (dados.observacoes[data] ?? "").trim(),
    atividades: conteudo.incluirAtividades ? (dados.atividades[data] ?? []).map(linhaAtividade) : [],
  };
}

/**
 * Mensagem de WhatsApp só com as datas escolhidas, em ordem cronológica.
 * Uma data: o título já identifica o culto. Várias: um bloco por culto.
 */
export function mensagemWhatsapp(
  dados: DadosEscala,
  datas: string[],
  conteudo: ConteudoExportacao,
  ano: number,
  mes: number
): string {
  const ordenadas = [...new Set(datas)].sort();
  const unica = ordenadas.length === 1;
  const titulo = unica
    ? `${nomeDiaSemanaLongo(diaSemanaDe(ordenadas[0]))}, ${ddmmaaaa(ordenadas[0])}`
    : cabecalhoDocumento(ordenadas, ano, mes).titulo;
  const linhas: string[] = [`📋 *Escala — ${titulo}*`, ""];

  for (const data of ordenadas) {
    const grupos = funcoesDoDia(dados, data, conteudo);
    const notas = notasDoDia(dados, data, conteudo);
    if (grupos.length === 0 && !notas.ministerio && !notas.observacao && notas.atividades.length === 0) continue;

    if (!unica) {
      const { y, m, d } = parseIsoDate(data);
      linhas.push(`*${nomeDiaSemanaLongo(diaSemanaDe(data))} · ${fmtDDMM(y, m, d)}*`);
    }
    if (notas.ministerio) linhas.push(`🏛️ ${notas.ministerio}`);
    for (const g of grupos) {
      for (const f of g.funcoes) linhas.push(`${emojiFuncao(f.nome)} ${f.label}: ${f.valor || "❌ (pendente)"}`);
    }
    if (notas.observacao) linhas.push(`📝 ${notas.observacao}`);
    for (const a of notas.atividades) linhas.push(`🗓️ ${a}`);
    linhas.push("");
  }
  return linhas.join("\n").trimEnd();
}
