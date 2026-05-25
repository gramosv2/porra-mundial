import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Navbar } from '@/components/navbar';
import type { Profile } from '@/types';

export async function requireApprovedUser(): Promise<Profile> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile) redirect('/auth/login');
  if (!profile.approved) redirect('/auth/pending');

  return profile as Profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireApprovedUser();
  if (profile.role !== 'admin') redirect('/dashboard');
  return profile;
}

export async function AppShell({ children }: { children: React.ReactNode }) {
  const profile = await requireApprovedUser();
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar profile={profile} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10">{children}</main>
    </div>
  );
}
