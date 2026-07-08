import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import {
  recalculateOneUserFull,
  computeRealLifeState,
  readPhaseBonusConfig,
} from '@/lib/bracket-engine';
import type { BracketSlot } from '@/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

/**
 * POST /api/admin/recalculate-user
 * Body: { userId, allSlots?, state?, phaseBonusConfig? }
 *
 * Recalcula el bracket de UN solo usuario. Se llama secuencialmente desde
 * el cliente para cada usuario (en vez de recalcular todos en una sola
 * petición), evitando el timeout de 10s de Vercel Hobby.
 *
 * Si el cliente pasa allSlots/state/phaseBonusConfig precalculados, los
 * usa directamente (ahorra queries a BD). Si no, los calcula aquí.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles').select('role, approved').eq('id', user.id).single();
  if (!profile || profile.role !== 'admin' || !profile.approved) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const userId = body.userId as string | undefined;
  if (!userId) return NextResponse.json({ error: 'Falta userId' }, { status: 400 });

  try {
    const admin = createAdminClient();

    // Leer el contexto desde BD (slots + state + bonus)
    // En Vercel Hobby, 1 usuario tarda ~1-2s → bien bajo el límite de 10s.
    const { data: allSlotsRaw } = await admin.from('bracket_slots').select('*');
    const allSlots = (allSlotsRaw ?? []) as BracketSlot[];
    const state = computeRealLifeState(allSlots);
    const phaseBonusConfig = await readPhaseBonusConfig(admin);

    await recalculateOneUserFull(admin, userId, allSlots, state, phaseBonusConfig);

    return NextResponse.json({ ok: true, userId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error' }, { status: 500 });
  }
}
