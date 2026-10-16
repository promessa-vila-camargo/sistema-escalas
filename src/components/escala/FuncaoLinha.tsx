"use client";

import Icon from "@/components/ui/Icon";

export type StatusConfirmacao = "AGUARDANDO" | "CONFIRMADO" | "TROCA_SOLICITADA";

const STATUS: Record<StatusConfirmacao, { icone: "checkCircle" | "clock" | "swap"; cor: string; texto: string }> = {
  CONFIRMADO: { icone: "checkCircle", cor: "text-green-600", texto: "Confirmado" },
  AGUARDANDO: { icone: "clock", cor: "text-ink-400", texto: "Aguardando confirmação" },
  TROCA_SOLICITADA: { icone: "swap", cor: "text-red-500", texto: "Pediu troca" },
};

/**
 * Uma função dentro do card de culto: rótulo à esquerda, escalado à direita
 * (o nome é o protagonista da linha). O ponto antes do rótulo mostra se está
 * preenchida; o ícone depois do nome, se a pessoa já confirmou.
 */
export default function FuncaoLinha({
  label,
  valor,
  editavel,
  onChange,
  onBlur,
  listaSugestoes,
  status,
}: {
  label: string;
  valor: string;
  editavel: boolean;
  onChange?: (valor: string) => void;
  onBlur?: (valor: string) => void;
  listaSugestoes?: string;
  status?: StatusConfirmacao | null;
}) {
  const preenchido = valor.trim().length > 0;
  const st = status && preenchido ? STATUS[status] : null;

  return (
    // Celular: rótulo em cima, nome embaixo ocupando a largura toda (o nome é o que importa ler/tocar).
    // A partir de sm: rótulo e nome lado a lado.
    <div className="-mx-2 grid grid-cols-1 items-center gap-x-2 gap-y-0.5 rounded-[9px] px-2 py-1.5 transition-colors focus-within:bg-brand-50/70 sm:grid-cols-[minmax(0,40%)_minmax(0,1fr)] sm:py-[3px]">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={
            "h-[7px] w-[7px] flex-none rounded-full " +
            (preenchido ? "bg-green-500" : "border-[1.5px] border-orange-500 bg-transparent")
          }
          title={preenchido ? "Preenchida" : "Sem responsável"}
        />
        <span className="text-[12.5px] leading-snug text-ink-600 sm:text-[13px]">{label}</span>
      </div>
      <div className="flex min-w-0 items-center gap-1 pl-[15px] sm:pl-0">
        {editavel ? (
          <input
            type="text"
            value={valor}
            placeholder="Adicionar nome"
            aria-label={label}
            onChange={(e) => onChange?.(e.target.value)}
            onBlur={(e) => onBlur?.(e.target.value)}
            list={listaSugestoes}
            autoComplete="off"
            spellCheck={false}
            className="h-9 min-w-0 flex-1 rounded-[8px] border border-transparent bg-transparent px-2 text-[16px] font-semibold tracking-[0.01em] text-ink-900 uppercase outline-none transition-[background-color,border-color,box-shadow] duration-150 placeholder:font-normal placeholder:tracking-normal placeholder:text-ink-400 placeholder:normal-case max-sm:bg-ink-100/60 hover:bg-ink-100/70 focus:border-brand-600 focus:bg-white focus:ring-3 focus:ring-brand-100 sm:h-8 sm:text-[13.5px]"
          />
        ) : (
          <span
            className={
              "min-w-0 flex-1 truncate px-2 text-[13.5px] font-semibold tracking-[0.01em] uppercase " +
              (preenchido ? "text-ink-700" : "font-normal text-ink-300")
            }
            title={valor}
          >
            {valor.trim() || "—"}
          </span>
        )}
        {st && (
          <span className={"flex-none " + st.cor} title={st.texto}>
            <Icon name={st.icone} size={16} title={st.texto} />
          </span>
        )}
      </div>
    </div>
  );
}

/** Divisor discreto de ministério dentro do card. */
export function DivisorMinisterio({ nome }: { nome: string }) {
  return (
    <div className="mb-1 flex items-center gap-3">
      <span className="text-[10.5px] font-bold tracking-[0.14em] whitespace-nowrap text-ink-500 uppercase">{nome}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
