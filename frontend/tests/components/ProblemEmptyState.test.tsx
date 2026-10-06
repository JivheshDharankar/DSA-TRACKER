import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProblemEmptyState } from '../../src/components/problems/ProblemEmptyState';

describe('ProblemEmptyState component', () => {
  it('renders genuinely empty state for College section with Add Problem button', async () => {
    const user = userEvent.setup();
    const handleCreate = vi.fn();

    render(
      <ProblemEmptyState
        section="COLLEGE"
        hasFilters={false}
        onCreateProblem={handleCreate}
      />
    );

    expect(screen.getByText('No College DSA problems yet')).toBeInTheDocument();
    expect(screen.getByText(/Add your first lecture or lab problem/i)).toBeInTheDocument();

    const addBtn = screen.getByRole('button', { name: /add problem/i });
    await user.click(addBtn);

    expect(handleCreate).toHaveBeenCalledTimes(1);
  });

  it('renders genuinely empty state for Personal section with Add Problem button', () => {
    render(
      <ProblemEmptyState
        section="PERSONAL"
        hasFilters={false}
        onCreateProblem={() => {}}
      />
    );

    expect(screen.getByText('No Personal DSA problems yet')).toBeInTheDocument();
    expect(screen.getByText(/Add your first LeetCode or independent prep problem/i)).toBeInTheDocument();
  });

  it('renders filtered empty state when hasFilters is true with Clear All Filters button', async () => {
    const user = userEvent.setup();
    const handleClearFilters = vi.fn();

    render(
      <ProblemEmptyState
        section="COLLEGE"
        hasFilters={true}
        onClearFilters={handleClearFilters}
        onCreateProblem={() => {}}
      />
    );

    expect(screen.getByText('No matching problems found')).toBeInTheDocument();
    expect(screen.getByText(/Try adjusting your search criteria/i)).toBeInTheDocument();

    const clearBtn = screen.getByRole('button', { name: /clear all filters/i });
    await user.click(clearBtn);

    expect(handleClearFilters).toHaveBeenCalledTimes(1);
  });
});
