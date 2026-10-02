import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Link individual de confirmação, sem login: /confirmar/<data>/<nome>?k=<assinatura>.
 * A assinatura é um HMAC de "data + nome" com o SESSION_SECRET — sem ela
 * ninguém consegue montar o link de outra pessoa só adivinhando nome e data,
 * e não precisa guardar token nenhum no banco (é sempre recalculável).
 */
function assinar(data: string, nome: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET não configurado.");
  return createHmac("sha256", `convite:${secret}`).update(`${data}|${nome}`).digest("base64url").slice(0, 22);
}

export function assinarConvite(data: string, nome: string) {
  return assinar(data, nome);
}

export function conviteValido(data: string, nome: string, k: string | undefined) {
  if (!k) return false;
  const esperado = Buffer.from(assinar(data, nome));
  const recebido = Buffer.from(k);
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}

/**
 * Link mensal: /confirmar/<YYYY-MM>/<nome>?k=<assinatura da pessoa>. A
 * assinatura vale pra qualquer mês daquela pessoa (é o que permite navegar
 * entre meses na própria tela), mas não serve pra outra pessoa.
 */
export function conviteMesValido(nome: string, k: string | undefined) {
  return conviteValido("*", nome, k);
}

export function caminhoConviteMes(mes: string, nome: string) {
  return `/confirmar/${mes}/${encodeURIComponent(nome)}?k=${assinar("*", nome)}`;
}

export function caminhoConvite(data: string, nome: string) {
  return `/confirmar/${data}/${encodeURIComponent(nome)}?k=${assinar(data, nome)}`;
}
