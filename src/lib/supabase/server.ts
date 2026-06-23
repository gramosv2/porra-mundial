import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Llamado desde Server Component; ignorable.
          }
        },
      },
    }
  );
}

// Cliente con service role (sólo en routes/server actions privilegiadas).
//
// IMPORTANTE — caché de fetch en Next.js:
// El SDK de Supabase usa `fetch` por debajo. Next.js 14 puede cachear
// llamadas a fetch incluso dentro de rutas marcadas `force-dynamic`, salvo
// que cada fetch indique explícitamente `cache: 'no-store'`. Por eso aquí
// inyectamos un `fetch` envuelto que SIEMPRE fuerza no-store, así cualquier
// query hecha con este cliente (en cualquier página o endpoint) lee siempre
// el dato fresco de Supabase, sin depender de que cada caller lo recuerde.
export function createAdminClient() {
  const { createClient: createSbClient } = require('@supabase/supabase-js');

  const noStoreFetch: typeof fetch = (url, init) =>
    fetch(url, { ...init, cache: 'no-store' });

  return createSbClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: noStoreFetch },
    }
  );
}
