import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { recalculateMatchPoints } from '@/lib/scoring-engine';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/edit-prediction
 *
 * Acceso "root" del admin: crear, editar o borrar la predicción de
 * cualquier usuario en cualquier partido, sin restricciones de fecha,
 * status o locked.
 *
 * IMPORTANTE: además de escribir en la BD, llamamos a revalidatePath()
 * para invalidar explícitamente la caché de Server Components de Next.js
 * en las rutas que muestran predicciones. Sin esto, router.refresh() en
 * el cliente puede seguir recibiendo una versión cacheada del RSC aunque
 * el dato en Supabase ya esté actualizado (justo el síntoma reportado:
 * "en la BD está bien pero no se refleja en la web").
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
  const userId = String(body.userId ?? '');
  const isDelete = body.delete === true;

  if (!matchId || !userId) {
    return NextResponse.json({ error: 'Faltan matchId o userId' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: match, error: matchErr } = await admin
    .from('matches')
    .select('id, result_team1, result_team2')
    .eq('id', matchId)
    .single();
  if (matchErr || !match) {
    return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 });
  }

  function revalidateAll() {
    // Invalida explícitamente todas las rutas que puedan mostrar
    // predicciones, para que el siguiente render del servidor lea
    // datos frescos de Supabase sin depender de la caché de fetch.
    try {
      revalidatePath('/admin/predicciones');
      revalidatePath('/mis-predicciones');
      revalidatePath('/partidos');
      revalidatePath('/clasificacion');
      revalidatePath('/dashboard');
    } catch {
      // revalidatePath puede lanzar si se llama fuera de una request
      // válida; lo ignoramos, no es crítico para la respuesta.
    }
  }

  // ---- BORRADO ----
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
    revalidateAll();
    return NextResponse.json({ ok: true, deleted: true });
  }

  // ---- CREAR / EDITAR ----
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
    .select('id')
    .eq('id', userId)
    .single();
  if (!targetProfile) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

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
      { error: 'El guardado no se confirmó (no se devolvió ninguna fila).' },
      { status: 500 }
    );
  }
  if (written.pred_team1 !== pred1 || written.pred_team2 !== pred2) {
    return NextResponse.json(
      { error: 'El valor guardado no coincide con el enviado. Vuelve a intentarlo.' },
      { status: 500 }
    );
  }

  if (match.result_team1 != null && match.result_team2 != null) {
    try {
      await recalculateMatchPoints(admin, matchId);
    } catch (e: any) {
      revalidateAll();
      return NextResponse.json(
        { ok: true, warning: 'Guardado, pero falló el recálculo: ' + (e?.message ?? '') },
        { status: 200 }
      );
    }
  }

  revalidateAll();
  return NextResponse.json({ ok: true, saved: written });
}
