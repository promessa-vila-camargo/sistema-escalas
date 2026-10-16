"use client";

import Icon from "@/components/ui/Icon";
import Menu, { type ItemMenu } from "@/components/ui/Menu";
import { fmtDDMM, nomeDiaSemanaLongo, nomeMesAbrev, parseIsoDate, tipoCulto } from "@/lib/datas";
import { corDoCulto } from "./SeletorExportacao";

/** Situação de preenchimento: anel de progresso + "9/11", ou "Completa". */
export function Progresso({ preenchidas, total }: { preenchidas: number; total: number }) {
  if (total === 0) return null;
  const completa = preenchidas === total;
  if (completa) {
    return (
      <span className="inline-flex h-7 items-center gap-1 rounded-full bg-green-50 px-2.5 text-[11.5px] font-semibold text-green-700">
        <Icon name="check" size={14} strokeWidth={2.25} />
        <span className="max-sm:sr-only">Completa</span>
      </span>
    );
  }
  const r = 6.5;
  const c = 2 * Math.PI * r;
  return (
    <span
      className="inline-flex h-7 items-center gap-1.5 rounded-full bg-ink-100 px-2.5 text-[11.5px] font-semibold text-ink-600 tabular-nums"
      title={`${preenchidas} de ${total} funções preenchidas`}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" className="-rotate-90" aria-hidden>
        <circle cx="8" cy="8" r={r} fill="none" stroke="var(--color-ink-200)" strokeWidth="2.5" />
        <circle
          cx="8"
          cy="8"
          r={r}
          fill="none"
          stroke="var(--color-orange-500)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={`${(preenchidas / total) * c} ${c}`}
        />
      </svg>
      {preenchidas}/{total}
    </span>
  );
}

/**
 * Card de um culto. O cabeçalho identifica o dia de relance (número grande,
 * dia da semana, tipo com a cor do culto) e concentra as ações daquele dia;
 * o corpo (funções, observação, atividades) vem pronto do quadro.
 */
export default function CultoCard({
  data,
  diaSemana,
  preenchidas,
  total,
  acoes,
  responsavel,
  children,
  rodape,
}: {
  data: string;
  diaSemana: number;
  preenchidas: number;
  total: number;
  acoes: ItemMenu[];
  responsavel?: React.ReactNode;
  children: React.ReactNode;
  rodape?: React.ReactNode;
}) {
  const { y, m, d } = parseIsoDate(data);

  return (
    <article className="relative flex flex-col rounded-[14px] border border-line bg-white shadow-[0_1px_2px_rgb(20_34_53/0.04)]">
      <span className={"absolute inset-x-0 top-0 h-[3px] rounded-t-[14px] " + corDoCulto(diaSemana)} aria-hidden />
      <header className="flex items-center gap-3.5 px-4 pt-5 pb-3.5 sm:px-5">
        <div className="flex w-11 flex-none flex-col items-center leading-none">
          <span className="font-heading text-[30px] font-bold tracking-tight text-ink-900 tabular-nums">
            {String(d).padStart(2, "0")}
          </span>
          <span className="mt-1.5 text-[10px] font-bold tracking-[0.16em] text-ink-400">{nomeMesAbrev(m)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-[16px] leading-tight font-bold text-ink-900">
            {nomeDiaSemanaLongo(diaSemana)}
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-ink-500">
            <span className={"h-1.5 w-1.5 flex-none rounded-full " + corDoCulto(diaSemana)} />
            <span className="truncate">
              {tipoCulto(diaSemana)}
              <span className="hidden tabular-nums sm:inline"> · {fmtDDMM(y, m, d)}/{y}</span>
            </span>
          </p>
        </div>
        <Progresso preenchidas={preenchidas} total={total} />
        {acoes.length > 0 && <Menu itens={acoes} rotulo={`Ações do culto de ${fmtDDMM(y, m, d)}`} />}
      </header>

      {responsavel && <div className="px-4 pb-3 sm:px-5">{responsavel}</div>}

      <div className="flex-1 border-t border-line px-4 pt-3.5 pb-4 sm:px-5">{children}</div>

      {rodape && <div className="rounded-b-[14px] border-t border-line bg-paper/50 px-4 py-3 sm:px-5">{rodape}</div>}
    </article>
  );
}
