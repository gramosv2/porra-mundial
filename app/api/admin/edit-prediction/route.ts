import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { recalculateMatchPoints } from '@/lib/scoring-engine';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/edit-prediction
 *
 * Permite al ADMIN crear, editar o borrar la predicción de cualquier
 * participante para un partido concreto. Útil cuando alguien se unió tarde
 * por un fallo y el admin conoce su predicción.
 *
 * Body:
 *   { matchId: number, userId: string, pred1: number, pred2: number }   → crea/edita
 *   { matchId: number, userId: string, delete: true }                   → borra
 *
 * Usa el service role (createAdminClient) para saltarse la RLS, así que
 * funciona aunque el partido ya haya empezado o esté finalizado.
 * Si el partido ya tiene resultado, recalcula los puntos automáticamente.
 */
export async function POST(req: NextRequest) {
  // 1) Verificar que quien llama es admin aprobado
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
  const userId = String(body.userId ?? '');
  const isDelete = body.delete === true;

  if (!matchId || !userId) {
    return NextResponse.json({ error: 'Faltan matchId o userId' }, { status: 400 });
  }

  const admin = createAdminClient();

  // 2) Comprobar que el partido existe (y si ya tiene resultado)
  const { data: match } = await admin
    .from('matches')
    .select('id, result_team1, result_team2')
    .eq('id', matchId)
    .single();
  if (!match) {
    return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 });
  }

  // 3) Borrado
  if (isDelete) {
    const { error } = await admin
      .from('predictions')
      .delete()
      .eq('match_id', matchId)
      .eq('user_id', userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Si el partido tenía resultado, recalcular para limpiar puntos
    if (match.result_team1 != null && match.result_team2 != null) {
      try {
        await recalculateMatchPoints(admin, matchId);
      } catch {}
    }
    return NextResponse.json({ ok: true, deleted: true });
  }

  // 4) Crear o editar
  const pred1 = Number(body.pred1);
  const pred2 = Number(body.pred2);
  if (
    Number.isNaN(pred1) || Number.isNaN(pred2) ||
    pred1 < 0 || pred2 < 0 || pred1 > 30 || pred2 > 30
  ) {
    return NextResponse.json({ error: 'Marcador inválido' }, { status: 400 });
  }

  // El usuario debe existir y estar aprobado (para no crear predicciones huérfanas)
  const { data: targetProfile } = await admin
    .from('profiles')
    .select('id, approved')
    .eq('id', userId)
    .single();
  if (!targetProfile) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  const { error: upsertErr } = await admin.from('predictions').upsert(
    {
      user_id: userId,
      match_id: matchId,
      pred_team1: pred1,
      pred_team2: pred2,
    },
    { onConflict: 'user_id,match_id' }
  );
  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  // 5) Si el partido ya tiene resultado, recalcular puntos
  if (match.result_team1 != null && match.result_team2 != null) {
    try {
      await recalculateMatchPoints(admin, matchId);
    } catch (e: any) {
      return NextResponse.json(
        { ok: true, warning: 'Guardado, pero falló el recálculo: ' + (e?.message ?? '') },
        { status: 200 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}
