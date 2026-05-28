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
  openRounds: string[];
  initialPhase?: string;
  initialGroup?: string;
  initialPendientes?: boolean;
}

export function PartidosClient({
  matches,
  userId,
  predsByMatchEntries,
  othersByMatchEntries,
  openRounds,
  initialPhase,
  initialGroup,
  initialPendientes,
}: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>((initialPhase as Phase) ?? 'grupos');
  const [group, setGroup] = useState<string>(initialGroup ?? 'A');
  const [onlyPending, setOnlyPending] = useState<boolean>(initialPendientes ?? false);
  const [lockingAll, setLockingAll] = useState(false);
  const [lockResult, setLockResult] = useState<string | null>(null);

  const predsByMatch = new Map(predsByMatchEntries);
  const othersByMatch = new Map(othersByMatchEntries);

  const roundOpen = openRounds.includes(phase);

  // Candidatas a "lock all"
  const lockMs = SCORING_CONFIG.lock_hours_before_match * 60 * 60 * 1000;
  const candidates = matches.filter((m) => {
    if (m.status !== 'open') return false;
    if (!openRounds.includes(m.phase)) return false;
    if (new Date(m.match_date).getTime() - Date.now() < lockMs) return false;
    const pred = predsByMatch.get(m.id);
    return pred && !pred.locked;
  });

  // Partidos pendientes globalmente (abiertos, ronda abierta, sin predicción)
  const pendingMatches = matches.filter((m) => {
    if (m.status !== 'open') return false;
    if (!openRounds.includes(m.phase)) return false;
    return !predsByMatch.has(m.id);
  });

  // Filtro de la vista
  let filtered: Match[];
  if (onlyPending) {
    filtered = pendingMatches;
  } else {
    filtered = matches.filter((m) => {
      if (m.phase !== phase) return false;
      if (phase === 'grupos' && m.group_name !== group) return false;
      return true;
    });
  }

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
      {/* Filtro pendientes + acción global */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <button
          type="button"
          onClick={() => setOnlyPending((v) => !v)}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-colors',
            onlyPending
              ? 'bg-accent text-black border-accent'
              : 'bg-surface border-border text-text-muted hover:text-text hover:border-accent/50'
          )}
        >
          {onlyPending ? '← Ver todos los partidos' : `📋 Predicciones pendientes (${pendingMatches.length})`}
        </button>

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

      {/* Modo pendientes: aviso */}
      {onlyPending ? (
        pendingMatches.length === 0 ? (
          <Card>
            <p className="text-text-muted text-sm text-center py-6">
              🎉 ¡No tienes predicciones pendientes! Has predicho todos los partidos
              disponibles de las rondas abiertas.
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
                roundOpen={openRounds.includes(m.phase)}
              />
            ))}
          </div>
        )
      ) : (
        <>
          {/* Phase tabs */}
          <div className="flex flex-wrap gap-2 mb-4 overflow-x-auto pb-2">
            {PHASES.map((p) => {
              const isOpen = openRounds.includes(p);
              return (
                <button
                  key={p}
                  onClick={() => setPhase(p)}
                  className={cn(
                    'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap flex items-center gap-1.5',
                    phase === p
                      ? 'bg-accent text-black'
                      : 'bg-surface border border-border text-text-muted hover:text-text hover:border-accent/50'
                  )}
                >
                  {!isOpen && <span title="Predicciones cerradas">🔒</span>}
                  {PHASE_LABELS[p]}
                </button>
              );
            })}
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

          {/* Banner ronda cerrada */}
          {!roundOpen && (
            <div className="mb-4 rounded-card border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm flex items-center gap-2">
              <span className="text-lg">🔒</span>
              <span className="text-amber-200">
                Las predicciones de <strong>{PHASE_LABELS[phase]}</strong> están
                cerradas. Podrás predecir cuando el admin abra esta ronda.
              </span>
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
                  roundOpen={roundOpen}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
