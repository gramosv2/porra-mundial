import { createClient } from '@/lib/supabase/server';
import { MatchesAdminClient } from './matches-client';
import type { Match } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * El contador de predicciones por partido se calcula con una agregación
 * hecha por la propia base de datos (GROUP BY) en vez de traer todas las
 * filas de `predictions` al servidor de Next.js y contarlas a mano.
 *
 * Motivo: un simple `.select('match_id')` sin agregación trae TODA la tabla,
 * y PostgREST limita cada respuesta a un máximo de filas por defecto (1000).
 * Con la tabla ya por encima de ese tamaño, el conteo manual se queda corto
 * de forma silenciosa. Al pedirle a Postgres que cuente directamente con
 * GROUP BY, el resultado es siempre exacto sin importar cuántas filas haya.
 */
async function fetchPredictionCounts(
  supabase: ReturnType<typeof createClient>
): Promise<Record<number, number>> {
  const { data, error } = await supabase.rpc('count_predictions_per_match');

  if (error) {
    console.error('Error contando predicciones por partido:', error.message);
    return {};
  }

  const counts: Record<number, number> = {};
  for (const row of (data ?? []) as Array<{ match_id: number; total: number }>) {
    counts[row.match_id] = row.total;
  }
  return counts;
}

export default async function AdminMatchesPage() {
  const supabase = createClient();

  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .order('match_date', { ascending: true });

  const counts = await fetchPredictionCounts(supabase);

  const { data: setting } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'open_rounds')
    .maybeSingle();
  const openRounds: string[] = Array.isArray(setting?.value)
    ? (setting!.value as string[])
    : ['grupos'];

  return (
    <MatchesAdminClient
      matches={(matches ?? []) as Match[]}
      predictionCounts={counts}
      openRounds={openRounds}
    />
  );
}
