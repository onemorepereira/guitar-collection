// Pre-render the public pages into static HTML (SEO Phase 1).
//
// Runs after `vite build` (client, from index.html) and
// `vite build --ssr src/entry-server.tsx --outDir dist-ssr`. Writes:
//   dist/index.html, dist/features/<slug>/index.html, dist/faq/index.html  (public, indexable)
//   dist/404.html  (catch-all route, noindex; CloudFront serves it with status 404)
//   dist/app.html  (SPA shell for app routes, noindex, empty #root)
//   dist/sitemap.xml
// and fails the build if a public page carries noindex or app/404 pages don't.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const DIST = 'dist';
const SSR_DIR = 'dist-ssr';

const template = readFileSync(join(DIST, 'index.html'), 'utf8'); // read before anything overwrites it
const { render, PUBLIC_PAGES, SITE_URL, SITE_NAME, OG_IMAGE, OG_IMAGE_ALT } = await import(
  pathToFileURL(join(SSR_DIR, 'entry-server.js')).href
);

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// JSON inside <script type="application/ld+json">: keep "</script>" from closing the block
const jsonLd = (o) => JSON.stringify(o).replace(/</g, '\\u003c');

function headTags({ title, description, url, noindex = false, jsonLdBlocks = [] }) {
  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}">`,
    noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${esc(url)}">`,
    `<meta property="og:site_name" content="${SITE_NAME}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:image" content="${OG_IMAGE}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${esc(OG_IMAGE_ALT)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:image" content="${OG_IMAGE}">`,
    `<meta name="twitter:image:alt" content="${esc(OG_IMAGE_ALT)}">`,
    `<script src="/theme-init.js"></script>`,
    ...jsonLdBlocks.map((b) => `<script type="application/ld+json">${jsonLd(b)}</script>`),
  ].join('\n    ');
}

function page({ head, route, body = '', noscript = '' }) {
  if (!/<title>[^<]*<\/title>/.test(template)) throw new Error('template has no <title>');
  if (!template.includes('<div id="root"></div>')) throw new Error('template has no empty #root');
  return template
    .replace(/<title>[^<]*<\/title>/, head)
    .replace(
      '<div id="root"></div>',
      `<div id="root"${route ? ` data-route="${esc(route)}"` : ''}>${body}</div>${noscript}`
    );
}

function write(file, html) {
  const out = join(DIST, file);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
}

function lastmod(sources) {
  let latest = '';
  for (const src of sources) {
    try {
      const d = execFileSync('git', ['log', '-1', '--format=%cI', '--', src], { encoding: 'utf8' }).trim();
      if (d > latest) latest = d;
    } catch {
      /* not a git checkout */
    }
  }
  return (latest || new Date().toISOString()).slice(0, 10);
}

// 1. Public pages
for (const p of PUBLIC_PAGES.filter((p) => !p.static)) {
  const url = `${SITE_URL}${p.path}`;
  write(
    p.file,
    page({
      head: headTags({ title: p.title, description: p.description, url, jsonLdBlocks: p.jsonLd || [] }),
      route: p.path,
      body: render(p.path),
    })
  );
  console.log(`prerendered ${p.path} -> ${p.file}`);
}

// 2. 404 page: rendered by the catch-all route
write(
  '404.html',
  page({
    head: headTags({
      title: `Page not found | ${SITE_NAME}`,
      description: 'This page does not exist. Go to the GuitarHelp homepage or read the FAQ.',
      url: `${SITE_URL}/`,
      noindex: true,
    }),
    route: '*',
    body: render('/__guitarhelp_not_found__'),
  })
);

// 3. App shell: generic share card, noindex, no canonical, empty root
write(
  'app.html',
  page({
    head: headTags({
      title: SITE_NAME,
      description: PUBLIC_PAGES[0].description,
      url: `${SITE_URL}/`,
      noindex: true,
    }),
    noscript: '\n    <noscript>GuitarHelp needs JavaScript to run.</noscript>',
  })
);

// 4. Sitemap: every indexable page, static legal pages included
const urls = PUBLIC_PAGES.map(
  (p) => `  <url>\n    <loc>${SITE_URL}${p.path}</loc>\n    <lastmod>${lastmod(p.sources)}</lastmod>\n  </url>`
);
write(
  'sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
);

// 5. Guards
const read = (f) => readFileSync(join(DIST, f), 'utf8');
for (const p of PUBLIC_PAGES.filter((p) => !p.static)) {
  if (read(p.file).includes('noindex')) throw new Error(`${p.file} must be indexable`);
}
for (const f of ['404.html', 'app.html']) {
  if (!read(f).includes('<meta name="robots" content="noindex">')) throw new Error(`${f} must carry noindex`);
}

rmSync(SSR_DIR, { recursive: true, force: true });
console.log('prerender done');
