'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, Badge, Input } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { teamFlag, teamES, formatMadridDate, formatMadridTime } from '@/lib/utils';
import { PHASE_LABELS } from '@/config/scoring';
import type { Match } from '@/types';

const PHASES: Array<Match['phase']> = ['r32', 'r16', 'cuartos', 'semis', 'tercero', 'final'];

interface Props {
  matches: Match[];
}

export function EliminatoriasClient({ matches }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<number | null>(null);

  const byPhase = useMemo(() => {
    const out: Record<string, Match[]> = {};
    for (const phase of PHASES) out[phase] = [];
    for (const m of matches) {
      if (out[m.phase]) out[m.phase].push(m);
    }
    return out;
  }, [matches]);

  async function save(matchId: number, fields: Partial<Match>) {
    setBusyId(matchId);
    const { error } = await supabase.from('matches').update(fields).eq('id', matchId);
    setBusyId(null);
    if (error) {
      alert('Error: ' + error.message);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <Card className="bg-accent/5 border-accent/30">
        <p className="text-sm text-text-muted">
          Cuando se confirmen los clasificados de cada ronda, sustituye{' '}
          <span className="text-text font-medium">"Por determinar"</span> por las selecciones
          reales. La fecha, hora y sede también son editables.
        </p>
      </Card>

      {PHASES.map((phase) => {
        const list = byPhase[phase];
        if (!list || list.length === 0) return null;
        return (
          <section key={phase}>
            <h2 className="font-display text-2xl font-semibold mb-3">{PHASE_LABELS[phase]}</h2>
            <div className="grid gap-3">
              {list.map((m) => (
                <EliminatoriaRow
                  key={m.id}
                  match={m}
                  busy={busyId === m.id}
                  onSave={save}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function EliminatoriaRow({
  match,
  busy,
  onSave,
}: {
  match: Match;
  busy: boolean;
  onSave: (id: number, fields: Partial<Match>) => void;
}) {
  const [team1, setTeam1] = useState(match.team1);
  const [team2, setTeam2] = useState(match.team2);
  const [venue, setVenue] = useState(match.venue ?? '');
  // datetime-local en hora local del navegador (Madrid en el cliente español)
  const initialDate = new Date(match.match_date);
  const localISO =
    !Number.isNaN(initialDate.getTime())
      ? new Date(initialDate.getTime() - initialDate.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16)
      : '';
  const [dateLocal, setDateLocal] = useState(localISO);

  const isPlaceholder =
    match.team1 === 'Por determinar' || match.team2 === 'Por determinar';

  function submit() {
    const fields: Partial<Match> = {
      team1: team1.trim() || 'Por determinar',
      team2: team2.trim() || 'Por determinar',
      venue: venue.trim() || null,
    };
    if (dateLocal) {
      const d = new Date(dateLocal);
      if (!Number.isNaN(d.getTime())) {
        fields.match_date = d.toISOString();
      }
    }
    onSave(match.id, fields);
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <div className="flex items-center gap-2">
          {isPlaceholder ? (
            <Badge variant="closed">Por determinar</Badge>
          ) : (
            <Badge variant="open">Confirmado</Badge>
          )}
          <span className="text-xs text-text-muted">
            {formatMadridDate(match.match_date)} · {formatMadridTime(match.match_date)}
          </span>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs uppercase tracking-widest text-text-muted mb-1.5">
            Equipo 1 {!isPlaceholder && teamFlag(team1)}
          </label>
          <Input
            value={team1}
            onChange={(e) => setTeam1(e.target.value)}
            placeholder="Equipo 1"
          />
          {team1 && team1 !== 'Por determinar' && teamES(team1) !== team1 && (
            <div className="text-xs text-text-muted mt-1">→ {teamES(team1)}</div>
          )}
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-text-muted mb-1.5">
            Equipo 2 {!isPlaceholder && teamFlag(team2)}
          </label>
          <Input
            value={team2}
            onChange={(e) => setTeam2(e.target.value)}
            placeholder="Equipo 2"
          />
          {team2 && team2 !== 'Por determinar' && teamES(team2) !== team2 && (
            <div className="text-xs text-text-muted mt-1">→ {teamES(team2)}</div>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs uppercase tracking-widest text-text-muted mb-1.5">
            Fecha y hora (Madrid)
          </label>
          <Input
            type="datetime-local"
            value={dateLocal}
            onChange={(e) => setDateLocal(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-text-muted mb-1.5">
            Sede
          </label>
          <Input
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            placeholder="Estadio…"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={submit} disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </Card>
  );
}
