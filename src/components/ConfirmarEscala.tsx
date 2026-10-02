"use client";

import { useState } from "react";
import { responderConvite } from "@/lib/actions/convite";
import type { ConviteDTO } from "@/lib/actions/convite";
import { labelFuncao, nomeMes, parseIsoDate } from "@/lib/datas";
import { emojiFuncao } from "@/lib/emojis";

const DIA_EXTENSO: Record<number, string> = { 0: "DOMINGO", 3: "QUARTA-FEIRA", 6: "SÁBADO" };

type Tela = "perguntar" | "motivo" | "confirmado" | "naoPode";

function Resumo({ convite }: { convite: ConviteDTO }) {
  const { m, d } = parseIsoDate(convite.data);
  return (
    <div className="rounded-2xl bg-ink-900 px-5 py-4 text-white">
      <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">
        {DIA_EXTENSO[convite.diaSemana] ?? ""} • {String(d).padStart(2, "0")} de {nomeMes(m)}
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {convite.funcoes.map((f) => (
          <div key={f.funcaoNome}>
            <div className="text-[15px] font-extrabold">
              {emojiFuncao(f.funcaoNome)} {labelFuncao(f.funcaoNome, convite.diaSemana)}
            </div>
            <div className="text-[12px] text-white/60">{f.categoriaNome}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 text-[12px] text-white/60">📍 Promessa Vila Camargo</div>
    </div>
  );
}

export default function ConfirmarEscala({ convite, k }: { convite: ConviteDTO; k: string }) {
  const primeiroNome = convite.nome.split(" ")[0].charAt(0) + convite.nome.split(" ")[0].slice(1).toLowerCase();
  const [tela, setTela] = useState<Tela>(
    convite.status === "CONFIRMADO" ? "confirmado" : convite.status === "NAO_PODE" ? "naoPode" : "perguntar"
  );
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(resposta: "POSSO" | "NAO_POSSO") {
    setEnviando(true);
    setErro(null);
    try {
      await responderConvite(convite.data, convite.nome, k, resposta, resposta === "NAO_POSSO" ? motivo : null);
      setTela(resposta === "POSSO" ? "confirmado" : "naoPode");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-8">
      <div className="text-center">
        <div className="font-heading text-[13px] font-extrabold tracking-[0.25em] text-ink-900">ESCALA VC</div>
        <div className="text-[12px] text-ink-400">Confirmação de escala</div>
      </div>

      {tela === "perguntar" && (
        <>
          <div>
            <h1 className="font-heading text-2xl font-extrabold text-ink-900">Olá, {primeiroNome}! 👋</h1>
            <p className="text-[14px] text-ink-600">Você foi escalado para este culto.</p>
          </div>
          <Resumo convite={convite} />
          <h2 className="text-center text-[16px] font-extrabold text-ink-900">Você pode participar dessa escala?</h2>
          {erro && <p className="text-center text-[13px] text-red-600">{erro}</p>}
          <div className="flex flex-col gap-3">
            <button
              type="button"
              disabled={enviando}
              onClick={() => enviar("POSSO")}
              className="w-full rounded-2xl bg-green-600 px-4 py-5 text-center text-white shadow-soft disabled:opacity-60"
            >
              <div className="text-[18px] font-extrabold">{enviando ? "Enviando..." : "✅ POSSO"}</div>
              <div className="text-[12.5px] text-white/80">Confirmar minha escala</div>
            </button>
            <button
              type="button"
              disabled={enviando}
              onClick={() => setTela("motivo")}
              className="w-full rounded-2xl border-2 border-red-500 bg-white px-4 py-5 text-center text-red-600 disabled:opacity-60"
            >
              <div className="text-[18px] font-extrabold">❌ NÃO POSSO</div>
              <div className="text-[12.5px] text-red-600/80">Informar que não poderei participar</div>
            </button>
          </div>
        </>
      )}

      {tela === "motivo" && (
        <>
          <div>
            <h1 className="font-heading text-2xl font-extrabold text-ink-900">Tudo bem, {primeiroNome}.</h1>
            <p className="text-[14px] text-ink-600">Entendemos. Vamos informar ao responsável pela escala.</p>
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-ink-600">Motivo (opcional)</label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={4}
              maxLength={500}
              placeholder="Ex.: Não estarei disponível neste domingo."
              className="input resize-none"
            />
          </div>
          {erro && <p className="text-center text-[13px] text-red-600">{erro}</p>}
          <button
            type="button"
            disabled={enviando}
            onClick={() => enviar("NAO_POSSO")}
            className="w-full rounded-2xl bg-ink-900 py-4 text-[16px] font-extrabold text-white disabled:opacity-60"
          >
            {enviando ? "Enviando..." : "ENVIAR"}
          </button>
          <button type="button" onClick={() => setTela("perguntar")} className="text-[13px] font-semibold text-ink-400">
            ← Voltar
          </button>
        </>
      )}

      {tela === "confirmado" && (
        <>
          <div className="text-center">
            <h1 className="font-heading text-2xl font-extrabold text-green-600">✅ Escala confirmada!</h1>
            <p className="mt-1 text-[14px] text-ink-600">
              Obrigado, {primeiroNome}!
              <br />
              Sua participação foi confirmada.
            </p>
          </div>
          <Resumo convite={convite} />
          <p className="text-center text-[13px] font-semibold text-ink-600">Você já está confirmado nessa escala.</p>
          <button type="button" onClick={() => setTela("perguntar")} className="text-[13px] font-semibold text-ink-400">
            Mudar minha resposta
          </button>
        </>
      )}

      {tela === "naoPode" && (
        <>
          <div className="text-center">
            <h1 className="font-heading text-2xl font-extrabold text-red-600">🔴 Indisponibilidade registrada</h1>
            <p className="mt-1 text-[14px] text-ink-600">Sua resposta foi enviada ao responsável pela escala.</p>
          </div>
          <Resumo convite={convite} />
          <button type="button" onClick={() => setTela("perguntar")} className="text-[13px] font-semibold text-ink-400">
            Mudar minha resposta
          </button>
        </>
      )}
    </div>
  );
}
