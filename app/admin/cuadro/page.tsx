import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { AdminCuadroClient } from './admin-cuadro-client';
import { resolveRealMatchup } from '@/lib/bracket-engine';
import { BRACKET_SLOTS } from '@/config/bracket';
import type { BracketSlot } from '@/types';

export const dynamic = 'force-dynamic';

export default async function AdminCuadroPage() {
  await requireAdmin();
  const supabase = createClient();

  const { data: slots } = await supabase
    .from('bracket_slots')
    .select('*')
    .order('phase', { ascending: true })
    .order('order_num', { ascending: true });

  const { data: lockSetting } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'bracket_locked')
    .maybeSingle();

  const { data: countsRaw } = await supabase
    .from('bracket_predictions')
    .select('slot_id');

  const counts: Record<string, number> = {};
  for (const row of (countsRaw ?? []) as Array<{ slot_id: string }>) {
    counts[row.slot_id] = (counts[row.slot_id] ?? 0) + 1;
  }

  const slotsList = (slots ?? []) as BracketSlot[];

  // Resolvemos el cruce REAL (equipo1/equipo2) de cada slot a partir de
  // real_advancer/real_loser de sus slots padre, para que el admin vea
  // contra quién juega cada uno sin tener que rastrear el árbol a mano.
  const matchups: Record<string, { team1: string | null; team2: string | null }> = {};
  for (const def of BRACKET_SLOTS) {
    matchups[def.id] = resolveRealMatchup(slotsList, def.id);
  }

  return (
    <AdminCuadroClient
      slots={slotsList}
      bracketLocked={lockSetting?.value === true}
      predictionCounts={counts}
      matchups={matchups}
    />
  );
}
