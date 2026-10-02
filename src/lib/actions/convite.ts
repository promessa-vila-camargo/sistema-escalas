"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyAdmin } from "@/lib/auth/dal";
import { caminhoConvite, caminhoConviteMes, conviteMesValido, conviteValido } from "@/lib/convite";
import { CATEGORIAS_CONFIRMACAO, isoDate } from "@/lib/datas";

/** Restringe qualquer consulta/atualização às áreas que participam da confirmação (Som, Datashow, Mídia, Transmissão). */
const SO_CONFIRMAVEIS = { funcao: { categoria: { nome: { in: CATEGORIAS_CONFIRMACAO } } } };

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
const MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function limitesDoMes(mes: string) {
  const [y, m] = mes.split("-").map(Number);
  return { de: new Date(Date.UTC(y, m - 1, 1)), ate: new Date(Date.UTC(y, m, 0)) };
}

function revalidarConfirmacoes() {
  revalidatePath("/admin");
  revalidatePath("/admin/confirmacoes");
  revalidatePath("/minhas-escalas");
}

export type StatusPessoa = "AGUARDANDO" | "CONFIRMADO" | "NAO_PODE";

export type FuncaoConvite = { funcaoNome: string; categoriaNome: string };

export type ConviteDTO = {
  data: string;
  diaSemana: number;
  nome: string;
  funcoes: FuncaoConvite[];
  status: StatusPessoa;
  motivo: string | null;
};

type LinhaComFuncao = {
  status: "AGUARDANDO" | "CONFIRMADO" | "TROCA_SOLICITADA";
  trocaObservacao: string | null;
  funcao: { nome: string; categoria: { nome: string } };
};

function statusDaPessoa(linhas: LinhaComFuncao[]): StatusPessoa {
  if (linhas.some((l) => l.status === "TROCA_SOLICITADA")) return "NAO_PODE";
  if (linhas.every((l) => l.status === "CONFIRMADO")) return "CONFIRMADO";
  return "AGUARDANDO";
}

/** Página pública: devolve a escala daquela pessoa naquela data, ou null se o link for inválido/a escala tiver mudado. */
export async function buscarConvite(data: string, nome: string, k: string | undefined): Promise<ConviteDTO | null> {
  if (!DATA_RE.test(data) || !conviteValido(data, nome, k)) return null;

  const linhas = await prisma.atribuicao.findMany({
    where: { data: new Date(data), nomeEscalado: nome, ...SO_CONFIRMAVEIS },
    include: { funcao: { include: { categoria: true } } },
    orderBy: { funcao: { ordem: "asc" } },
  });
  if (linhas.length === 0) return null;

  return {
    data,
    diaSemana: new Date(data).getUTCDay(),
    nome,
    funcoes: linhas.map((l) => ({ funcaoNome: l.funcao.nome, categoriaNome: l.funcao.categoria.nome })),
    status: statusDaPessoa(linhas),
    motivo: linhas.find((l) => l.trocaObservacao)?.trocaObservacao ?? null,
  };
}

/** Ação pública (sem login) — só vale com a assinatura certa do link; mexe somente nas linhas daquela pessoa naquela data. */
export async function responderConvite(
  data: string,
  nome: string,
  k: string,
  resposta: "POSSO" | "NAO_POSSO",
  motivo: string | null
) {
  if (!DATA_RE.test(data) || !conviteValido(data, nome, k)) {
    throw new Error("Link inválido.");
  }

  await aplicarResposta(data, nome, resposta, motivo);
  revalidarConfirmacoes();
}

async function aplicarResposta(data: string, nome: string, resposta: "POSSO" | "NAO_POSSO", motivo: string | null) {
  const where = { data: new Date(data), nomeEscalado: nome, ...SO_CONFIRMAVEIS };
  const resultado =
    resposta === "POSSO"
      ? await prisma.atribuicao.updateMany({
          where,
          data: { status: "CONFIRMADO", confirmadoEm: new Date(), trocaObservacao: null },
        })
      : await prisma.atribuicao.updateMany({
          where,
          data: {
            status: "TROCA_SOLICITADA",
            trocaSolicitadaEm: new Date(),
            trocaObservacao: motivo?.trim().slice(0, 500) || null,
          },
        });
  if (resultado.count === 0) throw new Error("Essa escala foi alterada. Peça um novo link ao responsável.");
}

export type ConviteMesDTO = { mes: string; nome: string; itens: ConviteDTO[] };

/** Link mensal: todas as datas daquela pessoa no mês (ou null se o link for inválido). */
export async function buscarConviteMes(mes: string, nome: string, k: string | undefined): Promise<ConviteMesDTO | null> {
  if (!MES_RE.test(mes) || !conviteMesValido(nome, k)) return null;
  const { de, ate } = limitesDoMes(mes);

  const linhas = await prisma.atribuicao.findMany({
    where: { nomeEscalado: nome, data: { gte: de, lte: ate }, ...SO_CONFIRMAVEIS },
    include: { funcao: { include: { categoria: true } } },
    orderBy: [{ data: "asc" }, { funcao: { ordem: "asc" } }],
  });

  const porData = new Map<string, typeof linhas>();
  for (const l of linhas) {
    const d = l.data.toISOString().slice(0, 10);
    porData.set(d, [...(porData.get(d) ?? []), l]);
  }
  const itens: ConviteDTO[] = [...porData.entries()].map(([data, ls]) => ({
    data,
    diaSemana: new Date(data).getUTCDay(),
    nome,
    funcoes: ls.map((l) => ({ funcaoNome: l.funcao.nome, categoriaNome: l.funcao.categoria.nome })),
    status: statusDaPessoa(ls),
    motivo: ls.find((l) => l.trocaObservacao)?.trocaObservacao ?? null,
  }));
  return { mes, nome, itens };
}

/** Resposta individual a partir do link mensal (assinatura da pessoa). */
export async function responderDataDoMes(
  data: string,
  nome: string,
  k: string,
  resposta: "POSSO" | "NAO_POSSO",
  motivo: string | null
) {
  if (!DATA_RE.test(data) || !conviteMesValido(nome, k)) throw new Error("Link inválido.");
  await aplicarResposta(data, nome, resposta, motivo);
  revalidarConfirmacoes();
}

/**
 * Confirma tudo que ainda está AGUARDANDO no mês. Nunca mexe em quem já
 * respondeu: linhas já CONFIRMADO ficam como estão e qualquer data em que a
 * pessoa marcou NÃO POSSO é pulada inteira.
 */
export async function confirmarTodasDoMes(mes: string, nome: string, k: string): Promise<number> {
  if (!MES_RE.test(mes) || !conviteMesValido(nome, k)) throw new Error("Link inválido.");
  const { de, ate } = limitesDoMes(mes);

  const naoPodem = await prisma.atribuicao.findMany({
    where: { nomeEscalado: nome, data: { gte: de, lte: ate }, status: "TROCA_SOLICITADA", ...SO_CONFIRMAVEIS },
    select: { data: true },
  });
  const resultado = await prisma.atribuicao.updateMany({
    where: {
      nomeEscalado: nome,
      data: { gte: de, lte: ate, notIn: naoPodem.map((r) => r.data) },
      status: "AGUARDANDO",
      ...SO_CONFIRMAVEIS,
    },
    data: { status: "CONFIRMADO", confirmadoEm: new Date(), trocaObservacao: null },
  });
  revalidarConfirmacoes();
  return resultado.count;
}

export type ConviteAdminDTO = ConviteDTO & { caminho: string; caminhoMes: string };

/** Painel do admin: uma linha por (pessoa, data) do mês, com o link individual já assinado. */
export async function buscarConvitesDoMes(ano: number, mes: number): Promise<ConviteAdminDTO[]> {
  await verifyAdmin();
  const primeiro = isoDate(ano, mes, 1);
  const ultimo = isoDate(ano, mes, new Date(ano, mes + 1, 0).getDate());

  const linhas = await prisma.atribuicao.findMany({
    where: { data: { gte: new Date(primeiro), lte: new Date(ultimo) }, nomeEscalado: { not: null }, ...SO_CONFIRMAVEIS },
    include: { funcao: { include: { categoria: true } } },
    orderBy: [{ data: "asc" }, { funcao: { ordem: "asc" } }],
  });

  const grupos = new Map<string, { data: string; nome: string; linhas: typeof linhas }>();
  for (const l of linhas) {
    const nome = l.nomeEscalado!;
    const dataIso = l.data.toISOString().slice(0, 10);
    const chave = `${dataIso}|${nome}`;
    if (!grupos.has(chave)) grupos.set(chave, { data: dataIso, nome, linhas: [] });
    grupos.get(chave)!.linhas.push(l);
  }

  return [...grupos.values()].map((g) => ({
    data: g.data,
    diaSemana: new Date(g.data).getUTCDay(),
    nome: g.nome,
    funcoes: g.linhas.map((l) => ({ funcaoNome: l.funcao.nome, categoriaNome: l.funcao.categoria.nome })),
    status: statusDaPessoa(g.linhas),
    motivo: g.linhas.find((l) => l.trocaObservacao)?.trocaObservacao ?? null,
    caminho: caminhoConvite(g.data, g.nome),
    caminhoMes: caminhoConviteMes(g.data.slice(0, 7), g.nome),
  }));
}
