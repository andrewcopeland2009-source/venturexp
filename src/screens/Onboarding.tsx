import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronLeft, Clock, Compass, GraduationCap, Megaphone, Rocket, TrendingUp, BookA } from 'lucide-react';
import { categories, playableCourses } from '@/content';
import { recommendCourses } from '@/domain/recommend';
import type { Experience, Goal, Preferences } from '@/domain/records';
import { updatePrefs, updateProfile } from '@/db/progression';
import { usePrefs } from '@/hooks/data';
import { markOnboarded } from '@/onboardingFlag';
import { Button, cx } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { LogoMark } from '@/components/Logo';

const EXPERIENCE: { value: Experience; title: string; text: string }[] = [
  { value: 'beginner', title: 'Beginner', text: 'New to business — start from the basics.' },
  { value: 'some', title: 'Some experience', text: 'I’ve tried selling or read a bit.' },
  { value: 'intermediate', title: 'Intermediate', text: 'I run or have run something small.' },
  { value: 'advanced', title: 'Advanced', text: 'I’m comfortable with the numbers and ops.' },
];

const GOALS: { value: Goal; title: string; icon: typeof Rocket }[] = [
  { value: 'start', title: 'Start a business', icon: Rocket },
  { value: 'grow', title: 'Grow a business', icon: TrendingUp },
  { value: 'terminology', title: 'Master terminology', icon: BookA },
  { value: 'marketing', title: 'Learn marketing', icon: Megaphone },
  { value: 'explore', title: 'Explore subjects', icon: Compass },
];

const DAILY: { value: Preferences['dailyGoalMinutes']; title: string; text: string }[] = [
  { value: 5, title: '5 min', text: 'Casual — about one lesson' },
  { value: 10, title: '10 min', text: 'Regular — two short lessons' },
  { value: 15, title: '15 min', text: 'Serious — lessons + review' },
  { value: 20, title: '20 min', text: 'Intense — deep daily practice' },
];

const STEPS = 6;

export default function Onboarding() {
  const navigate = useNavigate();
  const prefs = usePrefs();
  const [step, setStep] = useState(0);
  const [interests, setInterests] = useState<string[]>([]);
  const [experience, setExperience] = useState<Experience>('beginner');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [daily, setDaily] = useState<Preferences['dailyGoalMinutes']>(10);
  const [nickname, setNickname] = useState('');
  const [saving, setSaving] = useState(false);

  const route = useMemo(() => recommendCourses(playableCourses, { interests, goals, experience }), [interests, goals, experience]);

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function finish(to: string) {
    setSaving(true);
    await updatePrefs({ interests, experience, goals, dailyGoalMinutes: daily, timezone: prefs?.timezone });
    await updateProfile({ onboarded: true, nickname: nickname.trim().slice(0, 40), joinedAt: Date.now() });
    markOnboarded();
    navigate(to, { replace: true });
  }

  const next = () => setStep((s) => Math.min(STEPS - 1, s + 1));
  const canContinue = step !== 1 || interests.length > 0;

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 pb-safe pt-safe">
      <div className="flex min-h-[56px] items-center justify-between">
        {step > 0 ? (
          <button onClick={() => setStep(step - 1)} className="-ml-2 grid h-11 w-11 place-items-center rounded-xl text-muted hover:text-ink" aria-label="Previous step">
            <ChevronLeft size={24} />
          </button>
        ) : (
          <span className="w-11" />
        )}
        {step > 0 && (
          <div className="flex gap-1.5" aria-label={`Step ${step} of ${STEPS - 1}`} role="img">
            {Array.from({ length: STEPS - 1 }).map((_, i) => (
              <span key={i} className={cx('h-1.5 w-7 rounded-full transition-colors', i < step ? 'bg-violet' : 'bg-elevated')} />
            ))}
          </div>
        )}
        <button onClick={() => finish('/')} disabled={saving} className="min-h-[44px] rounded-xl px-2 text-sm font-semibold text-muted hover:text-ink">
          Skip for now
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }} className="flex flex-1 flex-col">
          {step === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <motion.div initial={{ scale: 0.8, rotate: -6 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 180, damping: 14 }}>
                <LogoMark size={96} />
              </motion.div>
              <h1 className="mt-8 text-[34px] font-extrabold leading-[1.1]">
                Learn business.
                <br />
                <span className="bg-gradient-to-r from-violet to-blue bg-clip-text text-transparent">Level up your future.</span>
              </h1>
              <p className="mt-4 max-w-sm text-[17px] text-muted">
                Five-minute lessons on e-commerce, shipping, finance and marketing. Earn XP, keep a streak, and practice with real scenarios.
              </p>
              <ul className="mt-6 space-y-2 text-left text-[15px] text-muted">
                <li className="flex items-center gap-2"><Check size={18} className="text-green" /> No account needed — progress stays on this device</li>
                <li className="flex items-center gap-2"><Check size={18} className="text-green" /> Works offline once installed</li>
                <li className="flex items-center gap-2"><Check size={18} className="text-green" /> Export a backup anytime</li>
              </ul>
            </div>
          )}

          {step === 1 && (
            <section aria-labelledby="ob-interests">
              <h1 id="ob-interests" className="mt-4 text-[28px] font-extrabold">What do you want to learn?</h1>
              <p className="mt-1 text-muted">Pick as many as you like.</p>
              <div className="mt-6 grid grid-cols-2 gap-2.5">
                {categories.map((c) => {
                  const on = interests.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => setInterests(toggle(interests, c.id))}
                      className={cx('flex min-h-[64px] items-center gap-2.5 rounded-2xl border-2 px-3 text-left text-[14px] font-semibold transition-colors', on ? 'border-violet bg-violet-soft' : 'border-line-strong bg-card')}
                    >
                      <Icon name={c.icon} size={20} className={on ? 'text-violet' : 'text-muted'} />
                      <span className="flex-1 leading-tight">{c.title}</span>
                      {on && <Check size={16} className="text-violet" />}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {step === 2 && (
            <section aria-labelledby="ob-exp">
              <h1 id="ob-exp" className="mt-4 text-[28px] font-extrabold">How much experience do you have?</h1>
              <div role="radiogroup" className="mt-6 space-y-3">
                {EXPERIENCE.map((e) => (
                  <button
                    key={e.value}
                    role="radio"
                    aria-checked={experience === e.value}
                    onClick={() => setExperience(e.value)}
                    className={cx('flex min-h-[64px] w-full flex-col justify-center rounded-2xl border-2 px-4 py-3 text-left', experience === e.value ? 'border-violet bg-violet-soft' : 'border-line-strong bg-card')}
                  >
                    <span className="font-bold">{e.title}</span>
                    <span className="text-sm text-muted">{e.text}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {step === 3 && (
            <section aria-labelledby="ob-goals">
              <h1 id="ob-goals" className="mt-4 text-[28px] font-extrabold">What are your goals?</h1>
              <p className="mt-1 text-muted">Choose any that apply.</p>
              <div className="mt-6 space-y-3">
                {GOALS.map((g) => {
                  const on = goals.includes(g.value);
                  return (
                    <button
                      key={g.value}
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => setGoals(toggle(goals, g.value))}
                      className={cx('flex min-h-[60px] w-full items-center gap-3 rounded-2xl border-2 px-4 text-left font-semibold', on ? 'border-violet bg-violet-soft' : 'border-line-strong bg-card')}
                    >
                      <g.icon size={22} className={on ? 'text-violet' : 'text-muted'} />
                      <span className="flex-1">{g.title}</span>
                      {on && <Check size={18} className="text-violet" />}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {step === 4 && (
            <section aria-labelledby="ob-daily">
              <h1 id="ob-daily" className="mt-4 text-[28px] font-extrabold">Pick a daily goal</h1>
              <p className="mt-1 text-muted">Measured by actual time spent in lessons and practice. You can change it anytime.</p>
              <div role="radiogroup" className="mt-6 space-y-3">
                {DAILY.map((d) => (
                  <button
                    key={d.value}
                    role="radio"
                    aria-checked={daily === d.value}
                    onClick={() => setDaily(d.value)}
                    className={cx('flex min-h-[64px] w-full items-center gap-3 rounded-2xl border-2 px-4 text-left', daily === d.value ? 'border-violet bg-violet-soft' : 'border-line-strong bg-card')}
                  >
                    <Clock size={22} className={daily === d.value ? 'text-violet' : 'text-muted'} />
                    <span className="flex-1">
                      <span className="block font-bold">{d.title}</span>
                      <span className="text-sm text-muted">{d.text}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {step === 5 && (
            <section aria-labelledby="ob-route">
              <h1 id="ob-route" className="mt-4 text-[28px] font-extrabold">Your recommended route</h1>
              <p className="mt-1 text-muted">Based on your interests, goals and experience. Every course stays open to browse.</p>
              <ol className="mt-6 space-y-2.5">
                {route.map((c, i) => (
                  <li key={c.id} className={cx('flex items-center gap-3 rounded-2xl p-3', i === 0 ? 'hero-gradient border border-violet/40' : 'surface')}>
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-elevated">
                      <Icon name={c.icon} size={22} className="text-violet" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">{c.title}</span>
                      <span className="text-sm text-muted">
                        {i === 0 ? 'Start here · ' : ''}
                        {c.modules.reduce((n, m) => n + m.lessons.length, 0)} lessons · ~{c.estimatedMinutes} min
                      </span>
                    </span>
                    <span className="text-sm font-bold text-faint">{i + 1}</span>
                  </li>
                ))}
              </ol>
              <label className="mt-6 block">
                <span className="text-sm font-semibold text-muted">What should we call you? (optional)</span>
                <input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  maxLength={40}
                  placeholder="Nickname"
                  className="mt-1.5 min-h-[52px] w-full rounded-2xl border-2 border-line-strong bg-card px-4 outline-none focus:border-violet"
                />
              </label>
            </section>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="sticky bottom-0 mt-6 bg-bg/95 py-4 backdrop-blur">
        {step < STEPS - 1 ? (
          <Button block size="lg" onClick={next} disabled={!canContinue}>
            {step === 0 ? 'Get started' : 'Continue'}
          </Button>
        ) : (
          <div className="space-y-2">
            <Button block size="lg" disabled={saving} onClick={() => finish(`/course/${route[0]?.id ?? 'shipping-terminology'}`)}>
              <GraduationCap size={20} /> Start {route[0]?.title}
            </Button>
            <Button block variant="ghost" disabled={saving} onClick={() => finish('/')}>
              Go to my dashboard
            </Button>
          </div>
        )}
        {step === 1 && interests.length === 0 && <p className="mt-2 text-center text-sm text-muted">Pick at least one, or tap “Skip for now”.</p>}
      </div>
    </div>
  );
}
