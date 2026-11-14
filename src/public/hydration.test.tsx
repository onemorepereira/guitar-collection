/**
 * Pre-rendered public pages must hydrate without mismatches: render with the
 * build's server entry, then hydrate the client tree on the same URL, the way
 * main.tsx does (StrictMode, onRecoverableError).
 */
import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

vi.mock('../services/guitarService', () => ({
  guitarService: { getRandomPublicGuitar: vi.fn(() => new Promise(() => {})) },
}));
vi.mock('../services/authService', async () => {
  const actual = await vi.importActual<typeof import('../services/authService')>('../services/authService');
  return {
    ...actual,
    authService: { ...actual.authService, getCurrentUser: vi.fn(() => new Promise(() => {})) },
  };
});

window.matchMedia = window.matchMedia || ((query: string) => ({
  matches: false, media: query, onchange: null,
  addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {},
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia;

import { render } from '../entry-server';
import { AppRoutes } from '../App';
import { ThemeProvider } from '../context/ThemeContext';
import { PUBLIC_PAGES } from './pages';

const PRERENDERED = PUBLIC_PAGES.filter((p) => !p.static).map((p) => p.path);

async function hydrate(path: string, html: string) {
  window.history.pushState({}, '', path);
  document.body.innerHTML = `<div id="root">${html}</div>`;
  const errors: unknown[] = [];
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  await act(async () => {
    hydrateRoot(
      document.getElementById('root')!,
      <StrictMode><ThemeProvider><BrowserRouter><AppRoutes /></BrowserRouter></ThemeProvider></StrictMode>,
      { onRecoverableError: (e) => errors.push(e) }
    );
  });
  const logged = consoleError.mock.calls.filter((c) => /hydrat|did not match|server/i.test(String(c[0])));
  consoleError.mockRestore();
  return [...errors, ...logged];
}

beforeEach(() => localStorage.clear());
afterEach(() => { document.body.innerHTML = ''; localStorage.clear(); });

describe('public pages hydrate cleanly', () => {
  test.each([...PRERENDERED, '/no-such-page'])('%s', async (path) => {
    expect(await hydrate(path, render(path))).toEqual([]);
  });

  test.each(PRERENDERED)('%s with a dark theme stored and a signed-in token', async (path) => {
    const html = render(path); // the build renders without any browser state
    localStorage.setItem('theme-preference', 'dark');
    localStorage.setItem('guitar-collection-token', 'header.eyJzdWIiOiJ1In0.sig');
    expect(await hydrate(path, html)).toEqual([]);
  });

  test('control: a mismatch is detected', async () => {
    const html = render('/').replace('Start your collection', 'Start your COLLECTION');
    expect(html).toContain('Start your COLLECTION');
    expect((await hydrate('/', html)).length).toBeGreaterThan(0);
  });
});
