import {
  BRACKET_SLOTS,
  BRACKET_SLOTS_BY_ID,
  BRACKET_PHASE_ORDER,
  T3_USES_LOSERS,
  getDescendantSlots,
  type BracketPhase,
} from '@/config/bracket';
import {
  calculateBracketPoints,
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

function allFinished(allSlots: BracketSlot[], slotIds: string[]): boolean {
  const byId = new Map(allSlots.map((s) => [s.id, s]));
  return slotIds.every((id) => byId.get(id)?.status === 'finished');
}

function realAdvancersOf(allSlots: BracketSlot[], slotIds: string[]): Set<string> {
  const byId = new Map(allSlots.map((s) => [s.id, s]));
  const out = new Set<string>();
  for (const id of slotIds) {
    const adv = byId.get(id)?.real_advancer;
    if (adv) out.add(adv);
  }
  return out;
}

const QF_FEEDER_SLOTS = ['R8_1', 'R8_2', 'R8_3', 'R8_4', 'R8_5', 'R8_6', 'R8_7', 'R8_8'];
const SF_FEEDER_SLOTS = ['QF_1', 'QF_2', 'QF_3', 'QF_4'];
const F_FEEDER_SLOTS = ['SF_1', 'SF_2'];

/**
 * Calcula los puntos extra de UN usuario, comparando lo que predijo (a
 * través de `resolved`, el bracket ya resuelto según SUS elecciones)
 * contra los equipos que REALMENTE llegaron a cada fase — solo cuando esa
 * ronda anterior ya está completamente resuelta en la realidad.
 */
export function calculateUserBracketExtras(
  resolved: Map<string, ResolvedSlot>,
  allSlots: BracketSlot[],
  realChampion: string | null
): BracketExtras {
  const cfg = SCORING_CONFIG.bracket_advance_bonus;

  // Equipos que el usuario predijo para cada casilla de la fase (su propia
  // elección, resuelta en cascada desde dieciseisavos).
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

  const qfReady = allFinished(allSlots, QF_FEEDER_SLOTS);
  const qfHits = qfReady
    ? countHits(userTeamsInPhase('qf'), realAdvancersOf(allSlots, QF_FEEDER_SLOTS))
    : 0;

  const sfReady = allFinished(allSlots, SF_FEEDER_SLOTS);
  const sfHits = sfReady
    ? countHits(userTeamsInPhase('sf'), realAdvancersOf(allSlots, SF_FEEDER_SLOTS))
    : 0;

  const fReady = allFinished(allSlots, F_FEEDER_SLOTS);
  const fHits = fReady
    ? countHits(userTeamsInPhase('f'), realAdvancersOf(allSlots, F_FEEDER_SLOTS))
    : 0;

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
// Recalcular UNA casilla con resultado real: marca puntos + propaga
// is_dead a toda la rama descendiente de cada usuario que falló el 1x2.
// ---------------------------------------------------------------------


/**
 * Se llama cuando el admin guarda el resultado real de un slot (bracket_slots
 * con result_team1/result_team2 ya actualizado, status='finished').
 * Recorre TODAS las predicciones de ese slot, calcula puntos, y si alguien
 * falló el ganador, marca is_dead=true en cascada para su rama completa.
 */
export async function recalculateBracketSlot(supabase: AdminClient, slotId: string) {
  const { data: slotRow, error: slotErr } = await supabase
    .from('bracket_slots')
    .select('*')
    .eq('id', slotId)
    .single();
  if (slotErr || !slotRow) throw new Error('Slot no encontrado');
  if (slotRow.result_team1 == null || slotRow.result_team2 == null) {
    throw new Error('El slot no tiene resultado real todavía');
  }
  if (!slotRow.real_advancer) {
    throw new Error('Falta indicar qué equipo avanzó realmente en este slot');
  }

  const { data: allSlots, error: allSlotsErr } = await supabase.from('bracket_slots').select('*');
  if (allSlotsErr || !allSlots) throw new Error('No se pudo leer el árbol de slots');

  const { data: allPreds, error: predsErr } = await supabase
    .from('bracket_predictions')
    .select('*');
  if (predsErr) throw predsErr;

  const predsByUser = new Map<string, Map<string, BracketPrediction>>();
  for (const p of (allPreds ?? []) as BracketPrediction[]) {
    if (!predsByUser.has(p.user_id)) predsByUser.set(p.user_id, new Map());
    predsByUser.get(p.user_id)!.set(p.slot_id, p);
  }

  const realAdvancerName = slotRow.real_advancer as string;
  const { team1: realTeam1Name, team2: realTeam2Name } = resolveRealMatchup(
    allSlots as BracketSlot[],
    slotId
  );

  const affectedUsers = new Set<string>();

  for (const [userId, userPreds] of predsByUser) {
    const pred = userPreds.get(slotId);
    if (!pred) continue; // no predijo esta casilla, nada que hacer
    if (pred.is_dead) continue; // su rama ya estaba muerta antes de esta ronda

    const resolvedForUser = resolveUserBracket(allSlots as BracketSlot[], userPreds);
    const resolvedSlot = resolvedForUser.get(slotId);

    // Si no se conocen ambos equipos para este usuario en este slot, no se puede evaluar.
    if (!resolvedSlot?.team1 || !resolvedSlot?.team2) continue;
    if (pred.pred_team1 == null || pred.pred_team2 == null) continue;

    // ¿El cruce que predijo este usuario es realmente el mismo cruce que pasó
    // en la vida real? (mismos dos equipos, en cualquier orden). Si predijo
    // un rival distinto al real (su rama anterior ya iba mal pero todavía no
    // se había marcado, p.ej. orden de carga de resultados), no se evalúa
    // como acierto ni como fallo "nuevo": su rama ya debería estar muerta por
    // la ronda anterior. Por seguridad, si no coincide el cruce, lo damos
    // por fallo (no puede haber acertado un cruce que no era el real).
    const sameMatchup =
      (resolvedSlot.team1 === realTeam1Name && resolvedSlot.team2 === realTeam2Name) ||
      (resolvedSlot.team1 === realTeam2Name && resolvedSlot.team2 === realTeam1Name);

    let hit = false;
    let points = 0;

    if (sameMatchup) {
      // ¿A qué equipo (nombre) dio el usuario como avanzante?
      const predictedAdvancerName = resolvedSlot.predictedAdvancer;
      hit = predictedAdvancerName === realAdvancerName;

      // Para el marcador exacto, hay que orientar pred_team1/pred_team2 del
      // usuario al mismo orden que el resultado real (team1/team2 pueden
      // estar invertidos respecto a como los guardó el admin).
      const userOriented =
        resolvedSlot.team1 === realTeam1Name
          ? { t1: pred.pred_team1, t2: pred.pred_team2, pw: pred.pred_penalty_winner }
          : { t1: pred.pred_team2, t2: pred.pred_team1, pw: invertPenalty(pred.pred_penalty_winner) };

      points = calculateBracketPoints({
        predTeam1: userOriented.t1,
        predTeam2: userOriented.t2,
        predPenaltyWinner: userOriented.pw,
        realTeam1: slotRow.result_team1,
        realTeam2: slotRow.result_team2,
        realPenaltyWinner: slotRow.real_penalty_winner,
        phase: slotRow.phase as BracketPhase,
      });
    }

    await supabase
      .from('bracket_predictions')
      .update({ points_earned: points })
      .eq('id', pred.id);

    if (!hit) {
      await markBranchDead(supabase, userId, slotId);
    }

    affectedUsers.add(userId);
  }

  for (const userId of affectedUsers) {
    await recalculateUserBracketTotal(supabase, userId);
  }
}

function invertPenalty(pw: 1 | 2 | null): 1 | 2 | null {
  if (pw === 1) return 2;
  if (pw === 2) return 1;
  return null;
}

/** Marca is_dead=true en una casilla y en TODA su rama descendiente, para un usuario. */
async function markBranchDead(supabase: AdminClient, userId: string, slotId: string) {
  const slotsToKill = [slotId, ...getDescendantSlots(slotId)];

  await supabase
    .from('bracket_predictions')
    .update({ is_dead: true })
    .eq('user_id', userId)
    .in('slot_id', slotsToKill);
}

/**
 * Suma todos los puntos de bracket de un usuario (partidos acertados +
 * extras por predicción: equipos en cuartos/semis/final + campeón) y
 * actualiza profiles.bracket_points / total_points.
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
  // (equipos según sus propias elecciones) y el campeón real, si ya se sabe.
  const { data: allSlots } = await supabase.from('bracket_slots').select('*');
  const slotsList = (allSlots ?? []) as BracketSlot[];
  const userPredsMap = new Map(userPredsList.map((p) => [p.slot_id, p]));
  const resolved = resolveUserBracket(slotsList, userPredsMap);

  const finalSlotRow = slotsList.find((s) => s.id === 'F');
  const realChampion = finalSlotRow?.real_advancer ?? null;

  const extras = calculateUserBracketExtras(resolved, slotsList, realChampion);

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
 * Recálculo completo desde cero: recorre TODOS los slots con resultado real
 * (en orden de fase) y reaplica is_dead + puntos. Útil tras corregir un
 * resultado antiguo, o como utilidad de mantenimiento.
 */
export async function recalculateAllBracketSlots(supabase: AdminClient) {
  // 1) Resetear is_dead y points_earned de todas las predicciones.
  await supabase
    .from('bracket_predictions')
    .update({ is_dead: false, points_earned: 0 })
    .neq('id', -1);

  // 2) Recorrer los slots con resultado real, en orden de fase (r16 → f/t3),
  //    para que la cascada de "muerte" se propague correctamente.
  const { data: finishedSlots } = await supabase
    .from('bracket_slots')
    .select('id, phase')
    .eq('status', 'finished');

  const sorted = (finishedSlots ?? []).sort(
    (a: any, b: any) =>
      BRACKET_PHASE_ORDER.indexOf(a.phase) - BRACKET_PHASE_ORDER.indexOf(b.phase)
  );

  for (const s of sorted) {
    await recalculateBracketSlot(supabase, s.id);
  }

  // 3) Recalcular agregados de todos los usuarios afectados.
  const { data: profiles } = await supabase.from('profiles').select('id');
  for (const p of profiles ?? []) {
    await recalculateUserBracketTotal(supabase, p.id);
  }
}
