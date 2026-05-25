// =====================================================================
// ARCHIVO DE CONFIGURACIÓN DE PUNTUACIÓN
// Modifica estos valores para ajustar las reglas sin tocar nada más.
// =====================================================================

export const SCORING_CONFIG = {
  // --- FASE DE GRUPOS ---
  group_stage: {
    exact_score: 3, // Aciertas el marcador exacto (ej: 2-1 y era 2-1)
    correct_result: 1, // Aciertas solo el ganador o el empate
    wrong: 0,
  },

  // --- FASES ELIMINATORIAS (multiplicadores sobre los puntos base) ---
  // Los puntos base son los mismos que grupo, multiplicados por:
  phase_multipliers: {
    r32: 1.5, // Ronda de 32
    r16: 2, // Octavos de final
    cuartos: 3, // Cuartos de final
    semis: 4, // Semifinales
    tercero: 3, // Partido por el 3er puesto
    final: 5, // Final
  },

  // --- PREMIOS INDIVIDUALES ---
  // Se validan manualmente por el admin al finalizar el torneo
  awards: {
    balon_oro: 5, // Mejor jugador del torneo
    bota_oro: 4, // Máximo goleador
    guante_oro: 3, // Mejor portero
    mejor_joven: 2, // Mejor jugador menor de 21 años
    fair_play: 1, // Equipo con mejor récord disciplinario (2ª fase)
  },
} as const;

export type Phase = 'grupos' | keyof typeof SCORING_CONFIG.phase_multipliers;
export type AwardType = keyof typeof SCORING_CONFIG.awards;

// Función principal: calcula puntos de un partido
export function calculateMatchPoints(
  predTeam1: number,
  predTeam2: number,
  realTeam1: number,
  realTeam2: number,
  phase: Phase
): number {
  const base = SCORING_CONFIG.group_stage;
  const multiplier = phase === 'grupos' ? 1 : SCORING_CONFIG.phase_multipliers[phase];

  if (predTeam1 === realTeam1 && predTeam2 === realTeam2) {
    return Math.round(base.exact_score * multiplier);
  }

  const predResult = Math.sign(predTeam1 - predTeam2);
  const realResult = Math.sign(realTeam1 - realTeam2);

  if (predResult === realResult) {
    return Math.round(base.correct_result * multiplier);
  }

  return base.wrong;
}

// Indica si una predicción fue marcador exacto
export function isExactScore(
  predTeam1: number,
  predTeam2: number,
  realTeam1: number,
  realTeam2: number
): boolean {
  return predTeam1 === realTeam1 && predTeam2 === realTeam2;
}

// Indica si una predicción acertó al menos el resultado (1X2)
export function isCorrectResult(
  predTeam1: number,
  predTeam2: number,
  realTeam1: number,
  realTeam2: number
): boolean {
  return Math.sign(predTeam1 - predTeam2) === Math.sign(realTeam1 - realTeam2);
}

// Etiqueta legible de una fase
export const PHASE_LABELS: Record<Phase, string> = {
  grupos: 'Fase de Grupos',
  r32: 'Ronda de 32',
  r16: 'Octavos',
  cuartos: 'Cuartos',
  semis: 'Semifinales',
  tercero: '3er Puesto',
  final: 'Final',
};

export const AWARD_LABELS: Record<AwardType, string> = {
  balon_oro: 'Balón de Oro',
  bota_oro: 'Bota de Oro',
  guante_oro: 'Guante de Oro',
  mejor_joven: 'Mejor Jugador Joven',
  fair_play: 'Premio Fair Play',
};
