import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { recalculateAllBracketSlots } from '@/lib/bracket-engine';
import { BRACKET_SLOTS_BY_ID } from '@/config/bracket';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/admin/edit-bracket-prediction
 *
 * Acceso "root" del admin: crear, editar o borrar la predicción de
 * CUALQUIER usuario en CUALQUIER casilla del cuadro, sin restricciones de
 * bracket_locked ni de locked individual (igual que /api/admin/edit-prediction
 * hace para la fase de grupos).
 *
 * Tras escribir, recalcula TODO el cuadro (puntos + ramas muertas) porque
 * tocar una predicción a mano puede revivir o matar una rama entera.
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
  const slotId = body.slotId as string | undefined;
  const userId = String(body.userId ?? '');
  const isDelete = body.delete === true;

  if (!slotId || !BRACKET_SLOTS_BY_ID[slotId] || !userId) {
    return NextResponse.json({ error: 'Faltan slotId o userId, o slotId inválido' }, { status: 400 });
  }

  const admin = createAdminClient();

  function revalidateAll() {
    try {
      revalidatePath('/admin/cuadro');
      revalidatePath('/cuadro');
      revalidatePath('/clasificacion');
      revalidatePath('/dashboard');
    } catch {
      // no crítico
    }
  }

  // ---- BORRADO ----
  if (isDelete) {
    const { error, count } = await admin
      .from('bracket_predictions')
      .delete({ count: 'exact' })
      .eq('slot_id', slotId)
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

    try {
      await recalculateAllBracketSlots(admin);
    } catch {}
    revalidateAll();
    return NextResponse.json({ ok: true, deleted: true });
  }

  // ---- CREAR / EDITAR ----
  const pred1 = Number(body.pred1);
  const pred2 = Number(body.pred2);
  const penaltyWinner: 1 | 2 | null =
    body.penaltyWinner === 1 || body.penaltyWinner === 2 ? body.penaltyWinner : null;

  if (
    Number.isNaN(pred1) || Number.isNaN(pred2) ||
    pred1 < 0 || pred2 < 0 || pred1 > 30 || pred2 > 30
  ) {
    return NextResponse.json({ error: 'Marcador inválido' }, { status: 400 });
  }
  if (pred1 === pred2 && penaltyWinner == null) {
    return NextResponse.json(
      { error: 'Empate: falta indicar quién pasa en los penaltis' },
      { status: 400 }
    );
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
    .from('bracket_predictions')
    .upsert(
      {
        user_id: userId,
        slot_id: slotId,
        pred_team1: pred1,
        pred_team2: pred2,
        pred_penalty_winner: pred1 === pred2 ? penaltyWinner : null,
        // Al editarla a mano el admin, la rama queda viva por defecto;
        // el recálculo de abajo la volverá a marcar muerta si corresponde.
        is_dead: false,
      },
      { onConflict: 'user_id,slot_id' }
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

  try {
    await recalculateAllBracketSlots(admin);
  } catch (e: any) {
    revalidateAll();
    return NextResponse.json(
      { ok: true, warning: 'Guardado, pero falló el recálculo: ' + (e?.message ?? '') },
      { status: 200 }
    );
  }

  revalidateAll();
  return NextResponse.json({ ok: true, saved: written });
}
