import { redirect } from "next/navigation";

/** A tela de confirmações saiu de /admin (que é só pra admin) pra /confirmacoes, aberta a quem tem uma área liberada. */
export default async function AdminConfirmacoesRedirect({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string; mes?: string }>;
}) {
  const { ano, mes } = await searchParams;
  const qs = ano && mes ? `?ano=${ano}&mes=${mes}` : "";
  redirect(`/confirmacoes${qs}`);
}
