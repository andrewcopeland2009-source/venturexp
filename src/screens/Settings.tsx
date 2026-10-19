import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ChevronRight, Database, Info, Smartphone, Trash2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { categories } from '@/content';
import { db } from '@/db/db';
import { resetAllProgress, updatePrefs } from '@/db/progression';
import { storageMode } from '@/db/storage';
import { CURRICULUM_VERSION } from '@/domain/content';
import { isValidTimeZone } from '@/domain/dates';
import type { Experience, Goal, Preferences } from '@/domain/records';
import { usePrefs } from '@/hooks/data';
import { Button, Card, Dialog, PageHeader, SectionTitle, Segmented, Spinner, Toggle, cx } from '@/components/ui';
import { BackupReminder } from './Backup';
import { resetOnboardedFlag } from '@/onboardingFlag';

const GOALS: { value: Goal; label: string }[] = [
  { value: 'start', label: 'Start a business' },
  { value: 'grow', label: 'Grow a business' },
  { value: 'terminology', label: 'Master terminology' },
  { value: 'marketing', label: 'Learn marketing' },
  { value: 'explore', label: 'Explore subjects' },
];

function timeZones(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
  } catch {
    return [];
  }
}

export default function Settings() {
  const prefs = usePrefs();
  const navigate = useNavigate();
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetText, setResetText] = useState('');
  const zones = useMemo(() => {
    const z = timeZones();
    return prefs && !z.includes(prefs.timezone) ? [prefs.timezone, ...z] : z;
  }, [prefs]);
  const hasProgress = useLiveQuery(async () => (await db.xpEvents.count()) > 0, []);

  if (!prefs) return <Spinner />;
  const set = (patch: Partial<Preferences>) => void updatePrefs(patch);
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <div>
      <PageHeader title="Settings" back />

      {hasProgress && <BackupReminder prefs={prefs} />}

      <SectionTitle>Appearance</SectionTitle>
      <Card className="space-y-4">
        <div>
          <p className="mb-2 font-medium">Theme</p>
          <Segmented label="Theme" value={prefs.theme} onChange={(v) => set({ theme: v })} options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]} />
        </div>
        <div>
          <p className="mb-2 font-medium">Reduce motion</p>
          <Segmented
            label="Reduce motion"
            value={prefs.reducedMotion}
            onChange={(v) => set({ reducedMotion: v })}
            options={[
              { value: 'system', label: 'System' },
              { value: 'on', label: 'On' },
              { value: 'off', label: 'Off' },
            ]}
          />
          <p className="mt-1.5 text-sm text-muted">“System” follows your iPhone’s Reduce Motion accessibility setting.</p>
        </div>
      </Card>

      <SectionTitle>Learning</SectionTitle>
      <Card className="space-y-5">
        <div>
          <p className="mb-2 font-medium">Daily goal</p>
          <Segmented
            label="Daily goal"
            value={prefs.dailyGoalMinutes}
            onChange={(v) => set({ dailyGoalMinutes: v })}
            options={[5, 10, 15, 20].map((m) => ({ value: m as Preferences['dailyGoalMinutes'], label: `${m} min` }))}
          />
        </div>
        <div>
          <p className="mb-2 font-medium">Experience</p>
          <select value={prefs.experience} onChange={(e) => set({ experience: e.target.value as Experience })} className="min-h-[48px] w-full rounded-xl border border-line-strong bg-elevated px-3">
            <option value="beginner">Beginner</option>
            <option value="some">Some experience</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
        <div>
          <p className="mb-2 font-medium">Interests</p>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const on = prefs.interests.includes(c.id);
              return (
                <button key={c.id} role="checkbox" aria-checked={on} onClick={() => set({ interests: toggle(prefs.interests, c.id) })} className={cx('min-h-[40px] rounded-full border px-3 text-sm font-semibold', on ? 'border-violet bg-violet-soft text-violet' : 'border-line-strong text-muted')}>
                  {c.title}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <p className="mb-2 font-medium">Goals</p>
          <div className="flex flex-wrap gap-2">
            {GOALS.map((g) => {
              const on = prefs.goals.includes(g.value);
              return (
                <button key={g.value} role="checkbox" aria-checked={on} onClick={() => set({ goals: toggle(prefs.goals, g.value) })} className={cx('min-h-[40px] rounded-full border px-3 text-sm font-semibold', on ? 'border-violet bg-violet-soft text-violet' : 'border-line-strong text-muted')}>
                  {g.label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label htmlFor="tz" className="mb-2 block font-medium">
            Timezone
          </label>
          <select id="tz" value={prefs.timezone} onChange={(e) => isValidTimeZone(e.target.value) && set({ timezone: e.target.value })} className="min-h-[48px] w-full rounded-xl border border-line-strong bg-elevated px-3">
            {zones.map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-sm text-muted">Streaks and daily goals count calendar days in this timezone. Past days keep the date they were recorded on.</p>
        </div>
      </Card>

      <SectionTitle>Your data</SectionTitle>
      <Card className="divide-y divide-line p-0">
        <Link to="/settings/backup" className="flex min-h-[60px] items-center gap-3 px-4">
          <Database size={20} className="text-blue" />
          <span className="flex-1 font-semibold">Backup & restore</span>
          <ChevronRight size={18} className="text-faint" />
        </Link>
        <div className="px-4">
          <Toggle checked={prefs.backupReminders} onChange={(v) => set({ backupReminders: v })} label="Backup reminders" description="A gentle note here every couple of weeks." />
        </div>
        <button onClick={() => setConfirmReset(true)} className="flex min-h-[60px] w-full items-center gap-3 px-4 text-left text-rose">
          <Trash2 size={20} />
          <span className="flex-1 font-semibold">Reset all progress</span>
        </button>
      </Card>

      <SectionTitle>About</SectionTitle>
      <Card className="space-y-3 text-sm text-muted">
        <p className="flex items-start gap-2">
          <Info size={16} className="mt-0.5 shrink-0" />
          Progress is saved locally in this browser ({storageMode === 'indexeddb' ? 'IndexedDB' : 'localStorage fallback'}). It does not sync between devices or to iCloud — use Export Progress to move it.
        </p>
        <p className="flex items-start gap-2">
          <Smartphone size={16} className="mt-0.5 shrink-0" />
          Install on iPhone: open the app’s HTTPS address in Safari, tap Share, then “Add to Home Screen”. After opening it once online, lessons work offline.
        </p>
        <p>VentureXP 1.0 · curriculum v{CURRICULUM_VERSION}. No account, no tracking, no ads.</p>
      </Card>

      <Dialog
        open={confirmReset}
        onClose={() => {
          setConfirmReset(false);
          setResetText('');
        }}
        title="Reset all progress?"
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={resetText.trim().toUpperCase() !== 'RESET'}
              onClick={async () => {
                await resetAllProgress();
                resetOnboardedFlag();
                setConfirmReset(false);
                navigate('/welcome', { replace: true });
              }}
            >
              Erase everything
            </Button>
          </>
        }
      >
        <p>This permanently deletes XP, lessons, streaks, badges, flashcard history and settings on this device. Consider exporting a backup first.</p>
        <label className="mt-3 block">
          <span className="text-sm font-semibold text-ink">Type RESET to confirm</span>
          <input value={resetText} onChange={(e) => setResetText(e.target.value)} autoCapitalize="characters" className="mt-1 min-h-[48px] w-full rounded-xl border border-line-strong bg-elevated px-3 text-ink outline-none focus:border-rose" />
        </label>
      </Dialog>
    </div>
  );
}
