'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, Input } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { NewsletterCard } from '@/components/newsletter-card';
import { formatMadridDate } from '@/lib/utils';
import type { Newsletter } from '@/types';

interface Props {
  initial: Newsletter[];
}

export function NewslettersAdminClient({ initial }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [list, setList] = useState(initial);
  const [editing, setEditing] = useState<Newsletter | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  function resetForm() {
    setTitle('');
    setBody('');
    setEditing(null);
    setShowForm(false);
    setShowPreview(false);
  }

  function startCreate() {
    setEditing(null);
    setTitle('');
    setBody('');
    setShowForm(true);
    setShowPreview(false);
  }

  function startEdit(n: Newsletter) {
    setEditing(n);
    setTitle(n.title);
    setBody(n.body);
    setShowForm(true);
    setShowPreview(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      alert('Pon un título.');
      return;
    }
    if (!body.trim()) {
      alert('El cuerpo no puede estar vacío.');
      return;
    }

    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    if (editing) {
      const { data, error } = await supabase
        .from('newsletters')
        .update({
          title: title.trim(),
          body: body.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', editing.id)
        .select()
        .single();
      setSaving(false);
      if (error || !data) {
        alert('Error al guardar: ' + error?.message);
        return;
      }
      setList((prev) => prev.map((n) => (n.id === editing.id ? (data as Newsletter) : n)));
    } else {
      const { data, error } = await supabase
        .from('newsletters')
        .insert({
          title: title.trim(),
          body: body.trim(),
          created_by: user.id,
        })
        .select()
        .single();
      setSaving(false);
      if (error || !data) {
        alert('Error al publicar: ' + error?.message);
        return;
      }
      setList((prev) => [data as Newsletter, ...prev]);
    }

    resetForm();
    startTransition(() => router.refresh());
  }

  async function remove(n: Newsletter) {
    if (!confirm(`¿Eliminar "${n.title}"? No se puede deshacer.`)) return;
    const { error } = await supabase.from('newsletters').delete().eq('id', n.id);
    if (error) {
      alert('Error: ' + error.message);
      return;
    }
    setList((prev) => prev.filter((x) => x.id !== n.id));
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-2xl font-bold">📰 Newsletter</h2>
          <p className="text-sm text-text-muted">
            {list.length} {list.length === 1 ? 'publicación' : 'publicaciones'}.
            La más reciente aparece en el dashboard de todos los usuarios.
          </p>
        </div>
        {!showForm && (
          <Button onClick={startCreate}>+ Nueva newsletter</Button>
        )}
      </div>

      {/* Formulario */}
      {showForm && (
        <Card>
          <form onSubmit={save} className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-display text-lg font-semibold">
                {editing ? 'Editar newsletter' : 'Nueva newsletter'}
              </h3>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreview((p) => !p)}
                >
                  {showPreview ? '✏ Editar' : '👁 Vista previa'}
                </Button>
              </div>
            </div>

            {showPreview ? (
              <div className="border border-border rounded-lg p-1 bg-background">
                <NewsletterCard
                  newsletter={{
                    id: 0,
                    title: title || 'Sin título',
                    body: body || '(vacío)',
                    published_at: new Date().toISOString(),
                    created_by: null,
                    updated_at: new Date().toISOString(),
                  }}
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="text-xs uppercase tracking-widest text-text-muted block mb-1.5">
                    Título
                  </label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Jornada 1: ¡arrancamos!"
                    maxLength={120}
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-text-muted block mb-1.5">
                    Cuerpo (texto plano, los saltos de línea se respetan)
                  </label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={10}
                    placeholder={
                      'Hola equipo,\n\nEsta semana arranca la fase de grupos…\n\nMucha suerte!'
                    }
                    className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none resize-y font-mono"
                  />
                  <p className="text-[11px] text-text-muted mt-1">
                    {body.length} caracteres.
                  </p>
                </div>
              </>
            )}

            <div className="flex gap-2 justify-end pt-2 border-t border-border">
              <Button type="button" variant="ghost" onClick={resetForm}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving
                  ? 'Guardando…'
                  : editing
                    ? 'Guardar cambios'
                    : 'Publicar'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Listado */}
      {list.length === 0 ? (
        <Card>
          <p className="text-text-muted text-sm text-center py-6">
            Aún no has publicado ninguna newsletter.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((n) => (
            <Card key={n.id} className="!p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-text-muted mb-1">
                    {formatMadridDate(n.published_at)}
                    {n.updated_at && n.updated_at !== n.published_at && (
                      <span className="ml-2 italic">(editada)</span>
                    )}
                  </div>
                  <div className="font-display text-lg font-bold mb-1">
                    {n.title}
                  </div>
                  <div className="text-sm text-text-muted whitespace-pre-line line-clamp-3">
                    {n.body}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button size="sm" variant="secondary" onClick={() => startEdit(n)}>
                    ✏️ Editar
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => remove(n)}>
                    🗑
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
