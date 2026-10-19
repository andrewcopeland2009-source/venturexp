import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw } from 'lucide-react';
import { Button } from './ui';

/**
 * Service worker update flow: a new version downloads in the background, then waits.
 * The learner chooses when to reload, so a lesson in progress is never interrupted.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // Check for updates hourly while the app is open.
      if (reg) setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    },
  });

  // The "ready offline" note is informational: hide it on its own after a few seconds.
  useEffect(() => {
    if (!offlineReady) return;
    const t = setTimeout(() => setOfflineReady(false), 5000);
    return () => clearTimeout(t);
  }, [offlineReady, setOfflineReady]);

  if (!needRefresh && !offlineReady) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-[calc(env(safe-area-inset-top)+8px)]" role="status">
      <div className="surface flex w-full max-w-md items-center gap-3 rounded-2xl p-3 pl-4">
        <p className="flex-1 text-sm">{needRefresh ? 'A new version of VentureXP is ready.' : 'VentureXP is ready to work offline.'}</p>
        {needRefresh ? (
          <Button size="sm" onClick={() => updateServiceWorker(true)}>
            <RefreshCw size={16} /> Reload
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={() => { setNeedRefresh(false); setOfflineReady(false); }}>
          {needRefresh ? 'Later' : 'OK'}
        </Button>
      </div>
    </div>
  );
}
