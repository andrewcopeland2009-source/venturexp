import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Award, Zap } from 'lucide-react';
import { ACHIEVEMENT_BY_ID } from '@/domain/achievements';

interface ToastItem {
  id: number;
  title: string;
  body?: string;
  kind: 'achievement' | 'xp' | 'info';
}

const Ctx = createContext<{ push: (t: Omit<ToastItem, 'id'>) => void }>({ push: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { ...t, id }]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 3800);
  }, []);
  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-safe" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              initial={{ y: -30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -30, opacity: 0 }}
              className="surface pointer-events-auto mt-3 flex w-full max-w-sm items-center gap-3 rounded-2xl px-4 py-3"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-soft text-amber">
                {t.kind === 'xp' ? <Zap size={20} /> : <Award size={20} />}
              </div>
              <div className="min-w-0">
                <p className="font-semibold">{t.title}</p>
                {t.body && <p className="truncate text-sm text-muted">{t.body}</p>}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const { push } = useContext(Ctx);
  const achievements = useCallback(
    (ids: string[]) => {
      for (const id of ids) {
        const a = ACHIEVEMENT_BY_ID.get(id);
        if (a) push({ kind: 'achievement', title: `Badge unlocked: ${a.title}`, body: a.description });
      }
    },
    [push],
  );
  return { push, achievements };
}
