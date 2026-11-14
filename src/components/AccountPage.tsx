import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Edit2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { accountService, AccountApiError, ExportJob } from '../services/accountService';
import { UserNameEditor } from './UserNameEditor';
import { DeleteAccountDialog } from './DeleteAccountDialog';
import { Footer } from './Footer';

const POLL_MS = 5000;
const NEW_EXPORT_AFTER_READY_MS = 60 * 60 * 1000;
const ISSUES_URL = 'https://github.com/onemorepereira/guitar-collection/issues';

function maskEmail(email?: string): string {
  if (!email) return '';
  const [local, domain] = email.split('@');
  if (!domain) return email;
  return `${local.slice(0, 1)}***@${domain}`;
}

function formatSize(bytes?: number): string {
  if (bytes === undefined) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso?: string): string {
  return iso ? new Date(iso).toLocaleDateString() : '';
}

function formatTime(iso?: string): string {
  return iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
}

/** "Your data" card: start an export and follow it to a download (approved states). */
const ExportCard = () => {
  const [job, setJob] = useState<ExportJob | null>(null);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const latest = await accountService.getExportStatus();
      if (!mounted.current) return;
      setJob(latest);
      if (latest.status === 'pending' || latest.status === 'processing') {
        timer.current = setTimeout(load, POLL_MS);
      }
    } catch {
      if (!mounted.current) return;
      setJob({ status: 'none' });
      setMessage({ kind: 'error', text: "Couldn't load your export status. Please reload the page." });
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [load]);

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setMessage(null);
    setBusy(true);
    try {
      const started = await accountService.startExport(password);
      setPassword('');
      setJob(started);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(load, POLL_MS);
    } catch (err) {
      if (err instanceof AccountApiError && err.code === 'WRONG_PASSWORD') {
        setMessage({ kind: 'error', text: "That password isn't right." });
      } else if (err instanceof AccountApiError && err.code === 'TOO_MANY_ATTEMPTS') {
        setMessage({ kind: 'error', text: 'Too many attempts. Please wait a few minutes and try again.' });
      } else if (err instanceof AccountApiError && err.code === 'EXPORT_RATE_LIMITED') {
        if (err.job) setJob(err.job);
        setMessage({
          kind: 'info',
          text: err.retryAfter ? `You can start a new export after ${formatTime(err.retryAfter)}.` : err.message,
        });
      } else {
        setMessage({ kind: 'error', text: 'Something went wrong. Please try again.' });
      }
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    setBusy(true);
    try {
      // Fetch a fresh link right before downloading (links can expire early)
      const latest = await accountService.getExportStatus();
      setJob(latest);
      if (latest.downloadUrl) window.location.assign(latest.downloadUrl);
    } finally {
      setBusy(false);
    }
  };

  const status = job?.status;
  const inProgress = status === 'pending' || status === 'processing';
  const tooLarge = status === 'failed' && job?.reason === 'too_large';
  // A ready export can be replaced once it's an hour old (backend AC9 limit)
  const readyAndRecent = status === 'ready' &&
    (!job?.completedAt || Date.now() - Date.parse(job.completedAt) < NEW_EXPORT_AFTER_READY_MS);
  const canStart = !inProgress && !tooLarge && !readyAndRecent;

  return (
    <section className="card p-6" aria-labelledby="your-data-heading">
      <h2 id="your-data-heading" className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Your data</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Download a ZIP of all your guitars, photos, documents and reports.
      </p>

      {job === null && <Loader2 className="w-5 h-5 animate-spin text-gray-400" aria-label="Loading" />}

      {inProgress && (
        <p className="text-sm text-gray-700 dark:text-gray-300" role="status">
          ⏳ Preparing your export… You can leave this page and come back.
        </p>
      )}

      {status === 'ready' && (
        <div className="space-y-1" role="status">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            ✅ Ready ({formatSize(job?.sizeBytes)}){' '}
            <button type="button" className="btn-primary ml-2" onClick={download} disabled={busy}>
              Download ZIP
            </button>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Link valid 1 hour; file kept until {formatDate(job?.availableUntil)}.
          </p>
        </div>
      )}

      {status === 'failed' && job?.reason === 'too_large' && (
        <p className="text-sm text-red-700 dark:text-red-300 mb-3">
          ❌ Your collection is too large to export automatically. Please{' '}
          <a href={ISSUES_URL} className="underline" target="_blank" rel="noreferrer">contact us</a>.
        </p>
      )}
      {status === 'failed' && job?.reason !== 'too_large' && (
        <p className="text-sm text-red-700 dark:text-red-300 mb-3">❌ Export failed. Try again.</p>
      )}
      {status === 'expired' && (
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">Your last export expired.</p>
      )}

      {job !== null && canStart && status === 'ready' && (
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-4 mb-2">Need a newer copy?</p>
      )}
      {job !== null && canStart && (
        <form onSubmit={start} className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="flex-1">
            <label htmlFor="export-password" className="label">Password</label>
            <input
              id="export-password"
              type="password"
              autoComplete="current-password"
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={!password || busy}>
            {status === 'failed' ? 'Try again' : 'Export my data'}
          </button>
        </form>
      )}

      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'}
          className={`text-sm mt-3 ${message.kind === 'error' ? 'text-red-700 dark:text-red-300' : 'text-gray-700 dark:text-gray-300'}`}>
          {message.text}
        </p>
      )}
    </section>
  );
};

/** /account — Profile, Your data, Danger zone (GTR-14 approved design). */
export const AccountPage = () => {
  const navigate = useNavigate();
  const { user, updateUserName } = useAuth();
  const [editingName, setEditingName] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/collection')}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            title="Back to guitar collection"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Account</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6 flex-1">
        <section className="card p-6" aria-labelledby="profile-heading">
          <h2 id="profile-heading" className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">Profile</h2>
          <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-gray-500 dark:text-gray-400">Name</dt>
            <dd className="text-gray-900 dark:text-gray-100 flex items-center gap-2">
              {user?.name}
              <button type="button" onClick={() => setEditingName(true)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="Change display name">
                <Edit2 className="w-3 h-3" />
                <span className="sr-only">Edit name</span>
              </button>
            </dd>
            <dt className="text-gray-500 dark:text-gray-400">Email</dt>
            <dd className="text-gray-900 dark:text-gray-100">{maskEmail(user?.email)}</dd>
          </dl>
        </section>

        <ExportCard />

        <section className="card p-6 border border-red-300 dark:border-red-800" aria-labelledby="danger-heading">
          <h2 id="danger-heading" className="text-xl font-bold text-red-700 dark:text-red-400 mb-1">Danger zone</h2>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Delete account</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Permanently deletes your account, guitars, photos, documents, shares.
          </p>
          <details className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            <summary className="cursor-pointer">What happens to backups &amp; copies</summary>
            <div className="mt-2 space-y-1">
              <p>Deleted right away: account, guitars, photos, documents, reports, share links.</p>
              <p>Copies that expire on their own:</p>
              <ul className="list-disc pl-5">
                <li>old file versions: 30 days</li>
                <li>database backups: 35 days</li>
                <li>server logs: 90 days</li>
                <li>browser caches of shared photos</li>
              </ul>
              <p>
                <a href="/privacy.html" className="underline">Full retention schedule</a>
              </p>
            </div>
          </details>
          <button
            type="button"
            className="px-4 py-2 rounded-lg border border-red-600 text-red-700 dark:text-red-400 font-medium hover:bg-red-50 dark:hover:bg-red-900/20"
            onClick={() => setDeleting(true)}
          >
            Delete my account…
          </button>
        </section>
      </main>

      <Footer />

      {editingName && user && (
        <UserNameEditor
          currentName={user.name}
          onSave={async (name: string) => { await updateUserName(name); }}
          onCancel={() => setEditingName(false)}
        />
      )}
      {deleting && <DeleteAccountDialog onClose={() => setDeleting(false)} />}
    </div>
  );
};
