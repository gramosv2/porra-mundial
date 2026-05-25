import { AppShell, requireApprovedUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { QuedadasClient } from './quedadas-client';

const FEATURED = ['Spain', 'Portugal', 'Italy', 'Brazil', 'Argentina', 'England', 'France', 'Germany'];

export default async function QuedadasPage() {
  const profile = await requireApprovedUser();
  const supabase = createClient();

  const now = new Date();
  const day = now.getDay() === 0 ? 7 : now.getDay(); // lunes=1, domingo=7
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day - 1));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 7);

  // Partidos destacados de la semana actual
  const orClause = FEATURED.flatMap((t) => [`team1.eq.${t}`, `team2.eq.${t}`]).join(',');
  const { data: weekFeatured } = await supabase
    .from('matches')
    .select('*')
    .or(orClause)
    .gte('match_date', monday.toISOString())
    .lt('match_date', sunday.toISOString())
    .order('match_date');

  // Todos los partidos destacados (para el "Ver todos")
  const { data: allFeatured } = await supabase
    .from('matches')
    .select('*')
    .or(orClause)
    .gte('match_date', now.toISOString())
    .order('match_date');

  // Eventos (incluye personalizados sin match)
  const { data: events } = await supabase
    .from('watch_events')
    .select('*, watch_attendees(user_id, profiles(display_name)), matches(*)')
    .order('created_at', { ascending: false });

  // Mapa de match_id -> event
  const eventByMatch = new Map<number, any>();
  const customEvents: any[] = [];
  for (const e of events ?? []) {
    if (e.match_id) eventByMatch.set(e.match_id, e);
    else customEvents.push(e);
  }

  // Todos los partidos (para selector)
  const { data: allMatches } = await supabase
    .from('matches')
    .select('id, team1, team2, match_date, phase, group_name')
    .order('match_date');

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="font-display text-4xl font-bold flex items-center gap-2">🍺 Quedadas</h1>
        <p className="text-text-muted text-sm mt-1">
          Organizad encuentros para ver los partidos juntos. Apúntate a los planes existentes o crea uno nuevo.
        </p>
      </div>

      <QuedadasClient
        userId={profile.id}
        isAdmin={profile.role === 'admin'}
        weekFeatured={weekFeatured ?? []}
        allFeatured={allFeatured ?? []}
        customEvents={customEvents}
        eventByMatchEntries={Array.from(eventByMatch.entries())}
        allMatches={allMatches ?? []}
      />
    </AppShell>
  );
}
