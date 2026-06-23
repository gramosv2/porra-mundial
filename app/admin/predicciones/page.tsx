import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { EditPrediccionesClient } from './predicciones-client';
import type { Match } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PredRow = {
  id: number;
  user_id: string;
  match_id: number;
  pred_team1: number;
  pred_team2: number;
  points_earned: number;
};

/**
 * PostgREST (la API que usa Supabase) limita cada respuesta a un máximo de
 * filas por defecto (1000 en la config estándar). Como la tabla `predictions`
 * ya supera ese número de filas en total, un simple `.select()` sin rango
 * se trunca SILENCIOSAMENTE: no da error, simplemente devuelve menos filas
 * de las que existen. El recorte cae en partidos "al azar" según el orden
 * físico de la tabla, lo que explica por qué algunos participantes parecían
 * "sin predicción" en el panel aunque su fila existiera en la BD.
 *
 * Esta función pagina explícitamente con `.range()` hasta traer todas las
 * filas, sin depender de ningún límite implícito.
 */
async function fetchAllPredictions(admin: ReturnType<typeof createAdminClient>) {
  const PAGE_SIZE = 1000;
  let from = 0;
  let all: PredRow[] = [];

  while (true) {
    const { data, error } = await admin
      .from('predictions')
      .select('id, user_id, match_id, pred_team1, pred_team2, points_earned')
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error('Error paginando predictions:', error.message);
      break;
    }
    if (!data || data.length === 0) break;

    all = all.concat(data as PredRow[]);

    if (data.length < PAGE_SIZE) break; // última página
    from += PAGE_SIZE;
  }

  return all;
}

/**
 * Editor admin de predicciones: todos los partidos por fecha. Al expandir uno
 * se ven (y editan) las predicciones de cada participante, y se pueden añadir
 * predicciones para los que no la tienen.
 */
export default async function AdminEditarPrediccionesPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: matches } = await admin
    .from('matches')
    .select('*')
    .order('match_date', { ascending: true });

  const preds = await fetchAllPredictions(admin);

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .eq('approved', true)
    .order('display_name', { ascending: true });

  const byMatch = new Map<number, PredRow[]>();
  for (const p of preds) {
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
