/**
 * GTR-12: the published privacy policy and terms stay in line with the
 * engineering docs and don't regress to statements that aren't true.
 * Files are loaded as raw strings by Vite (no Node fs, so tsc needs no Node types).
 */
import { describe, test, expect } from 'vitest';
import privacy from '../../public/privacy.html?raw';
import terms from '../../public/terms.html?raw';
import architecture from '../../docs/ARCHITECTURE.md?raw';
import { LEGAL_VERSION } from '../components/LegalLinks';

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const P = text(privacy);
const T = text(terms);
const lower = (s: string) => s.toLowerCase();

const REMOVED = [
  'Google Fonts',
  'Share your collection with anyone else', "won't share your guitar collection", 'Basic usage data',
  'what features you use', 'privacy-focused analytics', 'fight unnecessary', 'notify you via email or in-app',
  'probably an email or a notice in the app', 'anonymized data for analytics', 'important account stuff',
  'Opt out of emails', 'within a few days', 'unless you explicitly share it', 'unless you explicitly ask for updates',
  'bound by strict agreements', 'Regular backups', 'contact us or use the settings', 'We use minimal cookies',
  'process documents with AI when you ask', "Anything we don't actually need", 'never reduce your privacy rights',
  'appropriate safeguards', 'hashed and salted', 'Only authorized systems', 'password resets and notifications',
  'industry-standard', "We don't track you around the internet", "visitor's country", 'referrer, country',
  'anonymous account identifier',
];

describe('both pages', () => {
  test.each([['privacy', P], ['terms', T]])('%s: dated November 14, 2026', (_n, page) => {
    expect(page).toMatch(/last updated:\s*november 14, 2026/i);
  });

  test.each(REMOVED)('removed statement is gone: %s', (phrase) => {
    expect(lower(P)).not.toContain(lower(phrase));
    expect(lower(T)).not.toContain(lower(phrase));
  });

  test.each([['privacy', privacy], ['terms', terms]])('%s: GitHub contact, no email address', (_n, page) => {
    expect(page).toContain('https://github.com/onemorepereira/guitar-collection/issues');
    expect(page).toContain('https://github.com/onemorepereira/guitar-collection/security/advisories/new');
    expect(page).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  });

  test('cross-links use the versioned URLs', () => {
    // The static pages hard-code the version; it must match LEGAL_VERSION
    expect(privacy).toContain(`href="/terms.html?v=${LEGAL_VERSION}"`);
    expect(terms).toContain(`href="/privacy.html?v=${LEGAL_VERSION}"`);
    const versions = [...(privacy + terms).matchAll(/\.html\?v=(\d+)/g)].map((m) => m[1]);
    expect(versions.length).toBeGreaterThan(0);
    expect(new Set(versions)).toEqual(new Set([LEGAL_VERSION]));
  });
});

describe('privacy policy content', () => {
  test.each([
    'share link', 'gallery', '5 minutes', 'may keep working', 'random account ID', 'location',
    'Textract', 'Bedrock', "haven't opted out", 'abuse detection', '2,000 characters', 'condition',
    '90 days', 'IP address', 'user agent', 'revoke a share', 'excerpts', "don't record email addresses",
    'Account page', 'United States', 'Cognito',
  ])('mentions: %s', (phrase) => {
    expect(lower(P)).toContain(lower(phrase));
  });

  test('retention section matches docs/ARCHITECTURE.md row by row', () => {
    const lines = architecture.split('### Data retention after deletion')[1].split('\n');
    const start = lines.findIndex((l) => l.startsWith('|'));
    const end = lines.findIndex((l, i) => i > start && !l.startsWith('|'));
    const docRows = lines
      .slice(start + 2, end) // skip the header and separator rows
      .map((l) => l.split('|')[2].trim());
    const block = privacy.slice(privacy.indexOf('id="retention"'));
    const tbody = block.slice(block.indexOf('<tbody>'), block.indexOf('</tbody>'));
    const pageRows = tbody.split('<tr>').slice(1).map((r) => text(r));

    expect(docRows).toHaveLength(13);
    expect(pageRows).toHaveLength(docRows.length);
    docRows.forEach((docKept, i) => {
      for (const token of docKept.match(/~?\d+ (?:days?|hours?|minutes)|1 year/g) || []) {
        expect({ row: i + 1, has: pageRows[i].includes(token) }).toEqual({ row: i + 1, has: true });
      }
    });
  });
});

describe('docs/ARCHITECTURE.md corrections', () => {
  test('audit statements no longer claim the email is logged', () => {
    expect(architecture).not.toContain('sign-in events record the email');
    expect(architecture).not.toContain('(sign-ins, password resets,');
    expect(architecture).toContain("don't record email addresses");
  });

  test('AI sentence is per service', () => {
    expect(architecture).toContain('Amazon Textract is covered by the AWS AI services opt-out policy');
    expect(architecture).toMatch(/Bedrock[^.]*abuse detection/);
  });
});
