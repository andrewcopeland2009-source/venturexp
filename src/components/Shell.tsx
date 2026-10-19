import { NavLink, Outlet } from 'react-router';
import { Award, BookOpen, Dumbbell, House, Search, Settings, User, WifiOff } from 'lucide-react';
import { useOnline } from '@/hooks/useOnline';
import { useXp, useStreak } from '@/hooks/data';
import { cx } from './ui';
import { Logo } from './Logo';

const TABS = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/learn', label: 'Learn', icon: BookOpen },
  { to: '/practice', label: 'Practice', icon: Dumbbell },
  { to: '/achievements', label: 'Achievements', short: 'Badges', icon: Award },
  { to: '/profile', label: 'Profile', icon: User },
];

export function OfflinePill() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="fixed left-1/2 top-0 z-40 -translate-x-1/2 pt-safe" role="status">
      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-elevated px-3 py-1.5 text-xs font-semibold text-muted shadow">
        <WifiOff size={14} /> Offline — everything still works
      </div>
    </div>
  );
}

export function Shell() {
  const lvl = useXp();
  const streak = useStreak();
  return (
    <div className="min-h-dvh pl-safe pr-safe md:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-xl focus:bg-card focus:p-3">
        Skip to content
      </a>
      <OfflinePill />

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line px-4 py-6 md:flex">
        <div className="mb-8 px-2">
          <Logo />
        </div>
        <nav aria-label="Main" className="flex flex-col gap-1">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                cx('flex min-h-[48px] items-center gap-3 rounded-2xl px-3 font-semibold transition-colors', isActive ? 'bg-violet-soft text-violet' : 'text-muted hover:bg-elevated hover:text-ink')
              }
            >
              <t.icon size={22} aria-hidden /> {t.label}
            </NavLink>
          ))}
          <div className="my-3 border-t border-line" />
          <NavLink to="/search" className={({ isActive }) => cx('flex min-h-[48px] items-center gap-3 rounded-2xl px-3 font-semibold', isActive ? 'bg-violet-soft text-violet' : 'text-muted hover:bg-elevated hover:text-ink')}>
            <Search size={22} aria-hidden /> Search
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => cx('flex min-h-[48px] items-center gap-3 rounded-2xl px-3 font-semibold', isActive ? 'bg-violet-soft text-violet' : 'text-muted hover:bg-elevated hover:text-ink')}>
            <Settings size={22} aria-hidden /> Settings
          </NavLink>
        </nav>
        {lvl && (
          <div className="mt-auto rounded-2xl bg-elevated p-3 text-sm">
            <p className="font-semibold">
              Level {lvl.level} · {lvl.title}
            </p>
            <p className="text-muted">
              {lvl.totalXp.toLocaleString()} XP{streak ? ` · ${streak.current}-day streak` : ''}
            </p>
          </div>
        )}
      </aside>

      <main id="main" className="mx-auto w-full max-w-2xl px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-safe sm:px-6 md:pb-12 md:pt-6">
        <Outlet />
      </main>

      {/* Mobile bottom tabs */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 pb-safe pl-safe pr-safe backdrop-blur-xl md:hidden">
        <ul className="mx-auto grid max-w-2xl grid-cols-5">
          {TABS.map((t) => (
            <li key={t.to}>
              <NavLink
                to={t.to}
                end={t.end}
                className={({ isActive }) => cx('flex min-h-[60px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold', isActive ? 'text-violet' : 'text-faint')}
              >
                {({ isActive }) => (
                  <>
                    <t.icon size={24} strokeWidth={isActive ? 2.4 : 2} aria-hidden />
                    <span>{t.short ?? t.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
