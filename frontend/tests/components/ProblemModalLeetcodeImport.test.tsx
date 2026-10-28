import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ProblemModal } from '../../src/components/problems/ProblemModal';
import * as problemsApi from '../../src/api/problems.api';
import { createMockProblem } from '../fixtures/problem.fixture';
import type { LeetcodeImportPreview } from '../../src/types';

/**
 * Phase 2A — LeetCode import inside the existing Add Problem dialog.
 * The import endpoint is mocked; no network, no live LeetCode.
 */

vi.mock('../../src/api/problems.api', () => ({
  importLeetcodeProblem: vi.fn(),
  createProblem: vi.fn(),
  updateProblem: vi.fn(),
  deleteProblem: vi.fn(),
  fetchProblems: vi.fn(),
  fetchProblemById: vi.fn(),
}));

vi.mock('../../src/api/patterns.api', () => ({
  fetchPatterns: vi.fn().mockResolvedValue([]),
  fetchProblemPatterns: vi.fn().mockResolvedValue([]),
  syncProblemPatterns: vi.fn().mockResolvedValue([]),
}));

const preview = (overrides: Partial<LeetcodeImportPreview> = {}): LeetcodeImportPreview => ({
  source: 'LeetCode',
  slug: 'two-sum',
  url: 'https://leetcode.com/problems/two-sum/',
  suggestedTitle: 'Two Sum',
  title: 'Two Sum',
  difficulty: 'Easy',
  leetcodeNumber: 1,
  status: 'IMPORTED',
  duplicate: null,
  ...overrides,
});

const renderCreate = (section: 'PERSONAL' | 'COLLEGE' = 'PERSONAL', onSubmitCreate = vi.fn()) =>
  render(
    <MemoryRouter>
      <ProblemModal
        isOpen
        section={section}
        onClose={() => {}}
        onSubmitCreate={onSubmitCreate}
        onSubmitUpdate={async () => {}}
      />
    </MemoryRouter>
  );

const openImport = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: /import from leetcode/i }));
};

const urlField = () => screen.getByLabelText(/LeetCode problem URL/i);

describe('ProblemModal — LeetCode import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(problemsApi.importLeetcodeProblem).mockReset();
  });

  it('offers the import option for a new Personal problem only', () => {
    const { unmount } = renderCreate('PERSONAL');
    expect(screen.getByRole('button', { name: /import from leetcode/i })).toBeInTheDocument();
    unmount();

    renderCreate('COLLEGE');
    expect(screen.queryByRole('button', { name: /import from leetcode/i })).not.toBeInTheDocument();
  });

  it('does not offer import while editing an existing problem', () => {
    render(
      <MemoryRouter>
        <ProblemModal
          isOpen
          section="PERSONAL"
          problemToEdit={createMockProblem({ title: 'Two Sum' })}
          onClose={() => {}}
          onSubmitCreate={async () => {}}
          onSubmitUpdate={async () => {}}
        />
      </MemoryRouter>
    );

    expect(screen.queryByRole('button', { name: /import from leetcode/i })).not.toBeInTheDocument();
  });

  it('validates the URL locally and never calls the API for a non-LeetCode link', async () => {
    const user = userEvent.setup();
    renderCreate();
    await openImport(user);

    await user.type(urlField(), 'https://example.com/problems/two-sum/');
    await user.click(screen.getByRole('button', { name: /fetch details/i }));

    expect(
      screen.getByText(/Enter a valid LeetCode problem URL, for example/i)
    ).toBeInTheDocument();
    expect(problemsApi.importLeetcodeProblem).not.toHaveBeenCalled();
  });

  it('shows a loading state and then the imported preview', async () => {
    const user = userEvent.setup();
    let resolveImport: (value: LeetcodeImportPreview) => void = () => {};
    vi.mocked(problemsApi.importLeetcodeProblem).mockReturnValue(
      new Promise<LeetcodeImportPreview>((resolve) => {
        resolveImport = resolve;
      })
    );

    renderCreate();
    await openImport(user);
    await user.type(urlField(), 'https://leetcode.com/problems/two-sum/');
    await user.click(screen.getByRole('button', { name: /fetch details/i }));

    const loadingButton = screen.getByRole('button', { name: /fetching/i });
    expect(loadingButton).toHaveAttribute('aria-busy', 'true');
    expect(problemsApi.importLeetcodeProblem).toHaveBeenCalledWith(
      'https://leetcode.com/problems/two-sum/'
    );

    resolveImport(preview());

    const section = await screen.findByRole('region', { name: /imported problem preview/i });
    expect(section).toHaveTextContent('Two Sum');
    expect(section).toHaveTextContent('Easy');
    expect(section).toHaveTextContent('https://leetcode.com/problems/two-sum/');
    expect(screen.getByText('Imported')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /fetching/i })).not.toBeInTheDocument();
  });

  it('applies imported values to the form, which the user can edit before saving', async () => {
    const user = userEvent.setup();
    const handleSubmitCreate = vi.fn().mockResolvedValue(createMockProblem({ id: 'created-1' }));
    vi.mocked(problemsApi.importLeetcodeProblem).mockResolvedValue(preview());

    renderCreate('PERSONAL', handleSubmitCreate);
    await openImport(user);
    await user.type(urlField(), 'https://leetcode.com/problems/two-sum/');
    await user.click(screen.getByRole('button', { name: /fetch details/i }));
    await user.click(await screen.findByRole('button', { name: /use these details/i }));

    // Back on the normal form, prefilled from the preview.
    expect(screen.getByDisplayValue('Two Sum')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Difficulty/i)).toHaveValue('Easy');
    expect(screen.getByLabelText(/^Source/i)).toHaveValue('LeetCode');
    expect(
      screen.getByText(/Imported from LeetCode\. Review the details, add a topic, and save\./i)
    ).toBeInTheDocument();

    // The user remains the final authority: edit the title, add the required topic, save.
    const titleInput = screen.getByDisplayValue('Two Sum');
    await user.clear(titleInput);
    await user.type(titleInput, 'Two Sum (reviewed)');
    await user.type(screen.getByPlaceholderText(/e\.g\. Arrays, Strings, Trees, DP/i), 'Arrays');
    await user.click(screen.getByRole('button', { name: /save problem/i }));

    expect(handleSubmitCreate).toHaveBeenCalledTimes(1);
    expect(handleSubmitCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Two Sum (reviewed)',
        difficulty: 'Easy',
        source: 'LeetCode',
        leetcodeLink: 'https://leetcode.com/problems/two-sum/',
        leetcodeNumber: 1,
        topic: 'Arrays',
        section: 'PERSONAL',
      })
    );
  });

  it('offers manual entry when metadata is unavailable, pre-filling only the suggested title and link', async () => {
    const user = userEvent.setup();
    vi.mocked(problemsApi.importLeetcodeProblem).mockResolvedValue(
      preview({
        status: 'UNAVAILABLE',
        title: null,
        difficulty: null,
        leetcodeNumber: null,
        message: "Couldn't import this problem automatically. You can enter the problem details manually.",
      })
    );

    renderCreate();
    await openImport(user);
    await user.type(urlField(), 'https://leetcode.com/problems/two-sum/');
    await user.click(screen.getByRole('button', { name: /fetch details/i }));

    expect(
      await screen.findByText(/You can enter the problem details manually\./i)
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /enter details manually/i }));

    expect(screen.getByDisplayValue('Two Sum')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://leetcode.com/problems/two-sum/')).toBeInTheDocument();
    expect(
      screen.getByText(/the title and link were filled in from the URL/i)
    ).toBeInTheDocument();

    // Topic is still required — the fallback does not invent data.
    const form = screen.getByRole('button', { name: /save problem/i }).closest('form')!;
    fireEvent.submit(form);
    expect(screen.getByText(/Topic is required/i)).toBeInTheDocument();
  });

  it('surfaces a request failure with a retry and a manual path', async () => {
    const user = userEvent.setup();
    vi.mocked(problemsApi.importLeetcodeProblem).mockRejectedValue({
      message: 'Network communication error',
      code: 'NETWORK_ERROR',
    });

    renderCreate();
    await openImport(user);
    await user.type(urlField(), 'https://leetcode.com/problems/two-sum/');
    await user.click(screen.getByRole('button', { name: /fetch details/i }));

    expect(await screen.findByText('Network communication error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /enter details manually/i }));
    expect(
      screen.getByText(/You can enter the problem details manually\./i)
    ).toBeInTheDocument();
  });

  it('warns when the problem already exists instead of silently duplicating it', async () => {
    const user = userEvent.setup();
    vi.mocked(problemsApi.importLeetcodeProblem).mockResolvedValue(
      preview({
        duplicate: { id: 'existing-1', sNo: 4, title: 'Two Sum', section: 'PERSONAL' },
      })
    );

    renderCreate();
    await openImport(user);
    await user.type(urlField(), 'https://leetcode.com/problems/two-sum/');
    await user.click(screen.getByRole('button', { name: /fetch details/i }));

    expect(await screen.findByText(/already in your tracker/i)).toBeInTheDocument();
    expect(screen.getByText(/#4 Two Sum/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open the existing problem/i })).toHaveAttribute(
      'href',
      '/problems/existing-1'
    );
  });

  it('leaves the ordinary manual Add Problem flow untouched', async () => {
    const user = userEvent.setup();
    const handleSubmitCreate = vi.fn().mockResolvedValue(createMockProblem({ id: 'manual-1' }));

    renderCreate('PERSONAL', handleSubmitCreate);

    expect(screen.queryByLabelText(/LeetCode problem URL/i)).not.toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/e\.g\. Longest Substring/i), 'Merge Sort');
    await user.type(screen.getByPlaceholderText(/e\.g\. Arrays, Strings, Trees, DP/i), 'Sorting');
    await user.click(screen.getByRole('button', { name: /save problem/i }));

    expect(handleSubmitCreate).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Merge Sort', topic: 'Sorting', section: 'PERSONAL' })
    );
    expect(problemsApi.importLeetcodeProblem).not.toHaveBeenCalled();
  });
});
