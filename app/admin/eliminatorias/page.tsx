import { createClient } from '@/lib/supabase/server';
import { EliminatoriasClient } from './eliminatorias-client';
import type { Match } from '@/types';

export const dynamic = 'force-dynamic';

export default async function AdminEliminatoriasPage() {
  const supabase = createClient();

  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .neq('phase', 'grupos')
    .order('match_date', { ascending: true });

  return <EliminatoriasClient matches={(matches ?? []) as Match[]} />;
}
