// SPIKE: render public routes into the built index.html template.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dist = 'dist';
const template = readFileSync(join(dist, 'index.html'), 'utf8'); // read before overwriting
const { render } = await import(pathToFileURL('dist-ssr/entry-server.js').href);

const pages = [
  { route: '/', file: 'index.html' },
  { route: '*', path: '/__not_found__', file: '404.html' },
];
for (const p of pages) {
  const html = render(p.path || p.route);
  const out = template.replace('<div id="root"></div>', `<div id="root" data-route="${p.route}">${html}</div>`);
  if (out === template) throw new Error('root placeholder not found');
  mkdirSync(dirname(join(dist, p.file)), { recursive: true });
  writeFileSync(join(dist, p.file), out);
  console.log('prerendered', p.route, '->', p.file, `${html.length} chars`);
}
writeFileSync(join(dist, 'app.html'), template.replace('<head>', '<head>\n    <meta name="robots" content="noindex">'));
rmSync('dist-ssr', { recursive: true, force: true });
