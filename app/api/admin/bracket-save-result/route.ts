import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { recalculateBracketSlot, resolveRealMatchup } from '@/lib/bracket-engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/admin/bracket-save-result
 * Body: { slotId, resultTeam1, resultTeam2, penaltyWinner?, realAdvancer }
 * `realAdvancer` es el NOMBRE del equipo (en inglés, igual que en `matches`)
 * que avanzó realmente de ronda. El sistema calcula solo el perdedor.
 * Guarda el resultado real de una casilla y dispara el recálculo (puntos +
 * cascada de ramas muertas) para todos los usuarios.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, approved')
    .eq('id', user.id)
    .single();
  if (!profile || profile.role !== 'admin' || !profile.approved) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const slotId = body.slotId as string | undefined;
  const resultTeam1 = Number(body.resultTeam1);
  const resultTeam2 = Number(body.resultTeam2);
  const realAdvancer = (body.realAdvancer as string | undefined)?.trim();
  const penaltyWinner: 1 | 2 | null =
    body.penaltyWinner === 1 || body.penaltyWinner === 2 ? body.penaltyWinner : null;

  if (!slotId || !Number.isFinite(resultTeam1) || !Number.isFinite(resultTeam2)) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }
  if (resultTeam1 === resultTeam2 && penaltyWinner == null) {
    return NextResponse.json(
      { error: 'Resultado empatado: falta indicar quién gana en los penaltis' },
      { status: 400 }
    );
  }
  if (!realAdvancer) {
    return NextResponse.json(
      { error: 'Falta indicar qué equipo avanzó realmente de ronda' },
      { status: 400 }
    );
  }

  try {
    const admin = createAdminClient();

    // Validar que realAdvancer es uno de los dos equipos reales de este cruce.
    const { data: allSlots } = await admin.from('bracket_slots').select('*');
    const matchup = resolveRealMatchup(allSlots ?? [], slotId);
    if (
      matchup.team1 &&
      matchup.team2 &&
      realAdvancer !== matchup.team1 &&
      realAdvancer !== matchup.team2
    ) {
      return NextResponse.json(
        { error: `"${realAdvancer}" no es ninguno de los dos equipos de este cruce (${matchup.team1} / ${matchup.team2})` },
        { status: 400 }
      );
    }
    const realLoser =
      matchup.team1 && matchup.team2
        ? realAdvancer === matchup.team1
          ? matchup.team2
          : matchup.team1
        : null;

    const { error: updErr } = await admin
      .from('bracket_slots')
      .update({
        result_team1: resultTeam1,
        result_team2: resultTeam2,
        real_penalty_winner: resultTeam1 === resultTeam2 ? penaltyWinner : null,
        real_advancer: realAdvancer,
        real_loser: realLoser,
        status: 'finished',
        updated_at: new Date().toISOString(),
      })
      .eq('id', slotId);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    await recalculateBracketSlot(admin, slotId);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error' }, { status: 500 });
  }
}
