import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LogoutButton } from './logout-button';

export default async function PendingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('approved, display_name')
    .eq('id', user.id)
    .single();
  if (profile?.approved) redirect('/dashboard');

  return (
    <main className="min-h-screen gradient-hero flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md bg-surface border border-border rounded-modal p-8 text-center">
        <div className="text-5xl mb-4">⏳</div>
        <h1 className="font-display text-2xl font-bold">Hola {profile?.display_name}</h1>
        <p className="text-text-muted mt-3 text-sm leading-relaxed">
          Tu cuenta está pendiente de aprobación. El administrador te dará acceso pronto. Cuando lo
          haga, podrás entrar y empezar a predecir partidos.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link
            href="/auth/login"
            className="text-text-muted hover:text-text text-sm underline-offset-4 hover:underline"
          >
            Refrescar / volver a entrar
          </Link>
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
