/**
 * GTR-12: registration, the account page, and the public visitor pages link to
 * the static legal pages (versioned URLs, new tab); the old modals are gone.
 */
import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: false, register: vi.fn(), user: null }),
}));
vi.mock('../services/guitarService', () => ({
  guitarService: { getRandomPublicGuitar: vi.fn().mockResolvedValue(null) },
}));
vi.mock('../services/shareService', () => ({
  shareService: {
    getPublicShare: vi.fn().mockResolvedValue({
      shareId: 's1',
      createdAt: '2026-11-14T00:00:00.000Z',
      guitar: { brand: 'Fender', model: 'Stratocaster' },
      images: [],
      sharedFields: {},
    }),
  },
}));

import { Register } from './Register';
import { Home as Landing } from '../public/pages/Home';
import { SharedGuitarView } from './SharedGuitarView';
import { PRIVACY_URL, TERMS_URL, LEGAL_VERSION } from './LegalLinks';

afterEach(cleanup);

function expectNewTab(link: HTMLElement, href: string) {
  expect(link.getAttribute('href')).toBe(href);
  expect(link.getAttribute('target')).toBe('_blank');
  expect(link.getAttribute('rel')).toContain('noopener');
}

test('versioned URLs', () => {
  expect(PRIVACY_URL).toBe(`/privacy.html?v=${LEGAL_VERSION}`);
  expect(TERMS_URL).toBe(`/terms.html?v=${LEGAL_VERSION}`);
});

test('Register links the static pages in a new tab', () => {
  render(<MemoryRouter><Register /></MemoryRouter>);
  expectNewTab(screen.getByRole('link', { name: 'Terms of Service' }), TERMS_URL);
  expectNewTab(screen.getByRole('link', { name: 'Privacy Policy' }), PRIVACY_URL);
});

test('the registration modals are gone', () => {
  const modals = Object.keys(import.meta.glob('./*Modal.tsx'));
  expect(modals).not.toContain('./PrivacyModal.tsx');
  expect(modals).not.toContain('./TermsModal.tsx');
});

describe('visitor pages show Privacy · Terms', () => {
  test('landing page', async () => {
    render(<MemoryRouter><Landing /></MemoryRouter>);
    expectNewTab(await screen.findByRole('link', { name: 'Privacy' }), PRIVACY_URL);
    expectNewTab(screen.getByRole('link', { name: 'Terms' }), TERMS_URL);
  });

  test('shared guitar page', async () => {
    render(
      <MemoryRouter initialEntries={['/s/s1']}>
        <Routes><Route path="/s/:shareId" element={<SharedGuitarView />} /></Routes>
      </MemoryRouter>
    );
    expectNewTab(await screen.findByRole('link', { name: 'Privacy' }), PRIVACY_URL);
    expectNewTab(screen.getByRole('link', { name: 'Terms' }), TERMS_URL);
  });
});
