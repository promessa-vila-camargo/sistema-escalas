"use client";

import { useEffect, useId, useRef } from "react";
import Icon from "./Icon";

/**
 * Janela modal padrão do sistema — no celular abre como "folha" presa à base
 * da tela (fácil de alcançar com o polegar), no computador centralizada.
 * Esc e o fundo escurecido fecham; a rolagem da página fica travada enquanto
 * está aberta e o foco volta pro botão que abriu ao fechar.
 */
export default function Modal({
  titulo,
  descricao,
  onClose,
  children,
  rodape,
  largura = "md",
}: {
  titulo: React.ReactNode;
  descricao?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  rodape?: React.ReactNode;
  largura?: "sm" | "md" | "lg";
}) {
  const painelRef = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    painelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      anterior?.focus?.();
    };
  }, []);

  const maxW = largura === "sm" ? "sm:max-w-md" : largura === "lg" ? "sm:max-w-3xl" : "sm:max-w-xl";

  return (
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 animate-fade-in bg-ink-950/45 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
        className={`relative flex max-h-[92dvh] w-full animate-rise-in flex-col overflow-hidden rounded-t-[20px] bg-white shadow-soft-lift outline-none sm:max-h-[86vh] sm:rounded-[16px] ${maxW}`}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 flex-none rounded-full bg-ink-200 sm:hidden" />
        <div className="flex flex-none items-start gap-4 border-b border-line px-5 pt-4 pb-4 sm:px-6 sm:pt-5">
          <div className="min-w-0 flex-1">
            <h3 id={tituloId} className="font-heading text-[17px] font-bold text-ink-900">
              {titulo}
            </h3>
            {descricao && <div className="mt-1 text-[13px] leading-relaxed text-ink-600">{descricao}</div>}
          </div>
          <button type="button" onClick={onClose} className="btn-icon -mt-1 -mr-2" aria-label="Fechar">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {rodape && (
          <div className="flex-none border-t border-line bg-paper/60 px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:px-6">
            {rodape}
          </div>
        )}
      </div>
    </div>
  );
}
