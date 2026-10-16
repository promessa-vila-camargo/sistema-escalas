"use client";

import { useRef, useState } from "react";
import {
  criarEventoExtra,
  excluirEventoExtra,
  definirAtribuicaoExtra,
  type EventoExtraDTO,
} from "@/lib/actions/eventoExtra";
import { fmtDataCompleta, parseIsoDate, nomeMesAbrev, proximoSabado } from "@/lib/datas";
import type { CategoriaDTO } from "./EscalaBoard";
import type { CurrentUser } from "@/lib/auth/dal";
import Icon from "./ui/Icon";
import Modal from "./ui/Modal";
import Menu from "./ui/Menu";
import Impressao, { abrirImpressao } from "./ui/Impressao";
import FuncaoLinha, { DivisorMinisterio } from "./escala/FuncaoLinha";

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
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [printEventoId, setPrintEventoId] = useState<string | null>(null);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const isAdmin = currentUser.role === "ADMIN";
  const podeGerenciar = isAdmin || currentUser.podeGerenciarEventoExtra;
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
      setErroSalvar(e instanceof Error ? e.message : "Não foi possível excluir.");
    }
  }

  function applyLocalChange(eventoId: string, funcaoId: string, value: string) {
    setEventos((old) =>
      old.map((e) => (e.id === eventoId ? { ...e, atribuicoes: { ...e.atribuicoes, [funcaoId]: value } } : e))
    );
  }

  function commitSave(eventoId: string, funcaoId: string, nome: string | null) {
    definirAtribuicaoExtra(eventoId, funcaoId, nome)
      .then(() => setErroSalvar(null))
      .catch((e) => setErroSalvar(e instanceof Error ? e.message : "Não foi possível salvar."));
  }

  function handleTextChange(eventoId: string, funcaoId: string, value: string) {
    applyLocalChange(eventoId, funcaoId, value);
    const key = `${eventoId}:${funcaoId}`;
    if (saveTimers.current[key]) clearTimeout(saveTimers.current[key]);
    saveTimers.current[key] = setTimeout(() => {
      delete saveTimers.current[key];
      commitSave(eventoId, funcaoId, value);
    }, SAVE_DEBOUNCE_MS);
  }

  function handleBlurCommit(eventoId: string, funcaoId: string, value: string) {
    const key = `${eventoId}:${funcaoId}`;
    const maiuscula = value.trim().toUpperCase();
    if (maiuscula !== value) applyLocalChange(eventoId, funcaoId, maiuscula);
    // Só sair do campo, sem ter digitado nada, não regrava.
    if (!saveTimers.current[key]) return;
    clearTimeout(saveTimers.current[key]);
    delete saveTimers.current[key];
    commitSave(eventoId, funcaoId, maiuscula || null);
  }

  function handleImprimir(evento: EventoExtraDTO) {
    setPrintEventoId(evento.id);
    abrirImpressao(`Escala extraordinária ${evento.data.split("-").reverse().join("-")}`, () => setPrintEventoId(null));
  }

  const eventoImpressao = printEventoId ? eventos.find((e) => e.id === printEventoId) : null;

  return (
    <section className="mt-12 print:hidden">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="font-heading text-[17px] font-bold text-ink-900">Escalas extraordinárias</h2>
            <span className="text-[12.5px] text-ink-500 tabular-nums">{eventos.length}</span>
          </div>
          <p className="mt-1 text-[13px] text-ink-600">Eventos fora do horário oficial — não afetam a escala normal.</p>
        </div>
        {podeGerenciar && (
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button type="button" onClick={() => abrirModalRapido("sabado_noite")} className="btn-secondary px-3">
              <Icon name="moon" size={16} className="text-ink-500" />
              Sábado à noite
            </button>
            <button type="button" onClick={() => abrirModalRapido("outro")} className="btn-secondary px-3">
              <Icon name="plus" size={16} className="text-ink-500" />
              Outro evento
            </button>
          </div>
        )}
      </div>

      {erroSalvar && (
        <p className="mb-3 flex items-center gap-2 rounded-[10px] bg-red-50 px-3 py-2 text-[13px] font-medium text-red-600" role="alert">
          <Icon name="alert" size={16} /> {erroSalvar}
        </p>
      )}

      {eventos.length === 0 ? (
        <div className="empty-state">Nenhuma escala extraordinária cadastrada.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
          {eventos.map((evento) => {
            const { m, d } = parseIsoDate(evento.data);
            return (
              <article
                key={evento.id}
                className="relative rounded-[14px] border border-line bg-white shadow-[0_1px_2px_rgb(20_34_53/0.04)]"
              >
                <span
                  className="absolute inset-x-0 top-0 h-[3px] rounded-t-[14px] bg-[repeating-linear-gradient(135deg,var(--color-orange-500)_0_8px,var(--color-orange-200)_8px_14px)]"
                  aria-hidden
                />
                <header className="flex items-center gap-3.5 px-4 pt-5 pb-3.5 sm:px-5">
                  <div className="flex w-11 flex-none flex-col items-center leading-none">
                    <span className="font-heading text-[30px] font-bold tracking-tight text-ink-900 tabular-nums">
                      {String(d).padStart(2, "0")}
                    </span>
                    <span className="mt-1.5 text-[10px] font-bold tracking-[0.16em] text-ink-400">
                      {nomeMesAbrev(m)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-heading text-[15px] leading-tight font-bold text-ink-900">{evento.nome}</h3>
                    <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-ink-500">
                      <Icon name="clock" size={14} className="text-orange-500" />
                      <span className="truncate tabular-nums">
                        {fmtDataCompleta(evento.data)} · {evento.horario}
                      </span>
                    </p>
                  </div>
                  <Menu
                    rotulo="Ações da escala extraordinária"
                    itens={[
                      { rotulo: "Baixar PDF", icone: "download", onSelect: () => handleImprimir(evento) },
                      ...(podeGerenciar
                        ? [{ rotulo: "Excluir", icone: "trash" as const, onSelect: () => handleExcluir(evento.id) }]
                        : []),
                    ]}
                  />
                </header>
                <div className="border-t border-line px-4 pt-3.5 pb-4 sm:px-5">
                  {categoriasVisiveis.map((cat) => {
                    if (cat.funcoes.length === 0) return null;
                    return (
                      <div key={cat.id} className="pt-3.5 first:pt-0">
                        <DivisorMinisterio nome={cat.nome} />
                        {cat.funcoes.map((f) => (
                          <FuncaoLinha
                            key={f.id}
                            label={f.nome}
                            valor={evento.atribuicoes[f.id] ?? ""}
                            editavel={isAdmin || currentUser.funcaoIds.includes(f.id)}
                            onChange={(v) => handleTextChange(evento.id, f.id, v)}
                            onBlur={(v) => handleBlurCommit(evento.id, f.id, v)}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {modalAberto && (
        <Modal
          largura="sm"
          onClose={() => setModalAberto(false)}
          titulo="Nova escala extraordinária"
          descricao="Não altera os horários oficiais — existe só nesta escala."
          rodape={
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className="btn-ghost h-10" onClick={() => setModalAberto(false)}>
                Cancelar
              </button>
              <button type="button" className="btn-primary" disabled={criando} onClick={handleCriar}>
                {criando ? "Criando…" : "Criar escala"}
              </button>
            </div>
          }
        >
          <div className="flex flex-col gap-4 px-5 py-5 sm:px-6">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-ink-800">Nome do evento</span>
              <input
                value={formNome}
                onChange={(e) => setFormNome(e.target.value)}
                placeholder='Ex.: "Culto especial"'
                className="input"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-ink-800">Data</span>
                <input type="date" value={formData} onChange={(e) => setFormData(e.target.value)} className="input" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-ink-800">Horário</span>
                <input type="time" value={formHorario} onChange={(e) => setFormHorario(e.target.value)} className="input" />
              </label>
            </div>
            {erroForm && (
              <p className="form-message-error" role="alert">
                <Icon name="alert" size={16} className="mt-0.5" /> {erroForm}
              </p>
            )}
          </div>
        </Modal>
      )}

      {eventoImpressao && (
        <Impressao>
          <div className="bg-white font-sans text-[#142235]">
            <header className="mb-5 flex items-end justify-between gap-6 border-b-[1.5px] border-[#004b83] pb-3.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Promessa Vila Camargo" className="h-[34px] w-auto" />
              <div className="text-right">
                <div className="text-[8.5px] font-bold tracking-[0.22em] text-[#e18800] uppercase">
                  Escala extraordinária
                </div>
                <div className="font-heading text-[20px] leading-tight font-bold text-[#004b83]">{eventoImpressao.nome}</div>
                <div className="text-[10px] font-semibold text-[#56657a]">
                  {fmtDataCompleta(eventoImpressao.data)} · {eventoImpressao.horario}
                </div>
              </div>
            </header>
            <div className="mx-auto max-w-[520px] columns-1">
              {categoriasVisiveis.map((cat) => {
                if (cat.funcoes.length === 0) return null;
                return (
                  <div key={cat.id} className="mb-3 break-inside-avoid rounded-[10px] border border-[#dfe3e9] px-4 py-3">
                    <div className="mb-1 text-[7.5px] font-bold tracking-[0.16em] text-[#6f7d90] uppercase">{cat.nome}</div>
                    {cat.funcoes.map((f) => {
                      const nome = (eventoImpressao.atribuicoes[f.id] ?? "").trim();
                      return (
                        <div
                          key={f.id}
                          className="flex items-baseline justify-between gap-3 border-b border-[#eef0f3] py-[3px] last:border-b-0"
                        >
                          <span className="text-[9.5px] text-[#56657a]">{f.nome}</span>
                          <span
                            className={
                              "text-right text-[11px] font-bold uppercase " +
                              (nome ? "text-[#142235]" : "font-medium normal-case text-[#94a0b0] italic")
                            }
                          >
                            {nome || "não preenchido"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <footer className="mt-5 flex justify-between border-t border-[#e7e4dd] pt-2 text-[8px] tracking-[0.06em] text-[#949fae] uppercase">
              <span>Promessa Vila Camargo · Escala extraordinária</span>
              <span>Gerado em {new Date().toLocaleDateString("pt-BR")}</span>
            </footer>
          </div>
        </Impressao>
      )}
    </section>
  );
}
