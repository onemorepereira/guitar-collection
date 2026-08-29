import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { authService } from './authService';

const TOKEN_KEY = 'guitar-collection-token';
const REFRESH_TOKEN_KEY = 'guitar-collection-refresh-token';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('authFetch 401 handling', () => {
  test('refreshes the token and retries once on 401, then succeeds', async () => {
    localStorage.setItem(TOKEN_KEY, 'old-token');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'refresh-1');

    const fetchMock = vi.spyOn(globalThis, 'fetch');
    // 1) protected call → 401
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: 'expired' }));
    // 2) /auth/refresh → new token
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { tokens: { idToken: 'new-token' } }));
    // 3) retried protected call → 200
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    const res = await authService.authFetch('/guitars', { method: 'GET' });

    expect(res.status).toBe(200);
    expect(localStorage.getItem(TOKEN_KEY)).toBe('new-token');
    // retried request must carry the refreshed token
    const retried = fetchMock.mock.calls[2];
    const retriedHeaders = (retried[1] as RequestInit).headers as Record<string, string>;
    expect(retriedHeaders.Authorization).toBe('Bearer new-token');
  });

  test('logs out and throws when refresh fails on 401', async () => {
    localStorage.setItem(TOKEN_KEY, 'old-token');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'refresh-1');

    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: 'expired' }));
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: 'bad refresh' }));

    await expect(authService.authFetch('/guitars', { method: 'GET' })).rejects.toThrow();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  test('does not retry more than once (no infinite loop) on repeated 401', async () => {
    localStorage.setItem(TOKEN_KEY, 'old-token');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'refresh-1');

    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: 'expired' }));
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { tokens: { idToken: 'new-token' } }));
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: 'still expired' }));

    await expect(authService.authFetch('/guitars', { method: 'GET' })).rejects.toThrow();
    // 3 calls total: original, refresh, one retry — then give up
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe('getCurrentUser recursion cap', () => {
  test('does not loop forever when profile keeps failing but refresh keeps succeeding', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'refresh-1');

    const fetchMock = vi.spyOn(globalThis, 'fetch');
    // Always: profile 500, refresh 200, profile 500, refresh 200, ...
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/auth/refresh')) {
        return jsonResponse(200, { tokens: { idToken: 'new-token' } });
      }
      return jsonResponse(500, { error: 'boom' });
    });

    const user = await authService.getCurrentUser();
    expect(user).toBeNull();
    // Bounded: must not have made an unreasonable number of calls
    expect(fetchMock.mock.calls.length).toBeLessThan(10);
  });
});
