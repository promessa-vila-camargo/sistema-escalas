"use client";

import { useActionState, useRef, useState } from "react";
import { alternarDiaFuncao, criarCategoria, criarFuncao, excluirCategoria, excluirFuncao } from "@/lib/actions/pessoas";
import { FormError } from "@/components/ui/FormMessage";
import type { CategoriaDTO, FuncaoDTO } from "@/components/EscalaBoard";

const DIAS: { valor: number; label: string }[] = [
  { valor: 3, label: "Qua" },
  { valor: 6, label: "Sáb" },
  { valor: 0, label: "Dom" },
];

function DiaToggle({ funcao }: { funcao: FuncaoDTO }) {
  return (
    <div className="flex gap-1">
      {DIAS.map((d) => {
        const ativo = funcao.diasSemana.includes(d.valor);
        return (
          <button
            key={d.valor}
            type="button"
            title={ativo ? `Remover de ${d.label}` : `Incluir em ${d.label}`}
            onClick={() => alternarDiaFuncao(funcao.id, d.valor, !ativo)}
            className={
              "rounded px-1.5 py-0.5 text-[10px] font-bold transition-colors " +
              (ativo ? "bg-orange-100 text-orange-700" : "bg-ink-900/5 text-ink-400 hover:bg-ink-900/10")
            }
          >
            {d.label}
          </button>
        );
      })}
    </div>
  );
}

function NovaFuncaoForm({ categoriaId }: { categoriaId: string }) {
  const [state, formAction, pending] = useActionState(criarFuncao, undefined);
  const [dias, setDias] = useState<number[]>([3, 6, 0]);
  const ref = useRef<HTMLFormElement>(null);

  function toggleDia(v: number) {
    setDias((old) => (old.includes(v) ? old.filter((d) => d !== v) : [...old, v]));
  }

  return (
    <form
      ref={ref}
      action={async (fd) => {
        dias.forEach((d) => fd.append("dias", String(d)));
        await formAction(fd);
        ref.current?.reset();
        setDias([3, 6, 0]);
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="categoriaId" value={categoriaId} />
      <input name="nome" placeholder="Nova função…" maxLength={40} className="input min-w-[9rem] flex-1 py-1.5 text-[12.5px]" />
      <div className="flex gap-1">
        {DIAS.map((d) => (
          <button
            key={d.valor}
            type="button"
            onClick={() => toggleDia(d.valor)}
            className={
              "rounded px-1.5 py-0.5 text-[10px] font-bold transition-colors " +
              (dias.includes(d.valor) ? "bg-orange-100 text-orange-700" : "bg-ink-900/5 text-ink-400 hover:bg-ink-900/10")
            }
          >
            {d.label}
          </button>
        ))}
      </div>
      <button type="submit" disabled={pending} className="btn-primary !px-3 !py-1.5 text-xs">
        +
      </button>
      {state?.error && <FormError>{state.error}</FormError>}
    </form>
  );
}

function NovaCategoriaForm() {
  const [state, formAction, pending] = useActionState(criarCategoria, undefined);
  const ref = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={ref}
      action={async (fd) => {
        await formAction(fd);
        ref.current?.reset();
      }}
      className="flex gap-2"
    >
      <input name="nome" placeholder="Novo ministério…" maxLength={40} className="input py-1.5 text-[12.5px]" />
      <button type="submit" disabled={pending} className="btn-primary !px-3 !py-1.5 text-xs">
        +
      </button>
      {state?.error && <FormError>{state.error}</FormError>}
    </form>
  );
}

export default function CategoriasManager({ categorias }: { categorias: CategoriaDTO[] }) {
  return (
    <div className="card">
      <h2 className="mb-1 text-[13px] font-extrabold uppercase tracking-wide text-ink-600">Ministérios e funções</h2>
      <p className="mb-3 text-[11px] text-ink-400">
        Os dias marcados em laranja (Qua/Sáb/Dom) são os cultos em que aquela função aparece na escala.
      </p>

      {categorias.length === 0 && <p className="mb-3 text-[12.5px] text-ink-400">Nenhum ministério ainda.</p>}

      {categorias.map((cat, i) => (
        <div key={cat.id} className={"mb-4 pb-3.5 " + (i < categorias.length - 1 ? "border-b border-brand-100" : "")}>
          <div className="mb-2 flex items-center gap-2">
            <span className="flex-1 text-[12.5px] font-bold text-ink-900">{cat.nome}</span>
            <button
              type="button"
              className="text-xs text-red-500 hover:text-red-600"
              onClick={() => {
                if (confirm(`Remover o ministério "${cat.nome}" e todas as suas funções?`)) excluirCategoria(cat.id);
              }}
            >
              Remover
            </button>
          </div>
          <div className="mb-2 flex flex-col gap-1.5">
            {cat.funcoes.length === 0 && <span className="text-[11.5px] text-ink-400">Sem funções ainda.</span>}
            {cat.funcoes.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-2 rounded-lg border border-brand-100 bg-brand-50 py-1 pr-1.5 pl-3 text-xs font-semibold text-ink-900"
              >
                <span className="flex-1 truncate">{f.nome}</span>
                <DiaToggle funcao={f} />
                <button
                  type="button"
                  className="flex h-5 w-5 flex-none items-center justify-center rounded-full text-ink-400 hover:bg-red-50 hover:text-red-500"
                  onClick={() => {
                    if (confirm(`Remover a função "${f.nome}"?`)) excluirFuncao(f.id);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <NovaFuncaoForm categoriaId={cat.id} />
        </div>
      ))}

      <NovaCategoriaForm />
    </div>
  );
}
