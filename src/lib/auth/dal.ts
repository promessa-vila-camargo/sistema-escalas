import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionPayload } from "./session";

export type CurrentUser = {
  id: string;
  username: string | null;
  nome: string;
  role: "ADMIN" | "VOLUNTARIO";
  funcaoIds: string[];
  verTudo: boolean;
  podeGerenciarEventoExtra: boolean;
};

/**
 * Confirma a sessão E busca o usuário de novo no banco (papel, se ainda está
 * ativo, quais funções tem liberadas) — nunca confia só no que tem no
 * cookie. Se a conta foi desativada ou apagada desde o login, derruba a
 * sessão aqui.
 */
export const verifySession = cache(async (): Promise<CurrentUser> => {
  const session = await getSessionPayload();
  if (!session?.userId) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { funcoes: true },
  });

  if (!user || !user.ativo) {
    redirect("/logout-expired");
  }

  return {
    id: user.id,
    username: user.username,
    nome: user.nome,
    role: user.role,
    funcaoIds: user.funcoes.map((f) => f.funcaoId),
    verTudo: user.verTudo,
    podeGerenciarEventoExtra: user.podeGerenciarEventoExtra,
  };
});

export const verifyAdmin = cache(async (): Promise<CurrentUser> => {
  const user = await verifySession();
  if (user.role !== "ADMIN") {
    redirect("/inicio");
  }
  return user;
});
