import { createClient, createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { AdminCuadroClient } from './admin-cuadro-client';
import { resolveRealMatchup } from '@/lib/bracket-engine';
import { BRACKET_SLOTS } from '@/config/bracket';
import type { BracketSlot, BracketPrediction } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Igual que en /admin/predicciones: PostgREST trunca silenciosamente a
 * 1000 filas por defecto. Paginamos con .range() para traer SIEMPRE todas
 * las predicciones del cuadro de todos los usuarios, sin recorte oculto.
 */
async function fetchAllBracketPredictions(
  admin: ReturnType<typeof createAdminClient>
): Promise<BracketPrediction[]> {
  const PAGE_SIZE = 1000;
  let from = 0;
  let all: BracketPrediction[] = [];

  while (true) {
    const { data, error } = await admin
      .from('bracket_predictions')
      .select('*')
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error('Error paginando bracket_predictions:', error.message);
      break;
    }
    if (!data || data.length === 0) break;

    all = all.concat(data as BracketPrediction[]);

    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}

export default async function AdminCuadroPage() {
  await requireAdmin();
  const supabase = createClient();
  const admin = createAdminClient();

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

  const allPreds = await fetchAllBracketPredictions(admin);

  const counts: Record<string, number> = {};
  for (const row of allPreds) {
    counts[row.slot_id] = (counts[row.slot_id] ?? 0) + 1;
  }

  // Predicciones agrupadas por usuario, para el desplegable "ver/editar
  // el cuadro de cada usuario".
  const byUser = new Map<string, BracketPrediction[]>();
  for (const p of allPreds) {
    const arr = byUser.get(p.user_id) ?? [];
    arr.push(p);
    byUser.set(p.user_id, arr);
  }

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, username, display_name, avatar_url, total_points, bracket_points')
    .eq('approved', true)
    .order('display_name', { ascending: true });

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
      profiles={
        (profiles ?? []) as Array<{
          id: string;
          username: string;
          display_name: string;
          avatar_url: string | null;
          total_points: number;
          bracket_points: number;
        }>
      }
      predsByUserEntries={Array.from(byUser.entries())}
    />
  );
}
