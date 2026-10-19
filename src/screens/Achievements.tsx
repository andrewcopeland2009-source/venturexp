import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { ACHIEVEMENTS, type AchievementStats } from '@/domain/achievements';
import { computeStats } from '@/db/progression';
import { useAchievementUnlocks, useToday, useXp } from '@/hooks/data';
import { Card, PageHeader, ProgressBar, Spinner, cx } from '@/components/ui';
import { Icon } from '@/components/Icon';

const TIER = { bronze: 'text-amber bg-amber-soft', silver: 'text-blue bg-blue-soft', gold: 'text-violet bg-violet-soft' };

export default function Achievements() {
  const unlocks = useAchievementUnlocks();
  const today = useToday();
  const xp = useXp();
  const [stats, setStats] = useState<AchievementStats | null>(null);
  useEffect(() => {
    void computeStats(today).then(setStats);
  }, [today, unlocks, xp?.totalXp]);

  if (!unlocks || !stats) return <Spinner />;
  const byId = new Map(unlocks.map((u) => [u.id, u]));
  const sorted = [...ACHIEVEMENTS].sort((a, b) => Number(byId.has(b.id)) - Number(byId.has(a.id)));

  return (
    <div>
      <PageHeader title="Achievements" subtitle={`${unlocks.length} of ${ACHIEVEMENTS.length} badges earned. Every badge comes from real activity.`} />
      <ProgressBar value={unlocks.length / ACHIEVEMENTS.length} tone="amber" label="Badges earned" />
      <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {sorted.map((a) => {
          const u = byId.get(a.id);
          const value = Math.min(a.target, a.value(stats));
          return (
            <li key={a.id}>
              <Card className={cx('flex h-full items-center gap-3', !u && 'opacity-80')}>
                <div className={cx('relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl', u ? TIER[a.tier] : 'bg-elevated text-faint')}>
                  <Icon name={a.icon} size={26} />
                  {!u && (
                    <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-card text-faint">
                      <Lock size={12} />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{a.title}</p>
                  <p className="text-sm text-muted">{a.description}</p>
                  {u ? (
                    <p className="mt-1 text-xs font-semibold text-green">Earned {new Date(u.unlockedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  ) : (
                    <div className="mt-1.5">
                      <ProgressBar value={value / a.target} height={6} tone="violet" label={`${a.title} progress`} />
                      <p className="mt-1 text-xs text-muted">
                        {value.toLocaleString()} / {a.target.toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
