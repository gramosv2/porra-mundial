import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { SCORING_CONFIG } from '@/config/scoring';

export const dynamic = 'force-dynamic';

/**
 * POST /api/predictions/lock
 * Body: { matchId: number, lock: boolean }
 *  - lock=true  → marca la predicción como confirmada (locked=true).
 *  - lock=false → reabre la predicción si todavía estamos en ventana.
 *
 * Reglas (también enforzadas por RLS):
 *  - El partido debe estar status='open'.
 *  - Quedar al menos `lock_hours_before_match` horas para que empiece.
 *  - Si lock=false: la fila tiene que existir (no se reabre una predicción
 *    que no exista; primero hay que crearla).
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const matchId = Number(body.matchId);
  const lock = body.lock === true;
  if (!Number.isFinite(matchId)) {
    return NextResponse.json({ error: 'matchId inválido' }, { status: 400 });
  }

  // 1) Verificar partido + ventana
  const admin = createAdminClient();
  const { data: match } = await admin
    .from('matches')
    .select('id, status, match_date')
    .eq('id', matchId)
    .single();
  if (!match) return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 });
  if (match.status !== 'open') {
    return NextResponse.json(
      { error: 'El partido ya no está abierto.' },
      { status: 400 }
    );
  }
  const msToMatch = new Date(match.match_date).getTime() - Date.now();
  const lockMs = SCORING_CONFIG.lock_hours_before_match * 60 * 60 * 1000;
  if (msToMatch < lockMs) {
    return NextResponse.json(
      {
        error: `Solo puedes cerrar/abrir hasta ${SCORING_CONFIG.lock_hours_before_match}h antes del partido.`,
      },
      { status: 400 }
    );
  }

  // 2) Verificar que existe la predicción
  const { data: pred } = await admin
    .from('predictions')
    .select('id, locked')
    .eq('user_id', user.id)
    .eq('match_id', matchId)
    .maybeSingle();
  if (!pred) {
    return NextResponse.json(
      { error: 'Aún no tienes una predicción para este partido.' },
      { status: 400 }
    );
  }

  // 3) Aplicar lock/unlock con admin client (bypasa RLS para poder
  //    actualizar incluso si estaba locked en caso de unlock).
  const { error } = await admin
    .from('predictions')
    .update({
      locked: lock,
      locked_at: lock ? new Date().toISOString() : null,
    })
    .eq('id', pred.id)
    .eq('user_id', user.id); // doble seguro

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, locked: lock });
}
