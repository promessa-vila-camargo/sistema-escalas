"use client";

import { useMemo, useState } from "react";
import type { ConviteAdminDTO, StatusPessoa } from "@/lib/actions/convite";
import { fmtDDMM, labelFuncao, parseIsoDate } from "@/lib/datas";
import { emojiFuncao } from "@/lib/emojis";

const DIA: Record<number, string> = { 0: "Domingo", 3: "Quarta-feira", 6: "Sábado" };

const STATUS_VISUAL: Record<StatusPessoa, { emoji: string; texto: string; classe: string }> = {
  CONFIRMADO: { emoji: "🟢", texto: "Confirmado", classe: "text-green-600" },
  NAO_PODE: { emoji: "🔴", texto: "Não pode", classe: "text-red-600" },
  AGUARDANDO: { emoji: "🟡", texto: "Aguardando", classe: "text-orange-600" },
};

type FiltroStatus = "TODOS" | StatusPessoa;

function titulo(nome: string) {
  return nome
    .toLowerCase()
    .split(" ")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function ddmm(iso: string) {
  const { y, m, d } = parseIsoDate(iso);
  return fmtDDMM(y, m, d);
}

export default function ConfirmacoesPainel({
  convites,
  mesLabel,
  intervaloLabel,
}: {
  convites: ConviteAdminDTO[];
  mesLabel: string;
  intervaloLabel: string;
}) {
  // dias aplicados: null = todos os dias do mês
  const [diasAplicados, setDiasAplicados] = useState<Set<string> | null>(null);
  const [diasRascunho, setDiasRascunho] = useState<Set<string>>(new Set());
  const [diasAberto, setDiasAberto] = useState(false);
  const [status, setStatus] = useState<FiltroStatus>("TODOS");
  const [ministerio, setMinisterio] = useState("");
  const [funcao, setFuncao] = useState("");
  const [pessoa, setPessoa] = useState("");
  const [copiado, setCopiado] = useState<string | null>(null);

  const diasComEscala = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const c of convites) mapa.set(c.data, c.diaSemana);
    return [...mapa.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([data, diaSemana]) => ({ data, diaSemana }));
  }, [convites]);

  const ministerios = useMemo(() => [...new Set(convites.flatMap((c) => c.funcoes.map((f) => f.categoriaNome)))], [convites]);
  const funcoesLista = useMemo(
    () => [...new Set(convites.flatMap((c) => c.funcoes.filter((f) => !ministerio || f.categoriaNome === ministerio).map((f) => f.funcaoNome)))],
    [convites, ministerio]
  );
  const pessoas = useMemo(() => [...new Set(convites.map((c) => c.nome))].sort(), [convites]);

  // tudo menos o status — usado pra contar os chips e o resumo
  const base = useMemo(() => {
    return convites
      .filter((c) => !diasAplicados || diasAplicados.has(c.data))
      .filter((c) => !pessoa || c.nome === pessoa)
      .map((c) => ({
        c,
        funcoesVisiveis: c.funcoes.filter(
          (f) => (!ministerio || f.categoriaNome === ministerio) && (!funcao || f.funcaoNome === funcao)
        ),
      }))
      .filter((x) => x.funcoesVisiveis.length > 0);
  }, [convites, diasAplicados, pessoa, ministerio, funcao]);

  const visiveis = status === "TODOS" ? base : base.filter((x) => x.c.status === status);
  const contagem = {
    TODOS: base.length,
    CONFIRMADO: base.filter((x) => x.c.status === "CONFIRMADO").length,
    NAO_PODE: base.filter((x) => x.c.status === "NAO_PODE").length,
    AGUARDANDO: base.filter((x) => x.c.status === "AGUARDANDO").length,
  };

  const porData = new Map<string, typeof visiveis>();
  for (const x of visiveis) porData.set(x.c.data, [...(porData.get(x.c.data) ?? []), x]);

  const algumFiltro = diasAplicados !== null || status !== "TODOS" || ministerio || funcao || pessoa;

  function abrirDias() {
    setDiasRascunho(new Set(diasAplicados ?? []));
    setDiasAberto((v) => !v);
  }

  function selecionarPor(pred: (d: { data: string; diaSemana: number }) => boolean) {
    setDiasRascunho(new Set(diasComEscala.filter(pred).map((d) => d.data)));
  }

  function alternarDia(data: string) {
    setDiasRascunho((antigo) => {
      const novo = new Set(antigo);
      if (novo.has(data)) novo.delete(data);
      else novo.add(data);
      return novo;
    });
  }

  function aplicarDias() {
    const todos = diasRascunho.size === 0 || diasRascunho.size === diasComEscala.length;
    setDiasAplicados(todos ? null : new Set(diasRascunho));
    setDiasAberto(false);
  }

  function limparTudo() {
    setDiasAplicados(null);
    setDiasRascunho(new Set());
    setStatus("TODOS");
    setMinisterio("");
    setFuncao("");
    setPessoa("");
    setDiasAberto(false);
  }

  const diasAtivos = diasAplicados ? [...diasAplicados].sort() : [];
  const chips = [
    mesLabel,
    diasAplicados ? `${diasAplicados.size} dia(s)` : null,
    ministerio || null,
    funcao || null,
    pessoa ? titulo(pessoa) : null,
    status !== "TODOS" ? STATUS_VISUAL[status].texto : null,
  ].filter(Boolean);

  function linkCompleto(c: ConviteAdminDTO) {
    return `${window.location.origin}${c.caminhoMes}`;
  }

  // Um único link por pessoa no mês: a mensagem lista todas as datas dela (independente dos filtros ativos).
  function mensagem(c: ConviteAdminDTO) {
    const datas = convites.filter((x) => x.nome === c.nome);
    const linhas = datas.map((x) => {
      const funcoes = x.funcoes.map((f) => labelFuncao(f.funcaoNome, x.diaSemana)).join(" e ");
      return `• ${DIA[x.diaSemana]} ${ddmm(x.data)} — ${funcoes}`;
    });
    return [
      `${titulo(c.nome.split(" ")[0])}, tudo bem? 👋`,
      "",
      `Sua escala de *${mesLabel.split(" ")[0]}* está pronta:`,
      ...linhas,
      "",
      "É só clicar no link abaixo e confirmar (dá pra confirmar tudo de uma vez):",
      linkCompleto(c),
    ].join("\n");
  }

  async function copiar(c: ConviteAdminDTO) {
    await navigator.clipboard.writeText(mensagem(c));
    const chave = `${c.data}|${c.nome}`;
    setCopiado(chave);
    setTimeout(() => setCopiado((atual) => (atual === chave ? null : atual)), 2000);
  }

  const filtrosStatus: { id: FiltroStatus; label: string }[] = [
    { id: "TODOS", label: "Todos" },
    { id: "CONFIRMADO", label: "Confirmados" },
    { id: "NAO_PODE", label: "Não podem" },
    { id: "AGUARDANDO", label: "Aguardando" },
  ];

  return (
    <div>
      <div className="card !p-4 mb-4">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <div className="relative">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-ink-400">📅 Dias</span>
            <button type="button" onClick={abrirDias} className="input !w-auto text-left text-sm font-semibold">
              {diasAplicados ? `${diasAplicados.size} dia(s) selecionado(s)` : "Todos os dias"} ▾
            </button>
            {diasAberto && (
              <div className="absolute left-0 top-full z-30 mt-1 w-[290px] rounded-xl border border-brand-100 bg-white p-3 shadow-soft-lift">
                <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-ink-600">Selecionar dias</div>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {[
                    { l: "Todos", f: () => selecionarPor(() => true) },
                    { l: "Nenhum", f: () => setDiasRascunho(new Set()) },
                    { l: "Domingos", f: () => selecionarPor((d) => d.diaSemana === 0) },
                    { l: "Sábados", f: () => selecionarPor((d) => d.diaSemana === 6) },
                    { l: "Quartas", f: () => selecionarPor((d) => d.diaSemana === 3) },
                  ].map((a) => (
                    <button
                      key={a.l}
                      type="button"
                      onClick={a.f}
                      className="rounded-full bg-brand-50 px-2.5 py-1 text-[11.5px] font-bold text-ink-900"
                    >
                      {a.l}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2 border-b border-brand-100 pb-2 text-[13px] font-semibold text-ink-900">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-orange-600"
                    checked={diasRascunho.size === diasComEscala.length && diasComEscala.length > 0}
                    onChange={(e) => selecionarPor(() => e.target.checked)}
                  />
                  Todos os dias
                </label>
                <div className="mt-2 flex max-h-56 flex-col gap-1 overflow-auto">
                  {diasComEscala.length === 0 && <span className="text-[12.5px] text-ink-400">Nenhum dia com escala neste mês.</span>}
                  {diasComEscala.map((d) => (
                    <label key={d.data} className="flex items-center gap-2 text-[13px] text-ink-900">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-orange-600"
                        checked={diasRascunho.has(d.data)}
                        onChange={() => alternarDia(d.data)}
                      />
                      {ddmm(d.data)} — {DIA[d.diaSemana]}
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex justify-between gap-2">
                  <button type="button" onClick={() => setDiasRascunho(new Set())} className="btn-ghost">
                    Limpar
                  </button>
                  <button type="button" onClick={aplicarDias} className="btn-primary !px-5 !py-2">
                    Aplicar filtros
                  </button>
                </div>
              </div>
            )}
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Ministério</span>
            <select
              className="input !w-auto py-1.5 text-sm font-semibold"
              value={ministerio}
              onChange={(e) => {
                setMinisterio(e.target.value);
                setFuncao("");
              }}
            >
              <option value="">Todos</option>
              {ministerios.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Função</span>
            <select className="input !w-auto py-1.5 text-sm font-semibold" value={funcao} onChange={(e) => setFuncao(e.target.value)}>
              <option value="">Todas</option>
              {funcoesLista.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-ink-400">Pessoa</span>
            <select className="input !w-auto py-1.5 text-sm font-semibold" value={pessoa} onChange={(e) => setPessoa(e.target.value)}>
              <option value="">Todas</option>
              {pessoas.map((p) => (
                <option key={p} value={p}>
                  {titulo(p)}
                </option>
              ))}
            </select>
          </label>

          {algumFiltro && (
            <button type="button" onClick={limparTudo} className="btn-ghost pb-2">
              ✕ Limpar filtros
            </button>
          )}
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {filtrosStatus.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatus(f.id)}
              className={
                "rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-colors " +
                (status === f.id ? "bg-ink-900 text-white" : "bg-brand-50 text-ink-600 hover:text-ink-900")
              }
            >
              {f.label} <span className="opacity-60">{contagem[f.id]}</span>
            </button>
          ))}
        </div>

        <div className="text-[12.5px] text-ink-600">
          {diasAplicados ? (
            <>
              <b className="text-ink-900">{diasAplicados.size} dia(s) selecionado(s):</b>{" "}
              {diasAtivos.map(ddmm).join(" · ")}
            </>
          ) : (
            <>
              <b className="text-ink-900">{mesLabel}</b> — exibindo escalas de {intervaloLabel}
            </>
          )}
          {chips.length > 1 && <div className="mt-0.5 text-ink-400">{chips.join(" • ")}</div>}
        </div>
      </div>

      <div className="mb-4 rounded-2xl bg-ink-900 px-4 py-3 text-[13px] font-bold text-white">
        {contagem.TODOS} escalado(s) · 🟢 {contagem.CONFIRMADO} confirmado(s) · 🟡 {contagem.AGUARDANDO} aguardando · 🔴{" "}
        {contagem.NAO_PODE} não pode(m)
      </div>

      {visiveis.length === 0 && <p className="empty-state">Nenhuma escala com esses filtros.</p>}

      <div className="flex flex-col gap-4">
        {[...porData.entries()].map(([data, lista]) => (
          <div key={data} className="card !p-4">
            <h2 className="mb-3 text-[13px] font-extrabold uppercase tracking-wide text-ink-600">
              📅 {DIA[lista[0].c.diaSemana]} · {ddmm(data)}
            </h2>
            <div className="flex flex-col divide-y divide-brand-100">
              {lista.map(({ c, funcoesVisiveis }) => {
                const v = STATUS_VISUAL[c.status];
                const chave = `${c.data}|${c.nome}`;
                return (
                  <div key={chave} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
                    <div className="min-w-[150px] flex-1">
                      <div className="text-[13.5px] font-bold text-ink-900">{titulo(c.nome)}</div>
                      <div className="text-[12px] text-ink-600">
                        {funcoesVisiveis
                          .map((f) => `${emojiFuncao(f.funcaoNome)} ${labelFuncao(f.funcaoNome, c.diaSemana)}`)
                          .join(" · ")}
                      </div>
                      {c.motivo && <div className="mt-0.5 text-[12px] italic text-ink-400">📝 {c.motivo}</div>}
                    </div>
                    <span className={"text-[12.5px] font-bold " + v.classe}>
                      {v.emoji} {v.texto}
                    </span>
                    <div className="flex gap-2">
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(mensagem(c))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full bg-green-600 px-3 py-1.5 text-[12px] font-bold text-white"
                      >
                        📲 Enviar link do mês
                      </a>
                      <button
                        type="button"
                        onClick={() => copiar(c)}
                        className="rounded-full bg-brand-50 px-3 py-1.5 text-[12px] font-bold text-ink-900"
                      >
                        {copiado === chave ? "✓ Copiado" : "Copiar"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
