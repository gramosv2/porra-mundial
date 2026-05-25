'use client';

import { useState } from 'react';
import { MatchCard } from '@/components/match-card';
import { Card } from '@/components/ui';
import { PHASE_LABELS, type Phase } from '@/config/scoring';
import { cn } from '@/lib/utils';
import type { Match, Prediction } from '@/types';

const PHASES: Phase[] = ['grupos', 'r32', 'r16', 'cuartos', 'semis', 'tercero', 'final'];
const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

interface Props {
  matches: Match[];
  userId: string;
  predsByMatchEntries: Array<[number, Prediction]>;
  othersByMatchEntries: Array<[number, any[]]>;
  initialPhase?: string;
  initialGroup?: string;
}

export function PartidosClient({
  matches,
  userId,
  predsByMatchEntries,
  othersByMatchEntries,
  initialPhase,
  initialGroup,
}: Props) {
  const [phase, setPhase] = useState<Phase>((initialPhase as Phase) ?? 'grupos');
  const [group, setGroup] = useState<string>(initialGroup ?? 'A');

  const predsByMatch = new Map(predsByMatchEntries);
  const othersByMatch = new Map(othersByMatchEntries);

  const filtered = matches.filter((m) => {
    if (m.phase !== phase) return false;
    if (phase === 'grupos' && m.group_name !== group) return false;
    return true;
  });

  return (
    <div>
      {/* Phase tabs */}
      <div className="flex flex-wrap gap-2 mb-4 overflow-x-auto pb-2">
        {PHASES.map((p) => (
          <button
            key={p}
            onClick={() => setPhase(p)}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap',
              phase === p
                ? 'bg-accent text-black'
                : 'bg-surface border border-border text-text-muted hover:text-text hover:border-accent/50'
            )}
          >
            {PHASE_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Group sub-tabs (solo en fase de grupos) */}
      {phase === 'grupos' && (
        <div className="flex flex-wrap gap-2 mb-6 overflow-x-auto pb-2 border-b border-border">
          {GROUPS.map((g) => (
            <button
              key={g}
              onClick={() => setGroup(g)}
              className={cn(
                'px-3.5 py-1.5 rounded-md text-sm font-display font-bold',
                group === g
                  ? 'bg-surface-2 text-accent border-b-2 border-accent'
                  : 'text-text-muted hover:text-text'
              )}
            >
              {g}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <Card>
          <p className="text-text-muted text-sm text-center py-6">
            No hay partidos en esta sección todavía.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              userId={userId}
              userPrediction={predsByMatch.get(m.id) ?? null}
              allPredictions={othersByMatch.get(m.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
