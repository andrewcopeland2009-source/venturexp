import { forwardRef, useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft } from 'lucide-react';
import { Link, useNavigate, type LinkProps } from 'react-router';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ───────── Button ─────────
type Variant = 'primary' | 'secondary' | 'ghost' | 'success' | 'danger' | 'outline';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-violet text-on-accent shadow-[0_8px_24px_-8px_rgb(139_92_246/0.7)] hover:brightness-110 active:brightness-95',
  secondary: 'bg-elevated text-ink hover:bg-line-strong',
  ghost: 'bg-transparent text-ink hover:bg-elevated',
  outline: 'bg-transparent text-ink border border-line-strong hover:bg-elevated',
  success: 'bg-green text-[#05210f] hover:brightness-110',
  danger: 'bg-rose text-white hover:brightness-110',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'md' | 'lg' | 'sm';
  block?: boolean;
}

export function buttonClass(variant: Variant = 'primary', size: 'md' | 'lg' | 'sm' = 'md', block?: boolean, className?: string) {
  return cx(
    'inline-flex select-none items-center justify-center gap-2 rounded-2xl font-semibold transition-[filter,background-color,transform] duration-150 active:scale-[0.98] disabled:opacity-45 disabled:active:scale-100',
    size === 'lg' && 'min-h-[52px] px-6 text-[17px]',
    size === 'md' && 'min-h-[44px] px-5 text-[15px]',
    size === 'sm' && 'min-h-[44px] px-3 text-sm',
    block && 'w-full',
    VARIANTS[variant],
    className,
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', block, className, type = 'button', ...rest },
  ref,
) {
  return <button ref={ref} type={type} className={buttonClass(variant, size, block, className)} {...rest} />;
});

/** A router link styled like a Button (avoids nesting buttons inside links). */
export function LinkButton({ variant = 'primary', size = 'md', block, className, ...rest }: LinkProps & { variant?: Variant; size?: 'md' | 'lg' | 'sm'; block?: boolean }) {
  return <Link className={buttonClass(variant, size, block, className)} {...rest} />;
}

// ───────── Card ─────────
export function Card({ className, children, as: As = 'div', ...rest }: { className?: string; children: ReactNode; as?: 'div' | 'section' | 'article' } & React.HTMLAttributes<HTMLElement>) {
  return (
    <As className={cx('surface rounded-[var(--radius-card)] p-4', className)} {...rest}>
      {children}
    </As>
  );
}

// ───────── Progress ─────────
export function ProgressBar({ value, className, tone = 'xp', label, height = 10 }: { value: number; className?: string; tone?: 'xp' | 'green' | 'blue' | 'amber' | 'violet'; label?: string; height?: number }) {
  const v = Math.max(0, Math.min(1, value || 0));
  const fill = { xp: 'xp-gradient', green: 'bg-green', blue: 'bg-blue', amber: 'bg-amber', violet: 'bg-violet' }[tone];
  return (
    <div
      className={cx('w-full overflow-hidden rounded-full bg-elevated', className)}
      style={{ height }}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
    >
      <motion.div className={cx('h-full rounded-full', fill)} initial={{ width: 0 }} animate={{ width: `${v * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 22 }} />
    </div>
  );
}

export function Ring({ value, size = 56, stroke = 6, color = 'var(--c-green)', children, label }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--c-elevated)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - v) }}
          transition={{ type: 'spring', stiffness: 90, damping: 20 }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

// ───────── Small bits ─────────
export function Pill({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'violet' | 'blue' | 'green' | 'amber' | 'rose'; className?: string }) {
  const t = {
    neutral: 'bg-elevated text-muted',
    violet: 'bg-violet-soft text-violet',
    blue: 'bg-blue-soft text-blue',
    green: 'bg-green-soft text-green',
    amber: 'bg-amber-soft text-amber',
    rose: 'bg-rose-soft text-rose',
  }[tone];
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold', t, className)}>{children}</span>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 mt-7 flex items-end justify-between gap-3">
      <h2 className="text-lg font-bold">{children}</h2>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, back, action, large = true }: { title: string; subtitle?: ReactNode; back?: string | boolean; action?: ReactNode; large?: boolean }) {
  const navigate = useNavigate();
  return (
    <header className="mb-4 pt-2">
      <div className="flex min-h-[44px] items-center justify-between gap-2">
        {back ? (
          <button
            onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
            className="-ml-2 inline-flex min-h-[44px] min-w-[44px] items-center gap-1 rounded-xl pr-2 text-muted hover:text-ink"
            aria-label="Back"
          >
            <ChevronLeft size={22} />
            <span className="text-sm font-medium">Back</span>
          </button>
        ) : (
          <span />
        )}
        {action}
      </div>
      <h1 className={cx('font-extrabold', large ? 'text-[28px] leading-tight' : 'text-xl')}>{title}</h1>
      {subtitle && <p className="mt-1 text-[15px] text-muted">{subtitle}</p>}
    </header>
  );
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <Card className="flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-elevated text-muted">{icon}</div>
      <h3 className="text-lg font-bold">{title}</h3>
      {children && <div className="mt-1 max-w-sm text-[15px] text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </Card>
  );
}

export function Spinner() {
  return (
    <div className="grid min-h-[40vh] place-items-center" role="status" aria-label="Loading">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-elevated border-t-violet" />
    </div>
  );
}

// ───────── Dialog ─────────
export function Dialog({
  open,
  onClose,
  title,
  children,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  actions: ReactNode;
}) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement as HTMLElement;
    const t = setTimeout(() => panel.current?.querySelector<HTMLElement>('button, [href], input, select')?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && panel.current) {
        const f = [...panel.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea')].filter((el) => !el.hasAttribute('disabled'));
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      lastFocus.current?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center p-4 pb-safe sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-label="Close dialog" onClick={onClose} tabIndex={-1} />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={id}
            className="surface relative mb-4 w-full max-w-md rounded-3xl p-5 sm:mb-0"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <h2 id={id} className="text-xl font-bold">
              {title}
            </h2>
            {children && <div className="mt-2 text-[15px] text-muted">{children}</div>}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{actions}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  const id = useId();
  return (
    <div className="flex min-h-[52px] items-center justify-between gap-4 py-2">
      <label htmlFor={id} className="flex-1">
        <span className="block font-medium">{label}</span>
        {description && <span className="block text-sm text-muted">{description}</span>}
      </label>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx('relative h-8 w-[52px] shrink-0 rounded-full transition-colors', checked ? 'bg-green' : 'bg-elevated border border-line-strong')}
      >
        <span className={cx('absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-[left]', checked ? 'left-[24px]' : 'left-1')} />
      </button>
    </div>
  );
}

export function Segmented<T extends string | number>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-1 rounded-2xl bg-elevated p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx('min-h-[40px] rounded-xl px-2 text-sm font-semibold transition-colors', value === o.value ? 'bg-card text-ink shadow' : 'text-muted hover:text-ink')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
