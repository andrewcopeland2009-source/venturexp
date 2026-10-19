import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { CheckCircle2, CloudOff, Download, FileUp, ShieldCheck, Upload } from 'lucide-react';
import { backupFileName, createBackup, importBackup, parseBackup, readAll, summarize, type Backup as BackupFile, type BackupSummary } from '@/db/backup';
import { updatePrefs } from '@/db/progression';
import type { Preferences } from '@/domain/records';
import { usePrefs } from '@/hooks/data';
import { Button, Card, Dialog, PageHeader, SectionTitle, Spinner, cx } from '@/components/ui';

const REMIND_AFTER_DAYS = 14;

/** Gentle, dismissible-by-setting reminder. No pressure language. */
export function BackupReminder({ prefs }: { prefs: Preferences }) {
  if (!prefs.backupReminders) return null;
  const days = prefs.lastBackupAt ? (Date.now() - prefs.lastBackupAt) / 86_400_000 : Infinity;
  if (days < REMIND_AFTER_DAYS) return null;
  return (
    <Link to="/settings/backup" className="surface mb-2 flex items-center gap-3 rounded-2xl border-blue/30 p-3 text-sm">
      <ShieldCheck size={20} className="shrink-0 text-blue" />
      <span>
        {prefs.lastBackupAt ? `Last backup ${Math.floor(days)} days ago.` : 'No backup yet.'} Exporting a copy keeps your progress safe if browser data is cleared.
      </span>
    </Link>
  );
}

function SummaryTable({ current, incoming }: { current: BackupSummary; incoming: BackupSummary }) {
  const rows: [string, keyof BackupSummary][] = [
    ['Lessons completed', 'lessonsCompleted'],
    ['Total XP', 'totalXp'],
    ['Badges', 'achievements'],
    ['Flashcards reviewed', 'cards'],
    ['Active days', 'activeDays'],
    ['Simulation runs', 'simulations'],
  ];
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-muted">
          <th className="py-1 font-semibold" />
          <th className="py-1 text-right font-semibold">This device</th>
          <th className="py-1 text-right font-semibold">Backup file</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, k]) => (
          <tr key={k} className="border-t border-line">
            <td className="py-1.5 text-ink">{label}</td>
            <td className="py-1.5 text-right text-ink">{Number(current[k]).toLocaleString()}</td>
            <td className={cx('py-1.5 text-right font-semibold', incoming[k] !== current[k] ? 'text-blue' : 'text-ink')}>{Number(incoming[k]).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Backup() {
  const prefs = usePrefs();
  const fileInput = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ backup: BackupFile; current: BackupSummary; incoming: BackupSummary; name: string } | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function exportProgress() {
    setExporting(true);
    setError(null);
    try {
      const now = new Date();
      const backup = await createBackup(now);
      const name = backupFileName(now);
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const file = new File([blob], name, { type: 'application/json' });
      // iOS: the share sheet lets you "Save to Files". Elsewhere, a normal download.
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare?.({ files: [file] }) && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
        try {
          await navigator.share({ files: [file], title: 'VentureXP backup' });
        } catch (e) {
          if ((e as Error).name === 'AbortError') return;
          throw e;
        }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }
      await updatePrefs({ lastBackupAt: Date.now() });
      setExported(name);
    } catch (e) {
      console.error(e);
      setError('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setDone(null);
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) return setError('That file is too large to be a VentureXP backup.');
    const res = parseBackup(await f.text());
    if (!res.ok) return setError(res.error);
    setPending({ backup: res.backup, current: summarize(await readAll()), incoming: summarize(res.backup.data), name: f.name });
    setMode('merge');
  }

  async function doImport() {
    if (!pending) return;
    try {
      await importBackup(pending.backup, mode);
      setDone(mode === 'merge' ? 'Backup merged into this device’s progress.' : 'Progress replaced with the backup.');
      setPending(null);
      setConfirm(false);
    } catch (e) {
      console.error(e);
      setError('Import failed and nothing was changed. Please try again.');
      setConfirm(false);
    }
  }

  if (!prefs) return <Spinner />;

  return (
    <div>
      <PageHeader title="Backup & restore" back="/settings" />

      <Card className="flex items-start gap-3 border-blue/30">
        <CloudOff size={22} className="mt-0.5 shrink-0 text-blue" />
        <div className="text-[15px]">
          <p className="font-semibold">Your progress lives only on this device.</p>
          <p className="mt-1 text-muted">
            VentureXP has no account and no cloud. Progress does <strong className="text-ink">not</strong> sync automatically between devices, browsers or iCloud. Clearing Safari website data deletes
            it. Export a backup file to keep a copy or move to another device.
          </p>
        </div>
      </Card>

      <SectionTitle>Export Progress</SectionTitle>
      <Card>
        <p className="text-sm text-muted">Downloads a timestamped JSON file with all your progress. On iPhone, choose “Save to Files” in the share sheet.</p>
        <Button block size="lg" className="mt-3" onClick={exportProgress} disabled={exporting}>
          <Download size={18} /> {exporting ? 'Preparing…' : 'Export Progress'}
        </Button>
        <p className="mt-2 text-xs text-muted">{prefs.lastBackupAt ? `Last export: ${new Date(prefs.lastBackupAt).toLocaleString()}` : 'No exports yet.'}</p>
        {exported && (
          <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-green" role="status">
            <CheckCircle2 size={16} /> Saved {exported}
          </p>
        )}
      </Card>

      <SectionTitle>Import Progress</SectionTitle>
      <Card>
        <p className="text-sm text-muted">Choose a VentureXP backup file. It’s validated first and you’ll see exactly what changes before anything is written.</p>
        <input ref={fileInput} type="file" accept="application/json,.json" className="sr-only" onChange={onFile} aria-label="Choose backup file" data-testid="backup-file" />
        <Button block variant="secondary" size="lg" className="mt-3" onClick={() => fileInput.current?.click()}>
          <FileUp size={18} /> Choose backup file
        </Button>
        {error && (
          <p className="mt-3 rounded-xl bg-rose-soft p-3 text-sm text-rose" role="alert">
            {error}
          </p>
        )}
        {done && (
          <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-green-soft p-3 text-sm font-semibold text-green" role="status">
            <CheckCircle2 size={16} /> {done}
          </p>
        )}
      </Card>

      {pending && (
        <Card className="mt-3 border-violet/40">
          <p className="font-bold">Preview: {pending.name}</p>
          <p className="mb-3 text-xs text-muted">
            Exported {new Date(pending.backup.exportedAt).toLocaleString()}
            {pending.incoming.nickname ? ` · ${pending.incoming.nickname}` : ''}
          </p>
          <SummaryTable current={pending.current} incoming={pending.incoming} />
          <div className="mt-4 space-y-2" role="radiogroup" aria-label="Import mode">
            {(
              [
                ['merge', 'Merge (recommended)', 'Combine both. Keeps the furthest progress for each lesson, unions XP and badges without double-counting.'],
                ['replace', 'Replace', 'Erase this device’s progress and use the backup exactly as it is.'],
              ] as const
            ).map(([v, title, text]) => (
              <button key={v} role="radio" aria-checked={mode === v} onClick={() => setMode(v)} className={cx('w-full rounded-2xl border-2 p-3 text-left', mode === v ? 'border-violet bg-violet-soft' : 'border-line-strong')}>
                <span className="block font-semibold">{title}</span>
                <span className="text-sm text-muted">{text}</span>
              </button>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button onClick={() => setConfirm(true)}>
              <Upload size={18} /> Import
            </Button>
          </div>
        </Card>
      )}

      <details className="surface mt-6 rounded-2xl p-4 text-sm">
        <summary className="min-h-[32px] cursor-pointer font-semibold">Merge policy details</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
          <li>XP events, answers and simulation runs are combined by their unique IDs, so nothing is counted twice.</li>
          <li>Lessons: a completed record beats in-progress; best score, perfect runs and completion counts take the higher value.</li>
          <li>Badges: kept from both, with the earliest unlock date.</li>
          <li>Flashcards: the most recently reviewed schedule wins.</li>
          <li>Daily activity: for each day, the larger counts are kept; a day counts toward your streak if either copy says so.</li>
          <li>Profile and settings: this device’s are kept (the earlier join date is used).</li>
        </ul>
      </details>

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={mode === 'merge' ? 'Merge this backup?' : 'Replace all progress?'}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button variant={mode === 'replace' ? 'danger' : 'primary'} onClick={doImport}>
              {mode === 'merge' ? 'Merge' : 'Replace'}
            </Button>
          </>
        }
      >
        {mode === 'merge' ? 'Your current progress stays, and anything extra from the backup is added.' : 'This device’s current progress will be erased and replaced by the backup. This can’t be undone.'}
      </Dialog>
    </div>
  );
}
