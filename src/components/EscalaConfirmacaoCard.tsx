"use client";

import { useState } from "react";
import { confirmarEscala, solicitarTroca } from "@/lib/actions/confirmacao";
import type { MinhaEscalaDTO } from "@/lib/actions/confirmacao";
import { labelFuncao } from "@/lib/datas";
import { emojiFuncao, emojiMinisterio } from "@/lib/emojis";

function fmtHora(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function EscalaConfirmacaoCard({
  escala,
  dataLabel,
}: {
  escala: MinhaEscalaDTO;
  dataLabel: string;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [trocaAberta, setTrocaAberta] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function handleConfirmar() {
    setEnviando(true);
    try {
      await confirmarEscala(escala.id);
    } finally {
      setEnviando(false);
      setConfirmando(false);
    }
  }

  async function handleEnviarTroca() {
    setEnviando(true);
    try {
      await solicitarTroca(escala.id, observacao);
    } finally {
      setEnviando(false);
      setTrocaAberta(false);
    }
  }

  const mostraBotoes = escala.status === "AGUARDANDO";
  const label = labelFuncao(escala.funcaoNome, escala.diaSemana);

  return (
    <div className="rounded-2xl border border-ink-900/10 bg-white p-4 shadow-soft">
      <div className="mb-2 text-[12.5px] font-extrabold uppercase tracking-wide text-ink-900">{dataLabel}</div>

      <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-ink-400">
        {emojiMinisterio(escala.categoriaNome)} {escala.categoriaNome}
      </div>
      <div className="mb-3 -mt-2 text-[15px] font-bold text-ink-900">
        {emojiFuncao(escala.funcaoNome)} {label}
      </div>

      {escala.status === "CONFIRMADO" && (
        <div>
          <div className="flex items-center gap-1.5 text-[13px] font-bold text-green-600">🟢 CONFIRMADO</div>
          {escala.confirmadoEm && (
            <div className="mt-0.5 text-[12px] text-ink-400">Confirmado em {fmtHora(escala.confirmadoEm)}</div>
          )}
        </div>
      )}

      {escala.status === "TROCA_SOLICITADA" && (
        <div>
          <div className="flex items-center gap-1.5 text-[13px] font-bold text-red-600">🔴 TROCA SOLICITADA</div>
          <div className="mt-0.5 text-[12px] text-ink-400">Solicitação enviada ao administrador.</div>
          <div className="mt-1.5 text-[12px] font-semibold italic text-ink-400">Aguardando análise</div>
        </div>
      )}

      {escala.status === "AGUARDANDO" && escala.foiAlteradaAposConfirmacao && (
        <div className="mb-3 rounded-lg bg-orange-50 px-3 py-2 text-[12px] font-semibold text-orange-700">
          ⚠️ ESCALA ATUALIZADA — esta participação foi alterada pelo administrador. Por favor, confirme novamente.
        </div>
      )}

      {escala.status === "AGUARDANDO" && !escala.foiAlteradaAposConfirmacao && (
        <div className="mb-1 flex items-center gap-1.5 text-[13px] font-bold text-orange-600">
          🟡 AGUARDANDO CONFIRMAÇÃO
        </div>
      )}

      {mostraBotoes && !confirmando && (
        <div className="mt-3 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            className="w-full rounded-xl bg-green-600 py-3 text-[14px] font-bold text-white transition-colors hover:bg-green-700"
          >
            🟢 POSSO CUMPRIR
          </button>
          <button
            type="button"
            onClick={() => setTrocaAberta(true)}
            className="w-full rounded-xl border-2 border-red-500 py-3 text-[14px] font-bold text-red-600 transition-colors hover:bg-red-50"
          >
            🔴 PRECISO TROCAR
          </button>
        </div>
      )}

      {mostraBotoes && confirmando && (
        <div className="mt-3 rounded-xl bg-ink-900/5 p-3">
          <div className="mb-2 text-[13px] font-bold text-ink-900">Confirmar esta escala?</div>
          <div className="mb-3 text-[12.5px] text-ink-600">
            {dataLabel} • {escala.categoriaNome}
            <br />
            {label}
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={enviando}
              onClick={handleConfirmar}
              className="w-full rounded-xl bg-green-600 py-3 text-[14px] font-bold text-white disabled:opacity-60"
            >
              {enviando ? "Confirmando..." : "CONFIRMAR"}
            </button>
            <button
              type="button"
              disabled={enviando}
              onClick={() => setConfirmando(false)}
              className="w-full rounded-xl py-2 text-[13px] font-semibold text-ink-600"
            >
              Voltar
            </button>
          </div>
        </div>
      )}

      {trocaAberta && (
        <div className="fixed inset-0 z-50 flex items-end bg-ink-900/60 sm:items-center sm:justify-center">
          <div className="w-full rounded-t-2xl bg-white p-5 sm:max-w-sm sm:rounded-2xl">
            <div className="mb-3 text-center text-[15px] font-extrabold uppercase tracking-wide text-ink-900">
              Solicitar troca
            </div>
            <div className="mb-3 text-[13px] text-ink-600">
              {dataLabel}
              <br />
              {escala.categoriaNome} · {label}
            </div>
            <label className="mb-1 block text-[12px] font-semibold text-ink-600">
              Por que precisa trocar? (opcional)
            </label>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Escreva uma observação..."
              rows={3}
              className="input mb-4 resize-none"
            />
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={enviando}
                onClick={handleEnviarTroca}
                className="w-full rounded-xl bg-red-600 py-3 text-[14px] font-bold text-white disabled:opacity-60"
              >
                {enviando ? "Enviando..." : "ENVIAR SOLICITAÇÃO"}
              </button>
              <button
                type="button"
                disabled={enviando}
                onClick={() => setTrocaAberta(false)}
                className="w-full rounded-xl py-2 text-center text-[13px] font-semibold text-ink-600"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
