import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteProblemDialog } from '../../src/components/problems/DeleteProblemDialog';
import { createMockProblem } from '../fixtures/problem.fixture';

describe('DeleteProblemDialog component', () => {
  const mockProblem = createMockProblem({
    id: 'prob-99',
    sNo: 42,
    title: 'Trapping Rain Water',
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <DeleteProblemDialog
        isOpen={false}
        problem={mockProblem}
        onClose={() => {}}
        onConfirmDelete={async () => {}}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when problem is null', () => {
    const { container } = render(
      <DeleteProblemDialog
        isOpen={true}
        problem={null}
        onClose={() => {}}
        onConfirmDelete={async () => {}}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders dialog with problem S.No, title, and S.No preservation notice', () => {
    render(
      <DeleteProblemDialog
        isOpen={true}
        problem={mockProblem}
        onClose={() => {}}
        onConfirmDelete={async () => {}}
      />
    );

    expect(screen.getByText('Delete Problem #42?')).toBeInTheDocument();
    expect(screen.getByText(/Trapping Rain Water/i)).toBeInTheDocument();
    expect(screen.getByText(/S.No Preservation:/i)).toBeInTheDocument();
    expect(screen.getByText(/Remaining problems will not be renumbered/i)).toBeInTheDocument();
  });

  it('renders as a modal dialog with a warning description and closes on Escape', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    render(
      <DeleteProblemDialog
        isOpen={true}
        problem={mockProblem}
        onClose={handleClose}
        onConfirmDelete={async () => {}}
      />
    );

    const dialog = screen.getByRole('dialog', { name: 'Delete Problem #42?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription(/irreversible/i);
    expect(dialog).toHaveAccessibleDescription(/Trapping Rain Water/i);

    await user.keyboard('{Escape}');
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Cancel button is clicked without calling onConfirmDelete', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    const handleConfirm = vi.fn();

    render(
      <DeleteProblemDialog
        isOpen={true}
        problem={mockProblem}
        onClose={handleClose}
        onConfirmDelete={handleConfirm}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
    expect(handleConfirm).not.toHaveBeenCalled();
  });

  it('calls onConfirmDelete with problem ID and then onClose when confirmed', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    const handleConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <DeleteProblemDialog
        isOpen={true}
        problem={mockProblem}
        onClose={handleClose}
        onConfirmDelete={handleConfirm}
      />
    );

    const deleteBtn = screen.getByRole('button', { name: /delete permanently/i });
    await user.click(deleteBtn);

    expect(handleConfirm).toHaveBeenCalledTimes(1);
    expect(handleConfirm).toHaveBeenCalledWith('prob-99');
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('shows loading state and disables buttons while delete operation is in-flight', async () => {
    const user = userEvent.setup();
    let resolveDelete!: () => void;
    const pendingPromise = new Promise<void>((resolve) => {
      resolveDelete = resolve;
    });
    const handleConfirm = vi.fn().mockReturnValue(pendingPromise);

    render(
      <DeleteProblemDialog
        isOpen={true}
        problem={mockProblem}
        onClose={() => {}}
        onConfirmDelete={handleConfirm}
      />
    );

    const deleteBtn = screen.getByRole('button', { name: /delete permanently/i });
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });

    await user.click(deleteBtn);

    expect(screen.getByRole('button', { name: /deleting/i })).toBeInTheDocument();
    expect(deleteBtn).toBeDisabled();
    expect(cancelBtn).toBeDisabled();

    // Finish deletion
    resolveDelete();
  });
});
