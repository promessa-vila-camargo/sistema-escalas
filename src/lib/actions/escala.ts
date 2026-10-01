"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth/dal";
import { chaveNoite, FUNCOES_SEM_REPETICAO_DOMINGO } from "@/lib/datas";

export type Turno = "DIA" | "NOITE";

/**
 * Admin pode escrever qualquer nome em qualquer função (texto livre, sem
 * exigir cadastro prévio). Voluntário só mexe nas funções que o admin
 * atribuiu a ele ao criar o login — mas dentro dessas, tem liberdade total:
 * escreve o nome de quem quiser (não só o próprio), troca ou apaga.
 *
 * `turno` distingue o culto normal ("DIA") de um evento extra à noite no
 * mesmo dia ("NOITE") — ver definirEventoNoite. O espelho automático de
 * sábado pra domingo só vale pro turno DIA, e não vale pras funções em
 * FUNCOES_SEM_REPETICAO_DOMINGO (diretor, palavra pastoral, pregador —
 * pessoas diferentes em cada dia).
 */
export async function definirAtribuicao(data: string, funcaoId: string, nome: string | null, turno: Turno = "DIA") {
  const me = await verifySession();
  const nomeLimpo = nome?.trim().toUpperCase() || null;

  if (me.role !== "ADMIN" && !me.funcaoIds.includes(funcaoId)) {
    throw new Error("Você não tem habilitação para esta função.");
  }

  const dataObj = new Date(data);
  await gravar(dataObj, funcaoId, nomeLimpo, turno);

  // Domingo repete automaticamente o que foi escalado no sábado daquele
  // mesmo fim de semana, pra função continuar valendo nos dois dias sem
  // digitar duas vezes — só quando a edição parte do sábado, e só no turno
  // normal (o evento da noite não se propaga).
  if (turno === "DIA" && dataObj.getUTCDay() === 6) {
    const funcao = await prisma.funcao.findUnique({ where: { id: funcaoId } });
    if (funcao?.diasSemana.includes(0) && !FUNCOES_SEM_REPETICAO_DOMINGO.includes(funcao.nome)) {
      const domingo = new Date(dataObj);
      domingo.setUTCDate(domingo.getUTCDate() + 1);
      await gravar(domingo, funcaoId, nomeLimpo, turno);
    }
  }

  revalidatePath("/admin/escala");
  revalidatePath("/escala");
}

async function gravar(data: Date, funcaoId: string, nomeLimpo: string | null, turno: Turno) {
  if (!nomeLimpo) {
    await prisma.atribuicao.deleteMany({ where: { data, funcaoId, turno } });
  } else {
    await prisma.atribuicao.upsert({
      where: { data_funcaoId_turno: { data, funcaoId, turno } },
      update: { nomeEscalado: nomeLimpo, userId: null },
      create: { data, funcaoId, nomeEscalado: nomeLimpo, turno },
    });
  }
}

export type AtribuicaoMap = Record<string, Record<string, string | null>>; // chave -> funcaoId -> nomeEscalado

export async function buscarAtribuicoes(dataInicio: string, dataFim: string): Promise<AtribuicaoMap> {
  const rows = await prisma.atribuicao.findMany({
    where: { data: { gte: new Date(dataInicio), lte: new Date(dataFim) } },
  });
  const out: AtribuicaoMap = {};
  for (const row of rows) {
    const dataStr = row.data.toISOString().slice(0, 10);
    const key = row.turno === "NOITE" ? chaveNoite(dataStr) : dataStr;
    if (!out[key]) out[key] = {};
    out[key][row.funcaoId] = row.nomeEscalado;
  }
  return out;
}

/**
 * Observação livre por culto (ex.: "Sábado manhã" ou "também teremos culto
 * à noite") — só o admin escreve; quem só vê a escala lê em modo leitura.
 */
export async function definirObservacao(data: string, texto: string | null) {
  const me = await verifySession();
  if (me.role !== "ADMIN") {
    throw new Error("Só o administrador pode escrever observações.");
  }

  const dataObj = new Date(data);
  const textoLimpo = texto?.trim() || null;
  const existente = await prisma.cultoNota.findUnique({ where: { data: dataObj } });

  if (!textoLimpo && !existente?.temEventoNoite && !existente?.ministerioResponsavel) {
    await prisma.cultoNota.deleteMany({ where: { data: dataObj } });
  } else {
    await prisma.cultoNota.upsert({
      where: { data: dataObj },
      update: { texto: textoLimpo },
      create: { data: dataObj, texto: textoLimpo, temEventoNoite: false },
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

/**
 * Liga/desliga o evento da noite pra um culto. Ao ligar pela primeira vez
 * (turno NOITE ainda vazio pra essa data), copia os nomes já preenchidos no
 * turno DIA como ponto de partida — dali em diante os dois turnos são
 * editados de forma independente.
 */
export async function definirEventoNoite(data: string, ativo: boolean) {
  const me = await verifySession();
  if (me.role !== "ADMIN") {
    throw new Error("Só o administrador pode ativar o evento da noite.");
  }

  const dataObj = new Date(data);

  if (ativo) {
    const jaTemNoite = await prisma.atribuicao.findFirst({ where: { data: dataObj, turno: "NOITE" } });
    if (!jaTemNoite) {
      const diaRows = await prisma.atribuicao.findMany({ where: { data: dataObj, turno: "DIA" } });
      const comNome = diaRows.filter((r) => r.nomeEscalado);
      if (comNome.length > 0) {
        await prisma.atribuicao.createMany({
          data: comNome.map((r) => ({ data: dataObj, funcaoId: r.funcaoId, nomeEscalado: r.nomeEscalado, turno: "NOITE" as const })),
          skipDuplicates: true,
        });
      }
    }
  }

  await prisma.cultoNota.upsert({
    where: { data: dataObj },
    update: { temEventoNoite: ativo },
    create: { data: dataObj, temEventoNoite: ativo },
  });

  revalidatePath("/admin/escala");
  revalidatePath("/escala");
}

export type EventoNoiteMap = Record<string, boolean>; // data -> ativo

export async function buscarEventosNoite(dataInicio: string, dataFim: string): Promise<EventoNoiteMap> {
  const rows = await prisma.cultoNota.findMany({
    where: { data: { gte: new Date(dataInicio), lte: new Date(dataFim) }, temEventoNoite: true },
  });
  const out: EventoNoiteMap = {};
  for (const row of rows) out[row.data.toISOString().slice(0, 10)] = true;
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

  if (!ministerio && !existente?.temEventoNoite && !existente?.texto) {
    await prisma.cultoNota.deleteMany({ where: { data: dataObj } });
  } else {
    await prisma.cultoNota.upsert({
      where: { data: dataObj },
      update: { ministerioResponsavel: ministerio },
      create: { data: dataObj, ministerioResponsavel: ministerio, temEventoNoite: false },
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
