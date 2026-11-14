// Shared by src/infra/router.test.ts and scripts/check-router-live.mjs.
const BEGIN = '// ROUTER-BEGIN';
const END = '// ROUTER-END';

/**
 * Return the code between the ROUTER-BEGIN/END marker lines, with the common
 * indentation of non-blank lines removed (the template holds it in an indented
 * YAML block) and trailing whitespace trimmed, so template and live code compare equal.
 */
export function extractRouter(text) {
  const start = text.indexOf(BEGIN);
  const end = text.indexOf(END);
  if (start === -1 || end === -1 || end < start) throw new Error('ROUTER-BEGIN/END markers not found');
  const lineStart = text.lastIndexOf('\n', start) + 1;
  const block = text.slice(lineStart, end + END.length).split('\n');
  const indents = block.filter((l) => l.trim() !== '').map((l) => l.match(/^\s*/)[0].length);
  const common = Math.min(...indents);
  return block.map((l) => l.slice(common).replace(/\s+$/, '')).join('\n').trim();
}

/** Evaluate the router code and return its handler (for tests and the local server). */
export function loadHandler(code) {
  return new Function(`${code}\nreturn handler;`)();
}
