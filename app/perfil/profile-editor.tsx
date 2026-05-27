'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, Input } from '@/components/ui';
import { Button } from '@/components/ui/button';
import type { Profile } from '@/types';

const MAX_BIO_LENGTH = 280;
const AVATAR_MAX_SIZE = 800; // px (lado mayor tras resize)

interface Props {
  profile: Profile;
}

/**
 * Redimensiona una imagen al lado mayor MAX_SIZE manteniendo aspect ratio,
 * la convierte a JPEG calidad 0.85 y devuelve un Blob.
 * Útil para que las fotos en Storage no pesen MB innecesarios.
 */
async function resizeImage(file: File, maxSize: number): Promise<Blob> {
  const dataUrl: string = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(new Error('No se pudo leer el archivo.'));
    r.readAsDataURL(file);
  });

  const img: HTMLImageElement = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('No se pudo cargar la imagen.'));
    i.src = dataUrl;
  });

  let { width, height } = img;
  if (width > height && width > maxSize) {
    height = Math.round((height * maxSize) / width);
    width = maxSize;
  } else if (height > maxSize) {
    width = Math.round((width * maxSize) / height);
    height = maxSize;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible.');
  ctx.drawImage(img, 0, 0, width, height);

  const blob: Blob = await new Promise((res, rej) =>
    canvas.toBlob(
      (b) => (b ? res(b) : rej(new Error('toBlob falló.'))),
      'image/jpeg',
      0.85
    )
  );
  return blob;
}

export function ProfileEditor({ profile }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [bio, setBio] = useState(profile.bio ?? '');
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function flashSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 2500);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Tienes que seleccionar una imagen.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('La imagen no puede pesar más de 8 MB.');
      return;
    }

    setUploading(true);
    try {
      const blob = await resizeImage(file, AVATAR_MAX_SIZE);
      const path = `${profile.id}/avatar-${Date.now()}.jpg`;

      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, blob, {
          contentType: 'image/jpeg',
          upsert: true,
          cacheControl: '3600',
        });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const newUrl = pub.publicUrl;

      const { error: updErr } = await supabase
        .from('profiles')
        .update({ avatar_url: newUrl })
        .eq('id', profile.id);
      if (updErr) throw updErr;

      setAvatarUrl(newUrl);
      flashSuccess('Foto actualizada.');
      startTransition(() => router.refresh());
    } catch (e: any) {
      setError(e?.message ?? 'Error al subir la foto.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function removeAvatar() {
    if (!avatarUrl) return;
    if (!confirm('¿Quitar tu foto?')) return;
    setError(null);
    setUploading(true);
    try {
      const { error: updErr } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', profile.id);
      if (updErr) throw updErr;
      setAvatarUrl(null);
      flashSuccess('Foto eliminada.');
      startTransition(() => router.refresh());
    } catch (e: any) {
      setError(e?.message ?? 'Error al quitar la foto.');
    } finally {
      setUploading(false);
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!displayName.trim()) {
      setError('El nombre no puede estar vacío.');
      return;
    }
    if (bio.length > MAX_BIO_LENGTH) {
      setError(`La bio supera ${MAX_BIO_LENGTH} caracteres.`);
      return;
    }
    setSaving(true);
    const { error: upErr } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim(),
        bio: bio.trim() || null,
      })
      .eq('id', profile.id);
    setSaving(false);
    if (upErr) {
      setError(upErr.message);
      return;
    }
    flashSuccess('Perfil guardado.');
    startTransition(() => router.refresh());
  }

  return (
    <Card>
      <form onSubmit={saveProfile} className="space-y-5">
        {/* Avatar */}
        <div>
          <label className="text-xs uppercase tracking-widest text-text-muted block mb-2">
            Foto de perfil
          </label>
          <div className="flex items-start gap-4 flex-wrap">
            <div className="w-24 h-24 rounded-2xl overflow-hidden bg-surface-2 border border-border flex-shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl text-text-muted">
                  📷
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 flex-1 min-w-[180px]">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleFile}
                disabled={uploading}
                className="hidden"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? 'Subiendo…' : avatarUrl ? 'Cambiar foto' : 'Subir foto'}
              </Button>
              {avatarUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={removeAvatar}
                  disabled={uploading}
                >
                  Quitar foto
                </Button>
              )}
              <p className="text-[11px] text-text-muted">
                Se redimensiona a {AVATAR_MAX_SIZE}px de lado mayor. Formatos: JPG, PNG, WebP.
              </p>
            </div>
          </div>
        </div>

        {/* Display name */}
        <div>
          <label className="text-xs uppercase tracking-widest text-text-muted block mb-1.5">
            Nombre mostrado
          </label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={40}
          />
        </div>

        {/* Bio */}
        <div>
          <div className="flex justify-between items-baseline mb-1.5">
            <label className="text-xs uppercase tracking-widest text-text-muted">
              Biografía
            </label>
            <span
              className={
                bio.length > MAX_BIO_LENGTH
                  ? 'text-xs text-danger'
                  : 'text-xs text-text-muted'
              }
            >
              {bio.length} / {MAX_BIO_LENGTH}
            </span>
          </div>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            placeholder="Otro año más por aquí para llevarme el bote 🏆"
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none resize-none"
          />
        </div>

        {/* Feedback */}
        {error && (
          <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        {success && (
          <div className="text-sm text-accent bg-accent/10 border border-accent/30 rounded-lg px-3 py-2">
            ✓ {success}
          </div>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar perfil'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
