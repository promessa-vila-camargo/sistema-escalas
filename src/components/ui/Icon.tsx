/**
 * Conjunto único de ícones lineares do sistema (traço 1.75, cantos
 * arredondados, grade 24px). Substitui os emojis na interface — emojis ficam
 * só na mensagem de WhatsApp, onde são o idioma natural.
 */
const PATHS = {
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="8.75" />
      <path d="M8.25 12.25l2.6 2.6 4.9-5.1" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.75" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="8.75" />
      <path d="M12 7.75v5" />
      <path d="M12 16.25h.01" />
    </>
  ),
  swap: (
    <>
      <path d="M6 8h12l-3.5-3.5" />
      <path d="M18 16H6l3.5 3.5" />
    </>
  ),
  chevronLeft: <path d="M14.5 6l-6 6 6 6" />,
  chevronRight: <path d="M9.5 6l6 6-6 6" />,
  chevronDown: <path d="M6 9.5l6 6 6-6" />,
  x: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  more: (
    <>
      <circle cx="5.5" cy="12" r="1.1" fill="currentColor" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" />
      <circle cx="18.5" cy="12" r="1.1" fill="currentColor" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11" />
      <path d="M7.5 10.5L12 15l4.5-4.5" />
      <path d="M5 19.5h14" />
    </>
  ),
  eye: (
    <>
      <path d="M2.75 12S6.25 5.75 12 5.75 21.25 12 21.25 12 17.75 18.25 12 18.25 2.75 12 2.75 12z" />
      <circle cx="12" cy="12" r="2.75" />
    </>
  ),
  file: (
    <>
      <path d="M14 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8L14 3.5z" />
      <path d="M14 3.5V8h4.5" />
      <path d="M9 12.5h6M9 16h4" />
    </>
  ),
  message: (
    <path d="M20.25 11.75a8.25 8.25 0 0 1-12 7.35L3.75 20.25l1.2-4.25a8.25 8.25 0 1 1 15.3-4.25z" />
  ),
  save: (
    <>
      <path d="M5 3.75h11l3.25 3.25V19A1.25 1.25 0 0 1 18 20.25H6A1.25 1.25 0 0 1 4.75 19V5A1.25 1.25 0 0 1 6 3.75z" />
      <path d="M8 3.75V8h7V3.75" />
      <path d="M7.75 20.25v-5.5h8.5v5.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.75" y="5" width="16.5" height="15.25" rx="2" />
      <path d="M3.75 9.75h16.5M8 3v4M16 3v4" />
    </>
  ),
  building: (
    <>
      <path d="M3.5 20.25h17" />
      <path d="M5.5 20.25V10L12 4.5l6.5 5.5v10.25" />
      <path d="M10 20.25v-5h4v5" />
    </>
  ),
  note: (
    <>
      <path d="M4 20h4.25L19 9.25a2.1 2.1 0 0 0-3-3L5.25 17 4 20z" />
      <path d="M14.5 7.75l2.75 2.75" />
    </>
  ),
  sparkle: <path d="M12 3.75l1.75 5 5 1.75-5 1.75-1.75 5-1.75-5-5-1.75 5-1.75L12 3.75z" />,
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  trash: (
    <>
      <path d="M4.5 7h15" />
      <path d="M9.5 7V4.75h5V7" />
      <path d="M6.5 7l.9 12.25a1.25 1.25 0 0 0 1.25 1.15h6.7a1.25 1.25 0 0 0 1.25-1.15L17.5 7" />
    </>
  ),
  printer: (
    <>
      <path d="M7 9V3.75h10V9" />
      <path d="M7 17.25H5.25a1.5 1.5 0 0 1-1.5-1.5V10.5A1.5 1.5 0 0 1 5.25 9h13.5a1.5 1.5 0 0 1 1.5 1.5v5.25a1.5 1.5 0 0 1-1.5 1.5H17" />
      <path d="M7 14h10v6.25H7z" />
    </>
  ),
  moon: <path d="M19.5 14.75A7.75 7.75 0 0 1 9.25 4.5a7.75 7.75 0 1 0 10.25 10.25z" />,
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="9.75" rx="2" />
      <path d="M8.25 10.5V8a3.75 3.75 0 0 1 7.5 0v2.5" />
    </>
  ),
  list: (
    <>
      <path d="M9.5 6.5h10M9.5 12h10M9.5 17.5h10" />
      <path d="M4.5 6.5l1 1 2-2M4.5 12l1 1 2-2M4.5 17.5l1 1 2-2" />
    </>
  ),
  sliders: (
    <>
      <path d="M4.5 7h9M17.5 7h2M4.5 17h2M10.5 17h9" />
      <circle cx="15.5" cy="7" r="2" />
      <circle cx="8.5" cy="17" r="2" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

export default function Icon({
  name,
  size = 18,
  className,
  strokeWidth = 1.75,
  title,
}: {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={"flex-none " + (className ?? "")}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title && <title>{title}</title>}
      {PATHS[name]}
    </svg>
  );
}

/** Indicador de carregamento girando, no mesmo traço dos ícones. */
export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      className={"flex-none animate-spin " + (className ?? "")}
      aria-hidden
    >
      <path d="M12 3.5a8.5 8.5 0 1 1-8.5 8.5" />
    </svg>
  );
}
