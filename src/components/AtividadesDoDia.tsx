"use client";

import { useState } from "react";
import { criarAtividade, atualizarAtividade, excluirAtividade, type AtividadeDTO } from "@/lib/actions/atividade";

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
      alert(e instanceof Error ? e.message : "Não foi possível excluir.");
    }
  }

  return (
    <div className="no-print mt-2.5 border-t border-brand-100 pt-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[9.5px] font-extrabold uppercase tracking-wide text-ink-400">🎉 Atividades do dia</span>
        {isAdmin && !formAberto && (
          <button type="button" onClick={abrirNovo} className="text-[11px] font-semibold text-orange-600 hover:text-orange-700">
            + Adicionar
          </button>
        )}
      </div>

      {atividades.length === 0 && !formAberto ? (
        <p className="text-[11px] italic text-ink-400">Nenhuma atividade cadastrada.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {atividades.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg bg-brand-50/60 px-2 py-1.5">
              <div className="min-w-0 truncate">
                <span className="text-[11.5px] font-bold text-ink-900">
                  {a.horario && <span className="tabular-nums text-orange-600">{a.horario} </span>}
                  {a.titulo}
                </span>
                {a.ministerio && <span className="ml-1 text-[10.5px] text-ink-600">— {a.ministerio}</span>}
              </div>
              {isAdmin && (
                <div className="flex flex-none gap-2">
                  <button type="button" onClick={() => abrirEdicao(a)} className="text-[10.5px] text-ink-400 hover:text-orange-600">
                    editar
                  </button>
                  <button type="button" onClick={() => handleExcluir(a.id)} className="text-[10.5px] text-ink-400 hover:text-red-600">
                    excluir
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {formAberto && (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-brand-200 bg-white p-2.5">
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Nome da atividade"
            className="input !py-1.5 !text-[12px]"
          />
          <div className="flex gap-2">
            <input
              type="time"
              value={horario}
              onChange={(e) => setHorario(e.target.value)}
              className="input !py-1.5 !text-[12px]"
            />
            <input
              value={ministerio}
              onChange={(e) => setMinisterio(e.target.value)}
              placeholder="Ministério responsável"
              className="input !py-1.5 !text-[12px]"
            />
          </div>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descrição (opcional)"
            rows={2}
            className="input resize-none !py-1.5 !text-[12px]"
          />
          {erro && <p className="text-[11px] font-medium text-red-600">{erro}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost !text-[12px]" onClick={() => setFormAberto(false)}>
              Cancelar
            </button>
            <button type="button" className="btn-primary !px-4 !py-1.5 !text-[12px]" disabled={salvando} onClick={handleSalvar}>
              {salvando ? "Salvando..." : editandoId ? "Salvar" : "Adicionar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
