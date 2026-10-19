import { useEffect, useMemo, useRef } from 'react';

/** Max seconds credited for a single question, so leaving the app open idle doesn't inflate "minutes learned". */
const MAX_PER_LAP = 180;

/**
 * Counts active learning time: only while the page is visible, capped per question.
 * `lap()` closes the current question's time slice; `total()` returns credited seconds.
 */
export function useActiveTimer(running: boolean) {
  const credited = useRef(0);
  const lapSeconds = useRef(0);
  const runningRef = useRef(running);
  runningRef.current = running;

  useEffect(() => {
    const t = setInterval(() => {
      if (runningRef.current && document.visibilityState === 'visible' && lapSeconds.current < MAX_PER_LAP) lapSeconds.current += 1;
    }, 1000);
    return () => clearInterval(t);
  }, []);

  return useMemo(
    () => ({
      lap() {
        credited.current += lapSeconds.current;
        lapSeconds.current = 0;
      },
      total() {
        return credited.current + lapSeconds.current;
      },
    }),
    [],
  );
}
