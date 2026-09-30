"use client";

import { useActionState, useRef } from "react";
import { criarCategoria, criarFuncao, excluirCategoria, excluirFuncao } from "@/lib/actions/pessoas";
import { FormError } from "@/components/ui/FormMessage";
import type { CategoriaDTO } from "@/components/EscalaBoard";

function NovaFuncaoForm({ categoriaId }: { categoriaId: string }) {
  const [state, formAction, pending] = useActionState(criarFuncao, undefined);
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
      <input type="hidden" name="categoriaId" value={categoriaId} />
      <input name="nome" placeholder="Nova função…" maxLength={40} className="input py-1.5 text-[12.5px]" />
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
      <input name="nome" placeholder="Nova categoria…" maxLength={40} className="input py-1.5 text-[12.5px]" />
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
      <h2 className="mb-3 text-[13px] font-extrabold uppercase tracking-wide text-ink-600">Categorias e funções</h2>

      {categorias.length === 0 && <p className="mb-3 text-[12.5px] text-ink-400">Nenhuma categoria ainda.</p>}

      {categorias.map((cat, i) => (
        <div key={cat.id} className={"mb-4 pb-3.5 " + (i < categorias.length - 1 ? "border-b border-brand-100" : "")}>
          <div className="mb-2 flex items-center gap-2">
            <span className="flex-1 text-[12.5px] font-bold text-ink-900">{cat.nome}</span>
            <button
              type="button"
              className="text-xs text-red-500 hover:text-red-600"
              onClick={() => {
                if (confirm(`Remover a categoria "${cat.nome}" e todas as suas funções?`)) excluirCategoria(cat.id);
              }}
            >
              Remover
            </button>
          </div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {cat.funcoes.length === 0 && <span className="text-[11.5px] text-ink-400">Sem funções ainda.</span>}
            {cat.funcoes.map((f) => (
              <span
                key={f.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-brand-50 py-1 pr-1.5 pl-3 text-xs font-semibold text-ink-900"
              >
                {f.nome}
                <button
                  type="button"
                  className="flex h-4 w-4 items-center justify-center rounded-full text-ink-400 hover:bg-red-50 hover:text-red-500"
                  onClick={() => {
                    if (confirm(`Remover a função "${f.nome}"?`)) excluirFuncao(f.id);
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <NovaFuncaoForm categoriaId={cat.id} />
        </div>
      ))}

      <NovaCategoriaForm />
    </div>
  );
}
