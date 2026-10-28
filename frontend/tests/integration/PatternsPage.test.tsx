import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PatternsPage } from '../../src/pages/PatternsPage';
import * as patternsApi from '../../src/api/patterns.api';
import { createMockPattern } from '../fixtures/pattern.fixture';
import { PatternWithMastery } from '../../src/types';

vi.mock('../../src/api/patterns.api', () => ({
  fetchPatterns: vi.fn(),
  fetchPatternDetail: vi.fn(),
}));

const twoPointers = createMockPattern();

const slidingWindow = createMockPattern({
  id: 'pat-2',
  name: 'Sliding Window',
  slug: 'sliding-window',
  description: 'Maintain a moving window over a sequence to avoid recomputation.',
  recognitionSignals: ['Contiguous subarray constraint', 'Longest or shortest window'],
  commonMistakes: ['Forgetting to shrink the window'],
  prerequisites: ['Arrays', 'Hashing'],
  mastery: {
    score: 40,
    masteryLevel: 'Familiar',
    breakdown: {
      coverage: 30,
      independentRecall: 45,
      recallQuality: 50,
      recentConsistency: 35,
      transferEvidence: 20,
    },
    problemCount: 2,
    solvedCount: 1,
  },
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/patterns']}>
      <Routes>
        <Route path="/patterns" element={<PatternsPage />} />
        <Route path="/patterns/:id" element={<div>Pattern detail destination</div>} />
        <Route path="/review" element={<div>Review queue destination</div>} />
      </Routes>
    </MemoryRouter>
  );

const mockCatalog = (patterns: PatternWithMastery[]) =>
  vi.mocked(patternsApi.fetchPatterns).mockResolvedValue(patterns);

describe('PatternsPage (Pattern Library redesign)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reserves the grid with a labelled loading state', () => {
    vi.mocked(patternsApi.fetchPatterns).mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByText('Loading pattern library')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  it('renders each pattern with its mastery, counts, signal and prerequisites', async () => {
    mockCatalog([twoPointers, slidingWindow]);

    renderPage();

    const card = await screen.findByRole('link', { name: /Two Pointers/ });
    expect(card).toHaveAttribute('href', '/patterns/pat-1');

    // The chip splits the level and the score across two spans, so assert on the card.
    expect(card).toHaveTextContent('Independent (75%)');
    expect(screen.getByRole('link', { name: /Sliding Window/ })).toHaveTextContent(
      'Familiar (40%)'
    );

    expect(screen.getByText('4/5 solved')).toBeInTheDocument();
    expect(screen.getByText('5 problems linked')).toBeInTheDocument();
    expect(screen.getByText('1/2 solved')).toBeInTheDocument();

    // Only the first recognition signal is previewed, on both cards.
    expect(screen.getByText('Sorted array or linked list')).toBeInTheDocument();
    expect(screen.queryByText('Searching pairs')).not.toBeInTheDocument();

    // "Arrays" is a prerequisite of both patterns, so it renders twice.
    expect(screen.getAllByText('Arrays')).toHaveLength(2);
    expect(screen.getByText('Hashing')).toBeInTheDocument();

    // The mastery bar is exposed as a labelled progressbar.
    expect(
      screen.getByRole('progressbar', { name: 'Two Pointers mastery score' })
    ).toHaveAttribute('aria-valuenow', '75');

    // Catalog stats describe the whole library.
    expect(screen.getByText('In catalog')).toBeInTheDocument();
    expect(screen.getByText('0 strong · 1 independent')).toBeInTheDocument();
    expect(screen.getByText('1 familiar · 0 learning')).toBeInTheDocument();
    expect(screen.getByText('5 solved')).toBeInTheDocument();
    expect(screen.getByText('2 patterns')).toBeInTheDocument();
  });

  it('searches across names, signals and prerequisites and reports the match count', async () => {
    const user = userEvent.setup();
    mockCatalog([twoPointers, slidingWindow]);

    renderPage();

    await screen.findByText('Two Pointers');
    // The counts are bolded inside the summary line, so match on its text content.
    expect(screen.getByText(/^Showing/)).toHaveTextContent('Showing 2 of 2 patterns');

    const search = screen.getByRole('searchbox', { name: /search patterns/i });

    // Matches a recognition signal of the second pattern only.
    await user.type(search, 'longest');
    expect(await screen.findByText('Sliding Window')).toBeInTheDocument();
    expect(screen.queryByText('Two Pointers')).not.toBeInTheDocument();
    expect(screen.getByText(/^Showing/)).toHaveTextContent('Showing 1 of 2 patterns');

    // Matches a prerequisite of the first pattern only.
    await user.clear(search);
    await user.type(search, 'Two Pointers');
    expect(await screen.findByText('Two Pointers')).toBeInTheDocument();
    expect(screen.queryByText('Sliding Window')).not.toBeInTheDocument();
  });

  it('filters by mastery level while keeping catalog-wide counts on the pills', async () => {
    const user = userEvent.setup();
    mockCatalog([twoPointers, slidingWindow]);

    renderPage();

    await screen.findByText('Two Pointers');

    const allPill = screen.getByRole('button', { name: /all patterns/i });
    expect(allPill).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: /^Independent/ }));

    expect(screen.getByText('Two Pointers')).toBeInTheDocument();
    expect(screen.queryByText('Sliding Window')).not.toBeInTheDocument();

    // Counts are catalog-wide, not filtered.
    expect(screen.getByRole('button', { name: /^All patterns/ })).toHaveTextContent('2');
    expect(screen.getByText(/^Showing/)).toHaveTextContent('Showing 1 of 2 patterns');
  });

  it('explains an empty result and clears the controls in one action', async () => {
    const user = userEvent.setup();
    mockCatalog([twoPointers, slidingWindow]);

    renderPage();

    await screen.findByText('Two Pointers');

    await user.type(screen.getByRole('searchbox', { name: /search patterns/i }), 'segment tree');

    expect(await screen.findByText('No patterns match')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /clear search and filters/i }));

    expect(await screen.findByText('Two Pointers')).toBeInTheDocument();
    expect(screen.getByText('Sliding Window')).toBeInTheDocument();
  });

  it('shows the catalog empty state when the library has no patterns', async () => {
    mockCatalog([]);

    renderPage();

    expect(await screen.findByText('No patterns in the library yet')).toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('shows the failure state and recovers through Retry', async () => {
    const user = userEvent.setup();
    vi.mocked(patternsApi.fetchPatterns)
      .mockRejectedValueOnce(new Error('Pattern service unavailable'))
      .mockResolvedValueOnce([twoPointers]);

    renderPage();

    expect(await screen.findByText('Pattern service unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No patterns in the library yet')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findByText('Two Pointers')).toBeInTheDocument();
  });

  it('links to the Review Queue from the header', async () => {
    const user = userEvent.setup();
    mockCatalog([twoPointers]);

    renderPage();

    await screen.findByText('Two Pointers');
    await user.click(screen.getByRole('button', { name: /review queue/i }));

    expect(await screen.findByText('Review queue destination')).toBeInTheDocument();
  });
});
