import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase.from('profiles').select('approved').eq('id', user.id).single();
    redirect(profile?.approved ? '/dashboard' : '/auth/pending');
  }

  return (
    <main className="min-h-screen gradient-hero relative overflow-hidden">
      <div className="ball-blur absolute inset-0" />

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-20 sm:py-32">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface/80 border border-border text-xs text-text-muted mb-8 backdrop-blur">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-dot" />
          🇺🇸 🇨🇦 🇲🇽 FIFA World Cup 2026 · 48 selecciones · 11 junio – 19 julio
        </div>

        <h1 className="font-display text-5xl sm:text-7xl lg:text-8xl font-extrabold tracking-tight leading-[0.95] max-w-4xl">
          La porra del{' '}
          <span className="bg-gradient-to-br from-accent via-emerald-300 to-gold bg-clip-text text-transparent">
            Mundial 2026
          </span>{' '}
          entre amigos. 🏆
        </h1>

        <p className="mt-6 text-text-muted text-lg max-w-2xl leading-relaxed">
          Predice los 104 partidos del primer Mundial con 48 selecciones. Marcadores exactos,
          premios individuales y clasificación en tiempo real. <span className="text-text">Win it all 💶💶</span>
        </p>

        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/auth/register"
            className="inline-flex items-center gap-2 bg-accent text-black font-semibold px-7 py-3.5 rounded-full hover:bg-accent/90 hover:shadow-[0_0_32px_-4px_rgba(16,185,129,0.6)] transition-all"
          >
            Crear cuenta →
          </Link>
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-2 bg-surface border border-border text-text font-semibold px-7 py-3.5 rounded-full hover:border-accent transition-all"
          >
            Iniciar sesión
          </Link>
        </div>

        <div className="mt-20 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl">
          {[
            { v: '48', l: 'selecciones' },
            { v: '12', l: 'grupos' },
            { v: '104', l: 'partidos' },
            { v: '5', l: 'premios' },
          ].map((s) => (
            <div key={s.l} className="bg-surface/60 backdrop-blur border border-border rounded-card p-4">
              <div className="font-display text-3xl font-bold text-accent">{s.v}</div>
              <div className="text-xs text-text-muted uppercase tracking-wide mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      <footer className="relative z-10 border-t border-border mt-12 py-6 text-center text-xs text-text-muted">
        Hecho con cariño para amigos · v1.0
      </footer>
    </main>
  );
}
