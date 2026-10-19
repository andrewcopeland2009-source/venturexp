import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Check, CircleHelp, Eye, Lightbulb, Undo2, X } from 'lucide-react';
import type { ActivityOf } from '@/domain/content';
import type { ActivityResponse, GradeResult, Rating } from '@/domain/grading';
import { shuffle, shuffledIndices } from '@/domain/random';
import { SRS_RULES } from '@/domain/srs';
import { cx } from '../ui';

export interface ViewProps<T extends ActivityOf<ActivityResponse['type']>> {
  activity: T;
  response: ActivityResponse | null;
  onChange: (r: ActivityResponse) => void;
  result: GradeResult | null;
  seed: string;
  /** Submit immediately (Enter in a text field, flashcard rating). */
  onSubmit?: (r?: ActivityResponse) => void;
}

const LETTERS = 'ABCDEF';

export function Prompt({ children, eyebrow }: { children: ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-5">
      {eyebrow && <p className="mb-1 text-xs font-bold uppercase tracking-wider text-violet">{eyebrow}</p>}
      <h2 className="text-[21px] font-bold leading-snug">{children}</h2>
    </div>
  );
}

/** Option button used by multiple choice, scenario, strategy, case study and true/false. */
function OptionButton({
  label,
  children,
  selected,
  state,
  disabled,
  onClick,
  role = 'radio',
}: {
  label?: string;
  children: ReactNode;
  selected: boolean;
  state?: 'correct' | 'wrong' | 'answer' | null;
  disabled?: boolean;
  onClick: () => void;
  role?: string;
}) {
  return (
    <button
      role={role}
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'flex min-h-[56px] w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-[16px] font-medium transition-colors disabled:cursor-default',
        state === 'correct' && 'border-green bg-green-soft',
        state === 'answer' && 'border-green/70 border-dashed bg-green-soft/50',
        state === 'wrong' && 'border-rose bg-rose-soft',
        !state && selected && 'border-violet bg-violet-soft',
        !state && !selected && 'border-line-strong bg-card hover:border-violet/60',
      )}
    >
      {label && (
        <span
          className={cx(
            'grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-bold',
            state === 'correct' || state === 'answer' ? 'bg-green text-[#05210f]' : state === 'wrong' ? 'bg-rose text-white' : selected ? 'bg-violet text-white' : 'bg-elevated text-muted',
          )}
          aria-hidden
        >
          {state === 'correct' || state === 'answer' ? <Check size={16} /> : state === 'wrong' ? <X size={16} /> : label}
        </span>
      )}
      <span className="flex-1">{children}</span>
    </button>
  );
}

/** Keyboard shortcuts 1–6 / A–F to pick options. */
function useOptionKeys(count: number, pick: (i: number) => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= count) pick(n - 1);
      const li = LETTERS.toLowerCase().indexOf(e.key.toLowerCase());
      if (e.key.length === 1 && li >= 0 && li < count) pick(li);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count, pick, enabled]);
}

function useOrder(n: number, seed: string) {
  return useMemo(() => shuffle(Array.from({ length: n }, (_, i) => i), seed), [n, seed]);
}

// ───────── Multiple choice & scenario ─────────
export function ChoiceView({ activity, response, onChange, result, seed }: ViewProps<ActivityOf<'mcq'> | ActivityOf<'scenario'>>) {
  const order = useOrder(activity.options.length, seed);
  const choice = response && 'choice' in response ? response.choice : -1;
  const pick = (i: number) => !result && onChange({ type: activity.type, choice: order[i] } as ActivityResponse);
  useOptionKeys(order.length, pick, !result);
  return (
    <div>
      {activity.type === 'scenario' && (
        <div className="mb-4 rounded-2xl border border-blue/30 bg-blue-soft p-4 text-[15px] leading-relaxed">
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-blue">Scenario</p>
          {activity.scenario}
        </div>
      )}
      <Prompt>{activity.prompt}</Prompt>
      <div role="radiogroup" aria-label="Answer options" className="space-y-3">
        {order.map((oi, i) => {
          const st = result ? (oi === activity.answer ? (choice === oi ? 'correct' : 'answer') : choice === oi ? 'wrong' : null) : null;
          return (
            <OptionButton key={oi} label={LETTERS[i]} selected={choice === oi} state={st} disabled={!!result} onClick={() => pick(i)}>
              {activity.options[oi].text}
            </OptionButton>
          );
        })}
      </div>
    </div>
  );
}

// ───────── True / false ─────────
export function TrueFalseView({ activity, response, onChange, result }: ViewProps<ActivityOf<'truefalse'>>) {
  const value = response?.type === 'truefalse' ? response.value : null;
  const pick = (i: number) => !result && onChange({ type: 'truefalse', value: i === 0 });
  useOptionKeys(2, pick, !result);
  return (
    <div>
      <Prompt eyebrow="True or false?">{activity.statement}</Prompt>
      <div role="radiogroup" aria-label="True or false" className="grid grid-cols-2 gap-3">
        {[true, false].map((v, i) => {
          const st = result ? (v === activity.answer ? (value === v ? 'correct' : 'answer') : value === v ? 'wrong' : null) : null;
          return (
            <OptionButton key={String(v)} label={LETTERS[i]} selected={value === v} state={st} disabled={!!result} onClick={() => pick(i)}>
              {v ? 'True' : 'False'}
            </OptionButton>
          );
        })}
      </div>
    </div>
  );
}

// ───────── Match ─────────
const PAIR_COLORS = ['bg-violet', 'bg-blue', 'bg-amber', 'bg-pink', 'bg-teal', 'bg-green'];

export function MatchView({ activity, response, onChange, result, seed }: ViewProps<ActivityOf<'match'>>) {
  const n = activity.pairs.length;
  const termOrder = useOrder(n, `${seed}-t`);
  const defOrder = useMemo(() => shuffledIndices(n, `${seed}-d`), [n, seed]);
  const pairs = response?.type === 'match' ? response.pairs : Array<number>(n).fill(-1);
  const [activeTerm, setActiveTerm] = useState<number | null>(null);

  const set = (next: number[]) => onChange({ type: 'match', pairs: next });
  const tapTerm = (t: number) => {
    if (result) return;
    if (pairs[t] >= 0) {
      const next = [...pairs];
      next[t] = -1;
      set(next);
      setActiveTerm(t);
      return;
    }
    setActiveTerm(activeTerm === t ? null : t);
  };
  const tapDef = (d: number) => {
    if (result) return;
    const owner = pairs.indexOf(d);
    if (activeTerm === null) {
      if (owner >= 0) {
        const next = [...pairs];
        next[owner] = -1;
        set(next);
      }
      return;
    }
    const next = pairs.map((p) => (p === d ? -1 : p));
    next[activeTerm] = d;
    set(next);
    const nextFree = termOrder.find((t) => next[t] < 0);
    setActiveTerm(nextFree ?? null);
  };
  const colorOf = (t: number) => PAIR_COLORS[termOrder.indexOf(t) % PAIR_COLORS.length];

  return (
    <div>
      <Prompt eyebrow="Match the pairs">{activity.prompt}</Prompt>
      <p className="mb-3 text-sm text-muted" id={`${activity.id}-help`}>
        Tap a term, then tap its meaning. Tap a matched term to undo.
      </p>
      <div className="grid grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] gap-2.5" aria-describedby={`${activity.id}-help`}>
        <div className="space-y-2.5" role="group" aria-label="Terms">
          {termOrder.map((t) => {
            const matched = pairs[t] >= 0;
            const ok = result ? pairs[t] === t : null;
            return (
              <button
                key={t}
                disabled={!!result}
                aria-pressed={activeTerm === t}
                onClick={() => tapTerm(t)}
                className={cx(
                  'relative flex min-h-[64px] w-full items-center gap-2 rounded-2xl border-2 px-3 py-2 text-left text-[15px] font-semibold',
                  result ? (ok ? 'border-green bg-green-soft' : 'border-rose bg-rose-soft') : activeTerm === t ? 'border-violet bg-violet-soft' : matched ? 'border-line-strong bg-elevated' : 'border-line-strong bg-card',
                )}
              >
                {matched && <span className={cx('h-3 w-3 shrink-0 rounded-full', colorOf(t))} aria-hidden />}
                <span className="min-w-0 break-words">{activity.pairs[t].term}</span>
                {matched && <span className="sr-only">(matched)</span>}
              </button>
            );
          })}
        </div>
        <div className="space-y-2.5" role="group" aria-label="Definitions">
          {defOrder.map((d) => {
            const owner = pairs.indexOf(d);
            return (
              <button
                key={d}
                disabled={!!result}
                onClick={() => tapDef(d)}
                className={cx(
                  'flex min-h-[64px] w-full items-center gap-2 rounded-2xl border-2 px-3 py-2 text-left text-[14px] leading-snug',
                  owner >= 0 ? 'border-line-strong bg-elevated' : activeTerm !== null ? 'border-violet/50 bg-card' : 'border-line-strong bg-card',
                )}
              >
                {owner >= 0 && <span className={cx('h-3 w-3 shrink-0 rounded-full', colorOf(owner))} aria-hidden />}
                <span className="min-w-0 break-words">{activity.pairs[d].definition}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ───────── Text answers (fill in the blank, recall) ─────────
function TextAnswer({
  value,
  onChange,
  disabled,
  onEnter,
  label,
  placeholder,
  state,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  onEnter?: () => void;
  label: string;
  placeholder: string;
  state: 'correct' | 'wrong' | null;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!disabled) ref.current?.focus({ preventScroll: true });
  }, [disabled]);
  return (
    <input
      ref={ref}
      aria-label={label}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      autoCapitalize="none"
      autoCorrect="off"
      autoComplete="off"
      spellCheck={false}
      enterKeyHint="done"
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onEnter?.();
        }
      }}
      className={cx(
        'min-h-[56px] w-full rounded-2xl border-2 bg-card px-4 text-[17px] font-semibold outline-none placeholder:font-normal placeholder:text-faint',
        state === 'correct' ? 'border-green' : state === 'wrong' ? 'border-rose' : 'border-line-strong focus:border-violet',
      )}
    />
  );
}

function Hint({ hint }: { hint?: string }) {
  const [open, setOpen] = useState(false);
  if (!hint) return null;
  return open ? (
    <p className="mt-3 flex items-start gap-2 text-sm text-amber">
      <Lightbulb size={16} className="mt-0.5 shrink-0" /> {hint}
    </p>
  ) : (
    <button onClick={() => setOpen(true)} className="mt-2 inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
      <CircleHelp size={16} /> Show a hint
    </button>
  );
}

export function FillBlankView({ activity, response, onChange, result, onSubmit }: ViewProps<ActivityOf<'fillblank'>>) {
  const text = response?.type === 'fillblank' ? response.text : '';
  const [before, after] = activity.sentence.split('___');
  return (
    <div>
      <Prompt eyebrow="Fill in the blank">
        {before}
        <span className="mx-1 inline-block min-w-[80px] border-b-2 border-dashed border-violet text-violet">{result ? (result.correct ? text : activity.accept[0]) : text || ' '}</span>
        {after}
      </Prompt>
      <TextAnswer
        label="Your answer"
        placeholder="Type the missing word(s)"
        value={text}
        disabled={!!result}
        state={result ? (result.correct ? 'correct' : 'wrong') : null}
        onChange={(v) => onChange({ type: 'fillblank', text: v })}
        onEnter={() => onSubmit?.()}
      />
      {!result && <Hint hint={activity.hint} />}
    </div>
  );
}

export function RecallView({ activity, response, onChange, result, onSubmit }: ViewProps<ActivityOf<'recall'>>) {
  const text = response?.type === 'recall' ? response.text : '';
  return (
    <div>
      <Prompt eyebrow="Name the term">{activity.clue}</Prompt>
      <TextAnswer
        label="The term"
        placeholder="Type the term"
        value={text}
        disabled={!!result}
        state={result ? (result.correct ? 'correct' : 'wrong') : null}
        onChange={(v) => onChange({ type: 'recall', text: v })}
        onEnter={() => onSubmit?.()}
      />
      {!result && <Hint hint={activity.hint} />}
    </div>
  );
}

// ───────── Order ─────────
export function OrderView({ activity, response, onChange, result, seed }: ViewProps<ActivityOf<'order'>>) {
  const n = activity.steps.length;
  const pool = useMemo(() => shuffledIndices(n, seed), [n, seed]);
  const order = response?.type === 'order' ? response.order : [];
  const set = (o: number[]) => onChange({ type: 'order', order: o });
  const remaining = pool.filter((i) => !order.includes(i));
  const move = (pos: number, dir: -1 | 1) => {
    const t = pos + dir;
    if (t < 0 || t >= order.length) return;
    const o = [...order];
    [o[pos], o[t]] = [o[t], o[pos]];
    set(o);
  };
  return (
    <div>
      <Prompt eyebrow="Put in order">{activity.prompt}</Prompt>
      <p className="mb-3 text-sm text-muted">Tap steps in order. Use the arrows to adjust, or tap ↺ to remove a step.</p>
      <ol className="space-y-2" aria-label="Your order">
        {order.map((si, pos) => {
          const ok = result ? si === pos : null;
          return (
            <li
              key={si}
              className={cx(
                'flex min-h-[56px] items-center gap-2 rounded-2xl border-2 py-1.5 pl-3 pr-1.5',
                ok === null ? 'border-violet/50 bg-violet-soft' : ok ? 'border-green bg-green-soft' : 'border-rose bg-rose-soft',
              )}
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-card text-sm font-bold">{pos + 1}</span>
              <span className="flex-1 text-[15px] font-medium">{activity.steps[si]}</span>
              {!result && (
                <div className="flex shrink-0">
                  <button aria-label={`Move “${activity.steps[si]}” up`} disabled={pos === 0} onClick={() => move(pos, -1)} className="grid h-11 w-9 place-items-center rounded-lg text-muted hover:text-ink disabled:opacity-30">
                    <ArrowUp size={18} />
                  </button>
                  <button aria-label={`Move “${activity.steps[si]}” down`} disabled={pos === order.length - 1} onClick={() => move(pos, 1)} className="grid h-11 w-9 place-items-center rounded-lg text-muted hover:text-ink disabled:opacity-30">
                    <ArrowDown size={18} />
                  </button>
                  <button aria-label={`Remove “${activity.steps[si]}”`} onClick={() => set(order.filter((x) => x !== si))} className="grid h-11 w-9 place-items-center rounded-lg text-muted hover:text-ink">
                    <Undo2 size={18} />
                  </button>
                </div>
              )}
            </li>
          );
        })}
        {Array.from({ length: n - order.length }).map((_, i) => (
          <li key={`empty-${i}`} aria-hidden className="flex min-h-[56px] items-center gap-2 rounded-2xl border-2 border-dashed border-line-strong px-3 text-faint">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-elevated text-sm font-bold">{order.length + i + 1}</span>
          </li>
        ))}
      </ol>
      {remaining.length > 0 && !result && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Steps to place</p>
          <div className="flex flex-wrap gap-2">
            {remaining.map((si) => (
              <button key={si} onClick={() => set([...order, si])} className="min-h-[48px] rounded-2xl border-2 border-line-strong bg-card px-4 py-2 text-left text-[15px] font-medium hover:border-violet/60">
                {activity.steps[si]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ───────── Flashcard ─────────
const RATING_STYLE: Record<Rating, string> = {
  again: 'bg-rose-soft text-rose border-rose/40',
  hard: 'bg-amber-soft text-amber border-amber/40',
  good: 'bg-blue-soft text-blue border-blue/40',
  easy: 'bg-green-soft text-green border-green/40',
};

export function FlashcardFace({ front, back, detail, revealed, onReveal }: { front: string; back: string; detail?: string; revealed: boolean; onReveal: () => void }) {
  return (
    <button
      onClick={onReveal}
      disabled={revealed}
      aria-label={revealed ? undefined : 'Reveal the answer'}
      className="surface relative flex min-h-[260px] w-full flex-col items-center justify-center rounded-3xl p-6 text-center disabled:cursor-default"
    >
      <p className="text-xs font-bold uppercase tracking-wider text-violet">{revealed ? 'Answer' : 'Think of the answer'}</p>
      <p className="mt-3 font-display text-2xl font-bold">{front}</p>
      {revealed ? (
        <div className="mt-4 border-t border-line pt-4">
          <p className="text-[17px] leading-relaxed">{back}</p>
          {detail && <p className="mt-3 text-sm text-muted">{detail}</p>}
        </div>
      ) : (
        <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-elevated px-4 py-2 text-sm font-semibold text-muted">
          <Eye size={16} /> Tap to reveal
        </span>
      )}
    </button>
  );
}

export function RatingButtons({ onRate, disabled }: { onRate: (r: Rating) => void; disabled?: boolean }) {
  useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, Rating> = { '1': 'again', '2': 'hard', '3': 'good', '4': 'easy' };
      if (map[e.key]) onRate(map[e.key]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onRate, disabled]);
  return (
    <div className="grid grid-cols-4 gap-2" role="group" aria-label="How well did you remember?">
      {SRS_RULES.map((r) => (
        <button key={r.rating} disabled={disabled} onClick={() => onRate(r.rating)} title={r.text} className={cx('min-h-[52px] rounded-2xl border text-[15px] font-bold', RATING_STYLE[r.rating])}>
          {r.label}
        </button>
      ))}
    </div>
  );
}

export function FlashcardView({ activity, result, onSubmit }: ViewProps<ActivityOf<'flashcard'>>) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div>
      <Prompt eyebrow="Flashcard">Recall, then rate yourself honestly.</Prompt>
      <FlashcardFace front={activity.front} back={activity.back} revealed={revealed || !!result} onReveal={() => setRevealed(true)} />
      {revealed && !result && (
        <div className="mt-4">
          <p className="mb-2 text-center text-sm text-muted">How well did you remember?</p>
          <RatingButtons onRate={(rating) => onSubmit?.({ type: 'flashcard', rating })} />
        </div>
      )}
    </div>
  );
}

// ───────── Numeric ─────────
const UNIT_SUFFIX: Record<string, string> = { percent: '%', lb: 'lb', kg: 'kg', days: 'days', units: 'units', number: '', currency: '' };

export function NumericView({ activity, response, onChange, result, onSubmit }: ViewProps<ActivityOf<'numeric'>>) {
  const value = response?.type === 'numeric' ? response.value : '';
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!result) ref.current?.focus({ preventScroll: true });
  }, [result]);
  return (
    <div>
      <Prompt eyebrow="Calculate">{activity.prompt}</Prompt>
      <div
        className={cx(
          'flex min-h-[60px] items-center rounded-2xl border-2 bg-card px-4',
          result ? (result.correct ? 'border-green' : 'border-rose') : 'border-line-strong focus-within:border-violet',
        )}
      >
        {activity.unit === 'currency' && <span className="mr-1 text-xl font-bold text-muted">$</span>}
        <input
          ref={ref}
          aria-label="Your answer"
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          value={value}
          disabled={!!result}
          placeholder="0"
          onChange={(e) => onChange({ type: 'numeric', value: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSubmit?.();
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-2xl font-bold outline-none placeholder:text-faint"
        />
        {UNIT_SUFFIX[activity.unit] && <span className="ml-2 text-lg font-semibold text-muted">{UNIT_SUFFIX[activity.unit]}</span>}
      </div>
      {activity.tolerance > 0 && !result && (
        <p className="mt-2 text-sm text-muted">
          Answers within ±{activity.tolerance} {activity.unit === 'currency' ? 'dollars' : UNIT_SUFFIX[activity.unit] || ''} count.
        </p>
      )}
      {result && (
        <div className="mt-4 rounded-2xl bg-elevated p-4 text-[15px]">
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">Worked solution</p>
          {activity.working}
        </div>
      )}
    </div>
  );
}

// ───────── Spot the mistake ─────────
export function SpotMistakeView({ activity, response, onChange, result }: ViewProps<ActivityOf<'spotmistake'>>) {
  const line = response?.type === 'spotmistake' ? response.line : -1;
  const pick = (i: number) => !result && onChange({ type: 'spotmistake', line: i });
  useOptionKeys(activity.lines.length, pick, !result);
  return (
    <div>
      <Prompt eyebrow="Spot the mistake">{activity.prompt}</Prompt>
      <div role="radiogroup" aria-label="Lines" className="space-y-2">
        {activity.lines.map((l, i) => {
          const st = result ? (i === activity.mistake ? (line === i ? 'correct' : 'answer') : line === i ? 'wrong' : null) : null;
          return (
            <OptionButton key={i} label={String(i + 1)} selected={line === i} state={st} disabled={!!result} onClick={() => pick(i)}>
              <span className="font-mono text-[14px]">{l}</span>
            </OptionButton>
          );
        })}
      </div>
      {result && (
        <div className="mt-4 rounded-2xl bg-elevated p-4 text-[15px]">
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">The fix</p>
          {activity.correction}
        </div>
      )}
    </div>
  );
}

// ───────── Strategy ─────────
export function StrategyView({ activity, response, onChange, result, seed }: ViewProps<ActivityOf<'strategy'>>) {
  const order = useOrder(activity.options.length, seed);
  const choice = response?.type === 'strategy' ? response.choice : -1;
  const pick = (i: number) => !result && onChange({ type: 'strategy', choice: order[i] });
  useOptionKeys(order.length, pick, !result);
  return (
    <div>
      <Prompt eyebrow="Pick a strategy">{activity.prompt}</Prompt>
      <div role="radiogroup" aria-label="Strategies" className="space-y-3">
        {order.map((oi, i) => {
          const o = activity.options[oi];
          const isBest = activity.best.includes(oi);
          const st = result ? (isBest ? (choice === oi ? 'correct' : 'answer') : choice === oi ? 'wrong' : null) : null;
          return (
            <div key={oi}>
              <OptionButton label={LETTERS[i]} selected={choice === oi} state={st} disabled={!!result} onClick={() => pick(i)}>
                {o.text}
              </OptionButton>
              {result && (
                <div className="mx-2 mt-1.5 grid gap-1 rounded-xl bg-elevated px-3 py-2 text-sm">
                  <p>
                    <span className="font-semibold text-green">Pros: </span>
                    {o.pros}
                  </p>
                  <p>
                    <span className="font-semibold text-amber">Cons: </span>
                    {o.cons}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ───────── Case study ─────────
export function CaseStudyView({ activity, response, onChange, result, seed }: ViewProps<ActivityOf<'casestudy'>>) {
  const answers = response?.type === 'casestudy' ? response.answers : Array<number>(activity.questions.length).fill(-1);
  const [step, setStep] = useState(0);
  const [caseOpen, setCaseOpen] = useState(true);
  const q = activity.questions[step];
  const order = useMemo(() => (q ? shuffle(q.options.map((_, i) => i), `${seed}-${step}`) : []), [q, seed, step]);
  const set = (qi: number, oi: number) => {
    const next = [...answers];
    next[qi] = oi;
    onChange({ type: 'casestudy', answers: next });
  };
  useOptionKeys(order.length, (i) => !result && q && set(step, order[i]), !result);

  return (
    <div>
      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-violet">Case study</p>
      <h2 className="mb-3 text-[21px] font-bold">{activity.title}</h2>
      <div className="mb-4 rounded-2xl border border-blue/30 bg-blue-soft p-4 text-[15px] leading-relaxed">
        {caseOpen || result ? activity.case : <span className="line-clamp-2">{activity.case}</span>}
        {!result && step > 0 && (
          <button onClick={() => setCaseOpen(!caseOpen)} className="mt-1 block min-h-[36px] text-sm font-semibold text-blue">
            {caseOpen ? 'Collapse case' : 'Show full case'}
          </button>
        )}
      </div>

      {!result ? (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-muted">
              Question {step + 1} of {activity.questions.length}
            </p>
            <div className="flex gap-1.5" aria-hidden>
              {activity.questions.map((_, i) => (
                <span key={i} className={cx('h-2 w-6 rounded-full', i === step ? 'bg-violet' : answers[i] >= 0 ? 'bg-violet/40' : 'bg-elevated')} />
              ))}
            </div>
          </div>
          <h3 className="mb-3 text-[18px] font-bold">{q.prompt}</h3>
          <div role="radiogroup" aria-label={`Question ${step + 1} options`} className="space-y-3">
            {order.map((oi, i) => (
              <OptionButton key={oi} label={LETTERS[i]} selected={answers[step] === oi} onClick={() => set(step, oi)}>
                {q.options[oi].text}
              </OptionButton>
            ))}
          </div>
          <div className="mt-4 flex justify-between gap-2">
            <button disabled={step === 0} onClick={() => { setStep(step - 1); setCaseOpen(false); }} className="min-h-[44px] rounded-xl px-3 text-sm font-semibold text-muted disabled:opacity-30">
              ← Previous
            </button>
            {step < activity.questions.length - 1 && (
              <button disabled={answers[step] < 0} onClick={() => { setStep(step + 1); setCaseOpen(false); }} className="min-h-[44px] rounded-xl bg-elevated px-4 text-sm font-semibold disabled:opacity-40">
                Next question →
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {activity.questions.map((cq, qi) => {
            const part = result.parts?.[qi];
            return (
              <div key={qi} className={cx('rounded-2xl border-2 p-3', part?.correct ? 'border-green/60 bg-green-soft' : 'border-rose/50 bg-rose-soft')}>
                <p className="font-semibold">
                  {qi + 1}. {cq.prompt}
                </p>
                <p className="mt-1 text-sm">
                  You chose: <span className="font-semibold">{cq.options[answers[qi]]?.text ?? '—'}</span>
                </p>
                {!part?.correct && (
                  <p className="text-sm">
                    Best answer: <span className="font-semibold">{cq.options[cq.answer].text}</span>
                  </p>
                )}
                <p className="mt-1 text-sm text-muted">{part?.feedback}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
