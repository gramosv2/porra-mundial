import { AppShell, requireApprovedUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Card, Badge } from '@/components/ui';
import { PHASE_LABELS, type Phase } from '@/config/scoring';
import { teamES, teamFlag } from '@/lib/utils';
import { CalendarDownloadButton } from './download-button';

export default async function CalendarioPage() {
  await requireApprovedUser();
  const supabase = createClient();
  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .order('match_date', { ascending: true });

  // Agrupar por fecha local Madrid
  const byDay = new Map<string, typeof matches>();
  for (const m of matches ?? []) {
    const key = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Madrid',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(m.match_date));
    const arr = byDay.get(key) ?? [];
    arr!.push(m);
    byDay.set(key, arr);
  }

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-4xl font-bold">Calendario</h1>
          <p className="text-text-muted text-sm mt-1">
            Todos los partidos del Mundial en hora de Madrid · 11 junio – 19 julio 2026
          </p>
        </div>
        <CalendarDownloadButton />
      </div>

      <div className="space-y-6">
        {Array.from(byDay.entries()).map(([day, list]) => (
          <div key={day}>
            <h2 className="font-display text-lg font-bold mb-2 text-text-muted">
              {new Intl.DateTimeFormat('es-ES', {
                timeZone: 'Europe/Madrid',
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              }).format(new Date(day + 'T12:00:00Z'))}
            </h2>
            <div className="space-y-2">
              {list!.map((m) => (
                <Card key={m.id} className="!p-3 flex items-center gap-3 flex-wrap">
                  <div className="font-mono text-sm w-12 text-text-muted">
                    {new Intl.DateTimeFormat('es-ES', {
                      timeZone: 'Europe/Madrid',
                      hour: '2-digit',
                      minute: '2-digit',
                    }).format(new Date(m.match_date))}
                  </div>
                  <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                    <span className="text-xl">{teamFlag(m.team1)}</span>
                    <span className="font-semibold text-sm">{teamES(m.team1)}</span>
                    <span className="text-text-muted text-xs">vs</span>
                    <span className="text-xl">{teamFlag(m.team2)}</span>
                    <span className="font-semibold text-sm">{teamES(m.team2)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-text-muted">
                    {m.group_name && <Badge>G{m.group_name}</Badge>}
                    <Badge>{PHASE_LABELS[m.phase as Phase]}</Badge>
                    {m.venue && <span className="hidden md:inline">{m.venue}</span>}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
