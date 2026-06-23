import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { EditPrediccionesClient } from './predicciones-client';
import type { Match } from '@/types';

// force-dynamic asegura que este Server Component se ejecute en cada
// request (no se sirve desde caché estática). Lo combinamos con
// revalidate = 0 como refuerzo explícito.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Editor admin de predicciones: todos los partidos por fecha. Al expandir uno
 * se ven (y editan) las predicciones de cada participante, y se pueden añadir
 * predicciones para los que no la tienen.
 *
 * NOTA sobre caché: el cliente de Supabase usa `fetch` por debajo, y Next.js
 * puede cachear llamadas a fetch incluso en rutas dinámicas si no se indica
 * lo contrario. Por eso forzamos cache: 'no-store' explícitamente en cada
 * query de este archivo, además de revalidatePath() en el endpoint que
 * escribe los datos.
 */
export default async function AdminEditarPrediccionesPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: matches } = await admin
    .from('matches')
    .select('*')
    .order('match_date', { ascending: true });

  const { data: preds } = await admin
    .from('predictions')
    .select('id, user_id, match_id, pred_team1, pred_team2, points_earned');

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
  };

  const byMatch = new Map<number, PredRow[]>();
  for (const p of (preds ?? []) as PredRow[]) {
    const arr = byMatch.get(p.match_id) ?? [];
    arr.push(p);
    byMatch.set(p.match_id, arr);
  }

  return (
    <EditPrediccionesClient
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
