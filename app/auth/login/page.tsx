'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError('Email o contraseña incorrectos');
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <main className="min-h-screen gradient-hero flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="inline-flex items-center gap-2 mb-8 text-text-muted hover:text-text">
          <span>←</span> Volver
        </Link>
        <div className="bg-surface border border-border rounded-modal p-8">
          <div className="mb-2">
            <div className="font-display font-bold text-base sm:text-lg leading-tight">
              Porra 🇺🇸🇨🇦🇲🇽 FIFA World Cup{' '}
              <span className="text-accent">2026</span> 🌎🏆
            </div>
            <div className="font-display text-xs sm:text-sm text-text-muted font-medium mt-0.5">
              Win it all 💶💶
            </div>
          </div>
          <h1 className="font-display text-3xl font-bold mt-4">Bienvenido de nuevo</h1>
          <p className="text-text-muted text-sm mt-2">Inicia sesión para seguir prediciendo</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <label className="text-xs text-text-muted font-medium uppercase tracking-wide">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full mt-1.5"
                placeholder="tu@email.com"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted font-medium uppercase tracking-wide">Contraseña</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full mt-1.5"
              />
            </div>
            {error && (
              <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">{error}</div>
            )}
            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>

          <p className="text-sm text-text-muted text-center mt-6">
            ¿Aún no tienes cuenta?{' '}
            <Link href="/auth/register" className="text-accent hover:underline">
              Regístrate
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
