"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyAdmin } from "@/lib/auth/dal";

function refreshPessoasPages() {
  revalidatePath("/admin/pessoas");
  revalidatePath("/admin/escala");
  revalidatePath("/escala");
}

export type ActionState = { error?: string } | undefined;

export async function criarCategoria(_state: ActionState, formData: FormData): Promise<ActionState> {
  await verifyAdmin();
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) return { error: "Escreva um nome para a categoria." };

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

  const max = await prisma.funcao.aggregate({ _max: { ordem: true }, where: { categoriaId } });
  await prisma.funcao.create({ data: { nome, categoriaId, ordem: (max._max.ordem ?? 0) + 1 } });
  refreshPessoasPages();
  return undefined;
}

export async function excluirFuncao(funcaoId: string) {
  await verifyAdmin();
  await prisma.funcao.delete({ where: { id: funcaoId } });
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
  const funcaoIds = formData.getAll("funcaoIds").map(String);

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
        username?: string | null;
        passwordHash?: string;
        funcoes: { deleteMany: Record<string, never>; create: { funcaoId: string }[] };
      } = {
        nome,
        ativo,
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
