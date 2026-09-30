/**
 * Ícones lineares (outline), mesmo traço em todos, pra identidade do PDF —
 * nunca emoji no documento final. Mapeados por nome do ministério; um
 * ministério sem ícone reconhecido cai num círculo genérico.
 */
const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" {...stroke}>
      {children}
    </svg>
  );
}

const ICONS: Record<string, React.ReactNode> = {
  Direção: (
    <Svg>
      <path d="M12 3l2.2 2.2M12 3v3.5M4 21V10.5L12 5l8 5.5V21" />
      <path d="M9.5 21v-6h5v6" />
    </Svg>
  ),
  "Palavra e Pregação": (
    <Svg>
      <rect x="9.3" y="3" width="5.4" height="9" rx="2.7" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v3.2M9 20.2h6" />
    </Svg>
  ),
  Mídia: (
    <Svg>
      <rect x="7" y="2.5" width="10" height="19" rx="2.2" />
      <path d="M11 18.5h2" />
    </Svg>
  ),
  Datashow: (
    <Svg>
      <rect x="2.5" y="5" width="19" height="12" rx="1.8" />
      <path d="M9.5 20.5h5M12 17v3.5" />
    </Svg>
  ),
  Transmissão: (
    <Svg>
      <rect x="2.5" y="4" width="19" height="13" rx="1.8" />
      <path d="M8 20.5h8M12 17v3.5" />
      <circle cx="12" cy="10.5" r="2.6" />
    </Svg>
  ),
  Som: (
    <Svg>
      <path d="M5 20V10M12 20V4M19 20v-7" />
      <circle cx="5" cy="7.5" r="1.6" />
      <circle cx="12" cy="14.5" r="1.6" />
      <circle cx="19" cy="10.5" r="1.6" />
    </Svg>
  ),
};

export default function MinisterioIcon({ nome }: { nome: string }) {
  return (
    ICONS[nome] ?? (
      <Svg>
        <circle cx="12" cy="12" r="8.5" />
      </Svg>
    )
  );
}
