import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, Database, Pencil, Settings } from 'lucide-react';
import { db } from '@/db/db';
import { updateProfile } from '@/db/progression';
import { categoryById, courseById } from '@/content';
import { useAchievementUnlocks, useDailyActivity, usePrefs, useProfile, useStreak, useXp } from '@/hooks/data';
import { useCourseSummaries } from '@/hooks/courses';
import { AVATARS, avatarIcon } from '@/components/Icon';
import { Button, Card, Dialog, PageHeader, SectionTitle, Spinner, cx } from '@/components/ui';
import { AchievementChip, LevelCard } from '@/components/widgets';

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-3">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="text-xl font-extrabold">{value}</p>
    </Card>
  );
}

export default function Profile() {
  const profile = useProfile();
  const prefs = usePrefs();
  const lvl = useXp();
  const streak = useStreak();
  const days = useDailyActivity();
  const unlocks = useAchievementUnlocks();
  const summaries = useCourseSummaries();
  const lessonsDone = useLiveQuery(() => db.lessonProgress.where('status').equals('completed').count(), []);
  const accuracy = useLiveQuery(async () => {
    const all = await db.concepts.toArray();
    const a = all.reduce((n, c) => n + c.attempts, 0);
    return a ? all.reduce((n, c) => n + c.correct, 0) / a : null;
  }, []);
  const [editing, setEditing] = useState(false);
  const [nick, setNick] = useState('');
  const [avatar, setAvatar] = useState('rocket');
  useEffect(() => {
    if (profile) {
      setNick(profile.nickname);
      setAvatar(profile.avatar);
    }
  }, [profile, editing]);

  if (!profile || !prefs || !lvl || !streak || !days || !summaries || lessonsDone === undefined) return <Spinner />;
  const Avatar = avatarIcon(profile.avatar);
  const minutes = Math.round(days.reduce((n, d) => n + d.seconds, 0) / 60);
  const completedCourses = [...summaries].filter(([, s]) => s.done).map(([id]) => courseById.get(id)!);

  return (
    <div>
      <PageHeader
        title="Profile"
        action={
          <Link to="/settings" aria-label="Settings" className="grid h-11 w-11 place-items-center rounded-xl text-muted hover:bg-elevated hover:text-ink">
            <Settings size={22} />
          </Link>
        }
      />
      <Card className="flex items-center gap-4">
        <div className="grid h-20 w-20 shrink-0 place-items-center rounded-3xl bg-gradient-to-br from-violet to-blue text-white">
          <Avatar size={38} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-extrabold">{profile.nickname || 'Founder'}</p>
          <p className="text-sm text-muted">Joined {new Date(profile.joinedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setEditing(true)} aria-label="Edit profile">
          <Pencil size={16} />
        </Button>
      </Card>

      <div className="mt-4">
        <LevelCard lvl={lvl} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Current streak" value={`${streak.current} day${streak.current === 1 ? '' : 's'}`} />
        <Stat label="Longest streak" value={`${streak.longest} day${streak.longest === 1 ? '' : 's'}`} />
        <Stat label="Lessons completed" value={lessonsDone} />
        <Stat label="Courses completed" value={completedCourses.length} />
        <Stat label="Learning time" value={minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} min`} />
        <Stat label="Accuracy" value={accuracy == null ? '—' : `${Math.round(accuracy * 100)}%`} />
      </div>

      {completedCourses.length > 0 && (
        <>
          <SectionTitle>Completed courses</SectionTitle>
          <ul className="space-y-2">
            {completedCourses.map((c) => (
              <li key={c.id}>
                <Link to={`/course/${c.id}`} className="surface flex min-h-[52px] items-center justify-between rounded-2xl px-4 font-semibold">
                  {c.title} <ChevronRight size={18} className="text-faint" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <SectionTitle action={<Link to="/achievements" className="text-sm font-semibold text-violet">All badges</Link>}>Badges</SectionTitle>
      {unlocks && unlocks.length ? (
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
          {unlocks.map((u) => (
            <AchievementChip key={u.id} id={u.id} unlockedAt={u.unlockedAt} />
          ))}
        </div>
      ) : (
        <Card>
          <p className="text-sm text-muted">No badges yet — they unlock from real activity like finishing lessons and streaks.</p>
        </Card>
      )}

      <SectionTitle action={<Link to="/settings" className="text-sm font-semibold text-violet">Edit</Link>}>Preferred subjects</SectionTitle>
      <div className="flex flex-wrap gap-2">
        {prefs.interests.length ? (
          prefs.interests.map((i) => (
            <span key={i} className="rounded-full bg-violet-soft px-3 py-1.5 text-sm font-semibold text-violet">
              {categoryById.get(i)?.title ?? i}
            </span>
          ))
        ) : (
          <p className="text-sm text-muted">None picked yet.</p>
        )}
      </div>

      <Link to="/settings/backup" className="surface mt-6 flex min-h-[60px] items-center gap-3 rounded-2xl px-4">
        <Database size={20} className="text-blue" />
        <span className="flex-1">
          <span className="block font-semibold">Backup & restore</span>
          <span className="text-xs text-muted">Progress is stored only on this device</span>
        </span>
        <ChevronRight size={18} className="text-faint" />
      </Link>

      <Dialog
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit profile"
        actions={
          <>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                await updateProfile({ nickname: nick.trim().slice(0, 40), avatar });
                setEditing(false);
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <label className="block">
          <span className="text-sm font-semibold text-ink">Nickname</span>
          <input value={nick} onChange={(e) => setNick(e.target.value)} maxLength={40} className="mt-1 min-h-[48px] w-full rounded-xl border border-line-strong bg-elevated px-3 text-ink outline-none focus:border-violet" />
        </label>
        <p className="mt-4 text-sm font-semibold text-ink">Avatar</p>
        <div className="mt-2 grid grid-cols-4 gap-2" role="radiogroup" aria-label="Avatar">
          {AVATARS.map((a) => (
            <button key={a.id} role="radio" aria-checked={avatar === a.id} aria-label={a.label} onClick={() => setAvatar(a.id)} className={cx('grid h-14 place-items-center rounded-2xl border-2', avatar === a.id ? 'border-violet bg-violet-soft text-violet' : 'border-line-strong text-muted')}>
              <a.icon size={24} />
            </button>
          ))}
        </div>
      </Dialog>
    </div>
  );
}
