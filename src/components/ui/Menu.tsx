"use client";

import { useEffect, useRef, useState } from "react";
import Icon, { type IconName } from "./Icon";

export type ItemMenu = { rotulo: string; icone: IconName; onSelect: () => void };

/** Menu de ações secundárias ("⋯") — abre abaixo do botão, fecha com clique fora, Esc ou ao escolher. */
export default function Menu({ itens, rotulo }: { itens: ItemMenu[]; rotulo: string }) {
  const [aberto, setAberto] = useState(false);
  const raizRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    function fora(e: PointerEvent) {
      if (!raizRef.current?.contains(e.target as Node)) setAberto(false);
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  return (
    <div ref={raizRef} className="relative">
      <button
        type="button"
        className={"btn-icon " + (aberto ? "bg-ink-100 text-ink-900" : "")}
        aria-label={rotulo}
        title={rotulo}
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
      >
        <Icon name="more" size={18} />
      </button>
      {aberto && (
        <div
          role="menu"
          className="absolute top-full right-0 z-30 mt-1.5 w-60 origin-top-right animate-pop-in rounded-[12px] border border-line bg-white p-1.5 shadow-soft-lift"
        >
          {itens.map((item) => (
            <button
              key={item.rotulo}
              type="button"
              role="menuitem"
              onClick={() => {
                setAberto(false);
                item.onSelect();
              }}
              className="flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-[13.5px] font-medium text-ink-800 transition-colors hover:bg-ink-100"
            >
              <Icon name={item.icone} size={17} className="text-ink-500" />
              {item.rotulo}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
