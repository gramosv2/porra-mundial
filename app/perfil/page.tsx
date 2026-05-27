import { AppShell, requireApprovedUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ProfileEditor } from './profile-editor';
import { UserCard } from '@/components/user-card';

export const dynamic = 'force-dynamic';

export default async function PerfilPage() {
  const profile = await requireApprovedUser();
  const supabase = createClient();

  // Calcular rank y total players, y partidos predichos por el usuario
  const { count: totalPlayers } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('approved', true);

  // Rank actual: cuántos perfiles aprobados tienen MÁS puntos
  const { count: above } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('approved', true)
    .gt('total_points', profile.total_points);
  const rank = (above ?? 0) + 1;

  // Partidos con predicción de este usuario (denominador para %)
  const { count: predictedCount } = await supabase
    .from('predictions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', profile.id);

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="font-display text-4xl font-bold">Mi perfil</h1>
        <p className="text-text-muted text-sm mt-1">
          Sube una foto y escribe tu bio. Aparecerá en tu tarjeta para el resto del grupo.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr,360px] gap-8">
        {/* Editor */}
        <div className="order-2 lg:order-1">
          <ProfileEditor profile={profile} />
        </div>

        {/* Preview de la tarjeta */}
        <div className="order-1 lg:order-2">
          <div className="sticky top-24">
            <div className="text-xs uppercase tracking-widest text-text-muted mb-3 text-center">
              Vista previa
            </div>
            <UserCard
              profile={profile}
              rank={rank}
              totalPlayers={totalPlayers ?? 1}
              totalPredicted={predictedCount ?? 0}
              compact
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
