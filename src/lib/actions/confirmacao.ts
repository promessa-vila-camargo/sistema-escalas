"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth/dal";

function refreshConfirmacaoPages() {
  revalidatePath("/minhas-escalas");
  revalidatePath("/admin");
  revalidatePath("/admin/escala");
  revalidatePath("/escala");
}

/** Confere que a atribuição existe e pertence mesmo a quem está chamando — nunca confia só no id vindo do cliente. */
async function atribuicaoDoUsuario(atribuicaoId: string, userId: string) {
  const atribuicao = await prisma.atribuicao.findUnique({ where: { id: atribuicaoId } });
  if (!atribuicao || atribuicao.userId !== userId) {
    throw new Error("Essa escala não foi encontrada ou não pertence a você.");
  }
  return atribuicao;
}

export async function confirmarEscala(atribuicaoId: string) {
  const me = await verifySession();
  await atribuicaoDoUsuario(atribuicaoId, me.id);

  await prisma.atribuicao.update({
    where: { id: atribuicaoId },
    data: { status: "CONFIRMADO", confirmadoEm: new Date() },
  });
  refreshConfirmacaoPages();
}

export async function solicitarTroca(atribuicaoId: string, observacao: string | null) {
  const me = await verifySession();
  await atribuicaoDoUsuario(atribuicaoId, me.id);

  await prisma.atribuicao.update({
    where: { id: atribuicaoId },
    data: {
      status: "TROCA_SOLICITADA",
      trocaObservacao: observacao?.trim() || null,
      trocaSolicitadaEm: new Date(),
    },
  });
  refreshConfirmacaoPages();
}

export type MinhaEscalaDTO = {
  id: string;
  data: string; // "YYYY-MM-DD"
  diaSemana: number;
  funcaoNome: string;
  categoriaNome: string;
  status: "AGUARDANDO" | "CONFIRMADO" | "TROCA_SOLICITADA";
  /** true quando já tinha sido confirmada/com troca pedida antes, mas o admin alterou algo e voltou pra aguardando. */
  foiAlteradaAposConfirmacao: boolean;
  confirmadoEm: string | null;
  trocaObservacao: string | null;
  trocaSolicitadaEm: string | null;
};

/** Todas as escalas (hoje em diante) vinculadas ao login de quem está pedindo — base da tela "minhas escalas". */
export async function buscarMinhasEscalas(): Promise<MinhaEscalaDTO[]> {
  const me = await verifySession();
  const hoje = new Date();
  hoje.setUTCHours(0, 0, 0, 0);

  const rows = await prisma.atribuicao.findMany({
    where: { userId: me.id, data: { gte: hoje } },
    include: { funcao: { include: { categoria: true } } },
    orderBy: { data: "asc" },
  });

  return rows.map((r) => ({
    id: r.id,
    data: r.data.toISOString().slice(0, 10),
    diaSemana: r.data.getUTCDay(),
    funcaoNome: r.funcao.nome,
    categoriaNome: r.funcao.categoria.nome,
    status: r.status,
    foiAlteradaAposConfirmacao: r.status === "AGUARDANDO" && (r.confirmadoEm !== null || r.trocaSolicitadaEm !== null),
    confirmadoEm: r.confirmadoEm ? r.confirmadoEm.toISOString() : null,
    trocaObservacao: r.trocaObservacao,
    trocaSolicitadaEm: r.trocaSolicitadaEm ? r.trocaSolicitadaEm.toISOString() : null,
  }));
}

export type TrocaPendenteDTO = {
  id: string;
  data: string;
  diaSemana: number;
  funcaoNome: string;
  categoriaNome: string;
  nomeEscalado: string | null;
  observacao: string | null;
  solicitadaEm: string | null;
};

/** Pedidos de troca em aberto (hoje em diante) — pro painel do admin acompanhar. */
export async function buscarTrocasPendentes(): Promise<TrocaPendenteDTO[]> {
  const hoje = new Date();
  hoje.setUTCHours(0, 0, 0, 0);

  const rows = await prisma.atribuicao.findMany({
    where: { status: "TROCA_SOLICITADA", data: { gte: hoje } },
    include: { funcao: { include: { categoria: true } } },
    orderBy: { data: "asc" },
  });

  return rows.map((r) => ({
    id: r.id,
    data: r.data.toISOString().slice(0, 10),
    diaSemana: r.data.getUTCDay(),
    funcaoNome: r.funcao.nome,
    categoriaNome: r.funcao.categoria.nome,
    nomeEscalado: r.nomeEscalado,
    observacao: r.trocaObservacao,
    solicitadaEm: r.trocaSolicitadaEm ? r.trocaSolicitadaEm.toISOString() : null,
  }));
}
