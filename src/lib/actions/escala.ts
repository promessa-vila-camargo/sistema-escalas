"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth/dal";

/**
 * Admin pode escalar qualquer pessoa em qualquer função. Voluntário só pode
 * se marcar/desmarcar a si mesmo, e só em função que ele tem habilitação —
 * e só se a vaga estiver livre ou já ser dele (não pode tirar outra pessoa).
 */
export async function definirAtribuicao(data: string, funcaoId: string, userId: string | null) {
  const me = await verifySession();

  if (me.role !== "ADMIN") {
    if (!me.funcaoIds.includes(funcaoId)) {
      throw new Error("Você não tem habilitação para esta função.");
    }
    if (userId !== null && userId !== me.id) {
      throw new Error("Você só pode se escalar, não escalar outra pessoa.");
    }
    const atual = await prisma.atribuicao.findUnique({ where: { data_funcaoId: { data: new Date(data), funcaoId } } });
    if (atual?.userId && atual.userId !== me.id) {
      throw new Error("Essa função já está preenchida por outra pessoa.");
    }
  }

  if (userId === null) {
    await prisma.atribuicao.deleteMany({ where: { data: new Date(data), funcaoId } });
  } else {
    await prisma.atribuicao.upsert({
      where: { data_funcaoId: { data: new Date(data), funcaoId } },
      update: { userId },
      create: { data: new Date(data), funcaoId, userId },
    });
  }

  revalidatePath("/admin/escala");
  revalidatePath("/escala");
}

export type AtribuicaoMap = Record<string, Record<string, string | null>>; // data -> funcaoId -> userId

export async function buscarAtribuicoes(dataInicio: string, dataFim: string): Promise<AtribuicaoMap> {
  const rows = await prisma.atribuicao.findMany({
    where: { data: { gte: new Date(dataInicio), lte: new Date(dataFim) } },
  });
  const out: AtribuicaoMap = {};
  for (const row of rows) {
    const key = row.data.toISOString().slice(0, 10);
    if (!out[key]) out[key] = {};
    out[key][row.funcaoId] = row.userId;
  }
  return out;
}
