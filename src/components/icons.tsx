/**
 * Ícones de interface — lineares (outline), mesmo traço em todos, nada de
 * emoji na tela (só texto e SVG). Mesmo estilo do MinisterioIcon.tsx.
 */
const stroke = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function base(size: number, children: React.ReactNode) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...stroke} aria-hidden="true">
      {children}
    </svg>
  );
}

export function IconPdf({ size = 16 }: { size?: number }) {
  return base(
    size,
    <>
      <path d="M6.5 2.5h8l4 4v14a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-17a1 1 0 0 1 1-1Z" />
      <path d="M14.5 2.5v4h4" />
      <path d="M8.3 17v-4h1.4a1.3 1.3 0 1 1 0 2.6H8.3M12.3 17v-4h1.1a1.9 1.9 0 0 1 0 4h-1.1ZM17.3 13v4M17.3 15h1.4" />
    </>
  );
}

export function IconPrinter({ size = 15 }: { size?: number }) {
  return base(
    size,
    <>
      <path d="M7 8.5V3h10v5.5" />
      <rect x="3.5" y="8.5" width="17" height="8" rx="1.6" />
      <path d="M7 15.5h10V21H7z" />
      <path d="M17 11.5h1.3" />
    </>
  );
}

export function IconCheck({ size = 13 }: { size?: number }) {
  return base(
    size,
    <>
      <circle cx="12" cy="12" r="8.7" />
      <path d="M8.3 12.3l2.4 2.4 5-5.2" />
    </>
  );
}

export function IconAlert({ size = 13 }: { size?: number }) {
  return base(
    size,
    <>
      <path d="M12 3.2 2.3 20h19.4L12 3.2Z" />
      <path d="M12 9.6v4.4" />
      <circle cx="12" cy="17" r="0.15" fill="currentColor" stroke="none" />
    </>
  );
}

export function IconKey({ size = 12 }: { size?: number }) {
  return base(
    size,
    <>
      <circle cx="7.2" cy="14.8" r="3.7" />
      <path d="M9.7 12.3 18 4l1.6 1.6-2 2 1.7 1.7-2.1 2.1-1.7-1.6-1.9 1.9" />
    </>
  );
}
