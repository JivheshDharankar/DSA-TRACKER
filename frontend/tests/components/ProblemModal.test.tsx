import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProblemModal } from '../../src/components/problems/ProblemModal';
import { createMockProblem } from '../fixtures/problem.fixture';
import { createMockPattern } from '../fixtures/pattern.fixture';
import * as patternsApi from '../../src/api/patterns.api';

vi.mock('../../src/api/patterns.api', () => ({
  fetchPatterns: vi.fn(),
  fetchProblemPatterns: vi.fn(),
  syncProblemPatterns: vi.fn(),
}));

describe('ProblemModal component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(patternsApi.fetchPatterns).mockResolvedValue([
      createMockPattern({ id: 'pat-1', name: 'Two Pointers' }),
      createMockPattern({ id: 'pat-2', name: 'Binary Search' }),
    ]);
    vi.mocked(patternsApi.fetchProblemPatterns).mockResolvedValue([]);
    vi.mocked(patternsApi.syncProblemPatterns).mockResolvedValue([]);
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <ProblemModal
        isOpen={false}
        section="COLLEGE"
        onClose={() => {}}
        onSubmitCreate={async () => {}}
        onSubmitUpdate={async () => {}}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders Add College DSA Problem title and College sources in create mode', async () => {
    render(
      <ProblemModal
        isOpen={true}
        section="COLLEGE"
        onClose={() => {}}
        onSubmitCreate={async () => {}}
        onSubmitUpdate={async () => {}}
      />
    );

    expect(screen.getByText('Add College DSA Problem')).toBeInTheDocument();
    expect(screen.getByText('COLLEGE DSA')).toBeInTheDocument();
    expect(screen.getByText(/Auto-generated on save/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(patternsApi.fetchPatterns).toHaveBeenCalled();
    });
  });

  it('renders Add Personal DSA Problem title and Personal sources in create mode', () => {
    render(
      <ProblemModal
        isOpen={true}
        section="PERSONAL"
        onClose={() => {}}
        onSubmitCreate={async () => {}}
        onSubmitUpdate={async () => {}}
      />
    );

    expect(screen.getByText('Add Personal DSA Problem')).toBeInTheDocument();
    expect(screen.getByText('PERSONAL DSA')).toBeInTheDocument();
  });

  it('validates that title is required', async () => {
    const handleSubmitCreate = vi.fn();

    render(
      <ProblemModal
        isOpen={true}
        section="COLLEGE"
        onClose={() => {}}
        onSubmitCreate={handleSubmitCreate}
        onSubmitUpdate={async () => {}}
      />
    );

    const form = screen.getByRole('button', { name: /save problem/i }).closest('form')!;
    fireEvent.submit(form);

    expect(screen.getByText('Problem title is required.')).toBeInTheDocument();
    expect(handleSubmitCreate).not.toHaveBeenCalled();
  });

  it('validates that topic is required', async () => {
    const user = userEvent.setup();
    const handleSubmitCreate = vi.fn();

    render(
      <ProblemModal
        isOpen={true}
        section="COLLEGE"
        onClose={() => {}}
        onSubmitCreate={handleSubmitCreate}
        onSubmitUpdate={async () => {}}
      />
    );

    const titleInput = screen.getByPlaceholderText(/e\.g\. Longest Substring/i);
    await user.type(titleInput, 'Valid Problem Title');

    const form = screen.getByRole('button', { name: /save problem/i }).closest('form')!;
    fireEvent.submit(form);

    expect(screen.getByText('Topic is required (e.g., Arrays, Dynamic Programming).')).toBeInTheDocument();
    expect(handleSubmitCreate).not.toHaveBeenCalled();
  });

  it('validates invalid college link format', async () => {
    const user = userEvent.setup();
    const handleSubmitCreate = vi.fn();

    render(
      <ProblemModal
        isOpen={true}
        section="COLLEGE"
        onClose={() => {}}
        onSubmitCreate={handleSubmitCreate}
        onSubmitUpdate={async () => {}}
      />
    );

    await user.type(screen.getByPlaceholderText(/e\.g\. Longest Substring/i), 'Valid Title');
    await user.type(screen.getByPlaceholderText(/e\.g\. Arrays, Strings, Trees, DP/i), 'Graphs');

    const collegeLinkInput = screen.getByPlaceholderText(/https:\/\/college\.edu\/dsa\/\.\.\./i);
    await user.type(collegeLinkInput, 'ftp://invalid-scheme.com');

    const form = screen.getByRole('button', { name: /save problem/i }).closest('form')!;
    fireEvent.submit(form);

    expect(screen.getByText(/College link must be a valid URL/i)).toBeInTheDocument();
    expect(handleSubmitCreate).not.toHaveBeenCalled();
  });

  it('submits valid data to onSubmitCreate and closes modal', async () => {
    const user = userEvent.setup();
    const handleSubmitCreate = vi.fn().mockResolvedValue(createMockProblem({ id: 'new-id' }));
    const handleClose = vi.fn();

    render(
      <ProblemModal
        isOpen={true}
        section="COLLEGE"
        onClose={handleClose}
        onSubmitCreate={handleSubmitCreate}
        onSubmitUpdate={async () => {}}
      />
    );

    await user.type(screen.getByPlaceholderText(/e\.g\. Longest Substring/i), 'Merge Sort');
    await user.type(screen.getByPlaceholderText(/e\.g\. Arrays, Strings, Trees, DP/i), 'Sorting');

    await user.click(screen.getByRole('button', { name: /save problem/i }));

    expect(handleSubmitCreate).toHaveBeenCalledTimes(1);
    expect(handleSubmitCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Merge Sort',
        topic: 'Sorting',
        section: 'COLLEGE',
      })
    );
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('prepopulates fields in edit mode and calls onSubmitUpdate on submit', async () => {
    const user = userEvent.setup();
    const handleSubmitUpdate = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    const existingProblem = createMockProblem({
      id: 'edit-123',
      sNo: 15,
      title: 'Original Title',
      topic: 'Dynamic Programming',
      notes: 'Initial notes',
      difficulty: 'Hard',
    });

    render(
      <ProblemModal
        isOpen={true}
        section="COLLEGE"
        problemToEdit={existingProblem}
        onClose={handleClose}
        onSubmitCreate={async () => {}}
        onSubmitUpdate={handleSubmitUpdate}
      />
    );

    expect(screen.getByText('Edit Problem #15')).toBeInTheDocument();

    const titleInput = screen.getByDisplayValue('Original Title');
    await user.clear(titleInput);
    await user.type(titleInput, 'Updated Title');

    await user.click(screen.getByRole('button', { name: /update problem/i }));

    expect(handleSubmitUpdate).toHaveBeenCalledWith(
      'edit-123',
      expect.objectContaining({
        title: 'Updated Title',
        topic: 'Dynamic Programming',
      })
    );
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('displays error banner when onSubmitCreate throws an error', async () => {
    const user = userEvent.setup();
    const handleSubmitCreate = vi.fn().mockRejectedValue(new Error('Server failed to save problem'));

    render(
      <ProblemModal
        isOpen={true}
        section="COLLEGE"
        onClose={() => {}}
        onSubmitCreate={handleSubmitCreate}
        onSubmitUpdate={async () => {}}
      />
    );

    await user.type(screen.getByPlaceholderText(/e\.g\. Longest Substring/i), 'Quick Sort');
    await user.type(screen.getByPlaceholderText(/e\.g\. Arrays, Strings, Trees, DP/i), 'Sorting');

    await user.click(screen.getByRole('button', { name: /save problem/i }));

    await waitFor(() => {
      expect(screen.getByText('Server failed to save problem')).toBeInTheDocument();
    });
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    render(
      <ProblemModal
        isOpen={true}
        section="COLLEGE"
        onClose={handleClose}
        onSubmitCreate={async () => {}}
        onSubmitUpdate={async () => {}}
      />
    );

    await user.click(screen.getByTitle('Close modal'));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('associates selected pattern on creation using the newly created problem ID returned by onSubmitCreate', async () => {
    const user = userEvent.setup();
    const createdProblem = createMockProblem({ id: 'created-prob-999', title: 'Binary Search Problem' });
    const handleSubmitCreate = vi.fn().mockResolvedValue(createdProblem);
    const handleClose = vi.fn();

    render(
      <ProblemModal
        isOpen={true}
        section="COLLEGE"
        onClose={handleClose}
        onSubmitCreate={handleSubmitCreate}
        onSubmitUpdate={async () => {}}
      />
    );

    // Wait for patterns catalog to load
    await waitFor(() => {
      expect(patternsApi.fetchPatterns).toHaveBeenCalled();
    });

    await user.type(screen.getByPlaceholderText(/e\.g\. Longest Substring/i), 'Binary Search Problem');
    await user.type(screen.getByPlaceholderText(/e\.g\. Arrays, Strings, Trees, DP/i), 'Binary Search');

    // Select "Binary Search" pattern (pat-2)
    const patternSelect = screen.getByLabelText(/Primary Pattern/i);
    await user.selectOptions(patternSelect, 'pat-2');

    // Submit form
    await user.click(screen.getByRole('button', { name: /save problem/i }));

    // 1. onSubmitCreate is called
    expect(handleSubmitCreate).toHaveBeenCalledTimes(1);
    // 2. syncProblemPatterns is called with the exact ID of the newly created problem and selected pattern
    await waitFor(() => {
      expect(patternsApi.syncProblemPatterns).toHaveBeenCalledTimes(1);
      expect(patternsApi.syncProblemPatterns).toHaveBeenCalledWith('created-prob-999', [
        { patternId: 'pat-2', confidence: 'HIGH', isPrimary: true },
      ]);
    });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
