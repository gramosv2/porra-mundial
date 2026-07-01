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

  // --- CUADRO DE ELIMINATORIAS DINÁMICO (dieciseisavos en adelante) ---
  // Modelo de 3 bonus INDEPENDIENTES y ACUMULABLES:
  //   1. 1X2 a 90': aciertas si fue victoria/empate/derrota a tiempo reglamentario → correct_result (3)
  //   2. Exacto: además clavaste el marcador exacto a 90'                          → + exact_bonus (2)
  //   3. Quién pasa: además acertaste quién avanzó de ronda (penaltis si empate)   → + penalty_bonus (2)
  //
  // IMPORTANTE: el bonus 3 (quién pasa) es también lo que determina si la rama
  // del usuario sigue viva o muere — si fallas quién pasa, rama muerta aunque
  // hayas acertado el 1X2 y el exacto.
  //
  // En partidos sin empate, el bonus 1 y 3 van siempre juntos (no puedes acertar
  // quién gana sin acertar el 1X2). Solo en empates son independientes.
  bracket: {
    correct_result: 3,  // 1X2 a 90' acertado
    exact_bonus: 2,     // Marcador exacto a 90'
    penalty_bonus: 2,   // Quién pasa de ronda (penaltis si empate)
    wrong: 0,
  },

  // --- EXTRAS DEL CUADRO: puntos por predicción, independientes del
  // resultado real (se ganan en el momento de guardar la predicción) ---
  // Por cada equipo que el usuario predice llegando a esa fase (sea quien
  // sea, gane o pierda después en su propio cuadro), suma estos puntos.
  // Como cada equipo solo puede ocupar una casilla por fase en el cuadro
  // de un usuario, no hay riesgo de contar el mismo equipo dos veces.
  bracket_advance_bonus: {
    qf: 2,  // +2 por cada equipo que metas en cuartos (hasta 8 equipos)
    sf: 4,  // +4 por cada equipo que metas en semifinales (hasta 4 equipos)
    f: 8,   // +8 por cada equipo que metas en la final (hasta 2 equipos)
  },

  // --- EXTRA: ganador del Mundial ---
  // Si el equipo que el usuario puso como ganador de la Final coincide con
  // el campeón real, suma este extra (este sí depende del resultado real).
  bracket_champion_bonus: 16,
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

// =====================================================================
// CUADRO DE ELIMINATORIAS DINÁMICO — cálculo de puntos
// =====================================================================
// Independiente de calculateMatchPoints (que es del sistema antiguo de
// `matches`/`predictions`). Aquí el "ganador de la eliminatoria" puede venir
// de los penaltis si el marcador a 90' fue empate, así que se compara aparte
// del marcador exacto.
import type { BracketPhase } from './bracket';

export interface BracketScoreInput {
  predTeam1: number;
  predTeam2: number;
  predPenaltyWinner: 1 | 2 | null; // 1 = pred_team1, 2 = pred_team2, null si no hubo empate predicho
  realTeam1: number;
  realTeam2: number;
  realPenaltyWinner: 1 | 2 | null;
  phase: BracketPhase;
}

/** ¿A quién dio como avanzante de ronda una predicción (1 o 2)? */
export function bracketPredictedWinner(
  predTeam1: number,
  predTeam2: number,
  predPenaltyWinner: 1 | 2 | null
): 1 | 2 {
  if (predTeam1 !== predTeam2) return predTeam1 > predTeam2 ? 1 : 2;
  // Empate a 90': decide la predicción de penaltis (si no se dio, asumimos 1 por defecto)
  return predPenaltyWinner ?? 1;
}

/** ¿A quién dio el resultado real como avanzante de ronda? */
export function bracketRealWinner(
  realTeam1: number,
  realTeam2: number,
  realPenaltyWinner: 1 | 2 | null
): 1 | 2 {
  if (realTeam1 !== realTeam2) return realTeam1 > realTeam2 ? 1 : 2;
  return realPenaltyWinner ?? 1;
}

/**
 * Calcula los puntos de una casilla del bracket. Mismos números que
 * group_stage, sin multiplicador de fase:
 * - Acierta quién avanza (1X2 o penaltis) → correct_result
 * - Además clava el marcador a 90'/120'    → + exact_bonus
 * - Falla quién avanza                     → 0 (no puede haber acertado el marcador)
 */
export function calculateBracketPoints(input: BracketScoreInput): number {
  const cfg = SCORING_CONFIG.bracket;

  const predWinner = bracketPredictedWinner(input.predTeam1, input.predTeam2, input.predPenaltyWinner);
  const realWinner = bracketRealWinner(input.realTeam1, input.realTeam2, input.realPenaltyWinner);

  if (predWinner !== realWinner) return cfg.wrong;

  let points: number = cfg.correct_result;
  if (input.predTeam1 === input.realTeam1 && input.predTeam2 === input.realTeam2) {
    points += cfg.exact_bonus;
  }
  return points;
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
