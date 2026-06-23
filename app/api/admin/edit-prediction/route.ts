import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { recalculateMatchPoints } from '@/lib/scoring-engine';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/edit-prediction
 *
 * Permite al ADMIN crear, editar o borrar la predicción de cualquier
 * participante para un partido concreto, incluso si el partido ya empezó
 * o terminó. Usa el service role para saltarse la RLS de tiempo/estado
 * que aplica a los usuarios normales.
 *
 * Body:
 *   { matchId, userId, pred1, pred2 }  → crea/edita
 *   { matchId, userId, delete: true }  → borra
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

  // 2) Comprobar que el partido existe
  const { data: match, error: matchErr } = await admin
    .from('matches')
    .select('id, result_team1, result_team2')
    .eq('id', matchId)
    .single();
  if (matchErr || !match) {
    return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 });
  }

  // 3) Borrado
  if (isDelete) {
    const { error, count } = await admin
      .from('predictions')
      .delete({ count: 'exact' })
      .eq('match_id', matchId)
      .eq('user_id', userId);

    if (error) {
      return NextResponse.json({ error: 'Error al borrar: ' + error.message }, { status: 500 });
    }
    if (!count) {
      return NextResponse.json(
        { error: 'No se ha borrado nada (¿no existía esa predicción?)' },
        { status: 404 }
      );
    }

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

  const { data: targetProfile } = await admin
    .from('profiles')
    .select('id, approved')
    .eq('id', userId)
    .single();
  if (!targetProfile) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  // IMPORTANTE: pedimos .select() para que el upsert devuelva la fila escrita.
  // Si esto viene vacío sin error, es señal de que algo (RLS, trigger, o un
  // client mal inicializado) está silenciando la escritura.
  const { data: written, error: upsertErr } = await admin
    .from('predictions')
    .upsert(
      {
        user_id: userId,
        match_id: matchId,
        pred_team1: pred1,
        pred_team2: pred2,
      },
      { onConflict: 'user_id,match_id' }
    )
    .select('id, pred_team1, pred_team2')
    .maybeSingle();

  if (upsertErr) {
    return NextResponse.json({ error: 'Error al guardar: ' + upsertErr.message }, { status: 500 });
  }
  if (!written) {
    // upsert "tuvo éxito" pero no devolvió fila: lo tratamos como fallo
    // explícito en vez de responder ok:true engañosamente.
    return NextResponse.json(
      {
        error:
          'El guardado no se confirmó (no se devolvió ninguna fila). ' +
          'Revisa que SUPABASE_SERVICE_ROLE_KEY esté bien configurada en el entorno.',
      },
      { status: 500 }
    );
  }

  // Verificación extra: confirmar que el valor guardado coincide con el enviado
  if (written.pred_team1 !== pred1 || written.pred_team2 !== pred2) {
    return NextResponse.json(
      { error: 'El valor guardado no coincide con el enviado. Vuelve a intentarlo.' },
      { status: 500 }
    );
  }

  // 5) Si el partido ya tiene resultado, recalcular puntos
  if (match.result_team1 != null && match.result_team2 != null) {
    try {
      await recalculateMatchPoints(admin, matchId);
    } catch (e: any) {
      return NextResponse.json(
        { ok: true, warning: 'Guardado, pero falló el recálculo de puntos: ' + (e?.message ?? '') },
        { status: 200 }
      );
    }
  }

  return NextResponse.json({ ok: true, saved: written });
}
