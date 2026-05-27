'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Avatar, Badge, Card, Input, PulseDot } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { formatMadridDate, teamES, teamFlag, cn } from '@/lib/utils';

interface MatchLike {
  id: number;
  team1: string;
  team2: string;
  match_date: string;
  phase: string | null;
  group_name: string | null;
  venue?: string | null;
}

interface AttendeeLike {
  user_id: string;
  profiles: { display_name: string } | null;
}

interface EventLike {
  id: number;
  match_id: number | null;
  custom_title: string | null;
  custom_date: string | null;
  location: string;
  location_url: string | null;
  notes: string | null;
  attendee_limit: number | null;
  created_by: string;
  watch_attendees: AttendeeLike[];
  matches: MatchLike | null;
}

interface Props {
  userId: string;
  isAdmin: boolean;
  futureEvents: EventLike[];
  upcomingMatches: MatchLike[];
  eventsCountByMatch: Record<number, number>;
  allMatches: MatchLike[];
}

export function QuedadasClient({
  userId,
  isAdmin,
  futureEvents,
  upcomingMatches,
  eventsCountByMatch,
  allMatches,
}: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [events, setEvents] = useState(futureEvents);
  const [busyEvent, setBusyEvent] = useState<number | null>(null);

  // Modales
  const [createModal, setCreateModal] = useState<
    { kind: 'match'; match: MatchLike } | { kind: 'custom' } | null
  >(null);
  const [detailEventId, setDetailEventId] = useState<number | null>(null);
  const [editEventId, setEditEventId] = useState<number | null>(null);

  const detailEvent = events.find((e) => e.id === detailEventId) ?? null;
  const editEvent = events.find((e) => e.id === editEventId) ?? null;

  // ============================================================
  // ATTEND / LEAVE / KICK
  // ============================================================
  const toggleAttend = async (eventId: number, going: boolean) => {
    const ev = events.find((e) => e.id === eventId);
    if (!ev) return;

    // Comprobación cliente del límite
    if (
      going &&
      ev.attendee_limit != null &&
      ev.watch_attendees.length >= ev.attendee_limit &&
      ev.created_by !== userId
    ) {
      alert('Esta quedada está llena.');
      return;
    }

    setBusyEvent(eventId);

    // Optimistic
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== eventId) return e;
        const newAtt = going
          ? [
              ...e.watch_attendees,
              { user_id: userId, profiles: { display_name: 'Tú' } },
            ]
          : e.watch_attendees.filter((a) => a.user_id !== userId);
        return { ...e, watch_attendees: newAtt };
      })
    );

    const { error } = going
      ? await supabase
          .from('watch_attendees')
          .insert({ event_id: eventId, user_id: userId })
      : await supabase
          .from('watch_attendees')
          .delete()
          .eq('event_id', eventId)
          .eq('user_id', userId);

    setBusyEvent(null);

    if (error) {
      // Rollback
      setEvents(futureEvents);
      alert(
        error.message.includes('row-level security')
          ? 'Esta quedada está llena.'
          : 'Error: ' + error.message
      );
      return;
    }
    router.refresh();
  };

  const kickAttendee = async (eventId: number, targetUserId: string) => {
    const ev = events.find((e) => e.id === eventId);
    if (!ev) return;
    if (ev.created_by !== userId && !isAdmin) return;
    if (!confirm('¿Sacar a esta persona de la quedada?')) return;

    setEvents((prev) =>
      prev.map((e) =>
        e.id === eventId
          ? { ...e, watch_attendees: e.watch_attendees.filter((a) => a.user_id !== targetUserId) }
          : e
      )
    );

    const { error } = await supabase
      .from('watch_attendees')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', targetUserId);

    if (error) {
      setEvents(futureEvents);
      alert('Error: ' + error.message);
      return;
    }
    router.refresh();
  };

  // ============================================================
  // CRUD EVENTOS
  // ============================================================
  const createEvent = async (data: {
    match_id: number | null;
    custom_title: string | null;
    custom_date: string | null;
    location: string;
    location_url: string | null;
    notes: string | null;
    attendee_limit: number | null;
  }) => {
    const { data: inserted, error } = await supabase
      .from('watch_events')
      .insert({ ...data, created_by: userId })
      .select(
        '*, watch_attendees(user_id, profiles(display_name)), matches(id, team1, team2, match_date, phase, group_name, venue)'
      )
      .single();
    if (error || !inserted) {
      alert('Error al crear la quedada: ' + (error?.message ?? ''));
      return;
    }
    await supabase.from('watch_attendees').insert({ event_id: inserted.id, user_id: userId });
    setCreateModal(null);
    router.refresh();
  };

  const updateEvent = async (
    eventId: number,
    data: {
      location: string;
      location_url: string | null;
      notes: string | null;
      attendee_limit: number | null;
    }
  ) => {
    const { error } = await supabase
      .from('watch_events')
      .update(data)
      .eq('id', eventId);
    if (error) {
      alert('Error: ' + error.message);
      return;
    }
    setEditEventId(null);
    router.refresh();
  };

  const deleteEvent = async (eventId: number) => {
    if (!confirm('¿Eliminar esta quedada?')) return;
    const { error } = await supabase.from('watch_events').delete().eq('id', eventId);
    if (error) {
      alert('Error: ' + error.message);
      return;
    }
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
    setDetailEventId(null);
    setEditEventId(null);
    router.refresh();
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="space-y-12">
      {/* === BANNER HORIZONTAL DE QUEDADAS === */}
      <section>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="font-display text-2xl font-bold">📌 Quedadas activas</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Las más cercanas primero · {events.length} planes
            </p>
          </div>
        </div>

        {events.length === 0 ? (
          <Card>
            <p className="text-text-muted text-sm text-center py-6">
              Todavía no hay quedadas. Crea una desde un partido o desde el botón
              "Crear quedada personalizada" más abajo.
            </p>
          </Card>
        ) : (
          <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto pb-2">
            <div className="flex gap-3 snap-x snap-mandatory">
              {events.map((ev) => (
                <EventBannerCard
                  key={ev.id}
                  event={ev}
                  userId={userId}
                  isAdmin={isAdmin}
                  busy={busyEvent === ev.id}
                  onToggle={toggleAttend}
                  onOpenDetail={() => setDetailEventId(ev.id)}
                  onEdit={() => setEditEventId(ev.id)}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* === PRÓXIMOS PARTIDOS === */}
      <section>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="font-display text-2xl font-bold">⚽ Próximos partidos</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Crea una quedada para cualquier partido
            </p>
          </div>
          <Button onClick={() => setCreateModal({ kind: 'custom' })} variant="secondary" size="sm">
            + Quedada personalizada
          </Button>
        </div>

        {upcomingMatches.length === 0 ? (
          <Card>
            <p className="text-text-muted text-sm text-center py-4">
              No hay partidos en los próximos 30 días.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {upcomingMatches.map((m) => (
              <UpcomingMatchCard
                key={m.id}
                match={m}
                eventsCount={eventsCountByMatch[m.id] ?? 0}
                onCreate={() => setCreateModal({ kind: 'match', match: m })}
              />
            ))}
          </div>
        )}
      </section>

      {/* === MODALES === */}
      {createModal && (
        <CreateEventModal
          kind={createModal.kind}
          preMatch={createModal.kind === 'match' ? createModal.match : undefined}
          allMatches={allMatches}
          onClose={() => setCreateModal(null)}
          onCreate={createEvent}
        />
      )}

      {detailEvent && (
        <EventDetailModal
          event={detailEvent}
          userId={userId}
          isAdmin={isAdmin}
          busy={busyEvent === detailEvent.id}
          onClose={() => setDetailEventId(null)}
          onToggle={toggleAttend}
          onKick={kickAttendee}
          onEdit={() => {
            setDetailEventId(null);
            setEditEventId(detailEvent.id);
          }}
          onDelete={deleteEvent}
        />
      )}

      {editEvent && (
        <EditEventModal
          event={editEvent}
          onClose={() => setEditEventId(null)}
          onSave={(data) => updateEvent(editEvent.id, data)}
        />
      )}
    </div>
  );
}

// ============================================================================
// BANNER CARD
// ============================================================================
function EventBannerCard({
  event,
  userId,
  isAdmin,
  busy,
  onToggle,
  onOpenDetail,
  onEdit,
}: {
  event: EventLike;
  userId: string;
  isAdmin: boolean;
  busy: boolean;
  onToggle: (eventId: number, going: boolean) => void;
  onOpenDetail: () => void;
  onEdit: () => void;
}) {
  const isAttending = event.watch_attendees.some((a) => a.user_id === userId);
  const count = event.watch_attendees.length;
  const limit = event.attendee_limit;
  const overLimit = limit != null && count > limit;
  const isFull = limit != null && count >= limit;
  const canEdit = isAdmin || event.created_by === userId;

  const refDate = event.matches?.match_date ?? event.custom_date;
  const title =
    event.custom_title ??
    (event.matches
      ? `${teamFlag(event.matches.team1)} ${teamES(event.matches.team1)} vs ${teamFlag(event.matches.team2)} ${teamES(event.matches.team2)}`
      : 'Quedada');

  return (
    <div
      className={cn(
        'flex-shrink-0 snap-start w-[280px] sm:w-[320px] bg-surface border rounded-card p-4 flex flex-col',
        isAttending ? 'border-accent/50 ring-1 ring-accent/30' : 'border-border'
      )}
    >
      {/* Cabecera */}
      <div className="flex items-center justify-between gap-2 mb-2">
        {event.matches ? (
          <Badge variant="default" className="text-[10px]">
            {event.matches.phase === 'grupos' && event.matches.group_name
              ? `Grupo ${event.matches.group_name}`
              : event.matches.phase ?? 'Partido'}
          </Badge>
        ) : (
          <Badge variant="gold" className="text-[10px]">
            Personalizada
          </Badge>
        )}
        <div className="flex items-center gap-1">
          {isAttending && (
            <Badge variant="accent" className="text-[10px]">
              <PulseDot /> Apuntado
            </Badge>
          )}
          {canEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="text-text-muted hover:text-accent p-1 text-xs"
              title="Editar quedada"
            >
              ✏️
            </button>
          )}
        </div>
      </div>

      {/* Título — clic abre detalle */}
      <button
        type="button"
        onClick={onOpenDetail}
        className="text-left font-display font-bold text-base leading-tight mb-1 line-clamp-2 min-h-[2.5em] hover:text-accent transition-colors"
      >
        {title}
      </button>

      {refDate && (
        <div className="text-xs text-text-muted mb-2">
          📅 {formatMadridDate(refDate)}
        </div>
      )}

      <div className="text-sm flex items-start gap-1.5 mb-3">
        <span className="text-text-muted">📍</span>
        {event.location_url ? (
          <a
            href={event.location_url}
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline truncate"
          >
            {event.location}
          </a>
        ) : (
          <span className="font-medium truncate">{event.location}</span>
        )}
      </div>

      {event.notes && (
        <div className="text-xs text-text-muted italic mb-3 line-clamp-2">
          {event.notes}
        </div>
      )}

      <div className="flex-1" />

      {/* Asistentes */}
      <button
        type="button"
        onClick={onOpenDetail}
        className="flex items-center -space-x-2 mb-3 min-h-[28px] hover:opacity-80 transition-opacity"
      >
        {event.watch_attendees.slice(0, 5).map((a, i) => (
          <div
            key={a.user_id + i}
            className="ring-2 ring-surface rounded-full"
            title={a.profiles?.display_name}
          >
            <Avatar name={a.profiles?.display_name ?? '?'} size={28} />
          </div>
        ))}
        {count > 5 && (
          <div className="ring-2 ring-surface bg-surface-2 rounded-full w-7 h-7 flex items-center justify-center text-[10px] font-bold text-text-muted">
            +{count - 5}
          </div>
        )}
        <span
          className={cn(
            'ml-3 text-xs font-medium',
            overLimit ? 'text-danger' : isFull ? 'text-gold' : 'text-text-muted'
          )}
        >
          {limit != null ? (
            <>
              {count}/{limit} {count === 1 ? 'persona' : 'personas'}
              {isFull && !overLimit && ' · Llena'}
              {overLimit && ' · ⚠ Excedida'}
            </>
          ) : count === 0 ? (
            'Nadie aún'
          ) : (
            `${count} ${count === 1 ? 'persona' : 'personas'}`
          )}
        </span>
      </button>

      {/* Acciones */}
      <div className="flex items-center gap-2">
        <Button
          onClick={() => onToggle(event.id, !isAttending)}
          variant={isAttending ? 'ghost' : 'primary'}
          size="sm"
          className="flex-1"
          disabled={busy || (!isAttending && isFull && event.created_by !== userId)}
        >
          {busy
            ? '…'
            : isAttending
              ? 'Salirme'
              : isFull && event.created_by !== userId
                ? '🚫 Llena'
                : '+ Unirme'}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// UPCOMING MATCH CARD
// ============================================================================
function UpcomingMatchCard({
  match,
  eventsCount,
  onCreate,
}: {
  match: MatchLike;
  eventsCount: number;
  onCreate: () => void;
}) {
  return (
    <Card className="flex flex-col">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <Badge variant="default" className="text-[10px]">
          {match.phase === 'grupos' && match.group_name
            ? `Grupo ${match.group_name}`
            : match.phase ?? 'Partido'}
        </Badge>
        {eventsCount > 0 && (
          <Badge variant="accent" className="text-[10px]">
            {eventsCount} {eventsCount === 1 ? 'quedada' : 'quedadas'}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 my-2">
        <div className="text-right">
          <div className="text-2xl">{teamFlag(match.team1)}</div>
          <div className="font-semibold text-sm leading-tight mt-1">
            {teamES(match.team1)}
          </div>
        </div>
        <div className="text-text-muted font-display text-base">vs</div>
        <div className="text-left">
          <div className="text-2xl">{teamFlag(match.team2)}</div>
          <div className="font-semibold text-sm leading-tight mt-1">
            {teamES(match.team2)}
          </div>
        </div>
      </div>

      <div className="text-xs text-text-muted text-center mb-1">
        {formatMadridDate(match.match_date)}
      </div>
      {match.venue && (
        <div className="text-[11px] text-text-muted text-center mb-3">
          {match.venue}
        </div>
      )}

      <div className="flex-1" />

      <Button onClick={onCreate} size="sm" className="w-full" variant="primary">
        + Crear quedada
      </Button>
    </Card>
  );
}

// ============================================================================
// MODAL SHELL
// ============================================================================
function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-surface w-full sm:max-w-lg rounded-t-3xl sm:rounded-modal border border-border max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-bold pr-4">{title}</h2>
            <button
              onClick={onClose}
              className="text-text-muted hover:text-text text-2xl leading-none"
            >
              ×
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// EVENT DETAIL MODAL
// ============================================================================
function EventDetailModal({
  event,
  userId,
  isAdmin,
  busy,
  onClose,
  onToggle,
  onKick,
  onEdit,
  onDelete,
}: {
  event: EventLike;
  userId: string;
  isAdmin: boolean;
  busy: boolean;
  onClose: () => void;
  onToggle: (eventId: number, going: boolean) => void;
  onKick: (eventId: number, targetUserId: string) => void;
  onEdit: () => void;
  onDelete: (eventId: number) => void;
}) {
  const isAttending = event.watch_attendees.some((a) => a.user_id === userId);
  const canManage = isAdmin || event.created_by === userId;
  const count = event.watch_attendees.length;
  const limit = event.attendee_limit;
  const overLimit = limit != null && count > limit;
  const isFull = limit != null && count >= limit;

  const title =
    event.custom_title ??
    (event.matches
      ? `${teamFlag(event.matches.team1)} ${teamES(event.matches.team1)} vs ${teamFlag(event.matches.team2)} ${teamES(event.matches.team2)}`
      : 'Quedada');
  const refDate = event.matches?.match_date ?? event.custom_date;

  return (
    <ModalShell title={title} onClose={onClose}>
      {/* Info */}
      <div className="space-y-2 mb-4 text-sm">
        {refDate && (
          <div>
            <span className="text-text-muted">📅</span>{' '}
            <span className="font-medium">{formatMadridDate(refDate)}</span>
          </div>
        )}
        <div>
          <span className="text-text-muted">📍</span>{' '}
          {event.location_url ? (
            <a
              href={event.location_url}
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
            >
              {event.location}
            </a>
          ) : (
            <span className="font-medium">{event.location}</span>
          )}
        </div>
        {event.notes && (
          <div className="text-text-muted italic">"{event.notes}"</div>
        )}
      </div>

      {/* Aforo */}
      <div
        className={cn(
          'rounded-lg border px-4 py-3 mb-4 flex items-center justify-between gap-3',
          overLimit
            ? 'border-danger/40 bg-danger/10'
            : isFull
              ? 'border-gold/40 bg-gold/10'
              : 'border-border bg-surface-2'
        )}
      >
        <div>
          <div className="text-xs uppercase tracking-wide text-text-muted">Aforo</div>
          <div className="font-display text-2xl font-bold">
            {count}
            {limit != null && (
              <span className="text-text-muted text-lg">/{limit}</span>
            )}
          </div>
        </div>
        <div className="text-right text-xs">
          {limit == null ? (
            <span className="text-text-muted">Sin límite</span>
          ) : overLimit ? (
            <span className="text-danger font-semibold">
              ⚠ Excedido<br />({count - limit} de más)
            </span>
          ) : isFull ? (
            <span className="text-gold font-semibold">Llena</span>
          ) : (
            <span className="text-accent font-semibold">
              {limit - count} {limit - count === 1 ? 'plaza libre' : 'plazas libres'}
            </span>
          )}
        </div>
      </div>

      {/* Lista de asistentes */}
      <div className="mb-4">
        <div className="text-xs uppercase tracking-wide text-text-muted mb-2">
          Asistentes ({count})
        </div>
        {count === 0 ? (
          <div className="text-sm text-text-muted italic text-center py-3">
            Aún no se ha apuntado nadie.
          </div>
        ) : (
          <div className="space-y-1.5">
            {event.watch_attendees.map((a) => {
              const isCreator = a.user_id === event.created_by;
              const isYou = a.user_id === userId;
              return (
                <div
                  key={a.user_id}
                  className="flex items-center justify-between gap-2 bg-surface-2 rounded-lg px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar name={a.profiles?.display_name ?? '?'} size={28} />
                    <span className="text-sm font-medium truncate">
                      {a.profiles?.display_name ?? 'Desconocido'}
                      {isYou && (
                        <span className="text-accent text-xs ml-1.5">(tú)</span>
                      )}
                    </span>
                    {isCreator && (
                      <Badge variant="gold" className="text-[10px]">
                        Organizador
                      </Badge>
                    )}
                  </div>
                  {canManage && !isCreator && !isYou && (
                    <button
                      type="button"
                      onClick={() => onKick(event.id, a.user_id)}
                      className="text-xs text-text-muted hover:text-danger px-2 py-1"
                      title="Sacar de la quedada"
                    >
                      Sacar
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Acciones */}
      <div className="flex gap-2 flex-wrap">
        <Button
          onClick={() => onToggle(event.id, !isAttending)}
          variant={isAttending ? 'ghost' : 'primary'}
          className="flex-1"
          disabled={busy || (!isAttending && isFull && event.created_by !== userId)}
        >
          {isAttending
            ? 'Salirme de la quedada'
            : isFull && event.created_by !== userId
              ? '🚫 Quedada llena'
              : '+ Unirme'}
        </Button>
        {canManage && (
          <>
            <Button variant="secondary" onClick={onEdit}>
              ✏️ Editar
            </Button>
            <Button variant="danger" onClick={() => onDelete(event.id)}>
              🗑
            </Button>
          </>
        )}
      </div>
    </ModalShell>
  );
}

// ============================================================================
// EDIT EVENT MODAL
// ============================================================================
function EditEventModal({
  event,
  onClose,
  onSave,
}: {
  event: EventLike;
  onClose: () => void;
  onSave: (data: {
    location: string;
    location_url: string | null;
    notes: string | null;
    attendee_limit: number | null;
  }) => Promise<void> | void;
}) {
  const [location, setLocation] = useState(event.location);
  const [locationUrl, setLocationUrl] = useState(event.location_url ?? '');
  const [notes, setNotes] = useState(event.notes ?? '');
  const [hasLimit, setHasLimit] = useState(event.attendee_limit != null);
  const [limit, setLimit] = useState<string>(
    event.attendee_limit?.toString() ?? ''
  );
  const [submitting, setSubmitting] = useState(false);

  const currentCount = event.watch_attendees.length;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location.trim()) {
      alert('Indica un lugar.');
      return;
    }
    let parsedLimit: number | null = null;
    if (hasLimit) {
      const n = parseInt(limit, 10);
      if (!Number.isFinite(n) || n < 1) {
        alert('El límite debe ser un número mayor o igual a 1.');
        return;
      }
      parsedLimit = n;
      if (parsedLimit < currentCount) {
        if (
          !confirm(
            `Hay ${currentCount} personas apuntadas y vas a poner el límite en ${parsedLimit}. ` +
              `Quedarán ${currentCount - parsedLimit} por encima del nuevo aforo. ¿Continuar?`
          )
        ) {
          return;
        }
      }
    }

    setSubmitting(true);
    await onSave({
      location: location.trim(),
      location_url: locationUrl.trim() || null,
      notes: notes.trim() || null,
      attendee_limit: parsedLimit,
    });
    setSubmitting(false);
  };

  return (
    <ModalShell title="Editar quedada" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="text-xs uppercase tracking-widest text-text-muted block mb-1.5">
            Lugar
          </label>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>

        <div>
          <label className="text-xs uppercase tracking-widest text-text-muted block mb-1.5">
            Enlace <span className="normal-case">— opcional</span>
          </label>
          <Input
            type="url"
            placeholder="https://…"
            value={locationUrl}
            onChange={(e) => setLocationUrl(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs uppercase tracking-widest text-text-muted block mb-1.5">
            Notas <span className="normal-case">— opcional</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none resize-none"
          />
        </div>

        <LimitField
          hasLimit={hasLimit}
          setHasLimit={setHasLimit}
          limit={limit}
          setLimit={setLimit}
          currentCount={currentCount}
        />

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting} className="flex-1">
            {submitting ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

// ============================================================================
// CREATE EVENT MODAL
// ============================================================================
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
    attendee_limit: number | null;
  }) => Promise<void> | void;
}) {
  const [matchId, setMatchId] = useState<string>(preMatch?.id.toString() ?? '');
  const [customTitle, setCustomTitle] = useState('');
  const [customDate, setCustomDate] = useState('');
  const [location, setLocation] = useState('');
  const [locationUrl, setLocationUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [hasLimit, setHasLimit] = useState(false);
  const [limit, setLimit] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [includeMatch, setIncludeMatch] = useState<boolean>(kind === 'match');
  const [matchQuery, setMatchQuery] = useState('');

  const filteredMatches = matchQuery
    ? allMatches.filter((m) =>
        `${teamES(m.team1)} ${teamES(m.team2)} ${m.team1} ${m.team2}`
          .toLowerCase()
          .includes(matchQuery.toLowerCase())
      )
    : allMatches.slice(0, 20);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location.trim()) {
      alert('Indica un lugar.');
      return;
    }
    let parsedLimit: number | null = null;
    if (hasLimit) {
      const n = parseInt(limit, 10);
      if (!Number.isFinite(n) || n < 1) {
        alert('El límite debe ser un número mayor o igual a 1.');
        return;
      }
      parsedLimit = n;
    }

    let finalMatchId: number | null = null;
    let finalCustomTitle: string | null = null;
    let finalCustomDate: string | null = null;

    if (includeMatch) {
      if (!matchId) {
        alert('Elige un partido.');
        return;
      }
      finalMatchId = parseInt(matchId, 10);
    } else {
      if (!customTitle.trim()) {
        alert('Indica un título para la quedada personalizada.');
        return;
      }
      if (!customDate) {
        alert('Indica fecha y hora.');
        return;
      }
      finalCustomTitle = customTitle.trim();
      finalCustomDate = new Date(customDate).toISOString();
    }

    setSubmitting(true);
    await onCreate({
      match_id: finalMatchId,
      custom_title: finalCustomTitle,
      custom_date: finalCustomDate,
      location: location.trim(),
      location_url: locationUrl.trim() || null,
      notes: notes.trim() || null,
      attendee_limit: parsedLimit,
    });
    setSubmitting(false);
  };

  return (
    <ModalShell title="Crear quedada" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="flex bg-surface-2 rounded-full p-1">
          <button
            type="button"
            onClick={() => setIncludeMatch(true)}
            className={cn(
              'flex-1 py-2 text-sm font-medium rounded-full',
              includeMatch ? 'bg-accent text-black' : 'text-text-muted'
            )}
          >
            Para un partido
          </button>
          <button
            type="button"
            onClick={() => setIncludeMatch(false)}
            className={cn(
              'flex-1 py-2 text-sm font-medium rounded-full',
              !includeMatch ? 'bg-accent text-black' : 'text-text-muted'
            )}
          >
            Personalizada
          </button>
        </div>

        {includeMatch ? (
          <div>
            <label className="text-xs uppercase tracking-widest text-text-muted block mb-1.5">
              Partido
            </label>
            {preMatch ? (
              <div className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm">
                {teamFlag(preMatch.team1)} {teamES(preMatch.team1)} vs{' '}
                {teamFlag(preMatch.team2)} {teamES(preMatch.team2)}{' '}
                <span className="text-text-muted">
                  · {formatMadridDate(preMatch.match_date)}
                </span>
              </div>
            ) : (
              <>
                <Input
                  placeholder="Buscar partido (ej. España, Brasil…)"
                  value={matchQuery}
                  onChange={(e) => setMatchQuery(e.target.value)}
                  className="mb-2"
                />
                <select
                  value={matchId}
                  onChange={(e) => setMatchId(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none"
                  size={Math.min(filteredMatches.length, 6)}
                >
                  {filteredMatches.map((m) => (
                    <option key={m.id} value={m.id}>
                      {teamES(m.team1)} vs {teamES(m.team2)} ·{' '}
                      {formatMadridDate(m.match_date)}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        ) : (
          <>
            <div>
              <label className="text-xs uppercase tracking-widest text-text-muted block mb-1.5">
                Título
              </label>
              <Input
                placeholder="Ej. Jornada del sábado completa"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-text-muted block mb-1.5">
                Fecha y hora (Madrid)
              </label>
              <Input
                type="datetime-local"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
              />
            </div>
          </>
        )}

        <div>
          <label className="text-xs uppercase tracking-widest text-text-muted block mb-1.5">
            Lugar
          </label>
          <Input
            placeholder="Bar, casa de alguien…"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs uppercase tracking-widest text-text-muted block mb-1.5">
            Enlace <span className="normal-case">— opcional</span>
          </label>
          <Input
            type="url"
            placeholder="https://maps.google.com/…"
            value={locationUrl}
            onChange={(e) => setLocationUrl(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs uppercase tracking-widest text-text-muted block mb-1.5">
            Notas <span className="normal-case">— opcional</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Llegamos pronto, reservamos la mesa del fondo…"
            rows={2}
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none resize-none"
          />
        </div>

        <LimitField
          hasLimit={hasLimit}
          setHasLimit={setHasLimit}
          limit={limit}
          setLimit={setLimit}
        />

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting} className="flex-1">
            {submitting ? 'Creando…' : 'Crear quedada'}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

// ============================================================================
// LIMIT FIELD (reusable)
// ============================================================================
function LimitField({
  hasLimit,
  setHasLimit,
  limit,
  setLimit,
  currentCount,
}: {
  hasLimit: boolean;
  setHasLimit: (v: boolean) => void;
  limit: string;
  setLimit: (v: string) => void;
  currentCount?: number;
}) {
  return (
    <div>
      <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-text-muted mb-2 cursor-pointer">
        <input
          type="checkbox"
          checked={hasLimit}
          onChange={(e) => setHasLimit(e.target.checked)}
          className="accent-accent"
        />
        Limitar nº de asistentes
      </label>
      {hasLimit && (
        <Input
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          placeholder="Ej. 8"
          value={limit}
          onChange={(e) => setLimit(e.target.value.replace(/\D/g, ''))}
        />
      )}
      {hasLimit && currentCount != null && (
        <div className="text-[11px] text-text-muted mt-1">
          Actualmente hay {currentCount}{' '}
          {currentCount === 1 ? 'persona apuntada' : 'personas apuntadas'}.
        </div>
      )}
    </div>
  );
}
