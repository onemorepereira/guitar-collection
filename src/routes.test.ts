/**
 * Every route in App.tsx must be served in production: either a pre-rendered
 * public page or an app route the CloudFront router sends to app.html.
 */
import { test, expect } from 'vitest';
import appSource from './App.tsx?raw';
import { isAppRoute } from './routes';
import { PUBLIC_PAGES } from './public/pages';

const routePaths = [...appSource.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]);

test('App.tsx routes are found', () => {
  expect(routePaths.length).toBeGreaterThan(15);
});

test.each(routePaths.filter((p) => p !== '*'))('%s is served (public page or app route)', (path) => {
  const sample = path.replace(/:[^/]+/g, 'sample');
  const isPublic = PUBLIC_PAGES.some((p) => !p.static && p.path === sample);
  expect({ path, served: isPublic || isAppRoute(sample) }).toEqual({ path, served: true });
});
