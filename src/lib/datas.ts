const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const DIA_SEMANA_LABEL: Record<number, string> = { 0: "Domingo", 3: "4ª feira", 6: "Sábado" };

export type CultoDia = { data: string; dia: number; diaSemana: number };

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

/** "YYYY-MM-DD", sempre no fuso local — evita o desvio de 1 dia do toISOString (UTC). */
export function isoDate(y: number, m: number, d: number) {
  return `${y}-${pad2(m + 1)}-${pad2(d)}`;
}

/** Desfaz isoDate() sem passar por `new Date(iso)`, que interpretaria como UTC. */
export function parseIsoDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m: m - 1, d };
}

/**
 * Funções em que sábado e domingo são pessoas diferentes por natureza —
 * escalar no sábado NÃO repete automaticamente no domingo (diferente das
 * demais funções, que valem pro fim de semana inteiro).
 */
export const FUNCOES_SEM_REPETICAO_DOMINGO = ["Diretor(a)", "Palavra Pastoral", "Pregador"];

/** Ministério/departamento responsável por organizar o culto de sábado/domingo. */
export const MINISTERIOS_RESPONSAVEIS = [
  "LITURGIA",
  "MINISTÉRIO DE HOMENS",
  "MINISTÉRIO DE MULHERES",
  "COMUNICAÇÃO",
  "MINISTÉRIO DE CRIANÇA E ADOLESCENTES",
  "MINISTÉRIO DE PROCLAMAÇÃO",
  "MINISTÉRIO DE ENSINO",
];

export function fmtDDMM(y: number, m: number, d: number) {
  return `${pad2(d)}/${pad2(m + 1)}`;
}

/** Cultos do mês (quarta, sábado, domingo), agrupados por dia da semana. */
export function buildMonthDays(year: number, month: number) {
  const out: { qua: CultoDia[]; sab: CultoDia[]; dom: CultoDia[] } = { qua: [], sab: [], dom: [] };
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const wd = new Date(year, month, d).getDay();
    const item = { data: isoDate(year, month, d), dia: d, diaSemana: wd };
    if (wd === 3) out.qua.push(item);
    else if (wd === 6) out.sab.push(item);
    else if (wd === 0) out.dom.push(item);
  }
  return out;
}

export function buildMonthDaysFlat(year: number, month: number): CultoDia[] {
  const g = buildMonthDays(year, month);
  return [...g.qua, ...g.sab, ...g.dom].sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
}

export function nomeMes(month: number) {
  return MESES[month];
}

export function nomeDiaSemana(diaSemana: number) {
  return DIA_SEMANA_LABEL[diaSemana] ?? "";
}

export const MESES_LISTA = MESES;

/** Categorias que podem ter escalas extraordinárias (fora do horário oficial). */
export const CATEGORIAS_ESCALA_EXTRAORDINARIA = ["Mídia", "Datashow", "Transmissão", "Som"];

/** Formata uma data livre "YYYY-MM-DD" como "sábado, 04/10/2026" — pro cabeçalho de uma escala extraordinária. */
export function fmtDataCompleta(iso: string) {
  const { y, m, d } = parseIsoDate(iso);
  const diaSemana = new Date(y, m, d).getDay();
  return `${nomeDiaSemana(diaSemana)}, ${fmtDDMM(y, m, d)}/${y}`;
}

/** Próximo sábado a partir de hoje (incluindo hoje, se hoje já for sábado), como "YYYY-MM-DD". */
export function proximoSabado() {
  const hoje = new Date();
  const diasAteSabado = (6 - hoje.getDay() + 7) % 7;
  const alvo = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + diasAteSabado);
  return isoDate(alvo.getFullYear(), alvo.getMonth(), alvo.getDate());
}
