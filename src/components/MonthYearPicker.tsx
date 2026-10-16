"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { MESES_LISTA } from "@/lib/datas";
import Icon, { Spinner } from "@/components/ui/Icon";

/** Navegação de mês: setas pro mês anterior/seguinte e seletores de mês e ano no meio. */
export default function MonthYearPicker({ ano, mes, basePath }: { ano: number; mes: number; basePath: string }) {
  const router = useRouter();
  const [carregando, startTransition] = useTransition();
  const anoAtual = new Date().getFullYear();
  const primeiroAno = Math.min(anoAtual - 1, ano);
  const ultimoAno = Math.max(anoAtual + 4, ano);
  const anos = Array.from({ length: ultimoAno - primeiroAno + 1 }, (_, i) => primeiroAno + i);

  function go(nextAno: number, nextMes: number) {
    const d = new Date(nextAno, nextMes, 1);
    startTransition(() => router.push(`${basePath}?ano=${d.getFullYear()}&mes=${d.getMonth()}`));
  }

  const select =
    "h-9 cursor-pointer appearance-none rounded-[8px] bg-transparent pr-6 pl-2.5 text-[14px] font-semibold text-ink-900 outline-none hover:bg-ink-100 focus-visible:ring-3 focus-visible:ring-brand-100";
  const seta = "pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 text-ink-400";

  return (
    <div className="inline-flex h-11 items-center gap-0.5 rounded-[12px] border border-line-strong bg-white p-1 shadow-[0_1px_2px_rgb(20_34_53/0.05)]">
      <button type="button" className="btn-icon" onClick={() => go(ano, mes - 1)} aria-label="Mês anterior">
        <Icon name="chevronLeft" size={18} />
      </button>
      <label className="relative">
        <span className="sr-only">Mês</span>
        <select className={select} value={mes} onChange={(e) => go(ano, Number(e.target.value))}>
          {MESES_LISTA.map((m, i) => (
            <option key={m} value={i}>
              {m}
            </option>
          ))}
        </select>
        <Icon name="chevronDown" size={14} className={seta} />
      </label>
      <label className="relative">
        <span className="sr-only">Ano</span>
        <select className={select + " tabular-nums"} value={ano} onChange={(e) => go(Number(e.target.value), mes)}>
          {anos.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <Icon name="chevronDown" size={14} className={seta} />
      </label>
      <button type="button" className="btn-icon" onClick={() => go(ano, mes + 1)} aria-label="Próximo mês">
        {carregando ? <Spinner size={16} /> : <Icon name="chevronRight" size={18} />}
      </button>
    </div>
  );
}
