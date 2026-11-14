// Checks the built site against the SEO acceptance criteria (run after `npm run build`).
// Exits non-zero with a list of failures.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const failures = [];
const fail = (msg) => failures.push(msg);
const read = (f) => readFileSync(join(DIST, f), 'utf8');

const pages = [
  { file: 'index.html', path: '/', minWords: 300 },
  { file: 'features/insurance-inventory/index.html', path: '/features/insurance-inventory', minWords: 400, maxWords: 900 },
  { file: 'features/condition-reports/index.html', path: '/features/condition-reports', minWords: 400, maxWords: 900 },
  { file: 'features/selling/index.html', path: '/features/selling', minWords: 400, maxWords: 900 },
  { file: 'features/ai-import/index.html', path: '/features/ai-import', minWords: 400, maxWords: 900 },
  { file: 'faq/index.html', path: '/faq', minWords: 300 },
];

const attr = (html, re) => (html.match(re) || [])[1];
const visibleText = (html) => {
  const root = html.slice(html.indexOf('<div id="root"'));
  return root
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};
const words = (t) => t.split(' ').filter((w) => /[A-Za-z0-9]/.test(w)).length;

const titles = new Set();
for (const p of pages) {
  if (!existsSync(join(DIST, p.file))) { fail(`${p.file} missing`); continue; }
  const html = read(p.file);
  const title = attr(html, /<title>([^<]*)<\/title>/);
  const desc = attr(html, /<meta name="description" content="([^"]*)"/);
  const canonical = attr(html, /<link rel="canonical" href="([^"]*)"/);
  if (!title) fail(`${p.file}: no title`);
  else {
    if (title.length > 60) fail(`${p.file}: title ${title.length} > 60`);
    if (p.path === '/' ? !title.startsWith('GuitarHelp') : !title.endsWith('| GuitarHelp')) fail(`${p.file}: title brand position`);
    if (titles.has(title)) fail(`${p.file}: duplicate title`);
    titles.add(title);
  }
  if (!desc || desc.length < 120 || desc.length > 160) fail(`${p.file}: description length ${desc?.length}`);
  if (canonical !== `https://guitarhelp.click${p.path}`) fail(`${p.file}: canonical ${canonical}`);
  for (const prop of ['og:title', 'og:type', 'og:url', 'og:image', 'og:description', 'og:site_name', 'og:image:alt']) {
    if (!html.includes(`property="${prop}"`)) fail(`${p.file}: missing ${prop}`);
  }
  if (!html.includes('name="twitter:card" content="summary_large_image"')) fail(`${p.file}: twitter card`);
  if (!html.includes('name="twitter:image" content="https://guitarhelp.click/og/guitarhelp-1200x630.png"')) fail(`${p.file}: twitter:image`);
  if (!html.includes('content="https://guitarhelp.click/og/guitarhelp-1200x630.png"')) fail(`${p.file}: absolute og:image`);
  if (html.includes('noindex')) fail(`${p.file}: has noindex`);
  if (!html.includes(`data-route="${p.path}"`)) fail(`${p.file}: data-route`);
  if ((html.match(/<h1[\s>]/g) || []).length !== 1) fail(`${p.file}: expected exactly one <h1>`);
  const n = words(visibleText(html));
  if (n < p.minWords) fail(`${p.file}: ${n} words < ${p.minWords}`);
  if (p.maxWords && n > p.maxWords) fail(`${p.file}: ${n} words > ${p.maxWords}`);
  console.log(`${p.file}: ${n} words, title ${title?.length}, description ${desc?.length}`);
}

// FAQ: 8-12 questions (h2 inside the article, minus the closing CTA heading)
const faqQuestions = (read('faq/index.html').match(/<h2[^>]*>[^<]*\?<\/h2>/g) || []).length;
if (faqQuestions < 8 || faqQuestions > 12) fail(`faq: ${faqQuestions} questions`);

// JSON-LD on the homepage parses and is a free WebApplication
const ld = [...read('index.html').matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) =>
  JSON.parse(m[1])
);
const app = ld.find((b) => b['@type'] === 'WebApplication');
if (!app || app.offers?.price !== '0' || !ld.some((b) => b['@type'] === 'WebSite')) fail('index.html: JSON-LD');
if (ld.some((b) => b.aggregateRating || b.review)) fail('index.html: JSON-LD claims ratings/reviews');

// App shell and 404: noindex, no canonical
for (const f of ['app.html', '404.html']) {
  const html = read(f);
  if (!html.includes('<meta name="robots" content="noindex">')) fail(`${f}: missing noindex`);
  if (html.includes('rel="canonical"')) fail(`${f}: must not have a canonical`);
  if (!html.includes('property="og:image"') || !html.includes('name="twitter:image"')) fail(`${f}: missing share card`);
}
if (!read('app.html').includes('<div id="root"></div>')) fail('app.html: root must be empty');
if (!read('404.html').includes('data-route="*"')) fail('404.html: data-route');

// Brand: no old names in built HTML
for (const f of [...pages.map((p) => p.file), '404.html', 'app.html', 'privacy.html', 'terms.html']) {
  const html = read(f);
  // The old names used as a brand (the homepage title may still say "Free Guitar Collection Manager" as a description)
  if (/>\s*Guitar Collection Manager\s*<| - Guitar Collection<|Back to Guitar Collection|this Guitar Collection app|>\s*Guitar Collection is /.test(html)) {
    fail(`${f}: old brand name`);
  }
}

// Sitemap lists exactly the public pages + legal pages, robots points to it
const sitemap = read('sitemap.xml');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const expected = [...pages.map((p) => `https://guitarhelp.click${p.path}`), 'https://guitarhelp.click/privacy.html', 'https://guitarhelp.click/terms.html'];
if (locs.sort().join() !== expected.sort().join()) fail(`sitemap: ${locs.join(', ')}`);
if (!/^\d{4}-\d{2}-\d{2}$/.test(sitemap.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1] || '')) fail('sitemap: lastmod format');
if (!read('robots.txt').includes('Sitemap: https://guitarhelp.click/sitemap.xml')) fail('robots.txt: sitemap line');
if (/Disallow:\s*\/\S/.test(read('robots.txt'))) fail('robots.txt must not block pages (noindex must stay visible)');

// Share image (AC7): 1200x630 PNG
{
  const f = join(DIST, 'og/guitarhelp-1200x630.png');
  if (!existsSync(f)) fail('og image missing');
  else {
    const b = readFileSync(f);
    if (b.readUInt32BE(16) !== 1200 || b.readUInt32BE(20) !== 630) fail('og image is not 1200x630');
  }
}

// Homepage JS budget (AC13): entry + modulepreloads, gzip, at most half of the old 165 KB
{
  const { gzipSync } = await import('node:zlib');
  const html = read('index.html');
  const refs = [...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]))];
  const kb = refs.reduce((sum, r) => sum + gzipSync(readFileSync(join(DIST, r))).length, 0) / 1024;
  console.log(`homepage JS: ${refs.length} file(s), ${kb.toFixed(1)} KB gzip`);
  if (kb > 82) fail(`homepage JS ${kb.toFixed(1)} KB gzip > 82 KB`);
  const homepageJs = refs.map((r) => readFileSync(join(DIST, r), 'utf8')).join('\n');
  if (/Stratocaster.{0,200}Telecaster.{0,200}Jazzmaster/s.test(homepageJs) && homepageJs.includes('"commonSpecs"')) {
    fail('homepage JS includes the guitar knowledge base');
  }
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('\ndist checks passed');
