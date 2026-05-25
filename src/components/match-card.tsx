'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Badge, Card, Input, PulseDot } from './ui';
import { formatMadridDate, teamES, teamFlag, timeUntil, cn } from '@/lib/utils';
import type { Match, Prediction } from '@/types';

interface MatchCardProps {
  match: Match;
  userId: string;
  userPrediction?: Prediction | null;
  /** Predicciones del resto, sólo si finished */
  allPredictions?: Array<{
    user_id: string;
    display_name: string;
    pred_team1: number;
    pred_team2: number;
    points_earned: number;
  }>;
}

export function MatchCard({ match, userId, userPrediction, allPredictions }: MatchCardProps) {
  const [p1, setP1] = useState<string>(userPrediction?.pred_team1?.toString() ?? '');
  const [p2, setP2] = useState<string>(userPrediction?.pred_team2?.toString() ?? '');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const supabase = createClient();
  const isOpen = match.status === 'open';
  const isClosed = match.status === 'closed';
  const isFinished = match.status === 'finished';

  const save = async () => {
    if (p1 === '' || p2 === '') return;
    const a = parseInt(p1, 10);
    const b = parseInt(p2, 10);
    if (Number.isNaN(a) || Number.isNaN(b) || a < 0 || b < 0 || a > 30 || b > 30) {
      setError('Goles inválidos');
      return;
    }
    setError(null);

    startTransition(async () => {
      const { error } = await supabase.from('predictions').upsert(
        {
          user_id: userId,
          match_id: match.id,
          pred_team1: a,
          pred_team2: b,
        },
        { onConflict: 'user_id,match_id' }
      );
      if (error) {
        setError('Error al guardar');
      } else {
        setSavedAt(Date.now());
        setTimeout(() => setSavedAt(null), 2000);
      }
    });
  };

  const userHit = userPrediction
    ? userPrediction.pred_team1 === match.result_team1 && userPrediction.pred_team2 === match.result_team2
      ? 'exact'
      : Math.sign(userPrediction.pred_team1 - userPrediction.pred_team2) ===
        Math.sign((match.result_team1 ?? 0) - (match.result_team2 ?? 0))
      ? 'result'
      : 'miss'
    : null;

  return (
    <Card className="relative overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {isOpen && (
            <Badge variant="open">
              <PulseDot /> Abierto
            </Badge>
          )}
          {isClosed && <Badge variant="closed">Cerrado</Badge>}
          {isFinished && <Badge variant="finished">Finalizado</Badge>}
          {match.group_name && (
            <Badge variant="default">
              Grupo {match.group_name} · J{match.matchday}
            </Badge>
          )}
        </div>
        {isOpen && (
          <span className="text-[10px] text-text-muted font-medium">{timeUntil(match.match_date)}</span>
        )}
      </div>

      <div className="text-[11px] text-text-muted mb-3">
        {formatMadridDate(match.match_date)} · {match.venue ?? 'Sede TBD'}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        {/* Team 1 */}
        <div className="text-right">
          <div className="text-2xl mb-1">{teamFlag(match.team1)}</div>
          <div className="font-semibold text-sm leading-tight">{teamES(match.team1)}</div>
        </div>

        {/* Score / inputs */}
        <div className="flex items-center gap-1.5 px-2">
          {isOpen ? (
            <>
              <Input
                inputMode="numeric"
                pattern="[0-9]*"
                value={p1}
                onChange={(e) => setP1(e.target.value.replace(/\D/g, ''))}
                onBlur={save}
                className="w-12 text-center text-lg font-display font-bold !px-0"
                maxLength={2}
              />
              <span className="text-text-muted">–</span>
              <Input
                inputMode="numeric"
                pattern="[0-9]*"
                value={p2}
                onChange={(e) => setP2(e.target.value.replace(/\D/g, ''))}
                onBlur={save}
                className="w-12 text-center text-lg font-display font-bold !px-0"
                maxLength={2}
              />
            </>
          ) : isFinished ? (
            <div className="text-center">
              <div className="font-display text-2xl font-bold tabular-nums">
                {match.result_team1} <span className="text-text-muted">–</span> {match.result_team2}
              </div>
            </div>
          ) : (
            <div className="text-text-muted font-display text-xl">vs</div>
          )}
        </div>

        {/* Team 2 */}
        <div className="text-left">
          <div className="text-2xl mb-1">{teamFlag(match.team2)}</div>
          <div className="font-semibold text-sm leading-tight">{teamES(match.team2)}</div>
        </div>
      </div>

      {/* Feedback línea */}
      <div className="mt-3 min-h-[20px] text-xs flex items-center justify-between">
        {pending && <span className="text-text-muted">Guardando…</span>}
        {savedAt && <span className="text-accent">✓ Guardado</span>}
        {error && <span className="text-danger">{error}</span>}

        {userPrediction && !isFinished && !pending && !savedAt && (
          <span className="text-text-muted">
            Tu predicción: <span className="text-text font-semibold">{userPrediction.pred_team1}–{userPrediction.pred_team2}</span>
          </span>
        )}

        {isFinished && userPrediction && (
          <div className="flex items-center justify-between w-full">
            <span className="text-text-muted">
              Tu predicción: <span className="text-text font-semibold">{userPrediction.pred_team1}–{userPrediction.pred_team2}</span>
            </span>
            <Badge
              variant={userHit === 'exact' ? 'accent' : userHit === 'result' ? 'gold' : 'danger'}
            >
              {userHit === 'exact' ? `+${userPrediction.points_earned} EXACTO`
                : userHit === 'result' ? `+${userPrediction.points_earned} ganador`
                : '0 puntos'}
            </Badge>
          </div>
        )}

        {isFinished && !userPrediction && (
          <span className="text-text-muted italic">No predijiste este partido</span>
        )}
      </div>

      {/* Predicciones de los demás (solo si finished) */}
      {isFinished && allPredictions && allPredictions.length > 0 && (
        <details className="mt-3 pt-3 border-t border-border group">
          <summary className="cursor-pointer text-xs text-text-muted hover:text-text list-none flex items-center justify-between">
            <span>Ver predicciones de todos ({allPredictions.length})</span>
            <span className="group-open:rotate-180 transition-transform">▾</span>
          </summary>
          <div className="mt-3 space-y-1.5">
            {allPredictions
              .filter((p) => p.user_id !== userId)
              .sort((a, b) => b.points_earned - a.points_earned)
              .map((p) => {
                const isExact = p.pred_team1 === match.result_team1 && p.pred_team2 === match.result_team2;
                return (
                  <div key={p.user_id} className="flex items-center justify-between text-xs py-1">
                    <span className="text-text-muted">{p.display_name}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-text">{p.pred_team1}–{p.pred_team2}</span>
                      <span className={cn('font-bold w-10 text-right', p.points_earned > 0 ? isExact ? 'text-accent' : 'text-gold' : 'text-text-muted')}>
                        +{p.points_earned}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </details>
      )}
    </Card>
  );
}
