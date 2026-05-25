import { createClient } from '@/lib/supabase/server';
import { MatchesAdminClient } from './matches-client';
import type { Match } from '@/types';

export const dynamic = 'force-dynamic';

export default async function AdminMatchesPage() {
  const supabase = createClient();

  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .order('match_date', { ascending: true });

  // Conteo de predicciones por partido para mostrar contexto
  const { data: predictionsCount } = await supabase
    .from('predictions')
    .select('match_id');

  const counts: Record<number, number> = {};
  for (const p of predictionsCount ?? []) {
    counts[p.match_id] = (counts[p.match_id] ?? 0) + 1;
  }

  return (
    <MatchesAdminClient
      matches={(matches ?? []) as Match[]}
      predictionCounts={counts}
    />
  );
}
