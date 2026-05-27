import { AppShell, requireApprovedUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ClasificacionClient } from './clasificacion-client';
import type { Profile } from '@/types';

export const dynamic = 'force-dynamic';

export default async function ClasificacionPage() {
  const me = await requireApprovedUser();
  const supabase = createClient();

  const { data: profiles } = await supabase
    .from('profiles')
    .select(
      'id, username, display_name, avatar_url, bio, role, approved, total_points, exact_scores, correct_results, created_at'
    )
    .eq('approved', true)
    .order('total_points', { ascending: false })
    .order('exact_scores', { ascending: false });

  const list = (profiles ?? []) as Profile[];

  // Predicciones por usuario para barra de progreso (denominador)
  const userIds = list.map((p) => p.id);
  const { data: preds } = await supabase
    .from('predictions')
    .select('user_id')
    .in('user_id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000']);
  const predictedByUser: Record<string, number> = {};
  for (const p of preds ?? []) {
    predictedByUser[p.user_id] = (predictedByUser[p.user_id] ?? 0) + 1;
  }

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="font-display text-4xl font-bold">Clasificación</h1>
        <p className="text-text-muted text-sm mt-1">
          {list.length} {list.length === 1 ? 'jugador' : 'jugadores'} · ordenados
          por puntos totales, desempate por marcadores exactos
        </p>
      </div>

      <ClasificacionClient
        myId={me.id}
        profiles={list}
        predictedByUser={predictedByUser}
      />
    </AppShell>
  );
}
