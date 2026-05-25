import { AppShell, requireApprovedUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Avatar, Card } from '@/components/ui';
import { cn } from '@/lib/utils';

export default async function ClasificacionPage() {
  const profile = await requireApprovedUser();
  const supabase = createClient();

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, username, total_points, exact_scores, correct_results')
    .eq('approved', true)
    .order('total_points', { ascending: false })
    .order('exact_scores', { ascending: false });

  const ranked = (profiles ?? []).map((p, i) => ({ rank: i + 1, ...p }));
  const top3 = ranked.slice(0, 3);
  const rest = ranked.slice(3);
  const myRow = ranked.find((r) => r.id === profile.id);

  // Reordenar top3 visualmente: 2-1-3
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="font-display text-4xl font-bold">Clasificación</h1>
        <p className="text-text-muted text-sm mt-1">
          {ranked.length} jugadores · ordenados por puntos totales, desempate por marcadores exactos
        </p>
      </div>

      {/* Podio */}
      {top3.length > 0 && (
        <section className="mb-10">
          <div className="grid grid-cols-3 gap-3 sm:gap-6 items-end max-w-3xl mx-auto">
            {podiumOrder.map((p, idx) => {
              if (!p) return <div key={idx} />;
              const isFirst = p.rank === 1;
              const isSecond = p.rank === 2;
              const heights = ['h-32', 'h-44', 'h-24'];
              const colors = [
                'bg-gradient-to-b from-zinc-300/20 to-zinc-300/5 border-silver/40',
                'bg-gradient-to-b from-gold/30 to-gold/5 border-gold/60',
                'bg-gradient-to-b from-amber-700/20 to-amber-700/5 border-bronze/40',
              ];
              const visualIdx = isFirst ? 1 : isSecond ? 0 : 2;
              const colorClass = colors[visualIdx];
              const heightClass = heights[visualIdx];
              const medals = ['🥈', '🥇', '🥉'];
              return (
                <div key={p.id} className="flex flex-col items-center">
                  <Avatar name={p.display_name} size={isFirst ? 72 : 56} />
                  <div className="mt-2 text-center">
                    <div className="font-display font-bold text-sm sm:text-base truncate max-w-[120px]">{p.display_name}</div>
                    <div className="text-xs text-text-muted">@{p.username}</div>
                  </div>
                  <div
                    className={cn(
                      'mt-3 w-full rounded-t-card border border-b-0 flex flex-col items-center justify-end p-3 text-center',
                      colorClass,
                      heightClass
                    )}
                  >
                    <div className="text-2xl mb-1">{medals[visualIdx]}</div>
                    <div className="font-display text-2xl sm:text-3xl font-extrabold">{p.total_points}</div>
                    <div className="text-[10px] text-text-muted uppercase tracking-wide">puntos</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Tabla completa */}
      <Card className="!p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-xs text-text-muted uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left w-12">#</th>
              <th className="px-4 py-3 text-left">Jugador</th>
              <th className="px-4 py-3 text-center hidden sm:table-cell">Exactos</th>
              <th className="px-4 py-3 text-center hidden sm:table-cell">Ganadores</th>
              <th className="px-4 py-3 text-right">Puntos</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((p) => {
              const isMe = p.id === profile.id;
              return (
                <tr
                  key={p.id}
                  className={cn(
                    'border-t border-border transition-colors',
                    isMe ? 'bg-accent/10 hover:bg-accent/15' : 'hover:bg-surface-2'
                  )}
                >
                  <td className="px-4 py-3 font-display font-bold text-text-muted">
                    {p.rank <= 3 ? ['🥇', '🥈', '🥉'][p.rank - 1] : `#${p.rank}`}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={p.display_name} size={32} />
                      <div>
                        <div className={cn('font-semibold', isMe && 'text-accent')}>
                          {p.display_name} {isMe && <span className="text-xs">(tú)</span>}
                        </div>
                        <div className="text-xs text-text-muted">@{p.username}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center font-mono hidden sm:table-cell">{p.exact_scores}</td>
                  <td className="px-4 py-3 text-center font-mono hidden sm:table-cell">{p.correct_results}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-display font-bold text-lg">{p.total_points}</span>
                    <span className="text-xs text-text-muted ml-1">pts</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Fila pegajosa de tu posición si no estás visible (sólo si rank > 10) */}
        {myRow && myRow.rank > 10 && (
          <div className="sticky bottom-0 bg-accent/15 border-t-2 border-accent px-4 py-3 flex items-center justify-between text-sm">
            <div className="flex items-center gap-3">
              <span className="font-display font-bold">#{myRow.rank}</span>
              <Avatar name={myRow.display_name} size={28} />
              <span className="font-semibold">Tú</span>
            </div>
            <span className="font-display font-bold">{myRow.total_points} pts</span>
          </div>
        )}
      </Card>
    </AppShell>
  );
}
