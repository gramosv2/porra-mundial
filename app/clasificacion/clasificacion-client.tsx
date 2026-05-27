'use client';

import { useState } from 'react';
import { UserCard } from '@/components/user-card';
import { Avatar, Card } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { Profile } from '@/types';

interface Props {
  myId: string;
  profiles: Profile[];
  predictedByUser: Record<string, number>;
}

export function ClasificacionClient({ myId, profiles, predictedByUser }: Props) {
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const total = profiles.length;

  return (
    <div>
      {/* Toggle vista */}
      <div className="flex items-center justify-end gap-2 mb-6">
        <span className="text-xs text-text-muted">Vista:</span>
        <div className="flex bg-surface-2 rounded-full p-1">
          <button
            type="button"
            onClick={() => setView('cards')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-full transition-colors',
              view === 'cards' ? 'bg-accent text-black' : 'text-text-muted'
            )}
          >
            🃏 Tarjetas
          </button>
          <button
            type="button"
            onClick={() => setView('table')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-full transition-colors',
              view === 'table' ? 'bg-accent text-black' : 'text-text-muted'
            )}
          >
            📋 Tabla
          </button>
        </div>
      </div>

      {view === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {profiles.map((p, i) => (
            <div key={p.id} className={cn(p.id === myId && 'ring-2 ring-accent rounded-3xl')}>
              <UserCard
                profile={p}
                rank={i + 1}
                totalPlayers={total}
                totalPredicted={predictedByUser[p.id] ?? 0}
              />
            </div>
          ))}
        </div>
      ) : (
        <TableView profiles={profiles} myId={myId} />
      )}
    </div>
  );
}

function TableView({ profiles, myId }: { profiles: Profile[]; myId: string }) {
  return (
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
          {profiles.map((p, i) => {
            const rank = i + 1;
            const isMe = p.id === myId;
            return (
              <tr
                key={p.id}
                className={cn(
                  'border-t border-border transition-colors',
                  isMe ? 'bg-accent/10 hover:bg-accent/15' : 'hover:bg-surface-2'
                )}
              >
                <td className="px-4 py-3 font-display font-bold text-text-muted">
                  {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `#${rank}`}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {p.avatar_url ? (
                      <img
                        src={p.avatar_url}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <Avatar name={p.display_name} size={32} />
                    )}
                    <div>
                      <div className={cn('font-semibold', isMe && 'text-accent')}>
                        {p.display_name} {isMe && <span className="text-xs">(tú)</span>}
                      </div>
                      <div className="text-xs text-text-muted">@{p.username}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-center font-mono hidden sm:table-cell">
                  {p.exact_scores}
                </td>
                <td className="px-4 py-3 text-center font-mono hidden sm:table-cell">
                  {p.correct_results}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="font-display font-bold text-lg">{p.total_points}</span>
                  <span className="text-xs text-text-muted ml-1">pts</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
