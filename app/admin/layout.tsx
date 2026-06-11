import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { Navbar } from '@/components/navbar';

const ADMIN_LINKS = [
  { href: '/admin/usuarios', label: 'Usuarios', icon: '👥' },
  { href: '/admin/partidos', label: 'Partidos', icon: '⚽' },
  { href: '/admin/predicciones', label: 'Predicciones', icon: '🔮' },
  { href: '/admin/eliminatorias', label: 'Eliminatorias', icon: '🏆' },
  { href: '/admin/especiales', label: 'Especiales', icon: '🥇' },
  { href: '/admin/newsletters', label: 'Newsletter', icon: '📰' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireAdmin();

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar profile={profile} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="mb-6">
          <div className="text-xs uppercase tracking-widest text-accent font-medium mb-1">
            Panel de administración
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold">Gestión del torneo</h1>
        </div>

        <nav className="flex flex-wrap gap-2 mb-8 pb-4 border-b border-border">
          {ADMIN_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-4 py-2 rounded-full bg-surface border border-border text-sm font-medium hover:border-accent/40 hover:text-accent transition-colors"
            >
              <span className="mr-1.5">{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </nav>

        {children}
      </main>
    </div>
  );
}
