"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth/dal";

function refreshEventosExtraPages() {
  revalidatePath("/admin/escala");
  revalidatePath("/escala");
}

/** Admin sempre pode; um voluntário com podeGerenciarEventoExtra=true também, sem precisar virar admin. */
async function verifyGerenciaEventoExtra() {
  const me = await verifySession();
  if (me.role !== "ADMIN" && !me.podeGerenciarEventoExtra) {
    throw new Error("Você não tem permissão para gerenciar escalas extraordinárias.");
  }
  return me;
}

export type EventoExtraDTO = {
  id: string;
  nome: string;
  data: string; // "YYYY-MM-DD"
  horario: string;
  atribuicoes: Record<string, string | null>; // funcaoId -> nomeEscalado
};

export async function buscarEventosExtra(): Promise<EventoExtraDTO[]> {
  const eventos = await prisma.eventoExtra.findMany({
    orderBy: { data: "desc" },
    include: { atribuicoes: true },
  });
  return eventos.map((e) => ({
    id: e.id,
    nome: e.nome,
    data: e.data.toISOString().slice(0, 10),
    horario: e.horario,
    atribuicoes: Object.fromEntries(e.atribuicoes.map((a) => [a.funcaoId, a.nomeEscalado])),
  }));
}

export async function criarEventoExtra(nome: string, data: string, horario: string) {
  await verifyGerenciaEventoExtra();
  const nomeLimpo = nome.trim().toUpperCase();
  if (!nomeLimpo) throw new Error("Escreva um nome pra essa escala extraordinária.");
  if (!data) throw new Error("Escolha uma data.");
  if (!horario) throw new Error("Escolha um horário.");

  const evento = await prisma.eventoExtra.create({
    data: { nome: nomeLimpo, data: new Date(data), horario },
  });
  refreshEventosExtraPages();
  return evento.id;
}

export async function excluirEventoExtra(id: string) {
  await verifyGerenciaEventoExtra();
  await prisma.eventoExtra.delete({ where: { id } });
  refreshEventosExtraPages();
}

/** Mesma liberdade de definirAtribuicao: admin edita qualquer função; voluntário só as que o login dele habilita. */
export async function definirAtribuicaoExtra(eventoId: string, funcaoId: string, nome: string | null) {
  const me = await verifySession();
  if (me.role !== "ADMIN" && !me.funcaoIds.includes(funcaoId)) {
    throw new Error("Você não tem habilitação para esta função.");
  }

  const nomeLimpo = nome?.trim().toUpperCase() || null;
  if (!nomeLimpo) {
    await prisma.eventoExtraAtribuicao.deleteMany({ where: { eventoId, funcaoId } });
  } else {
    await prisma.eventoExtraAtribuicao.upsert({
      where: { eventoId_funcaoId: { eventoId, funcaoId } },
      update: { nomeEscalado: nomeLimpo },
      create: { eventoId, funcaoId, nomeEscalado: nomeLimpo },
    });
  }
  refreshEventosExtraPages();
}
