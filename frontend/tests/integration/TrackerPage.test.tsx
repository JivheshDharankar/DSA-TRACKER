import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TrackerPage } from '../../src/components/problems/TrackerPage';
import { CollegeDsaPage } from '../../src/pages/CollegeDsaPage';
import { PersonalDsaPage } from '../../src/pages/PersonalDsaPage';
import * as problemsApi from '../../src/api/problems.api';
import * as patternsApi from '../../src/api/patterns.api';
import { createMockProblem, createMockPaginatedProblems } from '../fixtures/problem.fixture';

vi.mock('../../src/api/problems.api', () => ({
  fetchProblems: vi.fn(),
  createProblem: vi.fn(),
  updateProblem: vi.fn(),
  deleteProblem: vi.fn(),
}));

vi.mock('../../src/api/patterns.api', () => ({
  fetchPatterns: vi.fn(),
  fetchProblemPatterns: vi.fn(),
  syncProblemPatterns: vi.fn(),
}));

describe('Shared Tracker Architecture (TrackerPage, CollegeDsaPage, PersonalDsaPage)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(patternsApi.fetchPatterns).mockResolvedValue([]);
    vi.mocked(patternsApi.fetchProblemPatterns).mockResolvedValue([]);
  });

  it('renders loading skeleton while fetching problems', () => {
    // Return pending promise
    vi.mocked(problemsApi.fetchProblems).mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter>
        <TrackerPage
          section="COLLEGE"
          title="College DSA Tracker"
          subtitle="Lecture problems"
          loadingMessage="Loading College problems..."
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Loading College problems...')).toBeInTheDocument();
    expect(screen.getByText('College DSA Tracker')).toBeInTheDocument();
  });

  it('renders error banner when problem fetching fails', async () => {
    vi.mocked(problemsApi.fetchProblems).mockRejectedValue({
      message: 'Server error retrieving problems',
      code: 'SERVER_ERROR',
    });

    render(
      <MemoryRouter>
        <TrackerPage
          section="COLLEGE"
          title="College DSA Tracker"
          subtitle="Lecture problems"
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Server error retrieving problems');
    });
  });

  it('renders empty state when zero problems exist in section', async () => {
    vi.mocked(problemsApi.fetchProblems).mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
    });

    render(
      <MemoryRouter>
        <TrackerPage
          section="COLLEGE"
          title="College DSA Tracker"
          subtitle="Lecture problems"
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No College DSA problems yet')).toBeInTheDocument();
    });
  });

  it('renders problems in table view by default and switches to cards view and back', async () => {
    const user = userEvent.setup();
    const mockProblem1 = createMockProblem({
      id: 'p-1',
      sNo: 1,
      title: 'Two Sum',
      section: 'COLLEGE',
      difficulty: 'Easy',
    });
    const mockProblem2 = createMockProblem({
      id: 'p-2',
      sNo: 2,
      title: '3Sum',
      section: 'COLLEGE',
      difficulty: 'Medium',
    });

    vi.mocked(problemsApi.fetchProblems).mockResolvedValue({
      items: [mockProblem1, mockProblem2],
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    });

    render(
      <MemoryRouter>
        <TrackerPage
          section="COLLEGE"
          title="College DSA Tracker"
          subtitle="Lecture problems"
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Two Sum')).toBeInTheDocument();
      expect(screen.getByText('3Sum')).toBeInTheDocument();
    });

    // Verify table structure exists
    expect(screen.getByRole('table')).toBeInTheDocument();

    // Switch to cards view
    const cardViewBtn = screen.getByTitle('Card view');
    await user.click(cardViewBtn);

    // Table should no longer exist; problems still visible in cards
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('Two Sum')).toBeInTheDocument();
    expect(screen.getByText('3Sum')).toBeInTheDocument();

    // Switch back to table view
    const tableViewBtn = screen.getByTitle('Table view');
    await user.click(tableViewBtn);
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('parameterizes CollegeDsaPage thin wrapper correctly', async () => {
    vi.mocked(problemsApi.fetchProblems).mockResolvedValue(createMockPaginatedProblems(1, { section: 'COLLEGE' }));

    render(
      <MemoryRouter>
        <CollegeDsaPage />
      </MemoryRouter>
    );

    expect(screen.getByText('College DSA Tracker')).toBeInTheDocument();
    expect(screen.getByText(/isolated S.No sequencing/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(problemsApi.fetchProblems).toHaveBeenCalledWith(
        expect.objectContaining({
          section: 'COLLEGE',
        })
      );
    });
  });

  it('parameterizes PersonalDsaPage thin wrapper correctly with LeetCode support', async () => {
    vi.mocked(problemsApi.fetchProblems).mockResolvedValue(createMockPaginatedProblems(1, { section: 'PERSONAL' }));

    render(
      <MemoryRouter>
        <PersonalDsaPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Personal DSA Tracker')).toBeInTheDocument();
    expect(screen.getByText(/LeetCode number support/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(problemsApi.fetchProblems).toHaveBeenCalledWith(
        expect.objectContaining({
          section: 'PERSONAL',
        })
      );
    });
  });

  it('opens DeleteProblemDialog when user clicks delete in problem row', async () => {
    const user = userEvent.setup();
    const mockProblem = createMockProblem({
      id: 'p-del',
      sNo: 99,
      title: 'Problem to Delete',
      section: 'COLLEGE',
    });

    vi.mocked(problemsApi.fetchProblems).mockResolvedValue({
      items: [mockProblem],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    render(
      <MemoryRouter>
        <TrackerPage
          section="COLLEGE"
          title="College DSA Tracker"
          subtitle="Lecture problems"
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Problem to Delete')).toBeInTheDocument();
    });

    const deleteBtn = screen.getByTitle(/delete problem/i);
    await user.click(deleteBtn);

    expect(screen.getByText('Delete Problem #99?')).toBeInTheDocument();
  });
});
