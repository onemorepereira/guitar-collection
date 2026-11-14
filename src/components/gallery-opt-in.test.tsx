/**
 * Public gallery opt-in UI (GTR-13): form checkbox through the real
 * edit-mode load path, detail-page badge, and landing empty state.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Guitar } from '../types/guitar';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-a', email: 'a@example.com', name: 'A' }, isAuthenticated: false }),
}));

vi.mock('../services/guitarService', () => ({
  guitarService: {
    getGuitar: vi.fn(),
    updateGuitar: vi.fn().mockResolvedValue({}),
    createGuitar: vi.fn().mockResolvedValue({ id: 'new-id' }),
    getRandomPublicGuitar: vi.fn(),
    uploadImage: vi.fn(),
  },
}));

vi.mock('../services/documentService', () => ({
  documentService: { list: vi.fn().mockResolvedValue([]) },
}));

vi.mock('../services/provenanceService', () => ({
  provenanceService: { listReports: vi.fn().mockResolvedValue([]) },
}));

import { guitarService } from '../services/guitarService';
import { GuitarForm } from './GuitarForm';
import { GuitarDetail } from './GuitarDetail';
import { Landing } from './Landing';

const baseGuitar: Guitar = {
  id: 'g1',
  userId: 'user-a',
  brand: 'Fender',
  model: 'Stratocaster',
  year: 1965,
  images: [],
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
} as unknown as Guitar;

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/add" element={<GuitarForm />} />
        <Route path="/edit/:id" element={<GuitarForm />} />
        <Route path="/guitar/:id" element={<GuitarDetail />} />
        <Route path="/" element={<Landing />} />
      </Routes>
    </MemoryRouter>
  );
}

function galleryCheckbox() {
  return screen.getByRole('checkbox', { name: /show in the public gallery/i }) as HTMLInputElement;
}

async function save() {
  fireEvent.submit(galleryCheckbox().closest('form')!);
}

beforeEach(() => {
  vi.mocked(guitarService.getGuitar).mockReset();
  vi.mocked(guitarService.updateGuitar).mockClear();
  vi.mocked(guitarService.createGuitar).mockClear();
});

afterEach(() => cleanup());

describe('GuitarForm gallery opt-in', () => {
  test('edit: loads a guitar with showInGallery=true as checked and keeps it on save', async () => {
    vi.mocked(guitarService.getGuitar).mockResolvedValue({ ...baseGuitar, showInGallery: true });
    renderAt('/edit/g1');

    await waitFor(() => expect(galleryCheckbox().checked).toBe(true));
    await save();

    await waitFor(() => expect(guitarService.updateGuitar).toHaveBeenCalled());
    const payload = vi.mocked(guitarService.updateGuitar).mock.calls[0][1];
    expect(payload.showInGallery).toBe(true);
  });

  test('edit: a guitar without the flag loads unchecked; checking it sends true', async () => {
    vi.mocked(guitarService.getGuitar).mockResolvedValue({ ...baseGuitar });
    renderAt('/edit/g1');

    await waitFor(() => expect(screen.getByDisplayValue('Stratocaster')).toBeTruthy());
    expect(galleryCheckbox().checked).toBe(false);

    fireEvent.click(galleryCheckbox());
    await save();

    await waitFor(() => expect(guitarService.updateGuitar).toHaveBeenCalled());
    expect(vi.mocked(guitarService.updateGuitar).mock.calls[0][1].showInGallery).toBe(true);
  });

  test('edit: unchecking an opted-in guitar sends false', async () => {
    vi.mocked(guitarService.getGuitar).mockResolvedValue({ ...baseGuitar, showInGallery: true });
    renderAt('/edit/g1');

    await waitFor(() => expect(galleryCheckbox().checked).toBe(true));
    fireEvent.click(galleryCheckbox());
    await save();

    await waitFor(() => expect(guitarService.updateGuitar).toHaveBeenCalled());
    expect(vi.mocked(guitarService.updateGuitar).mock.calls[0][1].showInGallery).toBe(false);
  });

  test('add: starts unchecked', () => {
    renderAt('/add');
    expect(galleryCheckbox().checked).toBe(false);
  });
});

describe('GuitarDetail gallery badge', () => {
  test('shows "In public gallery" when the flag is true', async () => {
    vi.mocked(guitarService.getGuitar).mockResolvedValue({ ...baseGuitar, showInGallery: true });
    renderAt('/guitar/g1');
    expect(await screen.findByText('In public gallery')).toBeTruthy();
  });

  test.each([false, undefined])('shows no badge when the flag is %s', async (flag) => {
    vi.mocked(guitarService.getGuitar).mockResolvedValue({ ...baseGuitar, showInGallery: flag });
    renderAt('/guitar/g1');
    await screen.findByRole('heading', { name: /Fender Stratocaster/ });
    expect(screen.queryByText('In public gallery')).toBeNull();
  });
});

describe('Landing empty state', () => {
  test('when no guitar is opted in, shows the private-by-default copy and a sign-up link', async () => {
    vi.mocked(guitarService.getRandomPublicGuitar).mockResolvedValue(null);
    renderAt('/');

    expect(await screen.findByText('Your collection, organized')).toBeTruthy();
    expect(screen.queryByText(/be the first to add a guitar/i)).toBeNull();
    const cta = screen.getByRole('link', { name: 'Get Started Free' });
    expect(cta.getAttribute('href')).toBe('/register');
  });
});
