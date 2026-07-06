'use client';

import { useState, useTransition, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Badge, Avatar, Input } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { teamES, teamFlag, cn } from '@/lib/utils';
import {
  BRACKET_SLOTS,
  BRACKET_PHASE_ORDER,
  BRACKET_PHASE_LABELS,
} from '@/config/bracket';
import {
  UserBracketEditor,
  type ProfileLite,
} from '@/components/admin/bracket-user-editor';
import type { BracketSlot, BracketPrediction } from '@/types';

interface Matchup {
  team1: string | null;
  team2: string | null;
}

interface Props {
  slots: BracketSlot[];
  bracketLocked: boolean;
  predictionCounts: Record<string, number>;
  matchups: Record<string, Matchup>;
  profiles: ProfileLite[];
  predsByUserEntries: Array<[string, BracketPrediction[]]>;
  phaseBonusConfig: Record<string, number>;
  phaseLabels: Record<string, string>;
}

export function AdminCuadroClient({
  slots,
  bracketLocked,
  predictionCounts,
  matchups,
  profiles,
  predsByUserEntries,
  phaseBonusConfig,
  phaseLabels,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [locked, setLocked] = useState(bracketLocked);
  const [togglingLock, setTogglingLock] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [bonusConfig, setBonusConfig] = useState<Record<string, number>>(phaseBonusConfig);
  const [savingBonus, setSavingBonus] = useState(false);

  const slotsById = new Map(slots.map((s) => [s.id, s]));
  const predsByUser = useMemo(() => new Map(predsByUserEntries), [predsByUserEntries]);

  async function saveBonus() {
    setSavingBonus(true);
    setMsg(null);
    const res = await fetch('/api/admin/bracket-phase-bonus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bonus: bonusConfig }),
    });
    setSavingBonus(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg('✗ Error al guardar bonus: ' + (data.error ?? 'desconocido'));
      return;
    }
    setMsg('✓ Bonus por fase guardados. Pulsa "Recalcular todo" para aplicarlos.');
    startTransition(() => router.refresh());
  }

  async function toggleLock() {
    const target = !locked;
    const confirmMsg = target
      ? '¿Cerrar TODAS las predicciones del cuadro para TODOS los usuarios? Esta acción afecta a todo el mundo de golpe, aunque no hayan terminado de rellenarlo.'
      : '¿Reabrir las predicciones del cuadro para todos los usuarios?';
    if (!confirm(confirmMsg)) return;

    setTogglingLock(true);
    const res = await fetch('/api/admin/bracket-toggle-lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locked: target }),
    });
    setTogglingLock(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert('Error: ' + (data.error ?? 'desconocido'));
      return;
    }
    setLocked(target);
    startTransition(() => router.refresh());
  }

  async function recalculateAll() {
    if (!confirm('¿Recalcular todo el cuadro desde cero? Útil tras corregir un resultado.')) return;
    setRecalculating(true);
    setMsg(null);
    const res = await fetch('/api/admin/bracket-recalculate-all', { method: 'POST' });
    setRecalculating(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg('✗ Error: ' + (data.error ?? 'desconocido'));
      return;
    }
    setMsg('✓ Recálculo completo.');
    startTransition(() => router.refresh());
  }

  async function repairAllTotals() {
    if (
      !confirm(
        '¿Reparar total_points de TODOS los usuarios? Esto corrige el bug donde el cuadro se borraba de su total tras recalcular grupos/premios. Es seguro ejecutarlo más de una vez.'
      )
    )
      return;
    setRepairing(true);
    setMsg(null);
    const res = await fetch('/api/admin/repair-all-totals', { method: 'POST' });
    setRepairing(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg('✗ Error: ' + (data.error ?? 'desconocido'));
      return;
    }
    setMsg(`✓ Reparados ${data.repaired} usuarios.`);
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <Card className="bg-accent/5 border-accent/30 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-lg font-semibold mb-1">
            Cierre global del cuadro
          </h2>
          <p className="text-sm text-text-muted">
            {locked
              ? 'Las predicciones están CERRADAS para todos los usuarios.'
              : 'Los usuarios todavía pueden rellenar y editar su cuadro.'}
          </p>
        </div>
        <Button
          variant={locked ? 'secondary' : 'danger'}
          onClick={toggleLock}
          disabled={togglingLock}
        >
          {togglingLock ? '…' : locked ? '🔓 Reabrir cuadro' : '🔒 Cerrar todas las predicciones'}
        </Button>
      </Card>

      <Card className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-lg font-semibold mb-1">Recalcular todo</h2>
          <p className="text-sm text-text-muted">
            Vuelve a aplicar puntos y ramas muertas desde cero (úsalo tras corregir un resultado).
          </p>
        </div>
        <Button onClick={recalculateAll} disabled={recalculating} variant="secondary">
          {recalculating ? 'Recalculando…' : 'Recalcular todo'}
        </Button>
      </Card>

      <Card className="flex items-center justify-between gap-4 flex-wrap border-amber-500/30 bg-amber-500/5">
        <div>
          <h2 className="font-display text-lg font-semibold mb-1">
            Reparar puntos totales (mantenimiento)
          </h2>
          <p className="text-sm text-text-muted">
            Recompone total_points de TODOS los usuarios sumando grupos + premios +
            semifinalistas + cuadro. Útil si el cuadro había desaparecido del ranking.
          </p>
        </div>
        <Button onClick={repairAllTotals} disabled={repairing} variant="secondary">
          {repairing ? 'Reparando…' : 'Reparar totales de todos'}
        </Button>
      </Card>

      {/* Bonus por fase configurable */}
      <Card>
        <h2 className="font-display text-lg font-semibold mb-1">
          Bonus por fase — quién pasa de ronda
        </h2>
        <p className="text-sm text-text-muted mb-4">
          Puntos extra que se dan por acertar quién avanza en cada ronda.
          Tras guardar, pulsa "Recalcular todo" para que se apliquen a todos los usuarios.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          {(['r16', 'r8', 'qf', 'sf', 't3', 'f'] as const).map((phase) => (
            <div key={phase} className="flex flex-col gap-1">
              <label className="text-xs text-text-muted font-medium">
                {phaseLabels[phase] ?? phase}
              </label>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={bonusConfig[phase] ?? 0}
                onChange={(e) =>
                  setBonusConfig((prev) => ({
                    ...prev,
                    [phase]: Math.max(0, parseInt(e.target.value, 10) || 0),
                  }))
                }
                className="w-full text-center font-display font-bold text-lg"
              />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={saveBonus} disabled={savingBonus}>
            {savingBonus ? 'Guardando…' : 'Guardar bonus'}
          </Button>
          <span className="text-xs text-text-muted">
            Recuerda pulsar "Recalcular todo" después para aplicar los cambios.
          </span>
        </div>
      </Card>
      {msg && (
        <div
          className={cn(
            'rounded-card border px-4 py-3 text-sm',
            msg.startsWith('✓')
              ? 'border-accent/30 bg-accent/10 text-accent'
              : 'border-danger/30 bg-danger/10 text-danger'
          )}
        >
          {msg}
        </div>
      )}

      <UsersBracketSection
        profiles={profiles}
        slots={slots}
        predsByUser={predsByUser}
        bracketLocked={locked}
        onSaved={() => startTransition(() => router.refresh())}
      />

      {BRACKET_PHASE_ORDER.map((phase) => {
        const defs = BRACKET_SLOTS.filter((s) => s.phase === phase);
        return (
          <section key={phase}>
            <h2 className="font-display text-2xl font-semibold mb-3">
              {BRACKET_PHASE_LABELS[phase]}
            </h2>
            <div className="grid gap-3">
              {defs.map((def) => (
                <SlotAdminRow
                  key={def.id}
                  slotId={def.id}
                  row={slotsById.get(def.id)}
                  matchup={matchups[def.id]}
                  predictionCount={predictionCounts[def.id] ?? 0}
                  onSaved={() => startTransition(() => router.refresh())}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function SlotAdminRow({
  slotId,
  row,
  matchup,
  predictionCount,
  onSaved,
}: {
  slotId: string;
  row?: BracketSlot;
  matchup?: Matchup;
  predictionCount: number;
  onSaved: () => void;
}) {
  const team1 = matchup?.team1 ?? null;
  const team2 = matchup?.team2 ?? null;
  const knownMatchup = !!team1 && !!team2;

  const [t1, setT1] = useState(row?.result_team1?.toString() ?? '');
  const [t2, setT2] = useState(row?.result_team2?.toString() ?? '');
  const [penaltyWinner, setPenaltyWinner] = useState<1 | 2 | null>(row?.real_penalty_winner ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFinished = row?.status === 'finished';
  const n1 = t1 === '' ? null : parseInt(t1, 10);
  const n2 = t2 === '' ? null : parseInt(t2, 10);
  const hasBothScores = n1 != null && n2 != null && !Number.isNaN(n1) && !Number.isNaN(n2);
  const isTie = hasBothScores && n1 === n2;

  // El "avanzante" se deriva del marcador automáticamente cuando no hay
  // empate; cuando hay empate, lo decide el botón de penaltis.
  const advancer: string | null = !hasBothScores
    ? null
    : isTie
      ? penaltyWinner === 1
        ? team1
        : penaltyWinner === 2
          ? team2
          : null
      : n1! > n2!
        ? team1
        : team2;

  // Si el marcador deja de estar empatado, olvidamos la elección de penaltis
  // previa (evita guardar un penaltyWinner obsoleto de un empate anterior).
  useEffect(() => {
    if (!isTie && penaltyWinner != null) setPenaltyWinner(null);
  }, [isTie]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit() {
    setError(null);
    if (!hasBothScores || n1 == null || n2 == null || n1 < 0 || n2 < 0) {
      setError('Resultado inválido');
      return;
    }
    if (isTie && penaltyWinner == null) {
      setError('Empate: indica quién gana en los penaltis');
      return;
    }
    if (!advancer) {
      setError('Indica qué equipo avanzó realmente de ronda');
      return;
    }
    if (
      !confirm(
        `Guardar ${knownMatchup ? `${teamES(team1!)} ${n1}-${n2} ${teamES(team2!)}` : `${n1}-${n2}`} en ${slotId}? Avanza: ${teamES(advancer)}. Se recalcularán los puntos de todos.`
      )
    )
      return;

    setSaving(true);
    const res = await fetch('/api/admin/bracket-save-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slotId,
        resultTeam1: n1,
        resultTeam2: n2,
        penaltyWinner: isTie ? penaltyWinner : null,
        realAdvancer: advancer,
      }),
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? 'Error al guardar');
      return;
    }
    onSaved();
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <div className="flex items-center gap-2">
          <Badge variant={isFinished ? 'finished' : 'open'}>
            {slotId} · {isFinished ? 'Finalizado' : 'Pendiente'}
          </Badge>
          {!knownMatchup && (
            <span className="text-xs text-text-muted italic">
              Esperando resultado de la ronda anterior
            </span>
          )}
        </div>
        <span className="text-xs text-text-muted">
          {predictionCount} {predictionCount === 1 ? 'predicción' : 'predicciones'}
        </span>
      </div>

      {knownMatchup && (
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 text-right font-medium">
            {teamFlag(team1!)} {teamES(team1!)}
          </div>
          <div className="text-text-muted text-sm">vs</div>
          <div className="flex-1 text-left font-medium">
            {teamES(team2!)} {teamFlag(team2!)}
          </div>
        </div>
      )}

      {!knownMatchup && (
        <div className="text-center text-sm text-text-muted py-4">
          No se puede cargar el resultado todavía: faltan por confirmarse los
          equipos de la ronda anterior.
        </div>
      )}

      {knownMatchup && (
        <>
          <div className="flex gap-2 items-center justify-center mb-3">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={t1}
              onChange={(e) => setT1(e.target.value)}
              className="w-16 text-center text-lg font-display bg-surface-2 border border-border rounded-lg py-2"
              placeholder="0"
            />
            <span className="text-text-muted">-</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={t2}
              onChange={(e) => setT2(e.target.value)}
              className="w-16 text-center text-lg font-display bg-surface-2 border border-border rounded-lg py-2"
              placeholder="0"
            />
          </div>

          {isTie && (
            <div className="mb-3 text-center">
              <div className="text-xs text-text-muted mb-1.5">¿Quién gana en los penaltis?</div>
              <div className="flex gap-2 justify-center">
                <button
                  type="button"
                  onClick={() => setPenaltyWinner(1)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium border',
                    penaltyWinner === 1
                      ? 'bg-accent text-black border-accent'
                      : 'bg-surface-2 border-border text-text-muted'
                  )}
                >
                  {teamFlag(team1!)} {teamES(team1!)}
                </button>
                <button
                  type="button"
                  onClick={() => setPenaltyWinner(2)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium border',
                    penaltyWinner === 2
                      ? 'bg-accent text-black border-accent'
                      : 'bg-surface-2 border-border text-text-muted'
                  )}
                >
                  {teamFlag(team2!)} {teamES(team2!)}
                </button>
              </div>
            </div>
          )}

          {!isTie && hasBothScores && advancer && (
            <div className="mb-3 text-center text-xs text-text-muted">
              Avanza automáticamente:{' '}
              <span className="font-semibold text-text">{teamES(advancer)}</span>
            </div>
          )}

          {error && <div className="text-xs text-danger text-center mb-2">{error}</div>}

          <div className="flex justify-center">
            <Button size="sm" onClick={submit} disabled={saving}>
              {saving ? 'Guardando…' : isFinished ? 'Corregir resultado' : 'Guardar resultado real'}
            </Button>
          </div>
        </>
      )}

      {isFinished && row?.real_advancer && (
        <div className="mt-3 pt-3 border-t border-border text-center text-xs text-text-muted">
          Resultado guardado:{' '}
          <span className="font-display font-bold text-text">
            {row.result_team1}–{row.result_team2}
          </span>
          {' · '}Avanzó: <span className="text-accent font-semibold">{teamES(row.real_advancer)}</span>
        </div>
      )}
    </Card>
  );
}

// =======================================================================
// Sección: listado de usuarios + su cuadro desplegable y editable
// =======================================================================
function UsersBracketSection({
  profiles,
  slots,
  predsByUser,
  bracketLocked,
  onSaved,
}: {
  profiles: ProfileLite[];
  slots: BracketSlot[];
  predsByUser: Map<string, BracketPrediction[]>;
  bracketLocked: boolean;
  onSaved: () => void;
}) {
  const [query, setQuery] = useState('');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(
      (p) => p.display_name.toLowerCase().includes(q) || p.username.toLowerCase().includes(q)
    );
  }, [profiles, query]);

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h2 className="font-display text-lg font-semibold mb-1">
          Cuadro de cada participante
        </h2>
        <p className="text-sm text-text-muted mb-3">
          Haz clic en un participante para ver su cuadro completo y editar
          cualquier casilla suya. Los cambios recalculan los puntos de todos.
        </p>
        <Input
          placeholder="Buscar participante…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:max-w-xs"
        />
      </div>

      <div className="divide-y divide-border">
        {filtered.map((profile) => {
          const expanded = expandedUserId === profile.id;
          const userPreds = predsByUser.get(profile.id) ?? [];
          const filledCount = userPreds.filter(
            (p) => p.pred_team1 != null && p.pred_team2 != null
          ).length;
          const deadCount = userPreds.filter((p) => p.is_dead).length;

          return (
            <div key={profile.id}>
              <button
                type="button"
                onClick={() => setExpandedUserId(expanded ? null : profile.id)}
                className="w-full text-left px-5 py-3 hover:bg-surface-2/50 transition-colors flex items-center gap-3"
              >
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <Avatar name={profile.display_name} size={32} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{profile.display_name}</div>
                  <div className="text-[11px] text-text-muted truncate">@{profile.username}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant={filledCount === BRACKET_SLOTS.length ? 'accent' : 'gold'}>
                    {filledCount}/{BRACKET_SLOTS.length}
                  </Badge>
                  {deadCount > 0 && (
                    <Badge variant="danger">{deadCount} muertas</Badge>
                  )}
                  <Badge variant="default">{profile.bracket_points} pts cuadro</Badge>
                  <span
                    className={cn(
                      'text-text-muted text-xs transition-transform',
                      expanded && 'rotate-180'
                    )}
                  >
                    ▾
                  </span>
                </div>
              </button>

              {expanded && (
                <div className="border-t border-border px-5 py-5 bg-background/40">
                  <UserBracketEditor
                    profile={profile}
                    slots={slots}
                    userPreds={userPreds}
                    bracketLocked={bracketLocked}
                    onSaved={onSaved}
                  />
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-text-muted">
            No hay participantes que coincidan con la búsqueda.
          </div>
        )}
      </div>
    </Card>
  );
}

