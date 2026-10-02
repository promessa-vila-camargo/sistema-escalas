"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth/dal";
import { FUNCOES_SEM_REPETICAO_DOMINGO } from "@/lib/datas";

/**
 * Admin pode escrever qualquer nome em qualquer função (texto livre, sem
 * exigir cadastro prévio). Voluntário só mexe nas funções que o admin
 * atribuiu a ele ao criar o login — mas dentro dessas, tem liberdade total:
 * escreve o nome de quem quiser (não só o próprio), troca ou apaga.
 */
export async function definirAtribuicao(data: string, funcaoId: string, nome: string | null) {
  const me = await verifySession();
  const nomeLimpo = nome?.trim().toUpperCase() || null;

  if (me.role !== "ADMIN" && !me.funcaoIds.includes(funcaoId)) {
    throw new Error("Você não tem habilitação para esta função.");
  }

  const dataObj = new Date(data);
  await gravar(dataObj, funcaoId, nomeLimpo);

  // Domingo repete automaticamente o que foi escalado no sábado daquele
  // mesmo fim de semana, pra função continuar valendo nos dois dias sem
  // digitar duas vezes — só quando a edição parte do sábado, e não vale
  // pras funções em FUNCOES_SEM_REPETICAO_DOMINGO (diretor, palavra
  // pastoral, pregador — pessoas diferentes em cada dia).
  if (dataObj.getUTCDay() === 6) {
    const funcao = await prisma.funcao.findUnique({ where: { id: funcaoId } });
    if (funcao?.diasSemana.includes(0) && !FUNCOES_SEM_REPETICAO_DOMINGO.includes(funcao.nome)) {
      const domingo = new Date(dataObj);
      domingo.setUTCDate(domingo.getUTCDate() + 1);
      await gravar(domingo, funcaoId, nomeLimpo);
    }
  }

  revalidatePath("/admin/escala");
  revalidatePath("/escala");
  revalidatePath("/minhas-escalas");
  revalidatePath("/admin");
}

/**
 * Se o texto digitado bater (sem diferenciar maiúsculas/minúsculas) com o
 * nome de um login ativo, vincula essa atribuição a ele — é esse vínculo que
 * liga a linha à tela "minhas escalas" daquela pessoa. Sem correspondência,
 * fica sem dono (como sempre foi) e continua funcionando normalmente.
 */
async function resolverUserId(nomeLimpo: string): Promise<string | null> {
  const user = await prisma.user.findFirst({
    where: { nome: { equals: nomeLimpo, mode: "insensitive" }, ativo: true },
  });
  return user?.id ?? null;
}

async function gravar(data: Date, funcaoId: string, nomeLimpo: string | null) {
  if (!nomeLimpo) {
    await prisma.atribuicao.deleteMany({ where: { data, funcaoId } });
    return;
  }

  const userId = await resolverUserId(nomeLimpo);
  const existente = await prisma.atribuicao.findUnique({ where: { data_funcaoId: { data, funcaoId } } });

  // Nome realmente mudou (não é o autosave regravando o mesmo valor) e já
  // tinha sido confirmada/pedida troca — volta pra "aguardando": uma
  // confirmação antiga nunca vale pra uma escala que o admin alterou depois.
  // Os timestamps antigos (confirmadoEm/trocaSolicitadaEm) ficam registrados
  // de propósito — é como a tela sabe mostrar "atualizada, confirme de novo"
  // em vez de tratar como se fosse a primeira vez.
  const precisaResetarStatus =
    existente && existente.nomeEscalado !== nomeLimpo && existente.status !== "AGUARDANDO";

  await prisma.atribuicao.upsert({
    where: { data_funcaoId: { data, funcaoId } },
    update: {
      nomeEscalado: nomeLimpo,
      userId,
      ...(precisaResetarStatus ? { status: "AGUARDANDO" as const } : {}),
    },
    create: { data, funcaoId, nomeEscalado: nomeLimpo, userId },
  });
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

/**
 * Observação livre por culto (ex.: "Sábado manhã") — só o admin escreve;
 * quem só vê a escala lê em modo leitura.
 */
export async function definirObservacao(data: string, texto: string | null) {
  const me = await verifySession();
  if (me.role !== "ADMIN") {
    throw new Error("Só o administrador pode escrever observações.");
  }

  const dataObj = new Date(data);
  const textoLimpo = texto?.trim() || null;
  const existente = await prisma.cultoNota.findUnique({ where: { data: dataObj } });

  if (!textoLimpo && !existente?.ministerioResponsavel) {
    await prisma.cultoNota.deleteMany({ where: { data: dataObj } });
  } else {
    await prisma.cultoNota.upsert({
      where: { data: dataObj },
      update: { texto: textoLimpo },
      create: { data: dataObj, texto: textoLimpo },
    });
  }

  revalidatePath("/admin/escala");
  revalidatePath("/escala");
}

export type ObservacaoMap = Record<string, string>; // data -> texto

export async function buscarObservacoes(dataInicio: string, dataFim: string): Promise<ObservacaoMap> {
  const rows = await prisma.cultoNota.findMany({
    where: { data: { gte: new Date(dataInicio), lte: new Date(dataFim) }, texto: { not: null } },
  });
  const out: ObservacaoMap = {};
  for (const row of rows) {
    if (row.texto) out[row.data.toISOString().slice(0, 10)] = row.texto;
  }
  return out;
}

/** Ministério/departamento responsável por organizar o culto (só sábado/domingo) — só o admin escolhe. */
export async function definirMinisterioResponsavel(data: string, ministerio: string | null) {
  const me = await verifySession();
  if (me.role !== "ADMIN") {
    throw new Error("Só o administrador pode definir o ministério responsável.");
  }

  const dataObj = new Date(data);
  const existente = await prisma.cultoNota.findUnique({ where: { data: dataObj } });

  if (!ministerio && !existente?.texto) {
    await prisma.cultoNota.deleteMany({ where: { data: dataObj } });
  } else {
    await prisma.cultoNota.upsert({
      where: { data: dataObj },
      update: { ministerioResponsavel: ministerio },
      create: { data: dataObj, ministerioResponsavel: ministerio },
    });
  }

  revalidatePath("/admin/escala");
  revalidatePath("/escala");
}

export type MinisterioResponsavelMap = Record<string, string>; // data -> ministério

export async function buscarMinisteriosResponsaveis(dataInicio: string, dataFim: string): Promise<MinisterioResponsavelMap> {
  const rows = await prisma.cultoNota.findMany({
    where: { data: { gte: new Date(dataInicio), lte: new Date(dataFim) }, ministerioResponsavel: { not: null } },
  });
  const out: MinisterioResponsavelMap = {};
  for (const row of rows) {
    if (row.ministerioResponsavel) out[row.data.toISOString().slice(0, 10)] = row.ministerioResponsavel;
  }
  return out;
}
