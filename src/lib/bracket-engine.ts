import {
  BRACKET_SLOTS,
  BRACKET_SLOTS_BY_ID,
  BRACKET_PHASE_ORDER,
  T3_USES_LOSERS,
  getDescendantSlots,
  type BracketPhase,
} from '@/config/bracket';
import { calculateBracketPoints, bracketPredictedWinner } from '@/config/scoring';
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

/** Suma todos los puntos de bracket de un usuario y actualiza profiles.total_points (incremental). */
export async function recalculateUserBracketTotal(supabase: AdminClient, userId: string) {
  const { data: preds } = await supabase
    .from('bracket_predictions')
    .select('points_earned, is_dead')
    .eq('user_id', userId);

  const bracketTotal = (preds ?? [])
    .filter((p: any) => !p.is_dead)
    .reduce((acc: number, p: any) => acc + (p.points_earned ?? 0), 0);

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
