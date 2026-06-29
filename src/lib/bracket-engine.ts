import {
  BRACKET_SLOTS,
  BRACKET_SLOTS_BY_ID,
  BRACKET_PHASE_ORDER,
  T3_USES_LOSERS,
  type BracketPhase,
} from '@/config/bracket';
import {
  bracketPredictedWinner,
  SCORING_CONFIG,
} from '@/config/scoring';
import type { BracketPrediction, BracketSlot } from '@/types';

type AdminClient = ReturnType<typeof import('./supabase/server').createAdminClient>;

// ---------------------------------------------------------------------
// Enfrentamiento REAL de un slot: a partir de octavos, los equipos no son
// fijos en bracket_slots (solo lo son en r16). Se resuelven mirando
// `real_advancer`/`real_loser` de los slots padre (que el admin rellena al
// guardar el resultado real de cada ronda).
// ---------------------------------------------------------------------
export interface RealMatchup {
  team1: string | null;
  team2: string | null;
}

export function resolveRealMatchup(allSlots: BracketSlot[], slotId: string): RealMatchup {
  const slotsById = new Map(allSlots.map((s) => [s.id, s]));
  const def = BRACKET_SLOTS_BY_ID[slotId];
  const row = slotsById.get(slotId);

  if (!def.fromSlot1 || !def.fromSlot2) {
    return { team1: row?.team1_real ?? null, team2: row?.team2_real ?? null };
  }

  const parent1 = slotsById.get(def.fromSlot1);
  const parent2 = slotsById.get(def.fromSlot2);

  if (slotId === 'T3' && T3_USES_LOSERS) {
    return {
      team1: parent1?.real_loser ?? null,
      team2: parent2?.real_loser ?? null,
    };
  }

  return {
    team1: parent1?.real_advancer ?? null,
    team2: parent2?.real_advancer ?? null,
  };
}

// ---------------------------------------------------------------------
// Resolución de rivales: dado el conjunto de predicciones de UN usuario
// y el árbol de slots, calcula qué EQUIPO (nombre) le tocaría en cada
// casilla según sus propias elecciones de ganador en rondas anteriores.
// Esto es puramente derivado — no se persiste como texto, se recalcula
// siempre a partir de pred_team1/pred_team2/pred_penalty_winner.
// ---------------------------------------------------------------------

export interface ResolvedSlot {
  slotId: string;
  team1: string | null; // null = todavía no se sabe (falta una ronda anterior)
  team2: string | null;
  /** Equipo (nombre) que esa predicción da como avanzante. null si no se ha predicho aún. */
  predictedAdvancer: string | null;
}

/**
 * Dado el árbol fijo de slots (con equipos reales en r16) y las predicciones
 * de un usuario, resuelve nombre de equipo en cada casilla para ESE usuario.
 */
export function resolveUserBracket(
  slots: BracketSlot[],
  userPreds: Map<string, BracketPrediction>
): Map<string, ResolvedSlot> {
  const slotsById = new Map(slots.map((s) => [s.id, s]));
  const resolved = new Map<string, ResolvedSlot>();

  function resolve(slotId: string): ResolvedSlot {
    const cached = resolved.get(slotId);
    if (cached) return cached;

    const def = BRACKET_SLOTS_BY_ID[slotId];
    const row = slotsById.get(slotId);
    const pred = userPreds.get(slotId);

    let team1: string | null = null;
    let team2: string | null = null;

    if (!def.fromSlot1 || !def.fromSlot2) {
      // r16: equipos fijos, vienen de la BD (admin)
      team1 = row?.team1_real ?? null;
      team2 = row?.team2_real ?? null;
    } else if (slotId === 'T3' && T3_USES_LOSERS) {
      // Tercer puesto: el PERDEDOR de cada semifinal predicha por el usuario
      const p1 = resolve(def.fromSlot1);
      const p2 = resolve(def.fromSlot2);
      team1 = loserOf(p1);
      team2 = loserOf(p2);
    } else {
      const p1 = resolve(def.fromSlot1);
      const p2 = resolve(def.fromSlot2);
      team1 = p1.predictedAdvancer;
      team2 = p2.predictedAdvancer;
    }

    let predictedAdvancer: string | null = null;
    if (
      pred &&
      pred.pred_team1 != null &&
      pred.pred_team2 != null &&
      team1 &&
      team2
    ) {
      const winnerSlot = bracketPredictedWinner(
        pred.pred_team1,
        pred.pred_team2,
        pred.pred_penalty_winner
      );
      predictedAdvancer = winnerSlot === 1 ? team1 : team2;
    }

    const out: ResolvedSlot = { slotId, team1, team2, predictedAdvancer };
    resolved.set(slotId, out);
    return out;
  }

  function loserOf(p: ResolvedSlot): string | null {
    if (!p.predictedAdvancer || !p.team1 || !p.team2) return null;
    return p.predictedAdvancer === p.team1 ? p.team2 : p.team1;
  }

  for (const s of BRACKET_SLOTS) resolve(s.id);
  return resolved;
}

// ---------------------------------------------------------------------
// "Vida real" de los equipos, independiente de cualquier usuario: para
// cada fase, qué equipos han avanzado de verdad hasta ahí, y qué equipos
// ya han sido eliminados de verdad en cualquier ronda anterior.
//
// Esto es la pieza central del nuevo modelo: la vida de un equipo en el
// cuadro de un usuario depende SOLO de si ese equipo, individualmente,
// sigue ganando sus partidos reales — no de si el cruce que el usuario
// había imaginado para él era el correcto.
// ---------------------------------------------------------------------

export interface RealLifeState {
  /** Equipos reales que han sido eliminados en cualquier ronda ya finalizada. */
  eliminatedTeams: Set<string>;
  /** Por fase, equipos reales que avanzan a ESA fase (solo si la ronda
   *  anterior está completamente finalizada; si no, el set está vacío y
   *  `phaseReady[phase]` es false). */
  advancersByPhase: Record<BracketPhase, Set<string>>;
  /** Si la ronda que alimenta a esa fase ya está 100% finalizada en la realidad. */
  phaseReady: Record<BracketPhase, boolean>;
}

const PHASE_FEEDER_SLOTS: Record<BracketPhase, string[]> = {
  r16: [], // r16 no tiene ronda anterior (equipos fijos desde el inicio)
  r8: ['R16_1', 'R16_2', 'R16_3', 'R16_4', 'R16_5', 'R16_6', 'R16_7', 'R16_8',
       'R16_9', 'R16_10', 'R16_11', 'R16_12', 'R16_13', 'R16_14', 'R16_15', 'R16_16'],
  qf: ['R8_1', 'R8_2', 'R8_3', 'R8_4', 'R8_5', 'R8_6', 'R8_7', 'R8_8'],
  sf: ['QF_1', 'QF_2', 'QF_3', 'QF_4'],
  f: ['SF_1', 'SF_2'],
  t3: ['SF_1', 'SF_2'],
};

/**
 * Construye el estado de vida real de todos los equipos a partir del
 * árbol de slots (con sus resultados reales ya cargados por el admin).
 * Es un cálculo puramente derivado de `allSlots`, sin tocar predicciones.
 */
export function computeRealLifeState(allSlots: BracketSlot[]): RealLifeState {
  const slotsById = new Map(allSlots.map((s) => [s.id, s]));
  const eliminatedTeams = new Set<string>();
  const advancersByPhase = {} as Record<BracketPhase, Set<string>>;
  const phaseReady = {} as Record<BracketPhase, boolean>;

  for (const phase of BRACKET_PHASE_ORDER) {
    const feeders = PHASE_FEEDER_SLOTS[phase];
    if (feeders.length === 0) {
      // r16: no depende de ninguna ronda anterior, siempre "lista".
      advancersByPhase[phase] = new Set();
      phaseReady[phase] = true;
      continue;
    }

    const ready = feeders.every((id) => slotsById.get(id)?.status === 'finished');
    phaseReady[phase] = ready;

    const advancers = new Set<string>();
    if (ready) {
      for (const id of feeders) {
        const row = slotsById.get(id);
        if (!row) continue;
        const adv = phase === 't3' ? row.real_loser : row.real_advancer;
        const elim = phase === 't3' ? row.real_advancer : row.real_loser;
        if (adv) advancers.add(adv);
        // El equipo que NO avanza a la fase normal queda eliminado del
        // todo (salvo en t3, que es el cruce de perdedores: ahí el que
        // "elimina" es el ganador real de esa semifinal).
        if (phase !== 't3' && elim) eliminatedTeams.add(elim);
      }
    }
    advancersByPhase[phase] = advancers;
  }

  return { eliminatedTeams, advancersByPhase, phaseReady };
}

/**
 * ¿Sigue vivo este equipo en la realidad, a la altura de la fase dada?
 * "Vivo" = no ha sido eliminado todavía en ninguna ronda ya finalizada.
 * Si la fase todavía no es alcanzable (ronda anterior sin terminar), no
 * podemos afirmar nada: devolvemos null (desconocido).
 *
 * Caso especial r16: ahí no hay "ronda anterior" que resolver — la pregunta
 * es directamente si ESE partido de dieciseisavos concreto ya tiene
 * resultado real y si el equipo elegido fue quien avanzó. Por eso este caso
 * se resuelve aparte, mirando el propio slot, no `state`.
 */
function isTeamRealAdvancer(
  state: RealLifeState,
  allSlots: BracketSlot[],
  phase: BracketPhase,
  slotId: string,
  team: string | null
): boolean | null {
  if (!team) return null;

  if (phase === 'r16') {
    const row = allSlots.find((s) => s.id === slotId);
    if (!row || row.status !== 'finished' || !row.real_advancer) return null;
    return row.real_advancer === team;
  }

  if (!state.phaseReady[phase]) return null;
  return state.advancersByPhase[phase].has(team);
}

// ---------------------------------------------------------------------
// Evaluación de UNA casilla para UN usuario: combina el nuevo modelo de
// "vida por equipo" con el bonus de marcador exacto (que sigue exigiendo
// que el CRUCE COMPLETO coincida con el real).
// ---------------------------------------------------------------------

export interface SlotEvaluation {
  /** true / false / null (todavía no se puede evaluar, falta info) */
  advancerAlive: boolean | null;
  /** El cruce que el usuario predijo coincide exactamente con el real (ambos equipos) */
  exactMatchup: boolean;
  points: number;
  /** Si esta elección del usuario debe marcarse is_dead (su equipo ya fue eliminado de verdad) */
  isDead: boolean;
}

export function evaluateUserSlot(
  state: RealLifeState,
  allSlots: BracketSlot[],
  phase: BracketPhase,
  resolvedSlot: ResolvedSlot,
  pred: BracketPrediction
): SlotEvaluation {
  const chosenTeam = resolvedSlot.predictedAdvancer;

  const advancerAlive = isTeamRealAdvancer(state, allSlots, phase, resolvedSlot.slotId, chosenTeam);

  if (advancerAlive === null) {
    return { advancerAlive: null, exactMatchup: false, points: 0, isDead: false };
  }

  if (!advancerAlive) {
    // El equipo que elegiste ya fue eliminado de verdad: 0 puntos, muere.
    return { advancerAlive: false, exactMatchup: false, points: 0, isDead: true };
  }

  // Tu equipo sigue vivo de verdad → ganas el 1X2 (correct_result).
  let points = SCORING_CONFIG.bracket.correct_result;

  // ¿El cruce completo (ambos equipos) coincide con el real? Solo entonces
  // puede haber bonus de marcador exacto.
  const { team1: realTeam1, team2: realTeam2 } = resolveRealMatchup(allSlots, resolvedSlot.slotId);
  const exactMatchup =
    !!realTeam1 &&
    !!realTeam2 &&
    ((resolvedSlot.team1 === realTeam1 && resolvedSlot.team2 === realTeam2) ||
      (resolvedSlot.team1 === realTeam2 && resolvedSlot.team2 === realTeam1));

  if (exactMatchup && pred.pred_team1 != null && pred.pred_team2 != null) {
    // Orientamos el marcador del usuario al mismo orden que el real para comparar.
    const userOriented =
      resolvedSlot.team1 === realTeam1
        ? { t1: pred.pred_team1, t2: pred.pred_team2 }
        : { t1: pred.pred_team2, t2: pred.pred_team1 };

    const slotRow = allSlots.find((s) => s.id === resolvedSlot.slotId);
    if (
      slotRow?.result_team1 != null &&
      slotRow?.result_team2 != null &&
      userOriented.t1 === slotRow.result_team1 &&
      userOriented.t2 === slotRow.result_team2
    ) {
      points += SCORING_CONFIG.bracket.exact_bonus;
    }
  }

  return { advancerAlive: true, exactMatchup, points, isDead: false };
}

// ---------------------------------------------------------------------
// Extras por predicción: puntos que SÍ dependen de resultados reales.
//
// Regla: el extra de una fase (cuartos/semis/final) se calcula cuando la
// RONDA ANTERIOR COMPLETA ya tiene resultado real en TODOS sus partidos —
// no antes, y no partido a partido. En ese momento se conoce el conjunto
// exacto de equipos que pasan de verdad a esa fase, y se compara contra lo
// que cada usuario puso en sus propias casillas de esa fase.
//
//   - Extra de cuartos  → exige que los 8 octavos (R8_1..R8_8) estén 'finished'
//   - Extra de semis    → exige que los 4 cuartos (QF_1..QF_4) estén 'finished'
//   - Extra de final    → exige que las 2 semis (SF_1, SF_2) estén 'finished'
//   - Extra de campeón  → exige que la Final (F) esté 'finished'
//
// Antes de que la ronda anterior esté completa, el extra de esa fase es 0
// — no se "promete" nada por adelantado.
// ---------------------------------------------------------------------

export interface BracketExtras {
  qfTeams: number; // nº de equipos reales-en-cuartos que el usuario acertó (0-8)
  sfTeams: number; // nº de equipos reales-en-semis que el usuario acertó (0-4)
  fTeams: number; // nº de equipos reales-en-la-final que el usuario acertó (0-2)
  championHit: boolean; // si su ganador de la Final coincide con el campeón real
  points: number; // suma total de los extras anteriores
}

/**
 * Calcula los puntos extra de UN usuario, comparando lo que predijo (a
 * través de `resolved`, el bracket ya resuelto según SUS elecciones)
 * contra los equipos que REALMENTE llegaron a cada fase — solo cuando esa
 * ronda anterior ya está completamente resuelta en la realidad.
 */
export function calculateUserBracketExtras(
  resolved: Map<string, ResolvedSlot>,
  state: RealLifeState,
  realChampion: string | null
): BracketExtras {
  const cfg = SCORING_CONFIG.bracket_advance_bonus;

  function userTeamsInPhase(phase: 'qf' | 'sf' | 'f'): Set<string> {
    const out = new Set<string>();
    const slotIds = phase === 'f' ? ['F'] : BRACKET_SLOTS.filter((s) => s.phase === phase).map((s) => s.id);
    for (const id of slotIds) {
      const r = resolved.get(id);
      if (r?.team1) out.add(r.team1);
      if (r?.team2) out.add(r.team2);
    }
    return out;
  }

  function countHits(userTeams: Set<string>, realTeams: Set<string>): number {
    let n = 0;
    for (const t of userTeams) {
      if (realTeams.has(t)) n++;
    }
    return n;
  }

  const qfHits = state.phaseReady.qf ? countHits(userTeamsInPhase('qf'), state.advancersByPhase.qf) : 0;
  const sfHits = state.phaseReady.sf ? countHits(userTeamsInPhase('sf'), state.advancersByPhase.sf) : 0;
  const fHits = state.phaseReady.f ? countHits(userTeamsInPhase('f'), state.advancersByPhase.f) : 0;

  const finalSlot = resolved.get('F');
  const userChampion = finalSlot?.predictedAdvancer ?? null;
  const championHit = !!userChampion && !!realChampion && userChampion === realChampion;

  const points =
    qfHits * cfg.qf + sfHits * cfg.sf + fHits * cfg.f + (championHit ? SCORING_CONFIG.bracket_champion_bonus : 0);

  return {
    qfTeams: qfHits,
    sfTeams: sfHits,
    fTeams: fHits,
    championHit,
    points,
  };
}

// ---------------------------------------------------------------------
// Recálculo: con el nuevo modelo, una casilla concreta solo puede
// evaluarse de forma fiable recalculando TODO el bracket del usuario
// (la vida de su equipo puede depender de resultados de otras ramas).
// ---------------------------------------------------------------------

/**
 * Recalcula el bracket COMPLETO de un usuario: re-evalúa las 32 casillas
 * con el modelo de "vida por equipo", actualiza points_earned/is_dead de
 * cada predicción, y devuelve el total de puntos de partidos (sin extras).
 */
async function recalculateOneUserBracket(
  supabase: AdminClient,
  userId: string,
  allSlots: BracketSlot[],
  state: RealLifeState,
  userPreds: Map<string, BracketPrediction>
): Promise<number> {
  const resolved = resolveUserBracket(allSlots, userPreds);
  let total = 0;

  for (const def of BRACKET_SLOTS) {
    const pred = userPreds.get(def.id);
    if (!pred) continue;
    if (pred.pred_team1 == null || pred.pred_team2 == null) continue;

    const resolvedSlot = resolved.get(def.id);
    if (!resolvedSlot?.team1 || !resolvedSlot?.team2) continue; // todavía no se sabe el rival

    const evalResult = evaluateUserSlot(state, allSlots, def.phase, resolvedSlot, pred);

    // Si todavía no se puede evaluar (la fase no está "lista" en la
    // realidad), dejamos la predicción como estaba (sin tocar puntos ni
    // is_dead) — no hay nada que decidir aún.
    if (evalResult.advancerAlive === null) continue;

    total += evalResult.points;

    await supabase
      .from('bracket_predictions')
      .update({ points_earned: evalResult.points, is_dead: evalResult.isDead })
      .eq('id', pred.id);
  }

  return total;
}

/**
 * Suma todos los puntos de bracket de un usuario (partidos acertados +
 * extras por predicción: equipos en cuartos/semis/final + campeón) y
 * actualiza profiles.bracket_points / total_points.
 *
 * Asume que las predicciones de este usuario YA tienen points_earned/is_dead
 * actualizados (recalculateOneUserBracket se encarga de eso); esta función
 * solo agrega el total y añade los extras.
 */
export async function recalculateUserBracketTotal(supabase: AdminClient, userId: string) {
  const { data: preds } = await supabase
    .from('bracket_predictions')
    .select('*')
    .eq('user_id', userId);

  const userPredsList = (preds ?? []) as BracketPrediction[];

  const matchPoints = userPredsList
    .filter((p) => !p.is_dead)
    .reduce((acc, p) => acc + (p.points_earned ?? 0), 0);

  // Extras por predicción: necesitamos resolver el bracket de este usuario
  // (equipos según sus propias elecciones), el estado de vida real, y el
  // campeón real, si ya se sabe.
  const { data: allSlots } = await supabase.from('bracket_slots').select('*');
  const slotsList = (allSlots ?? []) as BracketSlot[];
  const userPredsMap = new Map(userPredsList.map((p) => [p.slot_id, p]));
  const resolved = resolveUserBracket(slotsList, userPredsMap);
  const state = computeRealLifeState(slotsList);

  const finalSlotRow = slotsList.find((s) => s.id === 'F');
  const realChampion = finalSlotRow?.real_advancer ?? null;

  const extras = calculateUserBracketExtras(resolved, state, realChampion);

  const bracketTotal = matchPoints + extras.points;

  // Sumamos el bracket a lo que ya tenga el usuario de grupos/awards/semis.
  // Para no duplicar en sucesivas llamadas, guardamos el total de bracket
  // por separado y recomponemos total_points = base (sin bracket) + bracket.
  const { data: profile } = await supabase
    .from('profiles')
    .select('total_points, bracket_points')
    .eq('id', userId)
    .single();

  const basePoints = (profile?.total_points ?? 0) - (profile?.bracket_points ?? 0);

  await supabase
    .from('profiles')
    .update({
      bracket_points: bracketTotal,
      total_points: basePoints + bracketTotal,
    })
    .eq('id', userId);
}

/**
 * Cierra (o reabre) el bracket completo para TODOS los usuarios a la vez.
 * Es el botón del admin "Cerrar todas las predicciones del cuadro".
 * No marca nada como muerto — eso solo ocurre al cargar resultados reales.
 */
export async function setBracketGlobalLock(supabase: AdminClient, locked: boolean) {
  await supabase
    .from('app_settings')
    .upsert(
      { key: 'bracket_locked', value: locked },
      { onConflict: 'key' }
    );

  await supabase
    .from('bracket_predictions')
    .update({ locked })
    .neq('id', -1); // condición siempre verdadera para afectar a todas las filas
}

/**
 * Recálculo completo desde cero: para cada usuario, re-evalúa sus 32
 * casillas con el modelo de "vida por equipo" (computeRealLifeState +
 * evaluateUserSlot) y recompone sus puntos totales. Útil tras corregir un
 * resultado antiguo, o como utilidad de mantenimiento.
 */
export async function recalculateAllBracketSlots(supabase: AdminClient) {
  // 1) Resetear is_dead y points_earned de todas las predicciones.
  await supabase
    .from('bracket_predictions')
    .update({ is_dead: false, points_earned: 0 })
    .neq('id', -1);

  // 2) Estado de vida real de los equipos, calculado UNA vez para todos
  //    los usuarios (es independiente de cualquier predicción).
  const { data: allSlotsRaw } = await supabase.from('bracket_slots').select('*');
  const allSlots = (allSlotsRaw ?? []) as BracketSlot[];
  const state = computeRealLifeState(allSlots);

  // 3) Recorrer cada usuario, re-evaluar su cuadro completo, y recomponer
  //    sus puntos totales (partidos + extras).
  const { data: allPredsRaw } = await supabase.from('bracket_predictions').select('*');
  const predsByUser = new Map<string, Map<string, BracketPrediction>>();
  for (const p of (allPredsRaw ?? []) as BracketPrediction[]) {
    if (!predsByUser.has(p.user_id)) predsByUser.set(p.user_id, new Map());
    predsByUser.get(p.user_id)!.set(p.slot_id, p);
  }

  for (const [userId, userPreds] of predsByUser) {
    await recalculateOneUserBracket(supabase, userId, allSlots, state, userPreds);
    await recalculateUserBracketTotal(supabase, userId);
  }
}
