'use client';

import { useMemo, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Avatar, Badge, Card, Input, PulseDot } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { formatMadridDate, teamES, teamFlag, cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface MatchLike {
  id: number;
  team1: string;
  team2: string;
  match_date: string;
  phase?: string;
  group_name?: string | null;
  venue?: string | null;
}

interface EventLike {
  id: number;
  match_id: number | null;
  custom_title?: string | null;
  custom_date?: string | null;
  location: string;
  location_url?: string | null;
  notes?: string | null;
  created_by: string;
  watch_attendees: Array<{ user_id: string; profiles?: { display_name: string } }>;
  matches?: MatchLike | null;
}

interface Props {
  userId: string;
  isAdmin: boolean;
  weekFeatured: MatchLike[];
  allFeatured: MatchLike[];
  customEvents: EventLike[];
  eventByMatchEntries: Array<[number, EventLike]>;
  allMatches: MatchLike[];
}

export function QuedadasClient({
  userId,
  isAdmin,
  weekFeatured,
  allFeatured,
  customEvents,
  eventByMatchEntries,
  allMatches,
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [showAll, setShowAll] = useState(false);
  const [eventByMatch, setEventByMatch] = useState(new Map(eventByMatchEntries));
  const [customs, setCustoms] = useState(customEvents);
  const [, startTransition] = useTransition();

  // Modal organizar quedada (con match preasignado)
  const [modal, setModal] = useState<{ kind: 'match' | 'custom'; match?: MatchLike } | null>(null);

  const toggleAttend = async (eventId: number, going: boolean) => {
    // Optimistic update
    setEventByMatch((prev) => {
      const newMap = new Map(prev);
      for (const [k, ev] of newMap) {
        if (ev.id === eventId) {
          const newAtt = going
            ? [...ev.watch_attendees, { user_id: userId, profiles: { display_name: 'Tú' } }]
            : ev.watch_attendees.filter((a) => a.user_id !== userId);
          newMap.set(k, { ...ev, watch_attendees: newAtt });
        }
      }
      return newMap;
    });
    setCustoms((prev) =>
      prev.map((ev) => {
        if (ev.id !== eventId) return ev;
        const newAtt = going
          ? [...ev.watch_attendees, { user_id: userId, profiles: { display_name: 'Tú' } }]
          : ev.watch_attendees.filter((a) => a.user_id !== userId);
        return { ...ev, watch_attendees: newAtt };
      })
    );

    if (going) {
      await supabase.from('watch_attendees').insert({ event_id: eventId, user_id: userId });
    } else {
      await supabase.from('watch_attendees').delete().eq('event_id', eventId).eq('user_id', userId);
    }
    router.refresh();
  };

  const createEvent = async (data: {
    match_id: number | null;
    custom_title: string | null;
    custom_date: string | null;
    location: string;
    location_url: string | null;
    notes: string | null;
  }) => {
    const { data: inserted, error } = await supabase
      .from('watch_events')
      .insert({ ...data, created_by: userId })
      .select('*, watch_attendees(user_id, profiles(display_name)), matches(*)')
      .single();
    if (error || !inserted) {
      alert('No se pudo crear el evento');
      return;
    }
    // Auto-apuntar al creador
    await supabase.from('watch_attendees').insert({ event_id: inserted.id, user_id: userId });
    setModal(null);
    router.refresh();
  };

  const deleteEvent = async (eventId: number) => {
    if (!confirm('¿Eliminar esta quedada?')) return;
    await supabase.from('watch_events').delete().eq('id', eventId);
    router.refresh();
  };

  const list = showAll ? allFeatured : weekFeatured;

  return (
    <div className="space-y-10">
      {/* Sección destacados */}
      <section>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="font-display text-2xl font-bold">
            ⭐ Partidos destacados {showAll ? '(todos)' : '(esta semana)'}
          </h2>
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-sm text-accent hover:underline"
          >
            {showAll ? 'Mostrar solo esta semana' : 'Ver todos los partidos destacados →'}
          </button>
        </div>

        {list.length === 0 ? (
          <Card>
            <p className="text-text-muted text-sm text-center py-4">
              No hay partidos de equipos destacados {showAll ? '' : 'esta semana'}.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {list.map((m) => {
              const ev = eventByMatch.get(m.id);
              return (
                <FeaturedEventCard
                  key={m.id}
                  match={m}
                  event={ev}
                  userId={userId}
                  isAdmin={isAdmin}
                  onToggle={toggleAttend}
                  onOrganize={() => setModal({ kind: 'match', match: m })}
                  onDelete={deleteEvent}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Otras quedadas */}
      <section>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="font-display text-2xl font-bold">Otras quedadas</h2>
          <Button onClick={() => setModal({ kind: 'custom' })}>+ Crear quedada</Button>
        </div>

        {customs.length === 0 ? (
          <Card>
            <p className="text-text-muted text-sm text-center py-4">
              Aún no hay quedadas personalizadas. Sé el primero en crear una.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {customs.map((ev) => (
              <CustomEventCard
                key={ev.id}
                event={ev}
                userId={userId}
                isAdmin={isAdmin}
                onToggle={toggleAttend}
                onDelete={deleteEvent}
              />
            ))}
          </div>
        )}
      </section>

      {modal && (
        <CreateEventModal
          kind={modal.kind}
          preMatch={modal.match}
          allMatches={allMatches}
          onClose={() => setModal(null)}
          onCreate={createEvent}
        />
      )}
    </div>
  );
}

function FeaturedEventCard({
  match,
  event,
  userId,
  isAdmin,
  onToggle,
  onOrganize,
  onDelete,
}: {
  match: MatchLike;
  event?: EventLike;
  userId: string;
  isAdmin: boolean;
  onToggle: (id: number, going: boolean) => void;
  onOrganize: () => void;
  onDelete: (id: number) => void;
}) {
  const goingMe = event?.watch_attendees.some((a) => a.user_id === userId);
  const count = event?.watch_attendees.length ?? 0;

  return (
    <Card className="!p-5">
      <div className="text-xs text-text-muted mb-2">{formatMadridDate(match.match_date)}</div>
      <div className="font-display text-lg font-bold flex items-center gap-2 flex-wrap mb-3">
        <span className="text-xl">{teamFlag(match.team1)}</span>
        <span>{teamES(match.team1)}</span>
        <span className="text-text-muted">vs</span>
        <span className="text-xl">{teamFlag(match.team2)}</span>
        <span>{teamES(match.team2)}</span>
      </div>

      {event ? (
        <div className="space-y-3">
          <div className="text-sm text-text-muted flex items-start gap-1.5">
            <span>📍</span>
            <div>
              {event.location_url ? (
                <a href={event.location_url} target="_blank" rel="noreferrer" className="text-text hover:text-accent underline-offset-4 hover:underline">
                  {event.location}
                </a>
              ) : (
                <span className="text-text">{event.location}</span>
              )}
              {event.notes && <div className="text-xs mt-1">{event.notes}</div>}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm">🍺 {count} apuntad{count === 1 ? 'o' : 'os'}</span>
              <div className="flex -space-x-2">
                {event.watch_attendees.slice(0, 5).map((a, i) => (
                  <div key={i} className="ring-2 ring-surface">
                    <Avatar name={a.profiles?.display_name ?? '?'} size={22} />
                  </div>
                ))}
                {count > 5 && (
                  <div className="ring-2 ring-surface bg-surface-2 text-[10px] font-bold rounded-full w-[22px] h-[22px] flex items-center justify-center">
                    +{count - 5}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={goingMe ? 'secondary' : 'primary'}
                size="sm"
                onClick={() => onToggle(event.id, !goingMe)}
              >
                {goingMe ? 'Me bajo' : 'Me apunto'}
              </Button>
              {(isAdmin || event.created_by === userId) && (
                <button onClick={() => onDelete(event.id)} className="text-xs text-danger hover:underline">
                  Eliminar
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <Button variant="secondary" size="sm" onClick={onOrganize}>
          + Organizar quedada para este partido
        </Button>
      )}
    </Card>
  );
}

function CustomEventCard({
  event,
  userId,
  isAdmin,
  onToggle,
  onDelete,
}: {
  event: EventLike;
  userId: string;
  isAdmin: boolean;
  onToggle: (id: number, going: boolean) => void;
  onDelete: (id: number) => void;
}) {
  const goingMe = event.watch_attendees.some((a) => a.user_id === userId);
  const count = event.watch_attendees.length;
  const title = event.matches
    ? `${teamES(event.matches.team1)} vs ${teamES(event.matches.team2)}`
    : event.custom_title ?? 'Quedada personalizada';
  const date = event.matches?.match_date ?? event.custom_date;

  return (
    <Card className="!p-5">
      {date && <div className="text-xs text-text-muted mb-2">{formatMadridDate(date)}</div>}
      <div className="font-display text-lg font-bold mb-3">
        {event.matches && <>{teamFlag(event.matches.team1)} {teamFlag(event.matches.team2)} </>}
        {title}
      </div>
      <div className="text-sm text-text-muted flex items-start gap-1.5 mb-3">
        <span>📍</span>
        <div>
          {event.location_url ? (
            <a href={event.location_url} target="_blank" rel="noreferrer" className="text-text hover:text-accent underline-offset-4 hover:underline">
              {event.location}
            </a>
          ) : (
            <span className="text-text">{event.location}</span>
          )}
          {event.notes && <div className="text-xs mt-1">{event.notes}</div>}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">🍺 {count}</span>
          <div className="flex -space-x-2">
            {event.watch_attendees.slice(0, 5).map((a, i) => (
              <div key={i} className="ring-2 ring-surface">
                <Avatar name={a.profiles?.display_name ?? '?'} size={22} />
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={goingMe ? 'secondary' : 'primary'}
            size="sm"
            onClick={() => onToggle(event.id, !goingMe)}
          >
            {goingMe ? 'Me bajo' : 'Me apunto'}
          </Button>
          {(isAdmin || event.created_by === userId) && (
            <button onClick={() => onDelete(event.id)} className="text-xs text-danger hover:underline">
              ✕
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

function CreateEventModal({
  kind,
  preMatch,
  allMatches,
  onClose,
  onCreate,
}: {
  kind: 'match' | 'custom';
  preMatch?: MatchLike;
  allMatches: MatchLike[];
  onClose: () => void;
  onCreate: (data: {
    match_id: number | null;
    custom_title: string | null;
    custom_date: string | null;
    location: string;
    location_url: string | null;
    notes: string | null;
  }) => void;
}) {
  const [matchId, setMatchId] = useState<number | null>(preMatch?.id ?? null);
  const [noMatch, setNoMatch] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customDate, setCustomDate] = useState('');
  const [location, setLocation] = useState('');
  const [locationUrl, setLocationUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');

  const filteredMatches = useMemo(() => {
    if (!search) return allMatches.slice(0, 30);
    const s = search.toLowerCase();
    return allMatches.filter(
      (m) => m.team1.toLowerCase().includes(s) || m.team2.toLowerCase().includes(s)
    ).slice(0, 30);
  }, [allMatches, search]);

  const submit = () => {
    if (!location.trim()) {
      alert('Falta el lugar');
      return;
    }
    onCreate({
      match_id: noMatch ? null : matchId,
      custom_title: noMatch ? customTitle.trim() || 'Quedada' : null,
      custom_date: noMatch && customDate ? new Date(customDate).toISOString() : null,
      location: location.trim(),
      location_url: locationUrl.trim() || null,
      notes: notes.trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface border border-border rounded-modal w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="font-display text-2xl font-bold mb-1">Crear quedada</h3>
        <p className="text-xs text-text-muted mb-5">
          {preMatch ? `Para el partido ${teamES(preMatch.team1)} vs ${teamES(preMatch.team2)}` : 'Selecciona un partido o crea un evento sin partido vinculado'}
        </p>

        {!preMatch && (
          <div className="space-y-3 mb-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={noMatch} onChange={(e) => setNoMatch(e.target.checked)} />
              Sin partido vinculado (ej: "vemos la jornada completa")
            </label>

            {!noMatch ? (
              <>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar partido (equipo o país)…"
                  className="w-full"
                />
                <div className="max-h-48 overflow-y-auto border border-border rounded-lg">
                  {filteredMatches.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMatchId(m.id)}
                      className={cn(
                        'w-full text-left px-3 py-2 text-sm hover:bg-surface-2 border-b border-border last:border-b-0',
                        matchId === m.id && 'bg-accent/10 text-accent'
                      )}
                    >
                      {teamFlag(m.team1)} {teamES(m.team1)} vs {teamFlag(m.team2)} {teamES(m.team2)}
                      <span className="text-text-muted text-xs ml-2">{formatMadridDate(m.match_date)}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <Input value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} placeholder="Título (opcional)" className="w-full" />
                <Input type="datetime-local" value={customDate} onChange={(e) => setCustomDate(e.target.value)} className="w-full" />
              </>
            )}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-xs text-text-muted uppercase tracking-wide">Lugar *</label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ej: Bar La Esquina" className="w-full mt-1" />
          </div>
          <div>
            <label className="text-xs text-text-muted uppercase tracking-wide">URL Google Maps (opcional)</label>
            <Input value={locationUrl} onChange={(e) => setLocationUrl(e.target.value)} placeholder="https://maps.google.com/…" className="w-full mt-1" />
          </div>
          <div>
            <label className="text-xs text-text-muted uppercase tracking-wide">Notas (opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:border-accent"
              placeholder="Reservamos a las 20h, preguntar por Paco…"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit}>Crear quedada</Button>
        </div>
      </div>
    </div>
  );
}
