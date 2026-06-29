'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card, Avatar, Badge } from '@/components/ui';
import { Button } from '@/components/ui/button';
import type { Profile } from '@/types';

interface Props {
  pending: Profile[];
  approved: Profile[];
}

export function UsersClient({ pending, approved }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function setApproved(userId: string, value: boolean) {
    setBusyId(userId);
    const { error } = await supabase.from('profiles').update({ approved: value }).eq('id', userId);
    setBusyId(null);
    if (error) {
      alert('Error: ' + error.message);
      return;
    }
    startTransition(() => router.refresh());
  }

  async function setRole(userId: string, role: 'user' | 'admin') {
    setBusyId(userId);
    const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
    setBusyId(null);
    if (error) {
      alert('Error: ' + error.message);
      return;
    }
    startTransition(() => router.refresh());
  }

  async function rejectUser(userId: string) {
    if (
      !confirm(
        '¿Rechazar a este usuario? Su cuenta quedará marcada como no aprobada (sigue existiendo en auth).'
      )
    )
      return;
    await setApproved(userId, false);
  }

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Pendientes */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl font-semibold">Pendientes de aprobación</h2>
          <Badge variant={pending.length > 0 ? 'accent' : 'default'}>
            {pending.length} {pending.length === 1 ? 'usuario' : 'usuarios'}
          </Badge>
        </div>

        {pending.length === 0 ? (
          <Card>
            <p className="text-text-muted text-center py-6">No hay solicitudes pendientes.</p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {pending.map((u) => (
              <Card key={u.id} className="flex items-center gap-4 flex-wrap">
                <Avatar name={u.display_name} size={44} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{u.display_name}</div>
                  <div className="text-xs text-text-muted truncate">@{u.username}</div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => setApproved(u.id, true)}
                    disabled={busyId === u.id || isPending}
                  >
                    Aprobar
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => rejectUser(u.id)}
                    disabled={busyId === u.id || isPending}
                  >
                    Rechazar
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Aprobados */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl font-semibold">Usuarios aprobados</h2>
          <Badge>{approved.length}</Badge>
        </div>

        <div className="grid gap-3">
          {approved.map((u) => (
            <Card key={u.id} className="flex items-center gap-4 flex-wrap">
              <Avatar name={u.display_name} size={44} />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate flex items-center gap-2">
                  {u.display_name}
                  {u.role === 'admin' && <Badge variant="gold">Admin</Badge>}
                </div>
                <div className="text-xs text-text-muted truncate">
                  @{u.username} · {u.total_points} pts
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/admin/usuario/${u.id}`}
                  className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border border-border text-text-muted hover:text-text hover:border-accent/50 transition-colors"
                >
                  Ver predicciones
                </Link>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setRole(u.id, u.role === 'admin' ? 'user' : 'admin')}
                  disabled={busyId === u.id || isPending}
                >
                  {u.role === 'admin' ? 'Quitar admin' : 'Hacer admin'}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => setApproved(u.id, false)}
                  disabled={busyId === u.id || isPending}
                >
                  Bloquear
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
