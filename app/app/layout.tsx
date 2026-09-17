'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';

import ThemeToggle from '@/components/ui/ThemeToggle';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<any>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function loadProfile() {
      // First check onboarding study data for personalized profile
      let customData: any = null;
      try {
        const saved = localStorage.getItem('synapse_study_data');
        if (saved) customData = JSON.parse(saved);
      } catch (e) {}

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
          setProfile(data || {
            full_name: customData?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Learner',
            email: user.email,
            skill_domain: customData?.domain || 'Full-Stack Development',
          });
          return;
        }
      } catch (e) {
        console.warn('Supabase auth check error:', e);
      }

      // Check for demo mode session
      const isDemo = typeof document !== 'undefined' && (
        document.cookie.includes('synapse_demo_session=true') ||
        localStorage.getItem('synapse_demo_active') === 'true' ||
        Boolean(customData)
      );

      if (isDemo) {
        setProfile({
          full_name: customData?.name || localStorage.getItem('synapse_user_name') || 'Alex Morgan',
          email: customData?.email || 'alex.morgan@synapse.edu',
          skill_level: customData?.level || 'intermediate',
          skill_domain: customData?.domain || 'React',
          learning_goal: customData?.goal || 'Full-Stack React & AI Agents',
        });
      } else {
        router.push('/login');
      }

      // Broadcast presence on peer-network for live multi-device pairing
      const activeEmail = customData?.email || localStorage.getItem('synapse_user_email');
      const activeName = customData?.name || localStorage.getItem('synapse_user_name') || 'Learner';
      const activeDomain = customData?.domain || 'React';
      if (activeEmail && !activeEmail.includes('demo')) {
        try {
          fetch('/api/peer-network', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: activeName,
              email: activeEmail,
              domain: activeDomain,
              level: customData?.level || 'intermediate',
              score: customData?.score || 85,
            })
          }).catch(() => {});
        } catch (e) {}
      }
    }
    loadProfile();
  }, [router, supabase]);

  const handleLogout = async () => {
    try {
      document.cookie = 'synapse_demo_session=; path=/; max-age=0';
      localStorage.removeItem('synapse_demo_active');
      localStorage.removeItem('synapse_user_name');
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Signout warning:', e);
    }
    router.push('/login');
  };

  const tabs = [
    { name: 'Skills', path: '/app/skills', icon: '📊' },
    { name: 'Match', path: '/app/match', icon: '🤝' },
    { name: 'Sessions', path: '/app/sessions', icon: '💬' },
    { name: 'Reputation', path: '/app/reputation', icon: '⭐' },
    { name: 'Settings', path: '/app/settings', icon: '⚙️' },
  ];

  return (
    <div className="min-h-screen bg-canvas flex flex-col text-ink font-sans">
      {/* Top Header */}
      <header className="bg-card border-b border-border sticky top-0 z-30 shadow-xs">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/app" className="text-2xl font-serif font-bold text-ink tracking-tight flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber to-terracotta flex items-center justify-center text-white text-base shadow-xs">
                S
              </span>
              <span>Synapse</span>
            </Link>
            <span className="hidden sm:inline-flex text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-amber/10 text-amber border border-amber/20">
              {profile?.skill_domain ? `${profile.skill_domain} Track` : 'Peer Learning'}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 p-1.5 pl-2.5 sm:pl-3 rounded-full bg-card-alt border border-border hover:border-amber transition-colors cursor-pointer"
              >
                <span className="text-xs font-medium text-ink hidden sm:inline max-w-[120px] truncate">
                  {profile?.full_name || 'Learner'}
                </span>
                <div className="w-8 h-8 rounded-full bg-amber text-white flex items-center justify-center font-semibold text-sm shadow-xs">
                  {profile?.full_name?.charAt(0)?.toUpperCase() || 'A'}
                </div>
              </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-card border border-border rounded-2xl shadow-xl py-2 z-50 animate-fade-in">
                <div className="px-4 py-2 border-b border-border">
                  <p className="text-xs font-semibold text-ink truncate">{profile?.full_name || 'Learner'}</p>
                  <p className="text-[11px] text-muted truncate">{profile?.email || 'learner@synapse.edu'}</p>
                </div>
                <Link
                  href="/app/settings"
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-2 text-sm text-ink hover:bg-card-alt transition-colors"
                >
                  Settings & Preferences
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-bad hover:bg-bad/10 transition-colors cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            )}
            </div>
          </div>
        </div>

        {/* Desktop Tabs */}
        <nav className="max-w-[1200px] mx-auto px-4 sm:px-6 flex gap-1 sm:gap-4 overflow-x-auto border-t border-border/50">
          {tabs.map((tab) => {
            const isActive = pathname === tab.path || (tab.path === '/app/skills' && pathname === '/app');
            return (
              <Link
                key={tab.path}
                href={tab.path}
                className={`py-3 px-3 sm:px-4 text-sm font-medium border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border-amber text-amber font-semibold'
                    : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.name}</span>
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1200px] w-full mx-auto p-4 sm:p-6 pb-20 md:pb-6">
        {children}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border flex justify-around py-2 px-1 z-40 shadow-lg">
        {tabs.map((tab) => {
          const isActive = pathname === tab.path || (tab.path === '/app/skills' && pathname === '/app');
          return (
            <Link
              key={tab.path}
              href={tab.path}
              className={`flex flex-col items-center py-1 px-2 rounded-xl text-xs transition-colors ${
                isActive ? 'text-amber font-semibold' : 'text-muted'
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              <span className="text-[10px]">{tab.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
