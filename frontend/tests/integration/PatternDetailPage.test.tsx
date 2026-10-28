import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PatternDetailPage } from '../../src/pages/PatternDetailPage';
import * as patternsApi from '../../src/api/patterns.api';
import { createMockPattern } from '../fixtures/pattern.fixture';
import { AssociatedProblemItem, PatternDetailResponse } from '../../src/types';

vi.mock('../../src/api/patterns.api', () => ({
  fetchPatterns: vi.fn(),
  fetchPatternDetail: vi.fn(),
}));

const problem = (
  overrides: Partial<AssociatedProblemItem['problem']> = {},
  attachment: Partial<Omit<AssociatedProblemItem, 'problem'>> = {}
): AssociatedProblemItem => ({
  problem: {
    id: 'prob-1',
    sNo: 12,
    title: 'Container With Most Water',
    section: 'COLLEGE',
    difficulty: 'Medium',
    status: 'Solved',
    retentionLevel: 'Independent',
    nextReviewDate: '2026-10-01T00:00:00.000Z',
    ...overrides,
  },
  confidence: 'HIGH',
  isPrimary: true,
  ...attachment,
});

const buildDetail = (
  overrides: Partial<PatternDetailResponse> = {}
): PatternDetailResponse => {
  const { mastery, ...pattern } = createMockPattern();
  return {
    pattern,
    mastery,
    associatedProblems: [problem()],
    ...overrides,
  };
};

const renderPage = (initialEntry = '/patterns/pat-1') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/patterns/:id" element={<PatternDetailPage />} />
        <Route path="/patterns" element={<div>Pattern library destination</div>} />
        <Route path="/problems/:id" element={<div>Problem detail destination</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('PatternDetailPage (Pattern Detail redesign)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reserves the layout with a labelled loading state and requests the route param', () => {
    vi.mocked(patternsApi.fetchPatternDetail).mockReturnValue(new Promise(() => {}));

    renderPage('/patterns/two-pointers');

    expect(screen.getByText('Loading pattern')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(patternsApi.fetchPatternDetail).toHaveBeenCalledWith('two-pointers');
    expect(screen.getByRole('link', { name: /pattern library/i })).toHaveAttribute(
      'href',
      '/patterns'
    );
  });

  it('renders the overview, mastery score, breakdown and associated problems', async () => {
    vi.mocked(patternsApi.fetchPatternDetail).mockResolvedValue(buildDetail());

    renderPage();

    expect(await screen.findByRole('heading', { level: 2, name: 'Two Pointers' })).toBeInTheDocument();
    expect(screen.getByText('two-pointers')).toBeInTheDocument();
    expect(
      screen.getByText('Use two pointers moving in coordinated fashion across a sequence.')
    ).toBeInTheDocument();

    // Mastery ring reports the server score.
    expect(
      screen.getByRole('progressbar', { name: 'Two Pointers mastery score' })
    ).toHaveAttribute('aria-valuenow', '75');

    // All five breakdown factors are shown with the API values.
    for (const factor of [
      'Coverage',
      'Independent Recall',
      'Recall Quality',
      'Recent Consistency',
      'Transfer Evidence',
    ]) {
      expect(screen.getByText(factor)).toBeInTheDocument();
    }
    expect(
      screen.getByRole('progressbar', { name: 'Independent Recall score' })
    ).toHaveAttribute('aria-valuenow', '80');

    // Pattern knowledge sections.
    expect(screen.getByText('Sorted array or linked list')).toBeInTheDocument();
    expect(screen.getByText('Searching pairs')).toBeInTheDocument();
    expect(screen.getByText('Off-by-one errors on convergence')).toBeInTheDocument();
    expect(screen.getByText('Arrays')).toBeInTheDocument();

    // Associated problems link to their detail route and keep the attachment metadata.
    const problemLink = screen.getByRole('link', { name: /Container With Most Water/ });
    expect(problemLink).toHaveAttribute('href', '/problems/prob-1');
    expect(screen.getByText('Primary pattern')).toBeInTheDocument();
    expect(screen.getByText('#12')).toBeInTheDocument();
    expect(screen.getByText('High confidence')).toBeInTheDocument();
    expect(screen.getByText('Oct 1, 2026')).toBeInTheDocument();

    await userEvent.click(problemLink);
    expect(await screen.findByText('Problem detail destination')).toBeInTheDocument();
  });

  it('explains an empty attachment list instead of rendering an empty table', async () => {
    vi.mocked(patternsApi.fetchPatternDetail).mockResolvedValue(
      buildDetail({ associatedProblems: [] })
    );

    renderPage();

    expect(
      await screen.findByText('No problems linked to this pattern yet')
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Container With Most Water/ })).not.toBeInTheDocument();
  });

  it('shows the failure state and recovers through Retry', async () => {
    const user = userEvent.setup();
    vi.mocked(patternsApi.fetchPatternDetail)
      .mockRejectedValueOnce(new Error('Pattern service unavailable'))
      .mockResolvedValueOnce(buildDetail());

    renderPage();

    expect(await screen.findByText('Pattern service unavailable')).toBeInTheDocument();
    expect(screen.getByText("We couldn't load this pattern")).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Two Pointers' })).toBeInTheDocument();
    expect(patternsApi.fetchPatternDetail).toHaveBeenCalledTimes(2);
  });

  it('words a missing pattern as not found and links back to the library', async () => {
    const user = userEvent.setup();
    vi.mocked(patternsApi.fetchPatternDetail).mockRejectedValue(
      new Error('Pattern not found')
    );

    renderPage();

    // The title and the API message both read "Pattern not found".
    expect(
      await screen.findByRole('heading', { name: 'Pattern not found' })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /back to pattern library/i }));
    expect(await screen.findByText('Pattern library destination')).toBeInTheDocument();
  });
});
