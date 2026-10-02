"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyAdmin } from "@/lib/auth/dal";
import { CATEGORIAS_CONFIRMACAO } from "@/lib/datas";

function refreshPessoasPages() {
  revalidatePath("/admin/pessoas");
  revalidatePath("/admin/escala");
  revalidatePath("/escala");
}

export type ActionState = { error?: string } | undefined;

export async function criarCategoria(_state: ActionState, formData: FormData): Promise<ActionState> {
  await verifyAdmin();
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) return { error: "Escreva um nome para o ministério." };

  const max = await prisma.categoria.aggregate({ _max: { ordem: true } });
  await prisma.categoria.create({ data: { nome, ordem: (max._max.ordem ?? 0) + 1 } });
  refreshPessoasPages();
  return undefined;
}

export async function excluirCategoria(categoriaId: string) {
  await verifyAdmin();
  await prisma.categoria.delete({ where: { id: categoriaId } });
  refreshPessoasPages();
}

export async function criarFuncao(_state: ActionState, formData: FormData): Promise<ActionState> {
  await verifyAdmin();
  const nome = String(formData.get("nome") ?? "").trim();
  const categoriaId = String(formData.get("categoriaId") ?? "");
  if (!nome || !categoriaId) return { error: "Escreva um nome para a função." };

  const dias = formData.getAll("dias").map(Number).filter((n) => !Number.isNaN(n));
  const diasSemana = dias.length > 0 ? dias : [0, 3, 6];

  const max = await prisma.funcao.aggregate({ _max: { ordem: true }, where: { categoriaId } });
  await prisma.funcao.create({ data: { nome, categoriaId, diasSemana, ordem: (max._max.ordem ?? 0) + 1 } });
  refreshPessoasPages();
  return undefined;
}

export async function excluirFuncao(funcaoId: string) {
  await verifyAdmin();
  await prisma.funcao.delete({ where: { id: funcaoId } });
  refreshPessoasPages();
}

/** Alterna se uma função vale para um dia da semana (0=domingo, 3=quarta, 6=sábado). */
export async function alternarDiaFuncao(funcaoId: string, dia: number, ativo: boolean) {
  await verifyAdmin();
  const funcao = await prisma.funcao.findUnique({ where: { id: funcaoId } });
  if (!funcao) return;
  const atual = new Set(funcao.diasSemana);
  if (ativo) atual.add(dia);
  else atual.delete(dia);
  await prisma.funcao.update({ where: { id: funcaoId }, data: { diasSemana: Array.from(atual).sort() } });
  refreshPessoasPages();
}

export type PessoaFormState = { error?: string; success?: boolean } | undefined;

export async function salvarPessoa(_state: PessoaFormState, formData: FormData): Promise<PessoaFormState> {
  await verifyAdmin();

  const id = String(formData.get("id") ?? "") || null;
  const nome = String(formData.get("nome") ?? "").trim();
  const usernameRaw = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const ativo = formData.get("ativo") === "on";
  const verTudo = formData.get("verTudo") === "on";
  const podeGerenciarEventoExtra = formData.get("podeGerenciarEventoExtra") === "on";
  const funcaoIds = formData.getAll("funcaoIds").map(String);
  const gerenciaConfirmacao = formData.getAll("gerenciaConfirmacao").map(String).filter((a) => CATEGORIAS_CONFIRMACAO.includes(a));

  if (!nome) return { error: "Escreva o nome da pessoa." };
  if (usernameRaw && !password && !id) {
    return { error: "Defina uma senha para este usuário poder entrar." };
  }
  if (usernameRaw === "admin") {
    return { error: 'O usuário "admin" já é reservado para o administrador.' };
  }

  try {
    if (id) {
      const data: {
        nome: string;
        ativo: boolean;
        verTudo: boolean;
        podeGerenciarEventoExtra: boolean;
        gerenciaConfirmacao: string[];
        username?: string | null;
        passwordHash?: string;
        funcoes: { deleteMany: Record<string, never>; create: { funcaoId: string }[] };
      } = {
        nome,
        ativo,
        verTudo,
        podeGerenciarEventoExtra,
        gerenciaConfirmacao,
        username: usernameRaw || null,
        funcoes: { deleteMany: {}, create: funcaoIds.map((funcaoId) => ({ funcaoId })) },
      };
      if (password) data.passwordHash = await bcrypt.hash(password, 10);

      await prisma.user.update({ where: { id }, data });
    } else {
      await prisma.user.create({
        data: {
          nome,
          username: usernameRaw || null,
          passwordHash: password ? await bcrypt.hash(password, 10) : null,
          ativo,
          verTudo,
          podeGerenciarEventoExtra,
          gerenciaConfirmacao,
          role: "VOLUNTARIO",
          funcoes: { create: funcaoIds.map((funcaoId) => ({ funcaoId })) },
        },
      });
    }
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e && e.code === "P2002") {
      return { error: `O usuário "${usernameRaw}" já está em uso. Escolha outro.` };
    }
    throw e;
  }

  refreshPessoasPages();
  return { success: true };
}

export async function excluirPessoa(userId: string) {
  await verifyAdmin();
  await prisma.user.delete({ where: { id: userId } });
  refreshPessoasPages();
}
