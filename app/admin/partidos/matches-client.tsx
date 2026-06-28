'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, Badge, Input, PulseDot } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { formatMadridDate, formatMadridTime, teamFlag, teamES } from '@/lib/utils';
import { PHASE_LABELS } from '@/config/scoring';
import type { Match, MatchStatus } from '@/types';

// Las eliminatorias (r32/r16/cuartos/semis/tercero/final) ahora se gestionan
// desde el cuadro dinámico (/admin/cuadro). Este panel solo gestiona grupos.
const PHASES: Array<{ id: Match['phase']; label: string }> = [
  { id: 'grupos', label: PHASE_LABELS.grupos },
];

interface Props {
  matches: Match[];
  predictionCounts: Record<number, number>;
  openRounds: string[];
}

export function MatchesAdminClient({ matches, predictionCounts, openRounds }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [phase, setPhase] = useState<Match['phase']>('grupos');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [rounds, setRounds] = useState<string[]>(openRounds);
  const [togglingRound, setTogglingRound] = useState<string | null>(null);

  const filtered = useMemo(
    () => matches.filter((m) => m.phase === phase),
    [matches, phase]
  );

  const currentRoundOpen = rounds.includes(phase);

  async function toggleRound(targetPhase: string, open: boolean) {
    setTogglingRound(targetPhase);
    const res = await fetch('/api/admin/toggle-round', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase: targetPhase, open }),
    });
    setTogglingRound(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert('Error: ' + (data.error ?? 'desconocido'));
      return;
    }
    const data = await res.json();
    setRounds(data.open_rounds ?? []);
    startTransition(() => router.refresh());
  }

  async function setStatus(matchId: number, status: MatchStatus) {
    setBusyId(matchId);
    const { error } = await supabase.from('matches').update({ status }).eq('id', matchId);
    setBusyId(null);
    if (error) {
      alert('Error: ' + error.message);
      return;
    }
    startTransition(() => router.refresh());
  }

  async function saveResult(match: Match, t1: number, t2: number) {
    setBusyId(match.id);
    // 1) Guardar resultado y marcar finished
    const { error } = await supabase
      .from('matches')
      .update({
        result_team1: t1,
        result_team2: t2,
        status: 'finished',
      })
      .eq('id', match.id);

    if (error) {
      setBusyId(null);
      alert('Error guardando resultado: ' + error.message);
      return;
    }

    // 2) Recalcular puntos vía API interna (necesita service role)
    const res = await fetch('/api/admin/recalculate-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId: match.id }),
    });

    setBusyId(null);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(
        'Resultado guardado pero el recálculo falló: ' +
          (data.error ?? 'Error desconocido') +
          '. Puedes reintentar manualmente.'
      );
    }
    startTransition(() => router.refresh());
  }

  async function syncWithApi() {
    const secret = prompt(
      'Introduce el SYNC_SECRET para sincronizar con football-data.org:'
    );
    if (!secret) return;
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch('/api/sync-results', {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}` },
      });
      const data = await res.json();
      if (res.ok) {
        setSyncMessage(`✓ Sincronización completa. ${data.updated} partidos actualizados.`);
      } else {
        setSyncMessage(`✗ Error: ${data.error ?? 'Desconocido'}`);
      }
    } catch (e: any) {
      setSyncMessage(`✗ Error de red: ${e.message}`);
    }
    setSyncing(false);
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Sync */}
      <Card className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-lg font-semibold mb-1">Sincronización con API</h2>
          <p className="text-sm text-text-muted">
            Importa resultados de partidos finalizados desde football-data.org.
          </p>
        </div>
        <Button onClick={syncWithApi} disabled={syncing}>
          {syncing ? 'Sincronizando…' : 'Sincronizar ahora'}
        </Button>
      </Card>
      {syncMessage && (
        <div
          className={
            syncMessage.startsWith('✓')
              ? 'rounded-card border border-accent/30 bg-accent/10 text-accent px-4 py-3 text-sm'
              : 'rounded-card border border-danger/30 bg-danger/10 text-danger px-4 py-3 text-sm'
          }
        >
          {syncMessage}
        </div>
      )}

      {/* Phase tabs (solo si hay más de una fase disponible) */}
      {PHASES.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2">
          {PHASES.map((p) => {
            const active = phase === p.id;
            const isOpen = rounds.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => setPhase(p.id)}
                className={
                  'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border flex items-center gap-1.5 ' +
                  (active
                    ? 'bg-accent text-black border-accent'
                    : 'bg-surface text-text-muted border-border hover:text-text hover:border-border')
                }
              >
                <span
                  className={
                    'w-1.5 h-1.5 rounded-full ' +
                    (isOpen
                      ? active
                        ? 'bg-black'
                        : 'bg-accent'
                      : active
                        ? 'bg-black/40'
                        : 'bg-text-muted/40')
                  }
                  title={isOpen ? 'Predicciones abiertas' : 'Predicciones cerradas'}
                />
                {p.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Control de apertura de la ronda actual */}
      <div
        className={
          'rounded-card border px-4 py-3 flex items-center justify-between gap-3 flex-wrap ' +
          (currentRoundOpen
            ? 'border-accent/30 bg-accent/5'
            : 'border-border bg-surface')
        }
      >
        <div className="flex items-center gap-2 text-sm">
          <span className="text-lg">{currentRoundOpen ? '🔓' : '🔒'}</span>
          <div>
            <div className="font-medium">
              Predicciones de {PHASES.find((p) => p.id === phase)?.label}:{' '}
              <span className={currentRoundOpen ? 'text-accent' : 'text-text-muted'}>
                {currentRoundOpen ? 'ABIERTAS' : 'CERRADAS'}
              </span>
            </div>
            <div className="text-xs text-text-muted">
              {currentRoundOpen
                ? 'Los usuarios pueden hacer y editar sus predicciones de esta ronda.'
                : 'Los usuarios ven los partidos pero no pueden predecir esta ronda.'}
            </div>
          </div>
        </div>
        <Button
          onClick={() => toggleRound(phase, !currentRoundOpen)}
          disabled={togglingRound === phase}
          variant={currentRoundOpen ? 'danger' : 'primary'}
          size="sm"
        >
          {togglingRound === phase
            ? '…'
            : currentRoundOpen
              ? '🔒 Cerrar ronda'
              : '🔓 Abrir ronda'}
        </Button>
      </div>

      {/* Match list */}
      <div className="grid gap-3">
        {filtered.length === 0 && (
          <Card>
            <p className="text-text-muted text-center py-6">No hay partidos en esta fase.</p>
          </Card>
        )}

        {filtered.map((m) => (
          <MatchAdminRow
            key={m.id}
            match={m}
            predictionCount={predictionCounts[m.id] ?? 0}
            busy={busyId === m.id}
            onSetStatus={setStatus}
            onSaveResult={saveResult}
          />
        ))}
      </div>
    </div>
  );
}

function MatchAdminRow({
  match,
  predictionCount,
  busy,
  onSetStatus,
  onSaveResult,
}: {
  match: Match;
  predictionCount: number;
  busy: boolean;
  onSetStatus: (id: number, s: MatchStatus) => void;
  onSaveResult: (m: Match, t1: number, t2: number) => void;
}) {
  const [t1, setT1] = useState<string>(match.result_team1?.toString() ?? '');
  const [t2, setT2] = useState<string>(match.result_team2?.toString() ?? '');

  function submit() {
    const n1 = parseInt(t1, 10);
    const n2 = parseInt(t2, 10);
    if (Number.isNaN(n1) || Number.isNaN(n2) || n1 < 0 || n2 < 0) {
      alert('Introduce un resultado válido.');
      return;
    }
    if (!confirm(`Guardar ${match.team1} ${n1}-${n2} ${match.team2}? Se recalcularán los puntos.`))
      return;
    onSaveResult(match, n1, n2);
  }

  const statusVariant: 'open' | 'closed' | 'finished' =
    match.status === 'open' ? 'open' : match.status === 'finished' ? 'finished' : 'closed';

  return (
    <Card>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={statusVariant}>
            {match.status === 'open' && <PulseDot />}
            {match.status === 'open'
              ? 'Abierto'
              : match.status === 'closed'
                ? 'Cerrado'
                : 'Finalizado'}
          </Badge>
          {match.group_name && <Badge>Grupo {match.group_name}</Badge>}
          {match.matchday && <Badge>J{match.matchday}</Badge>}
          <span className="text-xs text-text-muted">
            {formatMadridDate(match.match_date)} · {formatMadridTime(match.match_date)}
          </span>
        </div>
        <span className="text-xs text-text-muted">
          {predictionCount} {predictionCount === 1 ? 'predicción' : 'predicciones'}
        </span>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 text-right">
          <div className="font-medium">
            {teamFlag(match.team1)} {teamES(match.team1)}
          </div>
        </div>
        <div className="text-text-muted text-sm">vs</div>
        <div className="flex-1 text-left">
          <div className="font-medium">
            {teamES(match.team2)} {teamFlag(match.team2)}
          </div>
        </div>
      </div>

      {match.venue && (
        <div className="text-xs text-text-muted mb-3">📍 {match.venue}</div>
      )}

      {/* Acciones según status */}
      {match.status === 'open' && (
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onSetStatus(match.id, 'closed')}
            disabled={busy}
          >
            Cerrar predicciones
          </Button>
        </div>
      )}

      {match.status === 'closed' && (
        <div className="space-y-3">
          <div className="flex gap-2 items-center justify-center">
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={20}
              value={t1}
              onChange={(e) => setT1(e.target.value)}
              className="w-16 text-center text-lg font-display"
              placeholder="0"
            />
            <span className="text-text-muted">-</span>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={20}
              value={t2}
              onChange={(e) => setT2(e.target.value)}
              className="w-16 text-center text-lg font-display"
              placeholder="0"
            />
          </div>
          <div className="flex gap-2 flex-wrap justify-center">
            <Button size="sm" onClick={submit} disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar resultado y recalcular'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onSetStatus(match.id, 'open')}
              disabled={busy}
            >
              Reabrir predicciones
            </Button>
          </div>
        </div>
      )}

      {match.status === 'finished' && (
        <div className="space-y-3">
          <div className="text-center">
            <div className="font-display text-3xl font-bold">
              <span>{match.result_team1}</span>
              <span className="text-text-muted mx-3">-</span>
              <span>{match.result_team2}</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex gap-2 items-center justify-center">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={t1}
                onChange={(e) => setT1(e.target.value)}
                className="w-16 text-center text-lg font-display"
              />
              <span className="text-text-muted">-</span>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={t2}
                onChange={(e) => setT2(e.target.value)}
                className="w-16 text-center text-lg font-display"
              />
            </div>
            <div className="flex gap-2 flex-wrap justify-center">
              <Button size="sm" variant="secondary" onClick={submit} disabled={busy}>
                Corregir resultado
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onSetStatus(match.id, 'closed')}
                disabled={busy}
              >
                Volver a cerrado
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
