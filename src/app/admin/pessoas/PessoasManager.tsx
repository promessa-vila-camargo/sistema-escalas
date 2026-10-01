"use client";

import { useActionState, useEffect, useState } from "react";
import { salvarPessoa, excluirPessoa } from "@/lib/actions/pessoas";
import { FormError } from "@/components/ui/FormMessage";
import PasswordField from "@/components/ui/PasswordField";
import type { CategoriaDTO } from "@/components/EscalaBoard";

type Pessoa = {
  id: string;
  nome: string;
  username: string | null;
  ativo: boolean;
  verTudo: boolean;
  podeGerenciarEventoExtra: boolean;
  funcaoIds: string[];
};

function PessoaForm({
  categorias,
  editando,
  onDone,
}: {
  categorias: CategoriaDTO[];
  editando: Pessoa | null;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(salvarPessoa, undefined);

  useEffect(() => {
    if (state && !state.error) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {editando && <input type="hidden" name="id" value={editando.id} />}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink-900">Nome completo</span>
        <input name="nome" required maxLength={80} defaultValue={editando?.nome ?? ""} className="input" />
      </label>

      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="font-medium text-ink-900">Usuário (login)</span>
          <input
            name="username"
            placeholder="opcional"
            maxLength={30}
            defaultValue={editando?.username ?? ""}
            autoComplete="off"
            className="input"
          />
        </label>
        <div className="flex-1">
          <PasswordField name="password" label="Senha" placeholder="deixe em branco p/ manter" autoComplete="new-password" />
        </div>
      </div>

      <div>
        <span className="mb-2 block text-[10.5px] font-bold uppercase tracking-wide text-ink-400">
          Funções habilitadas
        </span>
        <div className="flex flex-col gap-3">
          {categorias.length === 0 && (
            <p className="text-[12.5px] text-ink-400">Cadastre ministérios e funções ao lado primeiro.</p>
          )}
          {categorias.map((cat) => {
            if (cat.funcoes.length === 0) return null;
            return (
              <div key={cat.id}>
                <div className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-orange-600">
                  {cat.nome}
                </div>
                <div className="flex flex-col gap-1">
                  {cat.funcoes.map((f) => (
                    <label key={f.id} className="flex items-center gap-2 text-[13px] font-medium text-ink-900">
                      <input
                        type="checkbox"
                        name="funcaoIds"
                        value={f.id}
                        defaultChecked={editando?.funcaoIds.includes(f.id) ?? false}
                        className="h-4 w-4 accent-orange-600"
                      />
                      {f.nome}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <span className="mb-2 block text-[10.5px] font-bold uppercase tracking-wide text-ink-400">
          Permissões adicionais
        </span>
        <label className="flex items-center gap-2 text-[13px] font-medium text-ink-900">
          <input
            type="checkbox"
            name="podeGerenciarEventoExtra"
            defaultChecked={editando?.podeGerenciarEventoExtra ?? false}
            className="h-4 w-4 accent-orange-600"
          />
          🟠 Pode criar/editar/excluir escalas extraordinárias
        </label>
      </div>

      <div>
        <span className="mb-2 block text-[10.5px] font-bold uppercase tracking-wide text-ink-400">
          Tipo de visualização
        </span>
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-2 text-[13px] font-medium text-ink-900">
            <input
              type="radio"
              name="verTudo"
              value="off"
              defaultChecked={!(editando?.verTudo ?? false)}
              className="h-4 w-4 accent-orange-600"
            />
            Ver apenas minha responsabilidade
          </label>
          <label className="flex items-center gap-2 text-[13px] font-medium text-ink-900">
            <input
              type="radio"
              name="verTudo"
              value="on"
              defaultChecked={editando?.verTudo ?? false}
              className="h-4 w-4 accent-orange-600"
            />
            Ver a escala inteira (mas só edita o que é dela)
          </label>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-ink-900">
        <input type="checkbox" name="ativo" defaultChecked={editando?.ativo ?? true} className="h-4 w-4 accent-orange-600" />
        Ativo
      </label>

      <FormError>{state?.error}</FormError>

      <div className="flex justify-end gap-2">
        {editando && (
          <button type="button" className="btn-ghost" onClick={onDone}>
            Cancelar
          </button>
        )}
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Salvando..." : "Salvar pessoa"}
        </button>
      </div>
    </form>
  );
}

export default function PessoasManager({ categorias, pessoas }: { categorias: CategoriaDTO[]; pessoas: Pessoa[] }) {
  const [editandoId, setEditandoId] = useState<string | null | "novo">("novo");
  const [formKey, setFormKey] = useState(0);
  const [busca, setBusca] = useState("");

  function fecharFormulario() {
    setEditandoId("novo");
    setFormKey((k) => k + 1);
  }

  const editando = editandoId && editandoId !== "novo" ? pessoas.find((p) => p.id === editandoId) ?? null : null;

  function funcaoNomes(ids: string[]) {
    const nomes: string[] = [];
    for (const cat of categorias) {
      for (const f of cat.funcoes) {
        if (ids.includes(f.id)) nomes.push(f.nome);
      }
    }
    return nomes;
  }

  const listaFiltrada = pessoas
    .filter((p) => !busca || p.nome.toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return (
    <div className="card">
      <h2 className="mb-3 text-[13px] font-extrabold uppercase tracking-wide text-ink-600">
        {editando ? "Editar pessoa" : "Nova pessoa"}
      </h2>
      <div className="mb-5 border-b border-brand-100 pb-5">
        <PessoaForm
          key={`${editandoId ?? "novo"}:${formKey}`}
          categorias={categorias}
          editando={editando}
          onDone={fecharFormulario}
        />
      </div>

      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar pessoa…"
        className="input mb-3"
      />

      <div className="flex flex-col gap-2">
        {listaFiltrada.length === 0 && (
          <p className="empty-state">
            {pessoas.length === 0 ? "Nenhuma pessoa cadastrada ainda — use o formulário acima." : "Nenhuma pessoa encontrada."}
          </p>
        )}
        {listaFiltrada.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-2.5 rounded-xl border border-brand-100 bg-brand-50/60 px-3 py-2.5">
            <span className="min-w-[110px] text-[13.5px] font-bold text-ink-900">{p.nome}</span>
            {p.username && (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-ink-400">
                🔑 {p.username}
              </span>
            )}
            <div className="flex flex-1 flex-wrap gap-1.5">
              {funcaoNomes(p.funcaoIds).map((n) => (
                <span key={n} className="badge-neutral">
                  {n}
                </span>
              ))}
              {p.podeGerenciarEventoExtra && (
                <span className="badge-neutral !bg-orange-100 !text-orange-700">🟠 Escalas extraordinárias</span>
              )}
            </div>
            <span className={p.ativo ? "badge-positive" : "badge-negative"}>{p.ativo ? "Ativo" : "Inativo"}</span>
            <button type="button" className="link" onClick={() => setEditandoId(p.id)}>
              Editar
            </button>
            <button
              type="button"
              className="link-danger"
              onClick={() => {
                if (confirm(`Excluir "${p.nome}"?`)) excluirPessoa(p.id);
              }}
            >
              Excluir
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
