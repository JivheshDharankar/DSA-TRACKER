import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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

/**
 * Phase 6 — Tracker redesign behaviour
 * ===================================
 * Covers the behaviour the redesign introduced or had to protect: the responsive default
 * view, the four data states (in particular that a failure can never look like an empty
 * account), the mobile filter drawer, filter persistence and reset, and the copy, links
 * and accessible names the existing unit/e2e suites rely on.
 *
 * jsdom has no layout, so the breakpoints are driven by stubbing `matchMedia` with real
 * query evaluation — that is what lets the mobile/tablet/desktop branches be exercised.
 */

const matchesQuery = (query: string, width: number): boolean =>
  query.split(/\s+and\s+/).every((part) => {
    const max = /max-width:\s*(\d+)px/.exec(part);
    if (max) return width <= Number(max[1]);
    const min = /min-width:\s*(\d+)px/.exec(part);
    if (min) return width >= Number(min[1]);
    return true;
  });

const setViewportWidth = (width: number): void => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: matchesQuery(query, width),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
};

const renderCollegeTracker = () =>
  render(
    <MemoryRouter>
      <TrackerPage
        section="COLLEGE"
        title="College DSA Tracker"
        subtitle="Track college lecture problems"
        loadingMessage="Loading College problems..."
      />
    </MemoryRouter>
  );

describe('Phase 6 — Tracker responsive defaults', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(patternsApi.fetchPatterns).mockResolvedValue([]);
    vi.mocked(patternsApi.fetchProblemPatterns).mockResolvedValue([]);
    vi.mocked(problemsApi.fetchProblems).mockResolvedValue(
      createMockPaginatedProblems(2, { section: 'COLLEGE' })
    );
  });

  afterEach(() => {
    setViewportWidth(0);
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  });

  it('renders the table by default on desktop widths', async () => {
    setViewportWidth(1440);
    renderCollegeTracker();

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('renders compact cards by default below 768px', async () => {
    setViewportWidth(390);
    renderCollegeTracker();

    await waitFor(() => {
      expect(screen.getAllByRole('article')).toHaveLength(2);
    });
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('still lets the user switch to the table view on a narrow screen', async () => {
    setViewportWidth(390);
    const user = userEvent.setup();
    renderCollegeTracker();

    await waitFor(() => {
      expect(screen.getAllByRole('article')).toHaveLength(2);
    });

    // The explicit choice wins over the viewport default.
    await user.click(screen.getByTitle('Table view'));
    expect(screen.getByRole('table')).toBeInTheDocument();

    await user.click(screen.getByTitle('Card view'));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(2);
  });
});

describe('Phase 6 — Tracker data states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(patternsApi.fetchPatterns).mockResolvedValue([]);
    vi.mocked(patternsApi.fetchProblemPatterns).mockResolvedValue([]);
  });

  afterEach(() => {
    setViewportWidth(0);
  });

  it('keeps the section loading message visible and announces loading while fetching', () => {
    setViewportWidth(1440);
    vi.mocked(problemsApi.fetchProblems).mockReturnValue(new Promise(() => {}));
    renderCollegeTracker();

    expect(screen.getByText('Loading College problems...')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders the genuine empty state with the create action when the account has no rows', async () => {
    setViewportWidth(1440);
    vi.mocked(problemsApi.fetchProblems).mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
    });
    renderCollegeTracker();

    await waitFor(() => {
      expect(screen.getByText('No College DSA problems yet')).toBeInTheDocument();
    });
    expect(screen.getByText(/Add your first lecture or lab problem/i)).toBeInTheDocument();

    // The empty state keeps its own create action (the toolbar has a second one).
    const emptyState = screen.getByText('No College DSA problems yet').parentElement as HTMLElement;
    expect(within(emptyState).getByRole('button', { name: /add problem/i })).toBeInTheDocument();
  });

  it('renders the failure state and never the genuine-empty state', async () => {
    setViewportWidth(1440);
    vi.mocked(problemsApi.fetchProblems).mockRejectedValue({
      message: 'Server error retrieving problems',
      code: 'SERVER_ERROR',
    });
    renderCollegeTracker();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Server error retrieving problems');
    });
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText('No College DSA problems yet')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /clear all filters/i })).not.toBeInTheDocument();
  });

  it('refetches successfully when Retry is pressed and shows the recovered rows', async () => {
    setViewportWidth(1440);
    const user = userEvent.setup();
    vi.mocked(problemsApi.fetchProblems)
      .mockRejectedValueOnce({ message: 'Server error retrieving problems', code: 'SERVER_ERROR' })
      .mockResolvedValueOnce(createMockPaginatedProblems(2, { section: 'COLLEGE' }));
    renderCollegeTracker();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
    expect(problemsApi.fetchProblems).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
    expect(problemsApi.fetchProblems).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders the nothing-matched state and restores the list when filters are cleared', async () => {
    setViewportWidth(1440);
    const user = userEvent.setup();
    vi.mocked(problemsApi.fetchProblems)
      .mockResolvedValueOnce(createMockPaginatedProblems(1, { section: 'COLLEGE' }))
      .mockResolvedValue({
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      });
    renderCollegeTracker();

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Search problems by title or topic...'), 'zzz');

    await waitFor(() => {
      expect(screen.getByText('No matching problems found')).toBeInTheDocument();
    });
    expect(screen.getByText(/Try adjusting your search criteria/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /clear all filters/i }));

    await waitFor(() => {
      expect(problemsApi.fetchProblems).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: undefined, section: 'COLLEGE' })
      );
    });
  });
});

describe('Phase 6 — Tracker toolbar and mobile filter drawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(patternsApi.fetchPatterns).mockResolvedValue([]);
    vi.mocked(patternsApi.fetchProblemPatterns).mockResolvedValue([]);
    vi.mocked(problemsApi.fetchProblems).mockResolvedValue(
      createMockPaginatedProblems(2, { section: 'COLLEGE' })
    );
  });

  afterEach(() => {
    setViewportWidth(0);
  });

  it('keeps every filter as a native select in the desktop toolbar', async () => {
    setViewportWidth(1440);
    renderCollegeTracker();

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue('All Difficulties')).toBeInTheDocument();
    expect(screen.getByDisplayValue('All Statuses')).toBeInTheDocument();
    expect(screen.getByDisplayValue('All Retention Levels')).toBeInTheDocument();
    expect(screen.getByDisplayValue('All Mastery')).toBeInTheDocument();
    expect(screen.getByDisplayValue('All Sources')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Sort: S.No (Ascending)')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Lecture' })).toBeInTheDocument();
  });

  it('moves the filters into a dialog drawer on narrow screens and closes it again', async () => {
    setViewportWidth(390);
    const user = userEvent.setup();
    renderCollegeTracker();

    await waitFor(() => {
      expect(screen.getAllByRole('article')).toHaveLength(2);
    });

    // Closed: no dialog, and the filter controls are not in the document.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('All Difficulties')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^filters$/i }));

    const drawer = screen.getByRole('dialog');
    expect(within(drawer).getByDisplayValue('All Difficulties')).toBeInTheDocument();
    expect(within(drawer).getByDisplayValue('Sort: S.No (Ascending)')).toBeInTheDocument();

    await user.click(within(drawer).getByRole('button', { name: /close dialog/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('applies a filter chosen in the drawer and shows it as still selected when reopened', async () => {
    setViewportWidth(390);
    const user = userEvent.setup();
    renderCollegeTracker();

    await waitFor(() => {
      expect(screen.getAllByRole('article')).toHaveLength(2);
    });

    await user.click(screen.getByRole('button', { name: /^filters$/i }));
    await user.selectOptions(screen.getByDisplayValue('All Difficulties'), 'Hard');

    await waitFor(() => {
      expect(problemsApi.fetchProblems).toHaveBeenLastCalledWith(
        expect.objectContaining({ difficulty: 'Hard', page: 1, section: 'COLLEGE' })
      );
    });

    await user.click(screen.getByRole('button', { name: /close dialog/i }));
    expect(screen.queryByDisplayValue('Hard')).not.toBeInTheDocument();

    // Reopening shows the persisted selection and the active-filter count on the trigger.
    expect(screen.getByRole('button', { name: /filters \(1\)/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /filters \(1\)/i }));
    expect(within(screen.getByRole('dialog')).getByDisplayValue('Hard')).toBeInTheDocument();
  });

  it('resets filters from the drawer', async () => {
    setViewportWidth(390);
    const user = userEvent.setup();
    renderCollegeTracker();

    await waitFor(() => {
      expect(screen.getAllByRole('article')).toHaveLength(2);
    });

    await user.click(screen.getByRole('button', { name: /^filters$/i }));
    await user.selectOptions(screen.getByDisplayValue('All Statuses'), 'Solved');

    await waitFor(() => {
      expect(problemsApi.fetchProblems).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'Solved' })
      );
    });

    await user.click(screen.getByTitle('Reset all filters'));

    await waitFor(() => {
      expect(problemsApi.fetchProblems).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: undefined, section: 'COLLEGE' })
      );
    });
    expect(within(screen.getByRole('dialog')).getByDisplayValue('All Statuses')).toBeInTheDocument();
  });
});

describe('Phase 6 — preserved tracker contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(patternsApi.fetchPatterns).mockResolvedValue([]);
    vi.mocked(patternsApi.fetchProblemPatterns).mockResolvedValue([]);
  });

  afterEach(() => {
    setViewportWidth(0);
  });

  it('keeps the seven-column layout and its accessible names at wide desktop widths', async () => {
    setViewportWidth(1440);
    vi.mocked(problemsApi.fetchProblems).mockResolvedValue(
      // Distinct LeetCode number so the S.No chip `#1` stays unambiguous.
      createMockPaginatedProblems(1, { section: 'COLLEGE', leetcodeNumber: 7 })
    );
    renderCollegeTracker();

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    ['#', 'Problem & Topic', 'Difficulty & Status', 'Spaced Repetition', 'Retention & Mastery', 'Links', 'Actions'].forEach(
      (label) => {
        expect(screen.getByRole('columnheader', { name: label })).toBeInTheDocument();
      }
    );

    expect(screen.getByTitle('View Details')).toBeInTheDocument();
    expect(screen.getByTitle('Edit Problem')).toBeInTheDocument();
    expect(screen.getByTitle('Delete Problem')).toBeInTheDocument();
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText(/Stage 1 \(1d\)/)).toBeInTheDocument();
  });

  it('folds the link chips into the title cell between 768px and 1279px without losing them', async () => {
    setViewportWidth(1024);
    vi.mocked(problemsApi.fetchProblems).mockResolvedValue(
      createMockPaginatedProblems(1, { section: 'COLLEGE' })
    );
    renderCollegeTracker();

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    expect(screen.queryByRole('columnheader', { name: 'Links' })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument();
    expect(screen.getByTitle('Open LeetCode Problem')).toBeInTheDocument();
    expect(screen.getByTitle('Open College Problem Link')).toBeInTheDocument();
  });

  it('shows stage, interval, due status and next review date on the compact cards', async () => {
    setViewportWidth(390);
    vi.mocked(problemsApi.fetchProblems).mockResolvedValue({
      items: [
        createMockProblem({
          id: 'p-card',
          section: 'PERSONAL',
          sNo: 1,
          title: 'Trapping Rain Water',
          leetcodeNumber: 42,
          repetitionStage: 2,
          intervalDays: 3,
          nextReviewDate: '2020-01-01T00:00:00.000Z',
        }),
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    render(
      <MemoryRouter>
        <PersonalDsaPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('article')).toBeInTheDocument();
    });

    const card = screen.getByRole('article');
    expect(within(card).getByText('#1')).toBeInTheDocument();
    expect(within(card).getByText('LC #42')).toBeInTheDocument();
    expect(within(card).getByText(/Stage 2 \(3d\)/)).toBeInTheDocument();
    expect(within(card).getByText(/Overdue by \d+ days/)).toBeInTheDocument();
    expect(within(card).getByText(/Next review \w+ \d+, \d{4}/)).toBeInTheDocument();
    expect(within(card).getByText('Details')).toBeInTheDocument();
    expect(within(card).getByText('Edit')).toBeInTheDocument();
    expect(within(card).getByText('Delete')).toBeInTheDocument();
  });

  it('keeps the section heading text, copy and section lock for both trackers', async () => {
    setViewportWidth(1440);
    vi.mocked(problemsApi.fetchProblems).mockResolvedValue(
      createMockPaginatedProblems(1, { section: 'PERSONAL' })
    );

    render(
      <MemoryRouter>
        <PersonalDsaPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Personal DSA Tracker');
    expect(screen.getByText(/LeetCode number support/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(problemsApi.fetchProblems).toHaveBeenCalledWith(
        expect.objectContaining({ section: 'PERSONAL' })
      );
    });
    expect(problemsApi.fetchProblems).not.toHaveBeenCalledWith(
      expect.objectContaining({ section: 'COLLEGE' })
    );
  });

  it('keeps the pagination summary and the College source list', async () => {
    setViewportWidth(1440);
    vi.mocked(problemsApi.fetchProblems).mockResolvedValue(
      createMockPaginatedProblems(2, { section: 'COLLEGE' })
    );

    render(
      <MemoryRouter>
        <CollegeDsaPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Showing/i)).toBeInTheDocument();
    });
    // A single page still shows the control row, with both arrows disabled.
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('option', { name: 'Lab' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Mentor' })).not.toBeInTheDocument();
  });
});
