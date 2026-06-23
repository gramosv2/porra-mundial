import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { recalculateMatchPoints } from '@/lib/scoring-engine';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/edit-match-result
 *
 * ACCESO "ROOT" DEL ADMIN sobre el marcador real de un partido:
 *   - Puede fijar/cambiar result_team1 y result_team2 en cualquier momento.
 *   - Puede cambiar el status (open/closed/finished) a mano si lo envía.
 *   - No importa si el partido ya estaba finalizado: se puede corregir.
 *   - Si hay resultado, se recalculan automáticamente los puntos de todas
 *     las predicciones de ese partido y los agregados de los usuarios.
 *
 * Body:
 *   {
 *     matchId: number,
 *     result_team1: number,
 *     result_team2: number,
 *     status?: 'open' | 'closed' | 'finished'   // opcional; si no se manda
 *                                                 // y se envía resultado,
 *                                                 // se fuerza a 'finished'.
 *   }
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data: me } = await supabase
    .from('profiles')
    .select('role, approved')
    .eq('id', user.id)
    .single();
  if (!me || me.role !== 'admin' || !me.approved) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const matchId = Number(body.matchId);
  const r1 = Number(body.result_team1);
  const r2 = Number(body.result_team2);
  const statusInput = typeof body.status === 'string' ? body.status : null;

  if (!matchId) {
    return NextResponse.json({ error: 'Falta matchId' }, { status: 400 });
  }
  if (Number.isNaN(r1) || Number.isNaN(r2) || r1 < 0 || r2 < 0 || r1 > 30 || r2 > 30) {
    return NextResponse.json({ error: 'Marcador inválido' }, { status: 400 });
  }
  if (statusInput && !['open', 'closed', 'finished'].includes(statusInput)) {
    return NextResponse.json({ error: 'Status inválido' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: match, error: matchErr } = await admin
    .from('matches')
    .select('id')
    .eq('id', matchId)
    .single();
  if (matchErr || !match) {
    return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 });
  }

  // Sin restricciones de fecha/estado: el admin puede fijar el resultado
  // de cualquier partido, en cualquier momento, incluso si ya estaba
  // 'finished' (corrección a posteriori).
  const { data: updated, error: updErr } = await admin
    .from('matches')
    .update({
      result_team1: r1,
      result_team2: r2,
      status: statusInput ?? 'finished',
    })
    .eq('id', matchId)
    .select('id, result_team1, result_team2, status')
    .maybeSingle();

  if (updErr) {
    return NextResponse.json({ error: 'Error al guardar: ' + updErr.message }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json(
      { error: 'El guardado no se confirmó. Revisa SUPABASE_SERVICE_ROLE_KEY.' },
      { status: 500 }
    );
  }

  // Recalcular puntos de todas las predicciones de este partido + agregados
  try {
    await recalculateMatchPoints(admin, matchId);
  } catch (e: any) {
    return NextResponse.json(
      { ok: true, saved: updated, warning: 'Guardado, pero falló el recálculo: ' + (e?.message ?? '') },
      { status: 200 }
    );
  }

  return NextResponse.json({ ok: true, saved: updated });
}
