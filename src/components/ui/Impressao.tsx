"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * Documento que vai pra impressora/PDF. É montado direto no <body>, e
 * enquanto existe a página inteira fica oculta na impressão (ver
 * `.doc-impressao` em globals.css) — sai só o documento, sem cabeçalho do
 * site, cards da tela ou outra impressão que tenha ficado montada.
 * Quem usa monta este componente só durante a impressão.
 */
export default function Impressao({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add("imprimindo-doc");
    return () => document.documentElement.classList.remove("imprimindo-doc");
  }, []);
  return createPortal(<div className="doc-impressao">{children}</div>, document.body);
}

/** Abre a impressão do navegador e avisa quando ela termina (pra desmontar o documento e restaurar o título da aba). */
export function abrirImpressao(nomeArquivo: string, aoTerminar: () => void) {
  const tituloAnterior = document.title;
  document.title = nomeArquivo;
  const terminar = () => {
    window.removeEventListener("afterprint", terminar);
    document.title = tituloAnterior;
    aoTerminar();
  };
  window.addEventListener("afterprint", terminar);
  setTimeout(() => window.print(), 60);
}
