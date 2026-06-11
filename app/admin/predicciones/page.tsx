import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { PrediccionesAdminClient } from './predicciones-client';
import type { Match } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * Vista admin: todos los partidos ordenados por fecha. Al hacer clic en uno
 * se despliegan las predicciones de TODOS los participantes (incluso si el
 * partido no ha terminado, por eso usamos el admin client: la RLS normal
 * oculta las predicciones ajenas hasta que el partido esté 'finished').
 */
export default async function AdminPrediccionesPage() {
  await requireAdmin();
  const admin = createAdminClient();

  // 1) Todos los partidos ordenados por fecha
  const { data: matches } = await admin
    .from('matches')
    .select('*')
    .order('match_date', { ascending: true });

  // 2) Todas las predicciones (admin client => sin restricción RLS)
  const { data: preds } = await admin
    .from('predictions')
    .select('id, user_id, match_id, pred_team1, pred_team2, points_earned, locked, submitted_at');

  // 3) Perfiles aprobados (para nombres y para saber quién NO ha predicho)
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .eq('approved', true)
    .order('display_name', { ascending: true });

  type PredRow = {
    id: number;
    user_id: string;
    match_id: number;
    pred_team1: number;
    pred_team2: number;
    points_earned: number;
    locked: boolean;
    submitted_at: string;
  };

  // Agrupar predicciones por partido (serializable como entries)
  const byMatch = new Map<number, PredRow[]>();
  for (const p of (preds ?? []) as PredRow[]) {
    const arr = byMatch.get(p.match_id) ?? [];
    arr.push(p);
    byMatch.set(p.match_id, arr);
  }

  return (
    <PrediccionesAdminClient
      matches={(matches ?? []) as Match[]}
      predsByMatchEntries={Array.from(byMatch.entries())}
      profiles={
        (profiles ?? []) as Array<{
          id: string;
          username: string;
          display_name: string;
          avatar_url: string | null;
        }>
      }
    />
  );
}
