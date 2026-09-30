"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, deleteSession } from "@/lib/auth/session";
import { verifySession } from "@/lib/auth/dal";

export type LoginFormState = { error?: string } | undefined;

export async function login(
  _state: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "Preencha usuário e senha." };
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.ativo || !user.passwordHash) {
    return { error: "Usuário ou senha inválidos." };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return { error: "Usuário ou senha inválidos." };
  }

  await createSession(user.id);
  redirect(user.role === "ADMIN" ? "/admin" : "/inicio");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}

/** Só apaga o cookie — usado pela página de sessão encerrada, que não pode mexer em cookie durante a renderização. */
export async function encerrarSessaoExpirada() {
  await deleteSession();
}

export type ChangePasswordState = { error?: string; success?: boolean } | undefined;

export async function changePassword(
  _state: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const session = await verifySession();

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "Preencha todos os campos." };
  }
  if (newPassword.length < 4) {
    return { error: "A nova senha precisa ter pelo menos 4 caracteres." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "A confirmação não bate com a nova senha." };
  }

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user || !user.passwordHash) {
    return { error: "Usuário não encontrado." };
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return { error: "Senha atual incorreta." };
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  return { success: true };
}
