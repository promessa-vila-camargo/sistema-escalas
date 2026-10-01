"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyAdmin } from "@/lib/auth/dal";

function refreshAtividadesPages() {
  revalidatePath("/admin/escala");
  revalidatePath("/escala");
}

export type AtividadeDTO = {
  id: string;
  data: string; // "YYYY-MM-DD"
  titulo: string;
  horario: string | null;
  ministerio: string | null;
  descricao: string | null;
};

/** Agrupa por data e ordena por horário — sem horário vai pro fim, como pedido. */
export async function buscarAtividades(dataInicio: string, dataFim: string): Promise<Record<string, AtividadeDTO[]>> {
  const rows = await prisma.atividadeDia.findMany({
    where: { data: { gte: new Date(dataInicio), lte: new Date(dataFim) } },
  });
  const out: Record<string, AtividadeDTO[]> = {};
  for (const row of rows) {
    const key = row.data.toISOString().slice(0, 10);
    if (!out[key]) out[key] = [];
    out[key].push({
      id: row.id,
      data: key,
      titulo: row.titulo,
      horario: row.horario,
      ministerio: row.ministerio,
      descricao: row.descricao,
    });
  }
  for (const key of Object.keys(out)) {
    out[key].sort((a, b) => {
      if (!a.horario && !b.horario) return 0;
      if (!a.horario) return 1;
      if (!b.horario) return -1;
      return a.horario < b.horario ? -1 : a.horario > b.horario ? 1 : 0;
    });
  }
  return out;
}

export async function criarAtividade(
  data: string,
  titulo: string,
  horario: string | null,
  ministerio: string | null,
  descricao: string | null
) {
  await verifyAdmin();
  const tituloLimpo = titulo.trim();
  if (!tituloLimpo) throw new Error("Escreva um nome para a atividade.");

  const atividade = await prisma.atividadeDia.create({
    data: {
      data: new Date(data),
      titulo: tituloLimpo,
      horario: horario?.trim() || null,
      ministerio: ministerio?.trim() || null,
      descricao: descricao?.trim() || null,
    },
  });
  refreshAtividadesPages();
  return atividade.id;
}

export async function atualizarAtividade(
  id: string,
  titulo: string,
  horario: string | null,
  ministerio: string | null,
  descricao: string | null
) {
  await verifyAdmin();
  const tituloLimpo = titulo.trim();
  if (!tituloLimpo) throw new Error("Escreva um nome para a atividade.");

  await prisma.atividadeDia.update({
    where: { id },
    data: {
      titulo: tituloLimpo,
      horario: horario?.trim() || null,
      ministerio: ministerio?.trim() || null,
      descricao: descricao?.trim() || null,
    },
  });
  refreshAtividadesPages();
}

export async function excluirAtividade(id: string) {
  await verifyAdmin();
  await prisma.atividadeDia.delete({ where: { id } });
  refreshAtividadesPages();
}
