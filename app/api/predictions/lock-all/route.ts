import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { SCORING_CONFIG } from '@/config/scoring';

export const dynamic = 'force-dynamic';

/**
 * POST /api/predictions/lock-all
 * Cierra TODAS las predicciones del usuario que:
 *  - existen
 *  - el partido sigue open
 *  - faltan ≥ N horas
 *  - actualmente están unlocked
 */
export async function POST(_req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const admin = createAdminClient();
  const lockMs = SCORING_CONFIG.lock_hours_before_match * 60 * 60 * 1000;
  const cutoffIso = new Date(Date.now() + lockMs).toISOString();

  // 1) Obtener predicciones candidatas: del usuario, no lockeadas,
  //    cuyo partido está open y la fecha del partido > cutoff.
  const { data: preds, error: selErr } = await admin
    .from('predictions')
    .select('id, matches!inner(id, status, match_date)')
    .eq('user_id', user.id)
    .eq('locked', false)
    .eq('matches.status', 'open')
    .gt('matches.match_date', cutoffIso);

  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 });

  const ids = (preds ?? []).map((p: any) => p.id);
  if (ids.length === 0) {
    return NextResponse.json({ ok: true, locked: 0 });
  }

  const { error: updErr } = await admin
    .from('predictions')
    .update({ locked: true, locked_at: new Date().toISOString() })
    .in('id', ids)
    .eq('user_id', user.id);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, locked: ids.length });
}
