'use client';

import Link from 'next/link';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui';

export default function RegisterPage() {
  const supabase = createClient();
  const [form, setForm] = useState({ display_name: '', username: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  function field<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (!/^[a-z0-9_]{3,20}$/.test(form.username)) {
      setError('El username debe ser 3-20 caracteres en minúscula, números o _');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { display_name: form.display_name, username: form.username },
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSuccess(true);
  }

  if (success) {
    return (
      <main className="min-h-screen gradient-hero flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md bg-surface border border-border rounded-modal p-8 text-center">
          <div className="text-5xl mb-4">⏳</div>
          <h1 className="font-display text-2xl font-bold">Solicitud enviada</h1>
          <p className="text-text-muted mt-3 text-sm leading-relaxed">
            Tu cuenta ha sido creada. El administrador revisará tu solicitud y te dará acceso pronto.
            Mientras tanto, no podrás predecir partidos.
          </p>
          <Link
            href="/auth/login"
            className="inline-block mt-6 bg-accent text-black px-5 py-2.5 rounded-full font-semibold hover:bg-accent/90"
          >
            Ir a inicio de sesión
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen gradient-hero flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="inline-flex items-center gap-2 mb-8 text-text-muted hover:text-text">
          <span>←</span> Volver
        </Link>
        <div className="bg-surface border border-border rounded-modal p-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">⚽</span>
            <span className="font-display font-bold text-lg">PorraMundial 2026</span>
          </div>
          <h1 className="font-display text-3xl font-bold mt-4">Crear cuenta</h1>
          <p className="text-text-muted text-sm mt-2">El admin debe aprobarte antes de empezar a predecir</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <label className="text-xs text-text-muted font-medium uppercase tracking-wide">Nombre para mostrar</label>
              <Input
                value={form.display_name}
                onChange={(e) => field('display_name', e.target.value)}
                required
                className="w-full mt-1.5"
                placeholder="Juanito"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted font-medium uppercase tracking-wide">Username</label>
              <Input
                value={form.username}
                onChange={(e) => field('username', e.target.value.toLowerCase())}
                required
                className="w-full mt-1.5"
                placeholder="juanito_03"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted font-medium uppercase tracking-wide">Email</label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => field('email', e.target.value)}
                required
                className="w-full mt-1.5"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted font-medium uppercase tracking-wide">Contraseña</label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => field('password', e.target.value)}
                required
                minLength={6}
                className="w-full mt-1.5"
              />
            </div>
            {error && (
              <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">{error}</div>
            )}
            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading ? 'Creando…' : 'Crear cuenta'}
            </Button>
          </form>

          <p className="text-sm text-text-muted text-center mt-6">
            ¿Ya tienes cuenta?{' '}
            <Link href="/auth/login" className="text-accent hover:underline">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
