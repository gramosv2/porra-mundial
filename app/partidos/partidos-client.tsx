'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MatchCard } from '@/components/match-card';
import { Card } from '@/components/ui';
import { PHASE_LABELS, SCORING_CONFIG, type Phase } from '@/config/scoring';
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
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>((initialPhase as Phase) ?? 'grupos');
  const [group, setGroup] = useState<string>(initialGroup ?? 'A');
  const [lockingAll, setLockingAll] = useState(false);
  const [lockResult, setLockResult] = useState<string | null>(null);

  const predsByMatch = new Map(predsByMatchEntries);
  const othersByMatch = new Map(othersByMatchEntries);

  // Contar cuántas predicciones son candidatas a "lock all" (no lockeadas,
  // partido open, fuera de la ventana mínima)
  const lockMs = SCORING_CONFIG.lock_hours_before_match * 60 * 60 * 1000;
  const candidates = matches.filter((m) => {
    if (m.status !== 'open') return false;
    if (new Date(m.match_date).getTime() - Date.now() < lockMs) return false;
    const pred = predsByMatch.get(m.id);
    return pred && !pred.locked;
  });

  const filtered = matches.filter((m) => {
    if (m.phase !== phase) return false;
    if (phase === 'grupos' && m.group_name !== group) return false;
    return true;
  });

  async function lockAll() {
    if (candidates.length === 0) {
      setLockResult('No hay predicciones pendientes que cerrar.');
      return;
    }
    if (
      !confirm(
        `¿Cerrar ${candidates.length} predicciones pendientes? Podrás reabrirlas mientras falten más de ${SCORING_CONFIG.lock_hours_before_match}h para cada partido.`
      )
    ) {
      return;
    }
    setLockingAll(true);
    setLockResult(null);
    const res = await fetch('/api/predictions/lock-all', { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    setLockingAll(false);
    if (!res.ok) {
      setLockResult('Error: ' + (data.error ?? 'desconocido'));
      return;
    }
    setLockResult(`✓ ${data.locked} predicciones confirmadas.`);
    router.refresh();
  }

  return (
    <div>
      {/* Acción global */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="text-xs text-text-muted">
          {candidates.length > 0 ? (
            <>
              <span className="text-text font-medium">{candidates.length}</span>{' '}
              {candidates.length === 1 ? 'predicción pendiente' : 'predicciones pendientes'} de confirmar
            </>
          ) : (
            'Todas tus predicciones disponibles están confirmadas.'
          )}
        </div>
        <button
          type="button"
          onClick={lockAll}
          disabled={lockingAll || candidates.length === 0}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-colors',
            candidates.length > 0 && !lockingAll
              ? 'bg-accent text-black border-accent hover:bg-accent/90'
              : 'bg-surface border-border text-text-muted opacity-60 cursor-not-allowed'
          )}
        >
          {lockingAll ? '…' : '🔒 Cerrar todas las pendientes'}
        </button>
      </div>
      {lockResult && (
        <div
          className={cn(
            'mb-4 rounded-card border px-4 py-3 text-sm',
            lockResult.startsWith('✓')
              ? 'border-accent/30 bg-accent/10 text-accent'
              : 'border-danger/30 bg-danger/10 text-danger'
          )}
        >
          {lockResult}
        </div>
      )}

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
