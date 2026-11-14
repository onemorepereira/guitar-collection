import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { accountService, AccountApiError } from '../services/accountService';
import { authService } from '../services/authService';

interface DeleteAccountDialogProps {
  onClose: () => void;
}

/**
 * Confirm-and-delete dialog (GTR-14, approved design). "Delete forever" stays
 * disabled until a password is typed and the irreversible-action box is ticked.
 */
export const DeleteAccountDialog = ({ onClose }: DeleteAccountDialogProps) => {
  const [password, setPassword] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    passwordRef.current?.focus();
    return () => previouslyFocused?.focus?.();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !submitting) {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === 'Tab' && dialogRef.current) {
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'input, button:not([disabled]), a[href]'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !understood) return;
    setError('');
    setSubmitting(true);
    try {
      await accountService.requestDeletion(password);
      await authService.clearLocalUserData();
      authService.notifyLoggedOut();
      window.location.assign('/?account=deleting');
    } catch (err) {
      setSubmitting(false);
      if (err instanceof AccountApiError && err.code === 'WRONG_PASSWORD') {
        setError("That password isn't right.");
      } else if (err instanceof AccountApiError && err.code === 'TOO_MANY_ATTEMPTS') {
        setError('Too many attempts. Please wait a few minutes and try again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onKeyDown={handleKeyDown}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6"
      >
        <h2 id="delete-account-title" className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Delete your account?
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Consider exporting first.</p>

        <form onSubmit={handleDelete} className="space-y-4">
          <div>
            <label htmlFor="delete-password" className="label">Password</label>
            <input
              id="delete-password"
              ref={passwordRef}
              type="password"
              autoComplete="current-password"
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
          </div>

          <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
              disabled={submitting}
            />
            I understand this can't be undone
          </label>

          {error && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
              disabled={!password || !understood || submitting}
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              Delete forever
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
