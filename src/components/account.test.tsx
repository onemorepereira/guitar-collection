/**
 * GTR-14 frontend: account page (export states, download, polling), delete
 * dialog, app-wide reaction to a deleting account, landing banner.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-a', email: 'alex@example.com', name: 'Alex' },
    isAuthenticated: false,
    updateUserName: vi.fn(),
  }),
}));

vi.mock('../services/accountService', async () => {
  const actual = await vi.importActual<typeof import('../services/accountService')>('../services/accountService');
  return {
    ...actual,
    accountService: {
      getExportStatus: vi.fn(),
      startExport: vi.fn(),
      requestDeletion: vi.fn(),
    },
  };
});

vi.mock('../services/guitarService', () => ({
  guitarService: { getRandomPublicGuitar: vi.fn().mockResolvedValue(null) },
}));

import { accountService, AccountApiError } from '../services/accountService';
import { authService } from '../services/authService';
import { authenticatedRequest } from '../utils/api';
import { AccountPage } from './AccountPage';
import { Landing } from './Landing';

const assign = vi.fn();
const deleteDatabase = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, assign, search: '' },
  });
  deleteDatabase.mockImplementation(() => {
    const req: Record<string, unknown> = {};
    setTimeout(() => (req.onsuccess as () => void)?.(), 0);
    return req;
  });
  vi.stubGlobal('indexedDB', { deleteDatabase });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

function renderAccount() {
  return render(
    <MemoryRouter initialEntries={['/account']}>
      <Routes>
        <Route path="/account" element={<AccountPage />} />
      </Routes>
    </MemoryRouter>
  );
}

const ready = {
  status: 'ready' as const,
  jobId: 'j1',
  sizeBytes: 12 * 1024 * 1024,
  availableUntil: '2026-11-21T10:00:00.000Z',
  downloadUrl: 'https://signed.example/old',
};

describe('AccountPage: Your data', () => {
  test('profile shows the name and a masked email', async () => {
    vi.mocked(accountService.getExportStatus).mockResolvedValue({ status: 'none' });
    renderAccount();
    expect(screen.getByText('Alex')).toBeTruthy();
    expect(screen.getByText('a***@example.com')).toBeTruthy();
  });

  test('idle: password + Export my data (disabled until a password is typed)', async () => {
    vi.mocked(accountService.getExportStatus).mockResolvedValue({ status: 'none' });
    renderAccount();
    const button = await screen.findByRole('button', { name: 'Export my data' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pw' } });
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  test('starting an export shows the preparing message; wrong password shows the error', async () => {
    vi.mocked(accountService.getExportStatus).mockResolvedValue({ status: 'none' });
    vi.mocked(accountService.startExport).mockRejectedValueOnce(
      new AccountApiError("That password isn't right.", 401, { code: 'WRONG_PASSWORD' })
    );
    renderAccount();
    fireEvent.change(await screen.findByLabelText('Password'), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: 'Export my data' }));
    expect((await screen.findByRole('alert')).textContent).toBe("That password isn't right.");

    vi.mocked(accountService.startExport).mockResolvedValueOnce({ status: 'pending', jobId: 'j1' });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: 'Export my data' }));
    expect(await screen.findByText(/Preparing your export/)).toBeTruthy();
    expect(accountService.startExport).toHaveBeenLastCalledWith('pw');
  });

  test('ready: size, retention line, and Download fetches a fresh link before navigating', async () => {
    vi.mocked(accountService.getExportStatus)
      .mockResolvedValueOnce(ready)
      .mockResolvedValueOnce({ ...ready, downloadUrl: 'https://signed.example/fresh' });
    renderAccount();
    expect(await screen.findByText(/Ready \(12\.0 MB\)/)).toBeTruthy();
    expect(screen.getByText(/Link valid 1 hour; file kept until/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Download ZIP' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://signed.example/fresh'));
    expect(accountService.getExportStatus).toHaveBeenCalledTimes(2);
  });

  test.each([
    [{ status: 'failed' as const, reason: 'error' }, /Export failed/, 'Try again'],
    [{ status: 'expired' as const }, /Your last export expired/, 'Export my data'],
  ])('%o state', async (job, text, buttonName) => {
    vi.mocked(accountService.getExportStatus).mockResolvedValue(job);
    renderAccount();
    expect(await screen.findByText(text)).toBeTruthy();
    expect(screen.getByRole('button', { name: buttonName })).toBeTruthy();
  });

  test('too large: message and contact link only, no retry form (owner ruling)', async () => {
    vi.mocked(accountService.getExportStatus).mockResolvedValue({ status: 'failed', reason: 'too_large' });
    renderAccount();
    expect(await screen.findByText(/too large to export automatically/)).toBeTruthy();
    expect(screen.queryByLabelText('Password')).toBeNull();
  });

  test('ready less than an hour ago: download only, no new-export form', async () => {
    vi.mocked(accountService.getExportStatus).mockResolvedValue({ ...ready, completedAt: new Date(Date.now() - 10 * 60000).toISOString() });
    renderAccount();
    await screen.findByRole('button', { name: 'Download ZIP' });
    expect(screen.queryByText('Need a newer copy?')).toBeNull();
    expect(screen.queryByLabelText('Password')).toBeNull();
  });

  test('ready more than an hour ago: download plus "Need a newer copy?" form (owner ruling)', async () => {
    vi.mocked(accountService.getExportStatus).mockResolvedValue({ ...ready, completedAt: new Date(Date.now() - 2 * 3600000).toISOString() });
    renderAccount();
    await screen.findByRole('button', { name: 'Download ZIP' });
    expect(screen.getByText('Need a newer copy?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Export my data' })).toBeTruthy();
  });

  test('a failure loading the status is shown, not silently treated as no export', async () => {
    vi.mocked(accountService.getExportStatus).mockRejectedValue(new AccountApiError('down', 503, { code: 'SERVICE_UNAVAILABLE' }));
    renderAccount();
    expect((await screen.findByRole('alert')).textContent).toMatch(/Couldn't load your export status/);
  });

  test('too large links to the contact page', async () => {
    vi.mocked(accountService.getExportStatus).mockResolvedValue({ status: 'failed', reason: 'too_large' });
    renderAccount();
    const link = await screen.findByRole('link', { name: 'contact us' });
    expect(link.getAttribute('href')).toMatch(/github\.com\/onemorepereira\/guitar-collection\/issues/);
  });

  test('rate-limited while one is being prepared: shows the server message', async () => {
    vi.mocked(accountService.getExportStatus).mockResolvedValue({ status: 'none' });
    vi.mocked(accountService.startExport).mockRejectedValue(
      new AccountApiError('An export is already being prepared.', 429, { code: 'EXPORT_RATE_LIMITED', job: { status: 'failed', reason: 'error' } })
    );
    renderAccount();
    fireEvent.change(await screen.findByLabelText('Password'), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: 'Export my data' }));
    expect(await screen.findByText('An export is already being prepared.')).toBeTruthy();
  });

  test('rate-limited: shows when a new export can start', async () => {
    vi.mocked(accountService.getExportStatus).mockResolvedValue({ status: 'none' });
    vi.mocked(accountService.startExport).mockRejectedValue(
      new AccountApiError('wait', 429, { code: 'EXPORT_RATE_LIMITED', job: { status: 'failed', reason: 'error' }, retryAfter: '2026-11-14T18:30:00.000Z' })
    );
    renderAccount();
    fireEvent.change(await screen.findByLabelText('Password'), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: 'Export my data' }));
    expect(await screen.findByText(/You can start a new export after/)).toBeTruthy();
  });

  test('polls every 5 s while processing and stops on unmount', async () => {
    vi.useFakeTimers();
    vi.mocked(accountService.getExportStatus).mockResolvedValue({ status: 'processing', jobId: 'j1' });
    const { unmount } = renderAccount();
    await act(async () => { await Promise.resolve(); });
    expect(accountService.getExportStatus).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(accountService.getExportStatus).toHaveBeenCalledTimes(2);
    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
    expect(accountService.getExportStatus).toHaveBeenCalledTimes(2);
  });
});

describe('Delete account dialog', () => {
  async function openDialog() {
    vi.mocked(accountService.getExportStatus).mockResolvedValue({ status: 'none' });
    renderAccount();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete my account…' }));
    return screen.getByRole('dialog', { name: 'Delete your account?' });
  }

  test('Delete forever is disabled until a password is typed and the box is ticked', async () => {
    const dialog = await openDialog();
    const del = screen.getByRole('button', { name: 'Delete forever' }) as HTMLButtonElement;
    expect(del.disabled).toBe(true);
    fireEvent.change(dialog.querySelector('#delete-password')!, { target: { value: 'pw' } });
    expect(del.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText("I understand this can't be undone"));
    expect(del.disabled).toBe(false);
  });

  test('focus starts on the password and Tab wraps within the dialog', async () => {
    const dialog = await openDialog();
    const password = dialog.querySelector('#delete-password') as HTMLInputElement;
    expect(document.activeElement).toBe(password);
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    cancel.focus();
    // "Delete forever" is disabled, so Cancel is the last focusable element
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(password);
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(cancel);
  });

  test('Escape closes it', async () => {
    const dialog = await openDialog();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test.each([
    ['WRONG_PASSWORD', 401, "That password isn't right."],
    ['TOO_MANY_ATTEMPTS', 429, 'Too many attempts. Please wait a few minutes and try again.'],
  ])('%s shows its message and keeps the dialog open', async (code, status, text) => {
    vi.mocked(accountService.requestDeletion).mockRejectedValue(new AccountApiError('x', status as number, { code }));
    const dialog = await openDialog();
    fireEvent.change(dialog.querySelector('#delete-password')!, { target: { value: 'pw' } });
    fireEvent.click(screen.getByLabelText("I understand this can't be undone"));
    fireEvent.click(screen.getByRole('button', { name: 'Delete forever' }));
    expect((await screen.findByRole('alert')).textContent).toBe(text);
    expect(assign).not.toHaveBeenCalled();
  });

  test('success clears local data and goes to the landing banner', async () => {
    localStorage.setItem('guitar-collection-token', 't');
    localStorage.setItem('recent-brands', '["Fender"]');
    vi.mocked(accountService.requestDeletion).mockResolvedValue();
    const dialog = await openDialog();
    fireEvent.change(dialog.querySelector('#delete-password')!, { target: { value: 'pw' } });
    fireEvent.click(screen.getByLabelText("I understand this can't be undone"));
    fireEvent.click(screen.getByRole('button', { name: 'Delete forever' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/?account=deleting'));
    expect(localStorage.getItem('guitar-collection-token')).toBeNull();
    expect(localStorage.getItem('recent-brands')).toBeNull();
    expect(deleteDatabase).toHaveBeenCalledWith('guitar-collection-db');
  });
});

describe('app-wide reaction to a deleting account (other devices)', () => {
  test('a 401 with ACCOUNT_DELETION_IN_PROGRESS clears local data and redirects', async () => {
    localStorage.setItem('guitar-collection-token', 't');
    localStorage.setItem('guitar-collection-user', '{"id":"user-a"}');
    localStorage.setItem('recent-models', '[]');
    localStorage.setItem('guitarViewMode', 'table'); // not user data: kept
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Account deletion in progress', code: 'ACCOUNT_DELETION_IN_PROGRESS' }), { status: 401 })
    ));
    await authenticatedRequest('/guitars', 't');
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/?account=deleting'));
    expect(localStorage.getItem('guitar-collection-token')).toBeNull();
    expect(localStorage.getItem('guitar-collection-user')).toBeNull();
    expect(localStorage.getItem('recent-models')).toBeNull();
    expect(localStorage.getItem('guitarViewMode')).toBe('table');
    expect(deleteDatabase).toHaveBeenCalledWith('guitar-collection-db');
  });

  test('getCurrentUser does not fall back to the cached user while deleting', async () => {
    localStorage.setItem('guitar-collection-token', 't');
    localStorage.setItem('guitar-collection-user', '{"id":"user-a"}');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 'ACCOUNT_DELETION_IN_PROGRESS' }), { status: 401 })
    ));
    await expect(authService.getCurrentUser()).resolves.toBeNull();
  });

  test('an ordinary 401 does not trigger the deletion cleanup', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'expired' }), { status: 401 })));
    await authenticatedRequest('/guitars', 't');
    expect(assign).not.toHaveBeenCalled();
  });
});

describe('Landing banner', () => {
  test('shows the deletion banner with ?account=deleting', async () => {
    render(
      <MemoryRouter initialEntries={['/?account=deleting']}>
        <Routes><Route path="/" element={<Landing />} /></Routes>
      </MemoryRouter>
    );
    expect((await screen.findByText(/Your account is being deleted/)).textContent)
      .toBe('Your account is being deleted. This usually takes a few minutes.');
  });
});

describe('Login while the account is being deleted', () => {
  test('shows the server message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Your account is being deleted.', code: 'ACCOUNT_DELETION_IN_PROGRESS' }), { status: 403 })
    ));
    await expect(authService.login({ email: 'a@example.com', password: 'pw' })).rejects.toMatchObject({
      message: 'Your account is being deleted.',
      code: 'ACCOUNT_DELETION_IN_PROGRESS',
    });
  });
});
