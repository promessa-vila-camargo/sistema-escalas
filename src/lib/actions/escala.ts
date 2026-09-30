"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth/dal";

/**
 * Admin pode escrever qualquer nome em qualquer função (texto livre, sem
 * exigir cadastro prévio). Voluntário só pode preencher/limpar em função
 * que ele tem habilitação, e só se a vaga estiver vazia ou já tiver o
 * próprio nome dele (não pode apagar o nome de outra pessoa digitado ali).
 */
export async function definirAtribuicao(data: string, funcaoId: string, nome: string | null) {
  const me = await verifySession();
  const nomeLimpo = nome?.trim() || null;

  if (me.role !== "ADMIN") {
    if (!me.funcaoIds.includes(funcaoId)) {
      throw new Error("Você não tem habilitação para esta função.");
    }
    const atual = await prisma.atribuicao.findUnique({ where: { data_funcaoId: { data: new Date(data), funcaoId } } });
    const nomeAtual = atual?.nomeEscalado?.trim().toLowerCase() || null;
    const souEu = nomeAtual === me.nome.trim().toLowerCase();
    if (nomeAtual && !souEu) {
      throw new Error("Essa função já está preenchida por outra pessoa.");
    }
    if (nomeLimpo && nomeLimpo.toLowerCase() !== me.nome.trim().toLowerCase()) {
      throw new Error("Você só pode escrever o próprio nome aqui.");
    }
  }

  if (!nomeLimpo) {
    await prisma.atribuicao.deleteMany({ where: { data: new Date(data), funcaoId } });
  } else {
    await prisma.atribuicao.upsert({
      where: { data_funcaoId: { data: new Date(data), funcaoId } },
      update: { nomeEscalado: nomeLimpo, userId: null },
      create: { data: new Date(data), funcaoId, nomeEscalado: nomeLimpo },
    });
  }

  revalidatePath("/admin/escala");
  revalidatePath("/escala");
}

export type AtribuicaoMap = Record<string, Record<string, string | null>>; // data -> funcaoId -> nomeEscalado

export async function buscarAtribuicoes(dataInicio: string, dataFim: string): Promise<AtribuicaoMap> {
  const rows = await prisma.atribuicao.findMany({
    where: { data: { gte: new Date(dataInicio), lte: new Date(dataFim) } },
  });
  const out: AtribuicaoMap = {};
  for (const row of rows) {
    const key = row.data.toISOString().slice(0, 10);
    if (!out[key]) out[key] = {};
    out[key][row.funcaoId] = row.nomeEscalado;
  }
  return out;
}
