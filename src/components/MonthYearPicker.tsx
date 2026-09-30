"use client";

import { useRouter } from "next/navigation";
import { MESES_LISTA } from "@/lib/datas";

export default function MonthYearPicker({ ano, mes, basePath }: { ano: number; mes: number; basePath: string }) {
  const router = useRouter();
  const anoAtual = new Date().getFullYear();
  const anos = Array.from({ length: 5 }, (_, i) => anoAtual + i);

  function go(nextAno: number, nextMes: number) {
    router.push(`${basePath}?ano=${nextAno}&mes=${nextMes}`);
  }

  return (
    <div className="flex items-center gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Mês</span>
        <select
          className="input !w-auto py-1.5 text-sm font-semibold"
          value={mes}
          onChange={(e) => go(ano, Number(e.target.value))}
        >
          {MESES_LISTA.map((m, i) => (
            <option key={m} value={i}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Ano</span>
        <select
          className="input !w-auto py-1.5 text-sm font-semibold"
          value={ano}
          onChange={(e) => go(Number(e.target.value), mes)}
        >
          {anos.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
