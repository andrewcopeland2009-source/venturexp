import { useMemo } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Layers, Play, Rocket, Search, Settings } from 'lucide-react';
import { courseById, lessonIndex, playableCourses } from '@/content';
import { recommendCourses } from '@/domain/recommend';
import {
  useAchievementUnlocks,
  useCourseProgressRows,
  useDailyChallenge,
  usePracticeAvailability,
  usePrefs,
  useProfile,
  useStreak,
  useTodayActivity,
  useXp,
} from '@/hooks/data';
import { useCourseSummaries } from '@/hooks/courses';
import { Card, LinkButton, SectionTitle, Spinner } from '@/components/ui';
import { AchievementChip, ChallengeCard, CourseCard, DailyGoalRing, LevelCard, StreakBadge, WeekStrip } from '@/components/widgets';
import { Icon } from '@/components/Icon';

function greeting(h: number) {
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Home() {
  const profile = useProfile();
  const prefs = usePrefs();
  const lvl = useXp();
  const streak = useStreak();
  const today = useTodayActivity();
  const challenge = useDailyChallenge();
  const practice = usePracticeAvailability();
  const unlocks = useAchievementUnlocks();
  const recentCourses = useCourseProgressRows();
  const summaries = useCourseSummaries();

  const hour = useMemo(() => {
    try {
      return Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: prefs?.timezone }).format(new Date()));
    } catch {
      return new Date().getHours();
    }
  }, [prefs?.timezone]);

  const recommended = useMemo(() => {
    if (!prefs || !summaries) return [];
    const done = new Set([...summaries].filter(([, s]) => s.done).map(([id]) => id));
    const inProgress = new Set([...summaries].filter(([, s]) => s.started && !s.done).map(([id]) => id));
    return recommendCourses(playableCourses, { interests: prefs.interests, goals: prefs.goals, experience: prefs.experience, completed: done, inProgress });
  }, [prefs, summaries]);

  if (!profile || !prefs || !lvl || !streak || !summaries) return <Spinner />;

  // Continue learning: most recently played course that still has lessons left, else top recommendation.
  const resume = (recentCourses ?? [])
    .map((r) => ({ course: courseById.get(r.courseId), summary: summaries.get(r.courseId) }))
    .find((x) => x.course && x.summary && !x.summary.done);
  const continueCourse = resume?.course ?? recommended[0];
  const continueSummary = continueCourse ? summaries.get(continueCourse.id) : undefined;
  const nextLesson = continueSummary?.nextLessonId ? lessonIndex.get(continueSummary.nextLessonId) : undefined;
  const minutes = Math.floor((today?.seconds ?? 0) / 60);
  const name = profile.nickname || 'founder';

  return (
    <div>
      <header className="flex items-center justify-between gap-3 pb-2 pt-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted">{greeting(hour)},</p>
          <h1 className="truncate text-[26px] font-extrabold">{name}</h1>
        </div>
        <div className="flex items-center gap-1">
          <StreakBadge count={streak.current} active={streak.activeToday} />
          <Link to="/search" aria-label="Search" className="grid h-11 w-11 place-items-center rounded-xl text-muted hover:bg-elevated hover:text-ink">
            <Search size={22} />
          </Link>
          <Link to="/settings" aria-label="Settings" className="grid h-11 w-11 place-items-center rounded-xl text-muted hover:bg-elevated hover:text-ink md:hidden">
            <Settings size={22} />
          </Link>
        </div>
      </header>

      <LevelCard lvl={lvl} />

      {/* Continue learning */}
      {continueCourse && (
        <Card className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">{resume ? 'Continue learning' : 'Start here'}</p>
          <div className="mt-2 flex items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-soft text-violet">
              <Icon name={continueCourse.icon} size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{nextLesson?.lesson.title ?? continueCourse.title}</p>
              <p className="truncate text-sm text-muted">
                {continueCourse.title}
                {nextLesson ? ` · ${nextLesson.lesson.minutes} min` : ''}
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
            {nextLesson ? (
              <LinkButton block to={`/lesson/${nextLesson.lesson.id}`}>
                <Play size={18} className="fill-current" /> {continueSummary?.started ? 'Continue' : 'Start lesson'}
              </LinkButton>
            ) : (
              <LinkButton block to={`/course/${continueCourse.id}`}>
                Open course
              </LinkButton>
            )}
            <LinkButton variant="secondary" to={`/course/${continueCourse.id}/path`} aria-label="View learning path">
              Path <ArrowRight size={16} />
            </LinkButton>
          </div>
        </Card>
      )}

      {/* Daily goal + review due */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Card className="flex items-center gap-3 p-3">
          <DailyGoalRing minutes={minutes} goal={prefs.dailyGoalMinutes} />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Daily goal</p>
            <p className="text-sm font-semibold">{minutes >= prefs.dailyGoalMinutes ? 'Reached!' : `${prefs.dailyGoalMinutes - minutes} min to go`}</p>
          </div>
        </Card>
        <Link to={practice && practice.review > 0 ? '/practice/review' : '/practice'} className="surface flex items-center gap-3 rounded-[var(--radius-card)] p-3">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-blue-soft text-blue">
            <Layers size={26} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Review due</p>
            <p className="text-2xl font-extrabold leading-tight">{practice?.review ?? 0}</p>
            <p className="text-xs text-muted">{practice?.cardsDue ?? 0} cards</p>
          </div>
        </Link>
      </div>

      {challenge && (
        <div className="mt-4">
          <ChallengeCard title={challenge.def.title} value={challenge.value} target={challenge.def.target} done={challenge.done} claimed={challenge.claimed} />
        </div>
      )}

      <SectionTitle action={<span className="text-sm text-muted">Longest: {streak.longest} days</span>}>This week</SectionTitle>
      <Card>
        <WeekStrip week={streak.week} />
        <p className="mt-3 text-sm text-muted">
          {streak.activeToday
            ? `You’ve learned today. ${streak.current}-day streak!`
            : streak.current > 0
              ? `Learn anything today to make it ${streak.current + 1} days.`
              : 'Every day is a fresh start — one lesson begins a streak.'}
        </p>
      </Card>

      <SectionTitle action={<Link to="/learn" className="text-sm font-semibold text-violet">All courses</Link>}>Recommended for you</SectionTitle>
      <div className="space-y-3">
        {recommended
          .filter((c) => c.id !== continueCourse?.id)
          .slice(0, 2)
          .map((c) => (
            <CourseCard key={c.id} course={c} summary={summaries.get(c.id)} />
          ))}
      </div>

      <Link to="/simulate" className="hero-gradient surface mt-4 flex items-center gap-3 rounded-[var(--radius-card)] p-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-green-soft text-green">
          <Rocket size={24} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold">Launch a POD Brand</p>
          <p className="text-sm text-muted">Business simulation · $1,000 fictional budget</p>
        </div>
        <ArrowRight size={20} className="text-muted" />
      </Link>

      <SectionTitle action={<Link to="/achievements" className="text-sm font-semibold text-violet">See all</Link>}>Recent achievements</SectionTitle>
      {unlocks && unlocks.length > 0 ? (
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
          {unlocks.slice(0, 6).map((u) => (
            <AchievementChip key={u.id} id={u.id} unlockedAt={u.unlockedAt} />
          ))}
        </div>
      ) : (
        <Card>
          <p className="text-sm text-muted">Finish your first lesson to earn the “First Step” badge.</p>
        </Card>
      )}
    </div>
  );
}
