/** Chunk-load failures after a deploy: reload once, then ask; other errors pass through. */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { lazy, Suspense } from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { ChunkErrorBoundary, ClearReloadFlag } from './ChunkErrorBoundary';

const reload = vi.fn();
beforeEach(() => {
  sessionStorage.clear();
  Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, reload } });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); reload.mockReset(); });

const failing = (message: string) => lazy(() => Promise.reject(new TypeError(message)));
const ok = lazy(() => Promise.resolve({ default: () => <p>loaded</p> }));

const wrap = (Comp: React.ComponentType) => (
  <ChunkErrorBoundary>
    <Suspense fallback={<p>loading</p>}>
      <ClearReloadFlag />
      <Comp />
    </Suspense>
  </ChunkErrorBoundary>
);

describe('ChunkErrorBoundary', () => {
  test('first chunk failure reloads once', async () => {
    render(wrap(failing('Failed to fetch dynamically imported module: /assets/x.js')));
    await screen.findByText('A new version of GuitarHelp is available.');
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('chunk-reload-attempted')).toBe('1');
  });

  test('a second failure in the same session shows the message without reloading', async () => {
    sessionStorage.setItem('chunk-reload-attempted', '1');
    render(wrap(failing('Failed to fetch dynamically imported module: /assets/x.js')));
    await screen.findByText('A new version of GuitarHelp is available.');
    expect(reload).not.toHaveBeenCalled();
  });

  test('a screen that loads clears the flag', async () => {
    sessionStorage.setItem('chunk-reload-attempted', '1');
    render(wrap(ok));
    await screen.findByText('loaded');
    expect(sessionStorage.getItem('chunk-reload-attempted')).toBeNull();
  });

  test('other errors are not swallowed', async () => {
    const Boom = () => { throw new Error('boom'); };
    expect(() => render(wrap(Boom))).toThrow('boom');
    expect(reload).not.toHaveBeenCalled();
  });
});
