"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth/dal";

/**
 * Admin pode escrever qualquer nome em qualquer função (texto livre, sem
 * exigir cadastro prévio). Voluntário só mexe nas funções que o admin
 * atribuiu a ele ao criar o login — mas dentro dessas, tem liberdade total:
 * escreve o nome de quem quiser (não só o próprio), troca ou apaga.
 */
export async function definirAtribuicao(data: string, funcaoId: string, nome: string | null) {
  const me = await verifySession();
  const nomeLimpo = nome?.trim() || null;

  if (me.role !== "ADMIN" && !me.funcaoIds.includes(funcaoId)) {
    throw new Error("Você não tem habilitação para esta função.");
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
