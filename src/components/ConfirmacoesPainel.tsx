"use client";

import { useState } from "react";
import type { ConviteAdminDTO, StatusPessoa } from "@/lib/actions/convite";
import { fmtDDMM, labelFuncao, parseIsoDate } from "@/lib/datas";
import { emojiFuncao } from "@/lib/emojis";

const DIA: Record<number, string> = { 0: "Domingo", 3: "Quarta-feira", 6: "Sábado" };

const STATUS_VISUAL: Record<StatusPessoa, { emoji: string; texto: string; classe: string }> = {
  CONFIRMADO: { emoji: "🟢", texto: "Confirmado", classe: "text-green-600" },
  NAO_PODE: { emoji: "🔴", texto: "Não pode", classe: "text-red-600" },
  AGUARDANDO: { emoji: "🟡", texto: "Aguardando", classe: "text-orange-600" },
};

type Filtro = "TODOS" | StatusPessoa;

function titulo(nome: string) {
  return nome
    .toLowerCase()
    .split(" ")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export default function ConfirmacoesPainel({ convites }: { convites: ConviteAdminDTO[] }) {
  const [filtro, setFiltro] = useState<Filtro>("TODOS");
  const [copiado, setCopiado] = useState<string | null>(null);

  const contagem = {
    TODOS: convites.length,
    CONFIRMADO: convites.filter((c) => c.status === "CONFIRMADO").length,
    NAO_PODE: convites.filter((c) => c.status === "NAO_PODE").length,
    AGUARDANDO: convites.filter((c) => c.status === "AGUARDANDO").length,
  };
  const visiveis = filtro === "TODOS" ? convites : convites.filter((c) => c.status === filtro);

  const porData = new Map<string, ConviteAdminDTO[]>();
  for (const c of visiveis) porData.set(c.data, [...(porData.get(c.data) ?? []), c]);

  function linkCompleto(c: ConviteAdminDTO) {
    return `${window.location.origin}${c.caminho}`;
  }

  function mensagem(c: ConviteAdminDTO) {
    const { m, d } = parseIsoDate(c.data);
    const funcoes = c.funcoes.map((f) => labelFuncao(f.funcaoNome, c.diaSemana)).join(" e ");
    return [
      `${titulo(c.nome.split(" ")[0])}, tudo bem? 👋`,
      "",
      `Você está escalado para *${funcoes}* — ${DIA[c.diaSemana]}, ${fmtDDMM(parseIsoDate(c.data).y, m, d)}.`,
      "",
      "É só clicar no link abaixo e informar se consegue participar:",
      linkCompleto(c),
    ].join("\n");
  }

  async function copiar(c: ConviteAdminDTO) {
    await navigator.clipboard.writeText(mensagem(c));
    const chave = `${c.data}|${c.nome}`;
    setCopiado(chave);
    setTimeout(() => setCopiado((atual) => (atual === chave ? null : atual)), 2000);
  }

  const filtros: { id: Filtro; label: string }[] = [
    { id: "TODOS", label: "Todos" },
    { id: "CONFIRMADO", label: "Confirmados" },
    { id: "NAO_PODE", label: "Não podem" },
    { id: "AGUARDANDO", label: "Aguardando" },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {filtros.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltro(f.id)}
            className={
              "rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-colors " +
              (filtro === f.id ? "bg-ink-900 text-white" : "bg-white text-ink-600 shadow-soft hover:text-ink-900")
            }
          >
            {f.label} <span className="opacity-60">{contagem[f.id]}</span>
          </button>
        ))}
      </div>

      {visiveis.length === 0 && <p className="empty-state">Nenhuma escala nesse filtro.</p>}

      <div className="flex flex-col gap-4">
        {[...porData.entries()].map(([data, lista]) => {
          const { y, m, d } = parseIsoDate(data);
          return (
            <div key={data} className="card !p-4">
              <h2 className="mb-3 text-[13px] font-extrabold uppercase tracking-wide text-ink-600">
                {DIA[lista[0].diaSemana]} · {fmtDDMM(y, m, d)}
              </h2>
              <div className="flex flex-col divide-y divide-brand-100">
                {lista.map((c) => {
                  const v = STATUS_VISUAL[c.status];
                  const chave = `${c.data}|${c.nome}`;
                  return (
                    <div key={chave} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
                      <div className="min-w-[150px] flex-1">
                        <div className="text-[13.5px] font-bold text-ink-900">{titulo(c.nome)}</div>
                        <div className="text-[12px] text-ink-600">
                          {c.funcoes.map((f) => `${emojiFuncao(f.funcaoNome)} ${labelFuncao(f.funcaoNome, c.diaSemana)}`).join(" · ")}
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
                          📲 WhatsApp
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
          );
        })}
      </div>
    </div>
  );
}
