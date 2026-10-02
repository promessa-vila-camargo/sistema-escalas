"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyAdmin } from "@/lib/auth/dal";
import { caminhoConvite, conviteValido } from "@/lib/convite";
import { isoDate } from "@/lib/datas";

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

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
    where: { data: new Date(data), nomeEscalado: nome },
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

  const where = { data: new Date(data), nomeEscalado: nome };
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

  revalidatePath("/admin");
  revalidatePath("/admin/confirmacoes");
  revalidatePath("/minhas-escalas");
}

export type ConviteAdminDTO = ConviteDTO & { caminho: string };

/** Painel do admin: uma linha por (pessoa, data) do mês, com o link individual já assinado. */
export async function buscarConvitesDoMes(ano: number, mes: number): Promise<ConviteAdminDTO[]> {
  await verifyAdmin();
  const primeiro = isoDate(ano, mes, 1);
  const ultimo = isoDate(ano, mes, new Date(ano, mes + 1, 0).getDate());

  const linhas = await prisma.atribuicao.findMany({
    where: { data: { gte: new Date(primeiro), lte: new Date(ultimo) }, nomeEscalado: { not: null } },
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
  }));
}
