import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProblemFilterBar } from '../../src/components/problems/ProblemFilterBar';
import { COLLEGE_SOURCES, PERSONAL_SOURCES } from '../../src/types';

describe('ProblemFilterBar component', () => {
  const defaultFilters = {
    section: 'COLLEGE' as const,
    page: 1,
    limit: 20,
    sortBy: 'sNo' as const,
    sortOrder: 'asc' as const,
  };

  it('renders search input and Add Problem button', () => {
    render(
      <ProblemFilterBar
        section="COLLEGE"
        filters={defaultFilters}
        onFilterChange={() => {}}
        onResetFilters={() => {}}
        onOpenCreateModal={() => {}}
      />
    );

    expect(screen.getByPlaceholderText('Search problems by title or topic...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add problem/i })).toBeInTheDocument();
  });

  it('calls onFilterChange with search term and resets page to 1 when user types in search input', async () => {
    const handleFilterChange = vi.fn();

    render(
      <ProblemFilterBar
        section="COLLEGE"
        filters={defaultFilters}
        onFilterChange={handleFilterChange}
        onResetFilters={() => {}}
        onOpenCreateModal={() => {}}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search problems by title or topic...');
    fireEvent.change(searchInput, { target: { value: 'Binary Search' } });

    expect(handleFilterChange).toHaveBeenCalledWith({
      search: 'Binary Search',
      page: 1,
    });
  });

  it('shows clear search button when search is active and clears search on click', async () => {
    const user = userEvent.setup();
    const handleFilterChange = vi.fn();

    render(
      <ProblemFilterBar
        section="COLLEGE"
        filters={{ ...defaultFilters, search: 'Graph' }}
        onFilterChange={handleFilterChange}
        onResetFilters={() => {}}
        onOpenCreateModal={() => {}}
      />
    );

    const clearBtn = screen.getByTitle('Clear search');
    expect(clearBtn).toBeInTheDocument();

    await user.click(clearBtn);

    expect(handleFilterChange).toHaveBeenCalledWith({ search: '', page: 1 });
  });

  it('renders College sources when section is COLLEGE', () => {
    render(
      <ProblemFilterBar
        section="COLLEGE"
        filters={defaultFilters}
        onFilterChange={() => {}}
        onResetFilters={() => {}}
        onOpenCreateModal={() => {}}
      />
    );

    COLLEGE_SOURCES.forEach((source) => {
      expect(screen.getByRole('option', { name: source })).toBeInTheDocument();
    });
  });

  it('renders Personal sources when section is PERSONAL', () => {
    render(
      <ProblemFilterBar
        section="PERSONAL"
        filters={{ ...defaultFilters, section: 'PERSONAL' }}
        onFilterChange={() => {}}
        onResetFilters={() => {}}
        onOpenCreateModal={() => {}}
      />
    );

    PERSONAL_SOURCES.forEach((source) => {
      expect(screen.getByRole('option', { name: source })).toBeInTheDocument();
    });
  });

  it('calls onFilterChange when difficulty is selected', async () => {
    const user = userEvent.setup();
    const handleFilterChange = vi.fn();

    render(
      <ProblemFilterBar
        section="COLLEGE"
        filters={defaultFilters}
        onFilterChange={handleFilterChange}
        onResetFilters={() => {}}
        onOpenCreateModal={() => {}}
      />
    );

    const difficultySelect = screen.getByDisplayValue('All Difficulties');
    await user.selectOptions(difficultySelect, 'Hard');

    expect(handleFilterChange).toHaveBeenCalledWith({ difficulty: 'Hard', page: 1 });
  });

  it('calls onFilterChange when status is selected', async () => {
    const user = userEvent.setup();
    const handleFilterChange = vi.fn();

    render(
      <ProblemFilterBar
        section="COLLEGE"
        filters={defaultFilters}
        onFilterChange={handleFilterChange}
        onResetFilters={() => {}}
        onOpenCreateModal={() => {}}
      />
    );

    const statusSelect = screen.getByDisplayValue('All Statuses');
    await user.selectOptions(statusSelect, 'Solved');

    expect(handleFilterChange).toHaveBeenCalledWith({ status: 'Solved', page: 1 });
  });

  it('calls onFilterChange when retention level is selected', async () => {
    const user = userEvent.setup();
    const handleFilterChange = vi.fn();

    render(
      <ProblemFilterBar
        section="COLLEGE"
        filters={defaultFilters}
        onFilterChange={handleFilterChange}
        onResetFilters={() => {}}
        onOpenCreateModal={() => {}}
      />
    );

    const retentionSelect = screen.getByDisplayValue('All Retention Levels');
    await user.selectOptions(retentionSelect, 'Strong');

    expect(handleFilterChange).toHaveBeenCalledWith({ retentionLevel: 'Strong', page: 1 });
  });

  it('calls onFilterChange when mastery status is selected', async () => {
    const user = userEvent.setup();
    const handleFilterChange = vi.fn();

    render(
      <ProblemFilterBar
        section="COLLEGE"
        filters={defaultFilters}
        onFilterChange={handleFilterChange}
        onResetFilters={() => {}}
        onOpenCreateModal={() => {}}
      />
    );

    const masterySelect = screen.getByDisplayValue('All Mastery');
    await user.selectOptions(masterySelect, 'LOCKED');

    expect(handleFilterChange).toHaveBeenCalledWith({ masteryStatus: 'LOCKED', page: 1 });
  });

  it('shows Reset Filters button when active filters exist and triggers onResetFilters', async () => {
    const user = userEvent.setup();
    const handleResetFilters = vi.fn();

    const { rerender } = render(
      <ProblemFilterBar
        section="COLLEGE"
        filters={defaultFilters}
        onFilterChange={() => {}}
        onResetFilters={handleResetFilters}
        onOpenCreateModal={() => {}}
      />
    );

    expect(screen.queryByTitle('Reset all filters')).not.toBeInTheDocument();

    rerender(
      <ProblemFilterBar
        section="COLLEGE"
        filters={{ ...defaultFilters, difficulty: 'Medium' }}
        onFilterChange={() => {}}
        onResetFilters={handleResetFilters}
        onOpenCreateModal={() => {}}
      />
    );

    const resetBtn = screen.getByTitle('Reset all filters');
    expect(resetBtn).toBeInTheDocument();

    await user.click(resetBtn);
    expect(handleResetFilters).toHaveBeenCalledTimes(1);
  });

  it('handles special characters in search input without crashing', async () => {
    const user = userEvent.setup();
    const handleFilterChange = vi.fn();

    render(
      <ProblemFilterBar
        section="COLLEGE"
        filters={defaultFilters}
        onFilterChange={handleFilterChange}
        onResetFilters={() => {}}
        onOpenCreateModal={() => {}}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search problems by title or topic...');
    await user.type(searchInput, 'Tree <O(N)> / $#@!');

    expect(handleFilterChange).toHaveBeenCalled();
  });

  it('calls onOpenCreateModal when user clicks Add Problem button', async () => {
    const user = userEvent.setup();
    const handleOpenCreateModal = vi.fn();

    render(
      <ProblemFilterBar
        section="COLLEGE"
        filters={defaultFilters}
        onFilterChange={() => {}}
        onResetFilters={() => {}}
        onOpenCreateModal={handleOpenCreateModal}
      />
    );

    await user.click(screen.getByRole('button', { name: /add problem/i }));
    expect(handleOpenCreateModal).toHaveBeenCalledTimes(1);
  });
});
