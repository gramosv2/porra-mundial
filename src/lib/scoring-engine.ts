import { calculateMatchPoints, isCorrectResult, isExactScore, type Phase } from '@/config/scoring';
import { SCORING_CONFIG } from '@/config/scoring';

type AdminClient = ReturnType<typeof import('./supabase/server').createAdminClient>;

/**
 * Recalcula los puntos de un partido finalizado.
 * Recorre todas las predicciones, asigna points_earned y actualiza los agregados
 * de cada usuario afectado.
 */
export async function recalculateMatchPoints(supabase: AdminClient, matchId: number) {
  const { data: match, error: matchErr } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single();
  if (matchErr || !match) throw new Error('Match not found');
  if (match.result_team1 == null || match.result_team2 == null) {
    throw new Error('Match has no result');
  }

  const { data: predictions, error: predErr } = await supabase
    .from('predictions')
    .select('*')
    .eq('match_id', matchId);
  if (predErr) throw predErr;

  const affectedUserIds = new Set<string>();

  for (const p of predictions ?? []) {
    const points = calculateMatchPoints(
      p.pred_team1,
      p.pred_team2,
      match.result_team1,
      match.result_team2,
      match.phase as Phase
    );
    await supabase.from('predictions').update({ points_earned: points }).eq('id', p.id);
    affectedUserIds.add(p.user_id);
  }

  for (const userId of affectedUserIds) {
    await recalculateUserTotals(supabase, userId);
  }
}

/**
 * Recalcula los agregados de un usuario (total_points, exact_scores, correct_results)
 * sumando todas sus predicciones de partidos finalizados.
 */
export async function recalculateUserTotals(supabase: AdminClient, userId: string) {
  const { data: preds } = await supabase
    .from('predictions')
    .select('pred_team1, pred_team2, points_earned, match_id, matches!inner(status, result_team1, result_team2)')
    .eq('user_id', userId)
    .eq('matches.status', 'finished');

  let total = 0;
  let exact = 0;
  let correct = 0;

  for (const p of (preds ?? []) as any[]) {
    const m = p.matches;
    if (m?.result_team1 == null || m?.result_team2 == null) continue;
    total += p.points_earned ?? 0;
    if (isExactScore(p.pred_team1, p.pred_team2, m.result_team1, m.result_team2)) exact += 1;
    else if (isCorrectResult(p.pred_team1, p.pred_team2, m.result_team1, m.result_team2)) correct += 1;
  }

  // Sumar también los puntos de awards acertados
  const { data: awards } = await supabase
    .from('award_predictions')
    .select('points_earned')
    .eq('user_id', userId)
    .eq('is_correct', true);
  for (const a of awards ?? []) total += a.points_earned ?? 0;

  // Sumar también los puntos de semifinalistas acertados
  const { data: semis } = await supabase
    .from('semifinalist_predictions')
    .select('points_earned')
    .eq('user_id', userId)
    .eq('is_correct', true);
  for (const s of semis ?? []) total += s.points_earned ?? 0;

  // Sumar también los puntos del cuadro de eliminatorias dinámico.
  // IMPORTANTE: esta función pisaba total_points por completo, borrando sin
  // querer la contribución del bracket cada vez que se recalculaba algo de
  // grupos/awards/semis. bracket_points ya está siempre actualizado por
  // separado (ver recalculateUserBracketTotal en bracket-engine.ts), así
  // que aquí solo hace falta sumarlo de vuelta al componer el total.
  const { data: profile } = await supabase
    .from('profiles')
    .select('bracket_points')
    .eq('id', userId)
    .single();
  total += profile?.bracket_points ?? 0;

  await supabase
    .from('profiles')
    .update({ total_points: total, exact_scores: exact, correct_results: correct })
    .eq('id', userId);
}

/**
 * Recalcula todos los usuarios (utilidad admin tras cambios masivos).
 */
export async function recalculateAllUsers(supabase: AdminClient) {
  const { data: profiles } = await supabase.from('profiles').select('id');
  for (const p of profiles ?? []) {
    await recalculateUserTotals(supabase, p.id);
  }
}

/**
 * Aplica los puntos de un premio individual a todos los usuarios que acertaron.
 */
export async function resolveAward(
  supabase: AdminClient,
  awardType: keyof typeof SCORING_CONFIG.awards,
  winner: string
) {
  const { data: preds } = await supabase
    .from('award_predictions')
    .select('*')
    .eq('award_type', awardType);

  const points = SCORING_CONFIG.awards[awardType];
  const affected = new Set<string>();

  for (const p of preds ?? []) {
    const isCorrect = p.prediction.trim().toLowerCase() === winner.trim().toLowerCase();
    await supabase
      .from('award_predictions')
      .update({
        is_correct: isCorrect,
        points_earned: isCorrect ? points : 0,
      })
      .eq('id', p.id);
    affected.add(p.user_id);
  }

  for (const userId of affected) {
    await recalculateUserTotals(supabase, userId);
  }
}

/**
 * Resuelve las predicciones de semifinalistas dadas las 4 selecciones reales.
 * Cada acierto suma SCORING_CONFIG.semifinalists.points_per_hit puntos.
 * Acepta nombres en cualquier orden y comparación case-insensitive.
 */
export async function resolveSemifinalists(
  supabase: AdminClient,
  realSemifinalists: string[]
) {
  const normalized = new Set(
    realSemifinalists.map((t) => t.trim().toLowerCase())
  );
  const pointsPerHit = SCORING_CONFIG.semifinalists.points_per_hit;

  const { data: preds } = await supabase.from('semifinalist_predictions').select('*');
  const affected = new Set<string>();

  for (const p of preds ?? []) {
    const isCorrect = normalized.has(p.team.trim().toLowerCase());
    await supabase
      .from('semifinalist_predictions')
      .update({
        is_correct: isCorrect,
        points_earned: isCorrect ? pointsPerHit : 0,
      })
      .eq('id', p.id);
    affected.add(p.user_id);
  }

  for (const userId of affected) {
    await recalculateUserTotals(supabase, userId);
  }
}
