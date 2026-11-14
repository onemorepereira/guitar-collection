/**
 * The CloudFront URL router in frontend-infrastructure.yaml, run against the
 * app's routes and public pages. The code under test is the template's own
 * ROUTER-BEGIN/END block (the same text that is deployed).
 */
import { describe, test, expect } from 'vitest';
import template from '../../frontend-infrastructure.yaml?raw';
import { extractRouter, loadHandler } from '../../scripts/router-extract.mjs';
import { APP_ROUTE_PREFIXES } from '../routes';
import { PUBLIC_PAGES } from '../public/pages';

type Req = { uri: string; querystring: Record<string, { value: string; multiValue?: { value: string }[] }> };
type Res = { statusCode: number; headers: { location: { value: string } } };

const code = extractRouter(template);
const handler = loadHandler(code) as (e: { request: Req }) => Req | Res;
const run = (uri: string, querystring: Req['querystring'] = {}) => handler({ request: { uri, querystring } });
const routedTo = (uri: string) => (run(uri) as Req).uri;
const redirectOf = (uri: string, qs?: Req['querystring']) => {
  const r = run(uri, qs) as Res;
  return r.statusCode === 301 ? r.headers.location.value : `not a redirect (${(r as unknown as Req).uri})`;
};

const publicPaths = PUBLIC_PAGES.filter((p) => !p.static && p.path !== '/').map((p) => p.path);
const listIn = (name: string) => {
  const m = code.match(new RegExp(`var ${name} = \\[([\\s\\S]*?)\\];`));
  return [...(m?.[1] ?? '').matchAll(/'([^']+)'/g)].map((x) => x[1]);
};

describe('lists stay in step with the app', () => {
  test('APP_ROUTES equals src/routes.ts', () => {
    expect(listIn('APP_ROUTES').sort()).toEqual([...APP_ROUTE_PREFIXES].sort());
  });
  test('PUBLIC_PAGES equals the page registry (pre-rendered pages other than /)', () => {
    expect(listIn('PUBLIC_PAGES').sort()).toEqual([...publicPaths].sort());
  });
});

describe('routing', () => {
  test('/ -> /index.html', () => expect(routedTo('/')).toBe('/index.html'));

  test.each(publicPaths)('%s -> its pre-rendered file', (p) => {
    expect(routedTo(p)).toBe(`${p}/index.html`);
  });

  test.each(APP_ROUTE_PREFIXES.flatMap((p) => [p, `${p}/sample-id-abc`]))(
    '%s -> /app.html',
    (p) => expect(routedTo(p)).toBe('/app.html')
  );

  test.each([
    '/guitar/g1/provenance/r1',
    '/guitar/g1/sales/r1',
    '/edit/g1',
    '/s/sample-share-id',
  ])('nested app route %s -> /app.html', (p) => expect(routedTo(p)).toBe('/app.html'));

  test.each(['/address', '/sales', '/loginx', '/guitars', '/features', '/features/nope', '/nope', '/FAQ'])(
    'unknown %s falls through to S3 (-> 404 page)',
    (p) => expect(routedTo(p)).toBe(p)
  );

  test.each([
    '/assets/index-abc123.js',
    '/assets/index-abc123.css',
    '/privacy.html',
    '/terms.html',
    '/robots.txt',
    '/sitemap.xml',
    '/theme-init.js',
    '/og/guitarhelp-1200x630.png',
    '/guitar-icon.svg',
    '/404.html',
    '/app.html',
  ])('file %s is served as-is', (p) => expect(routedTo(p)).toBe(p));

  test('legal page with the version query is served as-is', () => {
    expect((run('/privacy.html', { v: { value: '2026111402' } }) as Req).uri).toBe('/privacy.html');
  });
});

describe('redirects', () => {
  test('/index.html -> /', () => expect(redirectOf('/index.html')).toBe('/'));
  test.each(publicPaths)('%s/index.html -> clean URL', (p) => expect(redirectOf(`${p}/index.html`)).toBe(p));
  test.each(publicPaths)('%s/ -> no trailing slash', (p) => expect(redirectOf(`${p}/`)).toBe(p));
  test('query string is kept, including repeated and empty values', () => {
    expect(
      redirectOf('/faq/', {
        utm_source: { value: 'a' },
        tag: { value: 'x', multiValue: [{ value: 'x' }, { value: 'y' }] },
        flag: { value: '' },
      })
    ).toBe('/faq?utm_source=a&tag=x&tag=y&flag');
  });
  test('no redirect loop: / is rewritten, not redirected', () => {
    expect((run('/') as Res).statusCode).toBeUndefined();
  });
  test('other index.html paths are not redirected', () => {
    expect(routedTo('/features/nope/index.html')).toBe('/features/nope/index.html');
  });
});

test('extractRouter ignores YAML indentation (template and live code compare equal)', () => {
  const live = `${code}\n`;
  const indented = code.split('\n').map((l) => (l ? `        ${l}` : l)).join('\n');
  expect(extractRouter(`prefix\n${indented}\n  suffix`)).toBe(extractRouter(live));
});
