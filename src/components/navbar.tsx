'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Avatar } from './ui';
import { cn } from '@/lib/utils';
import type { Profile } from '@/types';

interface NavbarProps {
  profile: Profile;
}

const LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/partidos', label: 'Partidos' },
  { href: '/clasificacion', label: 'Clasificación' },
  { href: '/mis-predicciones', label: 'Mis predicciones' },
  { href: '/quedadas', label: 'Quedadas' },
  { href: '/calendario', label: 'Calendario' },
];

export function Navbar({ profile }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const supabase = createClient();

  const logout = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <nav className="sticky top-0 z-40 bg-background/85 backdrop-blur-xl border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 group">
          <span className="text-2xl">⚽</span>
          <span className="font-display font-bold text-lg tracking-tight group-hover:text-accent">
            PorraMundial<span className="text-accent ml-1">2026</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden lg:flex items-center gap-1">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                'px-3 py-2 text-sm rounded-full font-medium',
                pathname.startsWith(l.href)
                  ? 'text-accent bg-accent/10'
                  : 'text-text-muted hover:text-text hover:bg-surface-2'
              )}
            >
              {l.label}
            </Link>
          ))}
          {profile.role === 'admin' && (
            <Link
              href="/admin/usuarios"
              className={cn(
                'px-3 py-2 text-sm rounded-full font-medium',
                pathname.startsWith('/admin')
                  ? 'text-gold bg-gold/10'
                  : 'text-text-muted hover:text-gold'
              )}
            >
              Admin
            </Link>
          )}
        </div>

        {/* User chip */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-surface-2 border border-border rounded-full pl-1 pr-3 py-1">
            <Avatar name={profile.display_name} size={28} />
            <div className="flex flex-col leading-tight">
              <span className="text-xs font-medium">{profile.display_name}</span>
              <span className="text-[10px] text-accent font-bold">
                {profile.total_points} pts
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            className="hidden sm:inline-flex text-xs text-text-muted hover:text-danger px-2 py-1"
          >
            Salir
          </button>
          <button
            onClick={() => setOpen(!open)}
            className="lg:hidden p-2 rounded-md hover:bg-surface-2"
            aria-label="Menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {open ? (
                <path d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="lg:hidden border-t border-border bg-surface animate-fade-in">
          <div className="px-4 py-3 flex flex-col gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'px-3 py-2 rounded-lg text-sm font-medium',
                  pathname.startsWith(l.href)
                    ? 'text-accent bg-accent/10'
                    : 'text-text-muted hover:text-text hover:bg-surface-2'
                )}
              >
                {l.label}
              </Link>
            ))}
            {profile.role === 'admin' && (
              <Link
                href="/admin/usuarios"
                onClick={() => setOpen(false)}
                className="px-3 py-2 rounded-lg text-sm font-medium text-gold hover:bg-gold/10"
              >
                Admin
              </Link>
            )}
            <div className="pt-2 mt-2 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar name={profile.display_name} size={28} />
                <div className="flex flex-col leading-tight">
                  <span className="text-xs font-medium">{profile.display_name}</span>
                  <span className="text-[10px] text-accent font-bold">{profile.total_points} pts</span>
                </div>
              </div>
              <button onClick={logout} className="text-xs text-danger px-3 py-1">
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
