import { AppShell, requireApprovedUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { QuedadasClient } from './quedadas-client';

export const dynamic = 'force-dynamic';

export default async function QuedadasPage() {
  const profile = await requireApprovedUser();
  const supabase = createClient();

  const now = new Date();
  const nowIso = now.toISOString();

  // 1) TODAS las quedadas existentes futuras (de cualquier partido + custom)
  //    Para custom usamos custom_date como referencia; para match-events usamos
  //    matches.match_date. Nos quedamos solo con las cuyo partido / fecha aún
  //    no haya pasado.
  const { data: rawEvents } = await supabase
    .from('watch_events')
    .select(
      '*, watch_attendees(user_id, profiles(display_name)), matches(id, team1, team2, match_date, phase, group_name, venue)'
    )
    .order('created_at', { ascending: false });

  type EventRow = {
    id: number;
    match_id: number | null;
    custom_title: string | null;
    custom_date: string | null;
    location: string;
    location_url: string | null;
    notes: string | null;
    attendee_limit: number | null;
    created_by: string;
    watch_attendees: Array<{
      user_id: string;
      profiles: { display_name: string } | null;
    }>;
    matches: {
      id: number;
      team1: string;
      team2: string;
      match_date: string;
      phase: string | null;
      group_name: string | null;
      venue: string | null;
    } | null;
  };

  const allEvents = (rawEvents ?? []) as EventRow[];

  // Filtrar futuros: si tiene match -> match_date >= now; si es custom -> custom_date >= now
  const futureEvents = allEvents.filter((e) => {
    const refDate = e.matches?.match_date ?? e.custom_date;
    if (!refDate) return true; // sin fecha, lo dejamos
    return new Date(refDate).getTime() >= now.getTime();
  });

  // Ordenar de más cercano a más lejano
  futureEvents.sort((a, b) => {
    const da = new Date(a.matches?.match_date ?? a.custom_date ?? 0).getTime();
    const db = new Date(b.matches?.match_date ?? b.custom_date ?? 0).getTime();
    return da - db;
  });

  // 2) Próximos partidos (próximos 30 días)
  const horizon = new Date(now);
  horizon.setDate(now.getDate() + 30);
  const { data: upcomingMatches } = await supabase
    .from('matches')
    .select('id, team1, team2, match_date, phase, group_name, venue')
    .gte('match_date', nowIso)
    .lte('match_date', horizon.toISOString())
    .order('match_date', { ascending: true })
    .limit(40);

  // 3) Contar quedadas por match_id para mostrar en cada tarjeta
  const eventsCountByMatch: Record<number, number> = {};
  for (const e of futureEvents) {
    if (e.match_id != null) {
      eventsCountByMatch[e.match_id] = (eventsCountByMatch[e.match_id] ?? 0) + 1;
    }
  }

  // 4) Para el selector de "crear quedada personalizada"
  const { data: allMatchesRaw } = await supabase
    .from('matches')
    .select('id, team1, team2, match_date, phase, group_name')
    .gte('match_date', nowIso)
    .order('match_date');

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="font-display text-4xl font-bold flex items-center gap-2">
          🍺 Quedadas
        </h1>
        <p className="text-text-muted text-sm mt-1">
          Organizad encuentros para ver los partidos juntos. Apúntate a los planes
          existentes o crea uno nuevo. Cada partido puede tener varias quedadas.
        </p>
      </div>

      <QuedadasClient
        userId={profile.id}
        isAdmin={profile.role === 'admin'}
        futureEvents={futureEvents}
        upcomingMatches={upcomingMatches ?? []}
        eventsCountByMatch={eventsCountByMatch}
        allMatches={allMatchesRaw ?? []}
      />
    </AppShell>
  );
}
