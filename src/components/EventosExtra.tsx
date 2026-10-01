"use client";

import { useRef, useState } from "react";
import {
  criarEventoExtra,
  excluirEventoExtra,
  definirAtribuicaoExtra,
  type EventoExtraDTO,
} from "@/lib/actions/eventoExtra";
import { fmtDataCompleta, proximoSabado } from "@/lib/datas";
import { emojiMinisterio, emojiFuncao } from "@/lib/emojis";
import type { CategoriaDTO } from "./EscalaBoard";
import type { CurrentUser } from "@/lib/auth/dal";

const SAVE_DEBOUNCE_MS = 600;

export default function EventosExtra({
  categorias,
  eventosIniciais,
  currentUser,
}: {
  categorias: CategoriaDTO[];
  eventosIniciais: EventoExtraDTO[];
  currentUser: CurrentUser;
}) {
  const [eventos, setEventos] = useState<EventoExtraDTO[]>(eventosIniciais);
  const [modalAberto, setModalAberto] = useState(false);
  const [formNome, setFormNome] = useState("");
  const [formData, setFormData] = useState("");
  const [formHorario, setFormHorario] = useState("");
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [printEventoId, setPrintEventoId] = useState<string | null>(null);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const isAdmin = currentUser.role === "ADMIN";
  const podeVerTudo = isAdmin || currentUser.verTudo;
  const categoriasVisiveis = podeVerTudo
    ? categorias
    : categorias
        .map((c) => ({ ...c, funcoes: c.funcoes.filter((f) => currentUser.funcaoIds.includes(f.id)) }))
        .filter((c) => c.funcoes.length > 0);

  // Ninguém dessas áreas tem nada a ver aqui — a seção nem aparece.
  if (categoriasVisiveis.length === 0) return null;

  function abrirModalRapido(tipo: "sabado_noite" | "outro") {
    setErroForm(null);
    if (tipo === "sabado_noite") {
      setFormNome("CULTO DE SÁBADO À NOITE");
      setFormData(proximoSabado());
      setFormHorario("20:00");
    } else {
      setFormNome("");
      setFormData("");
      setFormHorario("");
    }
    setModalAberto(true);
  }

  async function handleCriar() {
    if (!formNome.trim() || !formData || !formHorario) {
      setErroForm("Preencha nome, data e horário.");
      return;
    }
    setCriando(true);
    try {
      const id = await criarEventoExtra(formNome, formData, formHorario);
      setEventos((old) =>
        [{ id, nome: formNome.trim().toUpperCase(), data: formData, horario: formHorario, atribuicoes: {} }, ...old].sort(
          (a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0)
        )
      );
      setModalAberto(false);
    } catch (e) {
      setErroForm(e instanceof Error ? e.message : "Não foi possível criar.");
    } finally {
      setCriando(false);
    }
  }

  async function handleExcluir(id: string) {
    if (!confirm("Excluir esta escala extraordinária? Essa ação não pode ser desfeita.")) return;
    setEventos((old) => old.filter((e) => e.id !== id));
    try {
      await excluirEventoExtra(id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Não foi possível excluir.");
    }
  }

  function applyLocalChange(eventoId: string, funcaoId: string, value: string) {
    setEventos((old) =>
      old.map((e) => (e.id === eventoId ? { ...e, atribuicoes: { ...e.atribuicoes, [funcaoId]: value } } : e))
    );
  }

  function commitSave(eventoId: string, funcaoId: string, nome: string | null) {
    definirAtribuicaoExtra(eventoId, funcaoId, nome).catch((e) => {
      alert(e instanceof Error ? e.message : "Não foi possível salvar.");
    });
  }

  function handleTextChange(eventoId: string, funcaoId: string, value: string) {
    applyLocalChange(eventoId, funcaoId, value);
    const key = `${eventoId}:${funcaoId}`;
    if (saveTimers.current[key]) clearTimeout(saveTimers.current[key]);
    saveTimers.current[key] = setTimeout(() => commitSave(eventoId, funcaoId, value), SAVE_DEBOUNCE_MS);
  }

  function handleBlurCommit(eventoId: string, funcaoId: string, value: string) {
    const key = `${eventoId}:${funcaoId}`;
    if (saveTimers.current[key]) {
      clearTimeout(saveTimers.current[key]);
      delete saveTimers.current[key];
    }
    const maiuscula = value.trim().toUpperCase();
    if (maiuscula !== value) applyLocalChange(eventoId, funcaoId, maiuscula);
    commitSave(eventoId, funcaoId, maiuscula || null);
  }

  function handleImprimir(id: string) {
    setPrintEventoId(id);
    setTimeout(() => window.print(), 30);
  }

  return (
    <div className="mt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-0.5">
        <div>
          <span className="badge-neutral !bg-orange-100 !text-orange-700">🟠 Escalas extraordinárias</span>
          <p className="mt-1 text-[12px] text-ink-600">Eventos fora do horário oficial — não afetam a escala normal.</p>
        </div>
        {isAdmin && (
          <div className="no-print flex gap-2">
            <button type="button" onClick={() => abrirModalRapido("sabado_noite")} className="btn-secondary">
              🌙 Culto de sábado à noite
            </button>
            <button type="button" onClick={() => abrirModalRapido("outro")} className="btn-primary">
              + Outro evento/horário
            </button>
          </div>
        )}
      </div>

      {eventos.length === 0 ? (
        <div className="empty-state">Nenhuma escala extraordinária cadastrada.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {eventos.map((evento) => (
            <div key={evento.id} className="card !border-orange-200 !p-3.5">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="badge-neutral !bg-orange-100 !text-orange-700">🟠 ESCALA EXTRAORDINÁRIA</span>
                  </div>
                  <div className="text-[14px] font-extrabold text-ink-900">{evento.nome}</div>
                  <div className="text-[12px] tabular-nums text-ink-600">
                    {fmtDataCompleta(evento.data)} — {evento.horario}
                  </div>
                </div>
                <div className="no-print flex flex-none gap-1">
                  <button
                    type="button"
                    title="Gerar PDF desta escala"
                    onClick={() => handleImprimir(evento.id)}
                    className="rounded-md p-1 text-[15px] text-ink-400 hover:bg-brand-50 hover:text-orange-600"
                  >
                    🖨️
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      title="Excluir"
                      onClick={() => handleExcluir(evento.id)}
                      className="rounded-md p-1 text-[15px] text-ink-400 hover:bg-red-50 hover:text-red-600"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>

              {categoriasVisiveis.map((cat) => {
                if (cat.funcoes.length === 0) return null;
                return (
                  <div key={cat.id} className="mb-0.5">
                    <div className="mt-2 mb-0.5 text-[9.5px] font-extrabold uppercase tracking-wide text-ink-400 first:mt-0">
                      {emojiMinisterio(cat.nome)} {cat.nome}
                    </div>
                    {cat.funcoes.map((f) => {
                      const valor = evento.atribuicoes[f.id] ?? "";
                      const preenchido = valor.trim().length > 0;
                      const editavel = isAdmin || currentUser.funcaoIds.includes(f.id);
                      return (
                        <div key={f.id} className="leader-row">
                          <span className="leader-label" title={f.nome}>
                            {emojiFuncao(f.nome)} {f.nome}
                          </span>
                          <span className="leader-fill" />
                          {editavel ? (
                            <input
                              type="text"
                              placeholder="Digite o nome..."
                              value={valor}
                              onChange={(e) => handleTextChange(evento.id, f.id, e.target.value)}
                              onBlur={(e) => handleBlurCommit(evento.id, f.id, e.target.value)}
                              className="max-w-[48%] flex-none rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-right text-[12px] font-semibold uppercase text-ink-900 outline-none placeholder:font-normal placeholder:italic placeholder:normal-case placeholder:text-ink-400 hover:border-brand-200 hover:bg-brand-50 focus:border-orange-500 focus:bg-white"
                            />
                          ) : (
                            <span className="max-w-[48%] flex-none truncate text-right text-[12px] font-semibold uppercase text-ink-400">
                              {valor.trim() || "—"}
                            </span>
                          )}
                          <span className={"flex-none text-[13px] " + (preenchido ? "" : "opacity-70")}>
                            {preenchido ? "✅" : "⚠️"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {modalAberto && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 p-5">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-soft-lift">
            <h3 className="mb-1 font-heading text-base font-extrabold text-ink-900">Nova escala extraordinária</h3>
            <p className="mb-4 text-[12px] text-ink-600">
              Não altera os horários oficiais — existe só nesta escala.
            </p>

            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-ink-900">Nome do evento</span>
                <input
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value)}
                  placeholder='Ex: "Culto especial"'
                  className="input"
                />
              </label>
              <div className="flex gap-3">
                <label className="flex flex-1 flex-col gap-1 text-sm">
                  <span className="font-medium text-ink-900">Data</span>
                  <input type="date" value={formData} onChange={(e) => setFormData(e.target.value)} className="input" />
                </label>
                <label className="flex flex-1 flex-col gap-1 text-sm">
                  <span className="font-medium text-ink-900">Horário</span>
                  <input
                    type="time"
                    value={formHorario}
                    onChange={(e) => setFormHorario(e.target.value)}
                    className="input"
                  />
                </label>
              </div>
            </div>

            {erroForm && <p className="form-message-error mt-3">{erroForm}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setModalAberto(false)}>
                Cancelar
              </button>
              <button type="button" className="btn-primary" disabled={criando} onClick={handleCriar}>
                {criando ? "Criando..." : "Criar escala"}
              </button>
            </div>
          </div>
        </div>
      )}

      {printEventoId &&
        (() => {
          const evento = eventos.find((e) => e.id === printEventoId);
          if (!evento) return null;
          return (
            <div className="hidden print:block">
              <div className="mb-5 flex items-center gap-4 border-b-4 border-pdforange pb-4">
                <img src="/logo-icon.png" alt="" className="h-14 w-14 rounded-full" />
                <div className="flex flex-col">
                  <span className="font-heading text-[10px] font-bold uppercase tracking-[0.2em] text-pdforange">
                    Promessa Vila Camargo
                  </span>
                  <span className="font-heading text-[22px] font-extrabold text-pdfblue">{evento.nome}</span>
                  <span className="text-[12px] font-semibold text-ink-600">
                    {fmtDataCompleta(evento.data)} • {evento.horario}
                  </span>
                </div>
                <span className="ml-auto flex-none rounded-full bg-pdforange px-3 py-1.5 text-center font-heading text-[11px] font-extrabold uppercase tracking-wide text-white">
                  Escala extraordinária
                </span>
              </div>

              <div className="mx-auto max-w-md">
                {categoriasVisiveis.map((cat) => {
                  if (cat.funcoes.length === 0) return null;
                  return (
                    <div key={cat.id} className="mb-3 break-inside-avoid rounded-xl bg-pdfgray p-3.5">
                      <div className="mb-2 flex items-center gap-2 text-pdfblue">
                        <span className="text-[17px] leading-none">{emojiMinisterio(cat.nome)}</span>
                        <span className="font-heading text-[12.5px] font-extrabold uppercase tracking-wide">
                          {cat.nome}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {cat.funcoes.map((f, i) => {
                          const nome = (evento.atribuicoes[f.id] ?? "").trim();
                          return (
                            <div
                              key={f.id}
                              className={
                                "flex items-baseline justify-between gap-3 pb-1.5 " +
                                (i < cat.funcoes.length - 1 ? "border-b border-white" : "")
                              }
                            >
                              <span className="text-[11px] font-semibold text-ink-600">
                                {emojiFuncao(f.nome)} {f.nome}
                              </span>
                              <span
                                className={
                                  "text-right text-[12.5px] font-extrabold uppercase " +
                                  (nome ? "text-pdfblue" : "italic font-medium normal-case text-ink-400")
                                }
                              >
                                {nome || "não preenchido"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-10 border-t border-pdfgray pt-3 text-center text-[10px] text-ink-400">
                Escala Extraordinária · Promessa Vila Camargo · gerado em {new Date().toLocaleDateString("pt-BR")}
              </div>
            </div>
          );
        })()}
    </div>
  );
}
