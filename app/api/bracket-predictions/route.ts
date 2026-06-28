import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { BRACKET_SLOTS_BY_ID } from '@/config/bracket';

export const dynamic = 'force-dynamic';

interface SlotInput {
  slotId: string;
  predTeam1: number;
  predTeam2: number;
  predPenaltyWinner?: 1 | 2 | null;
}

/**
 * POST /api/bracket-predictions
 * Body: { slots: SlotInput[] }
 * Guarda (upsert) las predicciones del usuario para el cuadro de
 * eliminatorias. Pensado para guardar las 32 casillas de golpe, pero
 * también puede mandar un subconjunto.
 *
 * No usa el cliente admin: pasa por RLS, así que respeta automáticamente
 * `bracket_open()` (rechaza el guardado si el admin cerró el cuadro) y
 * que el usuario esté aprobado.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const slots = body.slots as SlotInput[] | undefined;
  if (!Array.isArray(slots) || slots.length === 0) {
    return NextResponse.json({ error: 'Faltan predicciones' }, { status: 400 });
  }

  const rows: Array<{
    user_id: string;
    slot_id: string;
    pred_team1: number;
    pred_team2: number;
    pred_penalty_winner: 1 | 2 | null;
  }> = [];

  for (const s of slots) {
    if (!s.slotId || !BRACKET_SLOTS_BY_ID[s.slotId]) {
      return NextResponse.json({ error: `Casilla inválida: ${s.slotId}` }, { status: 400 });
    }
    const t1 = Number(s.predTeam1);
    const t2 = Number(s.predTeam2);
    if (!Number.isFinite(t1) || !Number.isFinite(t2) || t1 < 0 || t2 < 0 || t1 > 30 || t2 > 30) {
      return NextResponse.json({ error: `Marcador inválido en ${s.slotId}` }, { status: 400 });
    }
    const penaltyWinner: 1 | 2 | null =
      s.predPenaltyWinner === 1 || s.predPenaltyWinner === 2 ? s.predPenaltyWinner : null;
    if (t1 === t2 && penaltyWinner == null) {
      return NextResponse.json(
        { error: `Empate en ${s.slotId}: falta elegir quién pasa en los penaltis` },
        { status: 400 }
      );
    }
    rows.push({
      user_id: user.id,
      slot_id: s.slotId,
      pred_team1: t1,
      pred_team2: t2,
      pred_penalty_winner: t1 === t2 ? penaltyWinner : null,
    });
  }

  const { error } = await supabase
    .from('bracket_predictions')
    .upsert(rows, { onConflict: 'user_id,slot_id' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, saved: rows.length });
}
