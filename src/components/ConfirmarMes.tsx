"use client";

import { useState } from "react";
import Link from "next/link";
import { confirmarTodasDoMes, responderDataDoMes } from "@/lib/actions/convite";
import type { ConviteDTO, StatusPessoa } from "@/lib/actions/convite";
import { labelFuncao, nomeMes, parseIsoDate } from "@/lib/datas";
import { emojiFuncao } from "@/lib/emojis";

const DIA_EXTENSO: Record<number, string> = { 0: "DOMINGO", 3: "QUARTA-FEIRA", 6: "SÁBADO" };

function mesVizinho(mes: string, delta: number) {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function rotuloMes(mes: string) {
  const [y, m] = mes.split("-").map(Number);
  return { nome: nomeMes(m - 1), ano: y };
}

export default function ConfirmarMes({
  mes,
  nome,
  k,
  itensIniciais,
}: {
  mes: string;
  nome: string;
  k: string;
  itensIniciais: ConviteDTO[];
}) {
  const [itens, setItens] = useState(itensIniciais);
  const [motivoAberto, setMotivoAberto] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [reabertos, setReabertos] = useState<Set<string>>(new Set());
  const [dialogTodas, setDialogTodas] = useState(false);
  const [tudoConfirmado, setTudoConfirmado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const primeiroNome = nome.split(" ")[0].charAt(0) + nome.split(" ")[0].slice(1).toLowerCase();
  const { nome: mesNome, ano } = rotuloMes(mes);
  const conta = (s: StatusPessoa) => itens.filter((i) => i.status === s).length;
  const pendentes = conta("AGUARDANDO");
  const linkMes = (m: string) => `/confirmar/${m}/${encodeURIComponent(nome)}?k=${k}`;

  function atualizar(data: string, status: StatusPessoa, motivoTxt: string | null) {
    setItens((lista) => lista.map((i) => (i.data === data ? { ...i, status, motivo: motivoTxt } : i)));
    setReabertos((r) => {
      const n = new Set(r);
      n.delete(data);
      return n;
    });
  }

  async function responder(data: string, resposta: "POSSO" | "NAO_POSSO") {
    setEnviando(true);
    setErro(null);
    try {
      await responderDataDoMes(data, nome, k, resposta, resposta === "NAO_POSSO" ? motivo : null);
      atualizar(data, resposta === "POSSO" ? "CONFIRMADO" : "NAO_PODE", resposta === "NAO_POSSO" ? motivo.trim() || null : null);
      setMotivoAberto(null);
      setMotivo("");
      setTudoConfirmado(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarTodas() {
    setEnviando(true);
    setErro(null);
    try {
      await confirmarTodasDoMes(mes, nome, k);
      // só o que estava aguardando muda; "não posso" e já confirmado ficam como estão
      setItens((lista) => lista.map((i) => (i.status === "AGUARDANDO" ? { ...i, status: "CONFIRMADO" } : i)));
      setDialogTodas(false);
      setTudoConfirmado(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-8">
      <div className="text-center">
        <div className="font-heading text-[13px] font-extrabold tracking-[0.25em] text-ink-900">ESCALA VC</div>
        <div className="text-[12px] text-ink-400">Confirmação de escala</div>
      </div>

      <div>
        <h1 className="font-heading text-2xl font-extrabold text-ink-900">Olá, {primeiroNome}! 👋</h1>
        <p className="text-[14px] text-ink-600">Sua escala de {mesNome} está abaixo.</p>
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-white px-2 py-2 shadow-soft">
        <Link href={linkMes(mesVizinho(mes, -1))} className="px-3 py-1 text-[20px] font-bold text-ink-600" aria-label="Mês anterior">
          ‹
        </Link>
        <div className="text-center text-[14px] font-extrabold uppercase tracking-wide text-ink-900">
          📅 {mesNome} {ano}
        </div>
        <Link href={linkMes(mesVizinho(mes, 1))} className="px-3 py-1 text-[20px] font-bold text-ink-600" aria-label="Próximo mês">
          ›
        </Link>
      </div>

      {itens.length === 0 ? (
        <p className="rounded-2xl bg-white p-5 text-center text-[14px] text-ink-600 shadow-soft">
          Você não tem nenhuma escala em {mesNome}.
        </p>
      ) : (
        <>
          <div className="rounded-2xl bg-ink-900 px-5 py-4 text-white">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">Sua escala — {mesNome}</div>
            <div className="mt-1 text-[16px] font-extrabold">{itens.length} escala(s)</div>
            <div className="mt-1 flex flex-col text-[13px] text-white/80">
              <span>🟢 {conta("CONFIRMADO")} confirmada(s)</span>
              <span>🟡 {pendentes} aguardando</span>
              <span>🔴 {conta("NAO_PODE")} não posso</span>
            </div>
          </div>

          {erro && <p className="text-center text-[13px] text-red-600">{erro}</p>}

          {pendentes > 0 ? (
            <button
              type="button"
              onClick={() => setDialogTodas(true)}
              className="w-full rounded-2xl bg-green-600 px-4 py-5 text-center text-white shadow-soft"
            >
              <div className="text-[18px] font-extrabold">✅ CONFIRMAR TODAS</div>
              <div className="text-[12.5px] text-white/80">Confirmar todas as escalas pendentes deste mês</div>
            </button>
          ) : tudoConfirmado ? (
            <div className="rounded-2xl bg-green-50 px-4 py-4 text-center">
              <div className="text-[16px] font-extrabold text-green-600">✅ Tudo confirmado!</div>
              <div className="text-[13px] text-ink-600">Suas escalas pendentes deste mês foram confirmadas.</div>
            </div>
          ) : (
            <div className="rounded-2xl bg-green-50 px-4 py-3 text-center text-[14px] font-extrabold text-green-600">
              ✅ Sua escala está atualizada!
            </div>
          )}

          <div className="flex flex-col gap-3">
            {itens.map((i) => {
              const { m, d } = parseIsoDate(i.data);
              const respondida = i.status !== "AGUARDANDO" && !reabertos.has(i.data);
              return (
                <div key={i.data} className="rounded-2xl bg-white p-4 shadow-soft">
                  <div className="text-[12px] font-extrabold uppercase tracking-wide text-ink-900">
                    📅 {DIA_EXTENSO[i.diaSemana]} — {String(d).padStart(2, "0")}/{String(m + 1).padStart(2, "0")}
                  </div>
                  <div className="mt-2 flex flex-col gap-0.5">
                    {i.funcoes.map((f) => (
                      <div key={f.funcaoNome} className="text-[15px] font-bold text-ink-900">
                        {emojiFuncao(f.funcaoNome)} {labelFuncao(f.funcaoNome, i.diaSemana)}
                      </div>
                    ))}
                  </div>

                  {respondida ? (
                    <div className="mt-3">
                      <div className={"text-[13px] font-bold " + (i.status === "CONFIRMADO" ? "text-green-600" : "text-red-600")}>
                        {i.status === "CONFIRMADO" ? "🟢 Confirmado" : "🔴 Não posso"}
                      </div>
                      {i.motivo && <div className="text-[12px] italic text-ink-400">📝 {i.motivo}</div>}
                      <button
                        type="button"
                        onClick={() => setReabertos((r) => new Set(r).add(i.data))}
                        className="mt-1 text-[12px] font-semibold text-ink-400"
                      >
                        Mudar resposta
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <div className="mb-2 text-[13px] font-bold text-orange-600">🟡 Aguardando</div>
                      {motivoAberto === i.data ? (
                        <div className="flex flex-col gap-2">
                          <label className="text-[12px] font-semibold text-ink-600">Motivo (opcional)</label>
                          <textarea
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                            rows={3}
                            maxLength={500}
                            placeholder="Ex.: Não estarei disponível neste domingo."
                            className="input resize-none"
                          />
                          <button
                            type="button"
                            disabled={enviando}
                            onClick={() => responder(i.data, "NAO_POSSO")}
                            className="w-full rounded-xl bg-ink-900 py-3 text-[14px] font-extrabold text-white disabled:opacity-60"
                          >
                            {enviando ? "Enviando..." : "ENVIAR"}
                          </button>
                          <button type="button" onClick={() => setMotivoAberto(null)} className="text-[12.5px] font-semibold text-ink-400">
                            ← Voltar
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            disabled={enviando}
                            onClick={() => responder(i.data, "POSSO")}
                            className="w-full rounded-xl bg-green-600 py-3.5 text-[15px] font-extrabold text-white disabled:opacity-60"
                          >
                            ✅ POSSO
                          </button>
                          <button
                            type="button"
                            disabled={enviando}
                            onClick={() => {
                              setMotivo("");
                              setMotivoAberto(i.data);
                            }}
                            className="w-full rounded-xl border-2 border-red-500 bg-white py-3.5 text-[15px] font-extrabold text-red-600 disabled:opacity-60"
                          >
                            ❌ NÃO POSSO
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {dialogTodas && (
        <div className="fixed inset-0 z-50 flex items-end bg-ink-900/60 sm:items-center sm:justify-center">
          <div className="w-full rounded-t-2xl bg-white p-5 sm:max-w-sm sm:rounded-2xl">
            <div className="mb-2 text-center text-[16px] font-extrabold text-ink-900">Confirmar todas as escalas?</div>
            <p className="mb-4 text-center text-[13.5px] text-ink-600">
              Você está confirmando sua participação em {pendentes} escala(s) pendente(s) deste mês.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={enviando}
                onClick={confirmarTodas}
                className="w-full rounded-xl bg-green-600 py-3.5 text-[15px] font-extrabold text-white disabled:opacity-60"
              >
                {enviando ? "Confirmando..." : "CONFIRMAR TODAS"}
              </button>
              <button
                type="button"
                disabled={enviando}
                onClick={() => setDialogTodas(false)}
                className="w-full rounded-xl py-2.5 text-[14px] font-semibold text-ink-600"
              >
                CANCELAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
