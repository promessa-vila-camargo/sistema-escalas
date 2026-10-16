"use client";

import { useState } from "react";
import { criarAtividade, atualizarAtividade, excluirAtividade, type AtividadeDTO } from "@/lib/actions/atividade";
import Icon from "./ui/Icon";

function ordenar(lista: AtividadeDTO[]) {
  return [...lista].sort((a, b) => {
    if (!a.horario && !b.horario) return 0;
    if (!a.horario) return 1;
    if (!b.horario) return -1;
    return a.horario < b.horario ? -1 : a.horario > b.horario ? 1 : 0;
  });
}

export default function AtividadesDoDia({
  data,
  atividades,
  onChange,
  isAdmin,
}: {
  data: string;
  atividades: AtividadeDTO[];
  onChange: (novas: AtividadeDTO[]) => void;
  isAdmin: boolean;
}) {
  const [formAberto, setFormAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [horario, setHorario] = useState("");
  const [ministerio, setMinisterio] = useState("");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!isAdmin && atividades.length === 0) return null;

  function abrirNovo() {
    setEditandoId(null);
    setTitulo("");
    setHorario("");
    setMinisterio("");
    setDescricao("");
    setErro(null);
    setFormAberto(true);
  }

  function abrirEdicao(a: AtividadeDTO) {
    setEditandoId(a.id);
    setTitulo(a.titulo);
    setHorario(a.horario ?? "");
    setMinisterio(a.ministerio ?? "");
    setDescricao(a.descricao ?? "");
    setErro(null);
    setFormAberto(true);
  }

  async function handleSalvar() {
    if (!titulo.trim()) {
      setErro("Escreva um nome para a atividade.");
      return;
    }
    setSalvando(true);
    const horarioLimpo = horario.trim() || null;
    const ministerioLimpo = ministerio.trim() || null;
    const descricaoLimpa = descricao.trim() || null;
    try {
      if (editandoId) {
        await atualizarAtividade(editandoId, titulo, horarioLimpo, ministerioLimpo, descricaoLimpa);
        onChange(
          ordenar(
            atividades.map((a) =>
              a.id === editandoId
                ? { ...a, titulo: titulo.trim(), horario: horarioLimpo, ministerio: ministerioLimpo, descricao: descricaoLimpa }
                : a
            )
          )
        );
      } else {
        const id = await criarAtividade(data, titulo, horarioLimpo, ministerioLimpo, descricaoLimpa);
        onChange(
          ordenar([
            ...atividades,
            { id, data, titulo: titulo.trim(), horario: horarioLimpo, ministerio: ministerioLimpo, descricao: descricaoLimpa },
          ])
        );
      }
      setFormAberto(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function handleExcluir(id: string) {
    if (!confirm("Excluir esta atividade?")) return;
    onChange(atividades.filter((a) => a.id !== id));
    try {
      await excluirAtividade(id);
    } catch (e) {
      // Volta a atividade pra lista e mostra o erro no próprio bloco.
      onChange(atividades);
      setErro(e instanceof Error ? e.message : "Não foi possível excluir.");
    }
  }

  return (
    <div className="no-print">
      <div className="flex min-h-8 items-center gap-2.5">
        <Icon name="sparkle" size={16} className="text-ink-400" />
        <span className="flex-1 text-[12px] font-semibold text-ink-500">Atividades do dia</span>
        {isAdmin && !formAberto && (
          <button type="button" onClick={abrirNovo} className="btn-ghost btn-sm -mr-2 text-brand-700">
            <Icon name="plus" size={15} />
            Adicionar
          </button>
        )}
      </div>

      {atividades.length === 0 && !formAberto ? (
        <p className="pl-[26px] text-[12.5px] text-ink-400">Nenhuma atividade cadastrada.</p>
      ) : (
        <ul className="mt-1 flex flex-col gap-1 pl-[26px]">
          {atividades.map((a) => (
            <li
              key={a.id}
              className="group flex items-center justify-between gap-2 rounded-[8px] border border-line bg-white px-2.5 py-1.5"
            >
              <div className="min-w-0 truncate text-[13px]">
                {a.horario && <span className="mr-1.5 font-semibold text-orange-700 tabular-nums">{a.horario}</span>}
                <span className="font-semibold text-ink-900">{a.titulo}</span>
                {a.ministerio && <span className="ml-1 text-ink-500">· {a.ministerio}</span>}
              </div>
              {isAdmin && (
                <div className="flex flex-none gap-0.5">
                  <button
                    type="button"
                    onClick={() => abrirEdicao(a)}
                    className="btn-icon h-7 w-7"
                    aria-label={`Editar ${a.titulo}`}
                    title="Editar"
                  >
                    <Icon name="note" size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExcluir(a.id)}
                    className="btn-icon h-7 w-7 hover:bg-red-50 hover:text-red-600"
                    aria-label={`Excluir ${a.titulo}`}
                    title="Excluir"
                  >
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {erro && !formAberto && (
        <p className="form-message-error mt-1 pl-[26px] text-[12.5px]" role="alert">
          <Icon name="alert" size={15} className="mt-0.5" /> {erro}
        </p>
      )}

      {formAberto && (
        <div className="mt-2 ml-[26px] flex animate-pop-in flex-col gap-2 rounded-[10px] border border-line-strong bg-white p-3">
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Nome da atividade"
            className="input"
            autoFocus
          />
          <div className="grid grid-cols-[7.5rem_1fr] gap-2">
            <input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} className="input" />
            <input
              value={ministerio}
              onChange={(e) => setMinisterio(e.target.value)}
              placeholder="Ministério responsável"
              className="input"
            />
          </div>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descrição (opcional)"
            rows={2}
            className="input resize-none"
          />
          {erro && (
            <p className="form-message-error text-[12.5px]" role="alert">
              <Icon name="alert" size={15} className="mt-0.5" /> {erro}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost btn-sm" onClick={() => setFormAberto(false)}>
              Cancelar
            </button>
            <button type="button" className="btn-primary btn-sm" disabled={salvando} onClick={handleSalvar}>
              {salvando ? "Salvando…" : editandoId ? "Salvar" : "Adicionar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
