import { buscarConvite } from "@/lib/actions/convite";
import ConfirmarEscala from "@/components/ConfirmarEscala";

export const metadata = { title: "Confirmação de escala" };

function decodificar(valor: string) {
  try {
    return decodeURIComponent(valor);
  } catch {
    return valor;
  }
}

export default async function ConfirmarPage({
  params,
  searchParams,
}: {
  params: Promise<{ data: string; nome: string }>;
  searchParams: Promise<{ k?: string }>;
}) {
  const { data, nome } = await params;
  const { k } = await searchParams;
  const convite = await buscarConvite(decodificar(data), decodificar(nome), k);

  return (
    <div className="min-h-screen bg-[#f6f6f7]">
      {convite && k ? (
        <ConfirmarEscala convite={convite} k={k} />
      ) : (
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <div className="font-heading text-[13px] font-extrabold tracking-[0.25em] text-ink-900">ESCALA VC</div>
          <h1 className="mt-6 font-heading text-xl font-extrabold text-ink-900">Link não encontrado</h1>
          <p className="mt-2 text-[14px] text-ink-600">
            Este link não é válido ou a escala foi alterada. Peça um novo link ao responsável pela escala.
          </p>
        </div>
      )}
    </div>
  );
}
