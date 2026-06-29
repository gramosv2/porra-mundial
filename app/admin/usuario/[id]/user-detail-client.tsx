'use client';

import { useState, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, Badge, Avatar, Input } from '@/components/ui';
import { teamES, teamFlag, formatMadridDate, cn } from '@/lib/utils';
import { PHASE_LABELS, type Phase } from '@/config/scoring';
import { UserBracketEditor, type ProfileLite } from '@/components/admin/bracket-user-editor';
import { BRACKET_SLOTS } from '@/config/bracket';
import type { Match, Prediction, BracketSlot, BracketPrediction, Profile } from '@/types';

interface Matchup {
  team1: string | null;
  team2: string | null;
}

interface Props {
  profile: Profile;
  groupMatches: Match[];
  groupPreds: Prediction[];
  slots: BracketSlot[];
  bracketPreds: BracketPrediction[];
  bracketLocked: boolean;
  matchups: Record<string, Matchup>;
}

export function UserDetailClient({
  profile,
  groupMatches,
  groupPreds,
  slots,
  bracketPreds,
  bracketLocked,
  matchups,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [tab, setTab] = useState<'grupos' | 'cuadro'>('grupos');

  const groupPredsByMatch = useMemo(
    () => new Map(groupPreds.map((p) => [p.match_id, p])),
    [groupPreds]
  );

  const profileLite: ProfileLite = {
    id: profile.id,
    username: profile.username,
    display_name: profile.display_name,
    avatar_url: profile.avatar_url,
    total_points: profile.total_points,
    bracket_points: profile.bracket_points,
  };

  const groupFilled = groupPreds.length;
  const bracketFilled = bracketPreds.filter(
    (p) => p.pred_team1 != null && p.pred_team2 != null
  ).length;
  const bracketDead = bracketPreds.filter((p) => p.is_dead).length;

  function onSaved() {
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <Link href="/admin/usuarios" className="text-xs text-text-muted hover:text-text">
          ← Volver a usuarios
        </Link>
      </div>

      {/* Cabecera */}
      <Card className="flex items-center gap-4 flex-wrap">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt=""
            className="w-14 h-14 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <Avatar name={profile.display_name} size={56} />
        )}
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-2xl font-bold truncate">{profile.display_name}</h1>
          <div className="text-sm text-text-muted">@{profile.username}</div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Stat label="Total puntos" value={profile.total_points} accent="gold" />
          <Stat label="Puntos cuadro" value={profile.bracket_points} accent="accent" />
          <Stat label="Grupos predichos" value={`${groupFilled}/${groupMatches.length}`} />
          <Stat label="Cuadro relleno" value={`${bracketFilled}/${BRACKET_SLOTS.length}`} />
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('grupos')}
          className={cn(
            'px-4 py-2 rounded-full text-sm font-medium border transition-colors',
            tab === 'grupos'
              ? 'bg-accent text-black border-accent'
              : 'bg-surface border-border text-text-muted hover:text-text'
          )}
        >
          Fase de grupos
        </button>
        <button
          onClick={() => setTab('cuadro')}
          className={cn(
            'px-4 py-2 rounded-full text-sm font-medium border transition-colors flex items-center gap-1.5',
            tab === 'cuadro'
              ? 'bg-accent text-black border-accent'
              : 'bg-surface border-border text-text-muted hover:text-text'
          )}
        >
          Cuadro de eliminatorias
          {bracketDead > 0 && (
            <Badge variant="danger" className="!py-0 !px-1.5 !text-[10px]">
              {bracketDead} muertas
            </Badge>
          )}
        </button>
      </div>

      {tab === 'grupos' && (
        <GroupsEditor matches={groupMatches} predsByMatch={groupPredsByMatch} profile={profile} onSaved={onSaved} />
      )}

      {tab === 'cuadro' && (
        <Card>
          <UserBracketEditor
            profile={profileLite}
            slots={slots}
            userPreds={bracketPreds}
            bracketLocked={bracketLocked}
            onSaved={onSaved}
          />
        </Card>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: 'gold' | 'accent';
}) {
  return (
    <div className="text-center px-3">
      <div className="text-[10px] text-text-muted uppercase tracking-wide">{label}</div>
      <div
        className={cn(
          'font-display text-xl font-bold',
          accent === 'gold' && 'text-gold',
          accent === 'accent' && 'text-accent'
        )}
      >
        {value}
      </div>
    </div>
  );
}

// =======================================================================
// Editor de la fase de grupos para UN usuario: todos los partidos,
// reutiliza /api/admin/edit-prediction (ya existente).
// =======================================================================
function GroupsEditor({
  matches,
  predsByMatch,
  profile,
  onSaved,
}: {
  matches: Match[];
  predsByMatch: Map<number, Prediction>;
  profile: Profile;
  onSaved: () => void;
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return matches;
    return matches.filter((m) => {
      const hay = `${m.team1} ${m.team2} ${teamES(m.team1)} ${teamES(m.team2)} ${m.group_name ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [matches, query]);

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <Input
          placeholder="Buscar por equipo o grupo…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:max-w-xs"
        />
      </div>
      <div className="divide-y divide-border">
        {filtered.map((m) => (
          <GroupMatchRow
            key={m.id}
            match={m}
            existing={predsByMatch.get(m.id) ?? null}
            profile={profile}
            onSaved={onSaved}
          />
        ))}
        {filtered.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-text-muted">
            No hay partidos que coincidan con la búsqueda.
          </div>
        )}
      </div>
    </Card>
  );
}

function GroupMatchRow({
  match,
  existing,
  profile,
  onSaved,
}: {
  match: Match;
  existing: Prediction | null;
  profile: Profile;
  onSaved: () => void;
}) {
  const [p1, setP1] = useState<string>(existing ? String(existing.pred_team1) : '');
  const [p2, setP2] = useState<string>(existing ? String(existing.pred_team2) : '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const dirty =
    (existing ? String(existing.pred_team1) : '') !== p1 ||
    (existing ? String(existing.pred_team2) : '') !== p2;

  const isFinished = match.status === 'finished';

  async function save() {
    if (p1 === '' || p2 === '') {
      setMsg('Pon ambos goles');
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await fetch('/api/admin/edit-prediction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchId: match.id,
        userId: profile.id,
        pred1: Number(p1),
        pred2: Number(p2),
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
    if (!confirm(`¿Borrar la predicción de ${profile.display_name} en este partido?`)) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch('/api/admin/edit-prediction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId: match.id, userId: profile.id, delete: true }),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data.error ?? 'Error');
      return;
    }
    setP1('');
    setP2('');
    setMsg('✓ Borrada');
    setTimeout(() => setMsg(null), 2500);
    onSaved();
  }

  return (
    <div className="flex items-center gap-3 px-5 py-3 flex-wrap">
      <div className="font-mono text-xs text-text-muted w-32 flex-shrink-0">
        {formatMadridDate(match.match_date)}
      </div>
      <div className="flex-1 min-w-[180px] flex items-center gap-2">
        <span className="text-lg">{teamFlag(match.team1)}</span>
        <span className="font-medium text-sm">{teamES(match.team1)}</span>
        {isFinished ? (
          <span className="font-display font-bold text-sm tabular-nums px-1">
            {match.result_team1}–{match.result_team2}
          </span>
        ) : (
          <span className="text-text-muted text-xs px-1">vs</span>
        )}
        <span className="text-lg">{teamFlag(match.team2)}</span>
        <span className="font-medium text-sm">{teamES(match.team2)}</span>
      </div>
      <Badge variant="default">
        {match.group_name ? `G${match.group_name} · J${match.matchday}` : PHASE_LABELS[match.phase as Phase]}
      </Badge>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Input
          inputMode="numeric"
          pattern="[0-9]*"
          value={p1}
          onChange={(e) => setP1(e.target.value.replace(/\D/g, ''))}
          className="w-11 text-center text-base font-display font-bold !px-0"
          maxLength={2}
          placeholder="–"
        />
        <span className="text-text-muted">–</span>
        <Input
          inputMode="numeric"
          pattern="[0-9]*"
          value={p2}
          onChange={(e) => setP2(e.target.value.replace(/\D/g, ''))}
          className="w-11 text-center text-base font-display font-bold !px-0"
          maxLength={2}
          placeholder="–"
        />
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0 w-[150px] justify-end">
        {msg && <span className="text-[10px] text-text-muted truncate">{msg}</span>}
        {existing && isFinished && (
          <span className="text-[10px] text-text-muted">+{existing.points_earned} pts</span>
        )}
        <button
          type="button"
          onClick={save}
          disabled={busy || !dirty}
          className={cn(
            'px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors',
            dirty && !busy
              ? 'bg-accent text-black border-accent hover:bg-accent/90'
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
            className="px-2 py-1.5 rounded-full text-xs border border-border text-danger hover:bg-danger/10"
            title="Borrar predicción"
          >
            🗑
          </button>
        )}
      </div>
    </div>
  );
}
