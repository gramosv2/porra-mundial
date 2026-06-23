import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { recalculateMatchPoints } from '@/lib/scoring-engine';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/edit-prediction
 *
 * ACCESO "ROOT" DEL ADMIN: permite crear, editar o borrar la predicción de
 * CUALQUIER participante para CUALQUIER partido, sin importar:
 *   - si el partido ya empezó (match_date pasado)
 *   - el status del partido (open / closed / finished)
 *   - si el perfil del usuario está aprobado o no
 *   - si la predicción estaba "locked" (confirmada) por el propio usuario
 *
 * Usa el service role (createAdminClient), que ignora la RLS por completo.
 * Esta ruta NO debe añadir ninguna comprobación de tiempo/estado/lock: es
 * intencionadamente la vía de "corrección manual" para el admin por encima
 * de cualquier regla que apliquemos a los usuarios normales.
 *
 * Body:
 *   { matchId, userId, pred1, pred2 }  → crea/edita (sin restricciones)
 *   { matchId, userId, delete: true }  → borra (sin restricciones)
 */
export async function POST(req: NextRequest) {
  // Única comprobación que SÍ se mantiene: que quien llama sea admin.
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

  // Solo comprobamos que el partido EXISTE. Da igual su status o su fecha.
  const { data: match, error: matchErr } = await admin
    .from('matches')
    .select('id, result_team1, result_team2')
    .eq('id', matchId)
    .single();
  if (matchErr || !match) {
    return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 });
  }

  // ---- BORRADO (sin restricciones de locked/status/fecha) ----
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

  // ---- CREAR / EDITAR (sin restricciones de locked/status/fecha/approved) ----
  const pred1 = Number(body.pred1);
  const pred2 = Number(body.pred2);
  if (
    Number.isNaN(pred1) || Number.isNaN(pred2) ||
    pred1 < 0 || pred2 < 0 || pred1 > 30 || pred2 > 30
  ) {
    return NextResponse.json({ error: 'Marcador inválido' }, { status: 400 });
  }

  // Solo comprobamos que el perfil EXISTE (no exigimos approved=true: el
  // admin puede querer meter la predicción de alguien que aún no ha sido
  // aprobado, que es justo uno de los casos que motivó este editor).
  const { data: targetProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single();
  if (!targetProfile) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  // Nota: NO tocamos `locked` al hacer este upsert. Si la predicción ya
  // estaba confirmada (locked=true) por el usuario, se mantiene tal cual;
  // si quieres que el admin pueda además bloquear/desbloquear, dímelo y
  // añado un campo opcional `locked` al body.
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
    return NextResponse.json(
      {
        error:
          'El guardado no se confirmó (no se devolvió ninguna fila). ' +
          'Revisa que SUPABASE_SERVICE_ROLE_KEY esté bien configurada en el entorno.',
      },
      { status: 500 }
    );
  }
  if (written.pred_team1 !== pred1 || written.pred_team2 !== pred2) {
    return NextResponse.json(
      { error: 'El valor guardado no coincide con el enviado. Vuelve a intentarlo.' },
      { status: 500 }
    );
  }

  // Si el partido ya tiene resultado, recalculamos puntos para que el
  // cambio se refleje también en la clasificación.
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
