import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CATEGORIAS_CONFIRMACAO } from "@/lib/datas";
import { getSessionPayload } from "./session";

export type CurrentUser = {
  id: string;
  username: string | null;
  nome: string;
  role: "ADMIN" | "VOLUNTARIO";
  funcaoIds: string[];
  verTudo: boolean;
  podeGerenciarEventoExtra: boolean;
  /**
   * Áreas (Som, Datashow, Mídia, Transmissão) cujas confirmações essa pessoa
   * pode acompanhar/enviar. ADMIN = todas; os demais = só as que o admin
   * liberou em Pessoas. Vazio = sem acesso ao painel de confirmações.
   */
  areasConfirmacao: string[];
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
    areasConfirmacao:
      user.role === "ADMIN"
        ? [...CATEGORIAS_CONFIRMACAO]
        : CATEGORIAS_CONFIRMACAO.filter((a) => user.gerenciaConfirmacao.includes(a)),
  };
});

export const verifyAdmin = cache(async (): Promise<CurrentUser> => {
  const user = await verifySession();
  if (user.role !== "ADMIN") {
    redirect("/inicio");
  }
  return user;
});

/** Painel de confirmações: ADMIN ou qualquer login com pelo menos uma área liberada (não exige ser admin). */
export const verifyConfirmacoes = cache(async (): Promise<CurrentUser> => {
  const user = await verifySession();
  if (user.areasConfirmacao.length === 0) {
    redirect("/inicio");
  }
  return user;
});
