/**
 * Pre-rendered public pages must hydrate without mismatches: render with the
 * build's server entry, then hydrate the client tree on the same URL.
 */
import { describe, test, expect, vi, afterEach } from 'vitest';
import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

vi.mock('../services/guitarService', () => ({
  guitarService: { getRandomPublicGuitar: vi.fn(() => new Promise(() => {})) },
}));

window.matchMedia = window.matchMedia || ((query: string) => ({
  matches: false, media: query, onchange: null,
  addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {},
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia;

import { render } from '../entry-server';
import { AppRoutes } from '../App';
import { ThemeProvider } from '../context/ThemeContext';

async function hydrate(path: string, html: string) {
  window.history.pushState({}, '', path);
  document.body.innerHTML = `<div id="root">${html}</div>`;
  const errors: unknown[] = [];
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  await act(async () => {
    hydrateRoot(
      document.getElementById('root')!,
      <ThemeProvider><BrowserRouter><AppRoutes /></BrowserRouter></ThemeProvider>,
      { onRecoverableError: (e) => errors.push(e) }
    );
  });
  const logged = consoleError.mock.calls.filter((c) => /hydrat|did not match|server/i.test(String(c[0])));
  consoleError.mockRestore();
  return [...errors, ...logged];
}

afterEach(() => { document.body.innerHTML = ''; });

describe('public pages hydrate cleanly', () => {
  test.each(['/', '/no-such-page'])('%s', async (path) => {
    expect(await hydrate(path, render(path))).toEqual([]);
  });

  test('control: a mismatch is detected', async () => {
    const html = render('/').replace('Sign In', 'Sign Out');
    expect((await hydrate('/', html)).length).toBeGreaterThan(0);
  });
});
