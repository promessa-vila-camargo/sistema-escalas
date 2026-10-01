const EMOJI_MINISTERIO: Record<string, string> = {
  "Direção": "⛪",
  "Palavra e Pregação": "🎤",
  "Mídia": "📱",
  "Datashow": "💻",
  "Transmissão": "🖥️",
  "Som": "🎚️",
};

const EMOJI_FUNCAO: Record<string, string> = {
  "Diretor(a)": "⛪",
  "Palavra Pastoral": "🎤",
  "Pregador": "🎤",
  "Mídia": "📱",
  "Datashow": "💻",
  "Operador de Transmissão": "🖥️",
  "Câmera Fixa": "📹",
  "Câmera Móvel 1": "📹",
  "Câmera Móvel 2": "📹",
  "Mesa de Som": "🎚️",
  "Som da Transmissão": "🎚️",
};

export function emojiMinisterio(nome: string) {
  return EMOJI_MINISTERIO[nome] ?? "🏛️";
}

export function emojiFuncao(nome: string) {
  return EMOJI_FUNCAO[nome] ?? "•";
}
