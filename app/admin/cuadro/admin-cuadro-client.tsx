'use client';

import { useState, useTransition, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Badge, Avatar, Input } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { teamES, teamFlag, cn } from '@/lib/utils';
import {
  BRACKET_SLOTS,
  BRACKET_SLOTS_BY_ID,
  BRACKET_PHASE_ORDER,
  BRACKET_PHASE_LABELS,
  T3_USES_LOSERS,
} from '@/config/bracket';
import { bracketPredictedWinner } from '@/config/scoring';
import type { BracketSlot, BracketPrediction } from '@/types';

interface Matchup {
  team1: string | null;
  team2: string | null;
}

interface ProfileLite {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  total_points: number;
  bracket_points: number;
}

interface Props {
  slots: BracketSlot[];
  bracketLocked: boolean;
  predictionCounts: Record<string, number>;
  matchups: Record<string, Matchup>;
  profiles: ProfileLite[];
  predsByUserEntries: Array<[string, BracketPrediction[]]>;
}

export function AdminCuadroClient({
  slots,
  bracketLocked,
  predictionCounts,
  matchups,
  profiles,
  predsByUserEntries,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [locked, setLocked] = useState(bracketLocked);
  const [togglingLock, setTogglingLock] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const slotsById = new Map(slots.map((s) => [s.id, s]));
  const predsByUser = useMemo(() => new Map(predsByUserEntries), [predsByUserEntries]);

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
// Resolución del bracket de UN usuario (cliente): mismo algoritmo que
// resolveUserBracket en src/lib/bracket-engine.ts, pero en el cliente y
// sin tocar el servidor — solo para PINTAR qué equipos le tocan a cada
// usuario en cada casilla según sus propias elecciones de ganador.
// =======================================================================
interface ResolvedSlot {
  team1: string | null;
  team2: string | null;
  predictedAdvancer: string | null;
}

function resolveUserBracketClient(
  slots: BracketSlot[],
  userPreds: Map<string, BracketPrediction>
): Map<string, ResolvedSlot> {
  const slotsById = new Map(slots.map((s) => [s.id, s]));
  const resolved = new Map<string, ResolvedSlot>();

  function resolve(slotId: string): ResolvedSlot {
    const cached = resolved.get(slotId);
    if (cached) return cached;

    const def = BRACKET_SLOTS_BY_ID[slotId];
    const row = slotsById.get(slotId);
    const pred = userPreds.get(slotId);

    let team1: string | null = null;
    let team2: string | null = null;

    if (!def.fromSlot1 || !def.fromSlot2) {
      team1 = row?.team1_real ?? null;
      team2 = row?.team2_real ?? null;
    } else if (slotId === 'T3' && T3_USES_LOSERS) {
      const p1 = resolve(def.fromSlot1);
      const p2 = resolve(def.fromSlot2);
      team1 = loserOf(p1);
      team2 = loserOf(p2);
    } else {
      const p1 = resolve(def.fromSlot1);
      const p2 = resolve(def.fromSlot2);
      team1 = p1.predictedAdvancer;
      team2 = p2.predictedAdvancer;
    }

    let predictedAdvancer: string | null = null;
    if (pred && pred.pred_team1 != null && pred.pred_team2 != null && team1 && team2) {
      const winnerSlot = bracketPredictedWinner(
        pred.pred_team1,
        pred.pred_team2,
        pred.pred_penalty_winner
      );
      predictedAdvancer = winnerSlot === 1 ? team1 : team2;
    }

    const out: ResolvedSlot = { team1, team2, predictedAdvancer };
    resolved.set(slotId, out);
    return out;
  }

  function loserOf(p: ResolvedSlot): string | null {
    if (!p.predictedAdvancer || !p.team1 || !p.team2) return null;
    return p.predictedAdvancer === p.team1 ? p.team2 : p.team1;
  }

  for (const s of BRACKET_SLOTS) resolve(s.id);
  return resolved;
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
                <UserBracketEditor
                  profile={profile}
                  slots={slots}
                  userPreds={userPreds}
                  bracketLocked={bracketLocked}
                  onSaved={onSaved}
                />
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

function UserBracketEditor({
  profile,
  slots,
  userPreds,
  bracketLocked,
  onSaved,
}: {
  profile: ProfileLite;
  slots: BracketSlot[];
  userPreds: BracketPrediction[];
  bracketLocked: boolean;
  onSaved: () => void;
}) {
  const predsById = useMemo(() => new Map(userPreds.map((p) => [p.slot_id, p])), [userPreds]);
  const resolved = useMemo(
    () => resolveUserBracketClient(slots, predsById),
    [slots, predsById]
  );

  return (
    <div className="border-t border-border px-5 py-5 bg-background/40 space-y-6">
      {bracketLocked && (
        <div className="text-[11px] text-text-muted italic">
          El cuadro global está cerrado para los usuarios, pero como admin
          puedes seguir editando cualquier casilla.
        </div>
      )}
      {BRACKET_PHASE_ORDER.map((phase) => {
        const defs = BRACKET_SLOTS.filter((s) => s.phase === phase);
        return (
          <div key={phase}>
            <h3 className="font-display text-sm font-semibold text-text-muted uppercase tracking-wide mb-2">
              {BRACKET_PHASE_LABELS[phase]}
            </h3>
            <div className="grid sm:grid-cols-2 gap-2">
              {defs.map((def) => (
                <UserSlotEditor
                  key={def.id}
                  slotId={def.id}
                  profile={profile}
                  resolvedSlot={resolved.get(def.id)}
                  existing={predsById.get(def.id) ?? null}
                  onSaved={onSaved}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function UserSlotEditor({
  slotId,
  profile,
  resolvedSlot,
  existing,
  onSaved,
}: {
  slotId: string;
  profile: ProfileLite;
  resolvedSlot?: ResolvedSlot;
  existing: BracketPrediction | null;
  onSaved: () => void;
}) {
  const team1 = resolvedSlot?.team1 ?? null;
  const team2 = resolvedSlot?.team2 ?? null;
  const knownMatchup = !!team1 && !!team2;

  const [p1, setP1] = useState<string>(existing?.pred_team1?.toString() ?? '');
  const [p2, setP2] = useState<string>(existing?.pred_team2?.toString() ?? '');
  const [penaltyWinner, setPenaltyWinner] = useState<1 | 2 | null>(
    existing?.pred_penalty_winner ?? null
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const n1 = p1 === '' ? null : parseInt(p1, 10);
  const n2 = p2 === '' ? null : parseInt(p2, 10);
  const hasBoth = n1 != null && n2 != null && !Number.isNaN(n1) && !Number.isNaN(n2);
  const isTie = hasBoth && n1 === n2;

  useEffect(() => {
    if (!isTie && penaltyWinner != null) setPenaltyWinner(null);
  }, [isTie]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty =
    (existing?.pred_team1?.toString() ?? '') !== p1 ||
    (existing?.pred_team2?.toString() ?? '') !== p2 ||
    (existing?.pred_penalty_winner ?? null) !== penaltyWinner;

  async function save() {
    setMsg(null);
    if (!hasBoth || n1! < 0 || n2! < 0) {
      setMsg('Pon ambos goles');
      return;
    }
    if (isTie && penaltyWinner == null) {
      setMsg('Empate: elige quién pasa en penaltis');
      return;
    }
    setBusy(true);
    const res = await fetch('/api/admin/edit-bracket-prediction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slotId,
        userId: profile.id,
        pred1: n1,
        pred2: n2,
        penaltyWinner: isTie ? penaltyWinner : null,
      }),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data.error ?? 'Error');
      return;
    }
    setMsg(data.warning ? '⚠ ' + data.warning : '✓ Guardado');
    setTimeout(() => setMsg(null), 2500);
    onSaved();
  }

  async function remove() {
    if (!existing) return;
    if (!confirm(`¿Borrar la predicción de ${profile.display_name} en ${slotId}?`)) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch('/api/admin/edit-bracket-prediction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotId, userId: profile.id, delete: true }),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data.error ?? 'Error');
      return;
    }
    setP1('');
    setP2('');
    setPenaltyWinner(null);
    setMsg('✓ Borrada');
    setTimeout(() => setMsg(null), 2500);
    onSaved();
  }

  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2.5 space-y-2',
        existing?.is_dead
          ? 'border-danger/40 bg-danger/10'
          : existing
            ? 'border-border bg-surface-2/40'
            : 'border-dashed border-border/60'
      )}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[10px] font-mono text-text-muted">{slotId}</span>
        {existing?.is_dead && <Badge variant="danger">✕ rama eliminada</Badge>}
        {existing && !existing.is_dead && existing.points_earned > 0 && (
          <Badge variant="accent">+{existing.points_earned} pts</Badge>
        )}
      </div>

      {knownMatchup ? (
        <div className="flex items-center justify-center gap-2 text-sm">
          <span className="flex items-center gap-1 flex-1 justify-end">
            {teamFlag(team1!)} {teamES(team1!)}
          </span>
          <Input
            inputMode="numeric"
            pattern="[0-9]*"
            value={p1}
            onChange={(e) => setP1(e.target.value.replace(/\D/g, ''))}
            className="w-10 text-center !px-0 font-display font-bold"
            maxLength={2}
          />
          <span className="text-text-muted">–</span>
          <Input
            inputMode="numeric"
            pattern="[0-9]*"
            value={p2}
            onChange={(e) => setP2(e.target.value.replace(/\D/g, ''))}
            className="w-10 text-center !px-0 font-display font-bold"
            maxLength={2}
          />
          <span className="flex items-center gap-1 flex-1">
            {teamES(team2!)} {teamFlag(team2!)}
          </span>
        </div>
      ) : (
        <div className="text-center text-xs text-text-muted italic py-1">
          Este usuario aún no tiene rival conocido en esta casilla (depende
          de su elección en la ronda anterior).
        </div>
      )}

      {isTie && knownMatchup && (
        <div className="flex gap-1.5 justify-center">
          <button
            type="button"
            onClick={() => setPenaltyWinner(1)}
            className={cn(
              'px-2 py-1 rounded-full text-[11px] font-medium border',
              penaltyWinner === 1
                ? 'bg-accent text-black border-accent'
                : 'bg-surface-2 border-border text-text-muted'
            )}
          >
            {teamES(team1!)}
          </button>
          <button
            type="button"
            onClick={() => setPenaltyWinner(2)}
            className={cn(
              'px-2 py-1 rounded-full text-[11px] font-medium border',
              penaltyWinner === 2
                ? 'bg-accent text-black border-accent'
                : 'bg-surface-2 border-border text-text-muted'
            )}
          >
            {teamES(team2!)}
          </button>
        </div>
      )}

      {knownMatchup && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-text-muted truncate">{msg}</span>
          <div className="flex gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={save}
              disabled={busy || !dirty}
              className={cn(
                'px-2.5 py-1 rounded-full text-[11px] font-medium border',
                dirty && !busy
                  ? 'bg-accent text-black border-accent'
                  : 'bg-surface border-border text-text-muted cursor-not-allowed'
              )}
            >
              {busy ? '…' : existing ? 'Guardar' : 'Añadir'}
            </button>
            {existing && (
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="px-2 py-1 rounded-full text-[11px] border border-border text-danger hover:bg-danger/10"
              >
                🗑
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
