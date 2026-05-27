// =====================================================================
// ARCHIVO DE CONFIGURACIÓN DE PUNTUACIÓN
// Modifica estos valores para ajustar las reglas sin tocar nada más.
// =====================================================================

export const SCORING_CONFIG = {
  // --- FASE DE GRUPOS Y ELIMINATORIAS ---
  // Sistema aditivo: si aciertas el 1X2 sumas correct_result; si además clavas
  // el marcador exacto, sumas también exact_bonus (no es excluyente).
  //   - Solo 1X2          → correct_result  (3)
  //   - 1X2 + exacto      → correct_result + exact_bonus  (3 + 2 = 5)
  //   - Fallo             → wrong  (0)
  group_stage: {
    correct_result: 3, // Pegar el 1X2 (ganador o empate)
    exact_bonus: 2,    // Extra si además clavas el marcador
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

  // --- PREMIOS INDIVIDUALES DEL TORNEO ---
  // Se eligen ANTES de que empiecen los partidos de fase de grupos.
  // Se resuelven manualmente por el admin al finalizar el torneo.
  awards: {
    balon_oro: 5, // Mejor jugador del torneo
    bota_oro: 4, // Máximo goleador
    guante_oro: 3, // Mejor portero
    mejor_joven: 2, // Mejor jugador joven
    fair_play: 1, // Equipo con mejor récord disciplinario (2ª fase)
  },

  // --- SEMIFINALISTAS ---
  // El usuario elige 4 selecciones que cree que llegarán a semifinales.
  // Por cada acierto, +1 punto. Se cierran cuando arranca el torneo.
  semifinalists: {
    count: 4,
    points_per_hit: 1,
  },

  // --- REPARTO DEL BOTE (informativo, la web no gestiona el dinero) ---
  prize_distribution: {
    first: 0.75,   // 75%
    second: 0.20,  // 20%
    third: 0.05,   // 5%
  },

  // --- VENTANA DE CIERRE/REAPERTURA DE PREDICCIONES ---
  // Un usuario puede cerrar y reabrir su predicción mientras falten al menos
  // estas horas para el partido. Pasada esa ventana, queda bloqueada en su
  // último estado.
  lock_hours_before_match: 2,
} as const;

export type Phase = 'grupos' | keyof typeof SCORING_CONFIG.phase_multipliers;
export type AwardType = keyof typeof SCORING_CONFIG.awards;

/**
 * Calcula los puntos de un partido para una predicción dada.
 * Modelo aditivo:
 *  - 1X2 acertado → correct_result
 *  - Marcador exacto → correct_result + exact_bonus
 * Sobre estos puntos se aplica el multiplicador de fase (1 en fase de grupos).
 */
export function calculateMatchPoints(
  predTeam1: number,
  predTeam2: number,
  realTeam1: number,
  realTeam2: number,
  phase: Phase
): number {
  const base = SCORING_CONFIG.group_stage;
  const multiplier = phase === 'grupos' ? 1 : SCORING_CONFIG.phase_multipliers[phase];

  const predResult = Math.sign(predTeam1 - predTeam2);
  const realResult = Math.sign(realTeam1 - realTeam2);
  if (predResult !== realResult) return base.wrong;

  let points = base.correct_result;
  if (predTeam1 === realTeam1 && predTeam2 === realTeam2) {
    points += base.exact_bonus;
  }
  return Math.round(points * multiplier);
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

export const AWARD_DESCRIPTIONS: Record<AwardType, string> = {
  balon_oro: 'Mejor jugador del torneo',
  bota_oro: 'Máximo goleador',
  guante_oro: 'Mejor portero',
  mejor_joven: 'Mejor jugador joven',
  fair_play: 'Equipo con mejor récord disciplinario (2ª fase)',
};
