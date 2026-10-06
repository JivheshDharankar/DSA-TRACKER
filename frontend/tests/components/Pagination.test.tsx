import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination } from '../../src/components/problems/Pagination';

describe('Pagination component', () => {
  it('returns null when total problems is 0', () => {
    const { container } = render(
      <Pagination
        meta={{ page: 1, limit: 20, total: 0, totalPages: 1 }}
        onPageChange={() => {}}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders record counts correctly', () => {
    render(
      <Pagination
        meta={{ page: 2, limit: 20, total: 45, totalPages: 3 }}
        onPageChange={() => {}}
      />
    );

    expect(screen.getByText(/Showing/i)).toBeInTheDocument();
    expect(screen.getByText('21')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
  });

  it('disables previous button on first page and enables next button', () => {
    render(
      <Pagination
        meta={{ page: 1, limit: 20, total: 45, totalPages: 3 }}
        onPageChange={() => {}}
      />
    );

    const prevBtn = screen.getByTitle('Previous Page');
    const nextBtn = screen.getByTitle('Next Page');

    expect(prevBtn).toBeDisabled();
    expect(nextBtn).not.toBeDisabled();
  });

  it('disables next button on last page and enables previous button', () => {
    render(
      <Pagination
        meta={{ page: 3, limit: 20, total: 45, totalPages: 3 }}
        onPageChange={() => {}}
      />
    );

    const prevBtn = screen.getByTitle('Previous Page');
    const nextBtn = screen.getByTitle('Next Page');

    expect(prevBtn).not.toBeDisabled();
    expect(nextBtn).toBeDisabled();
  });

  it('calls onPageChange with page + 1 when next button is clicked', async () => {
    const user = userEvent.setup();
    const handlePageChange = vi.fn();

    render(
      <Pagination
        meta={{ page: 1, limit: 20, total: 45, totalPages: 3 }}
        onPageChange={handlePageChange}
      />
    );

    await user.click(screen.getByTitle('Next Page'));
    expect(handlePageChange).toHaveBeenCalledWith(2);
  });

  it('calls onPageChange with page - 1 when previous button is clicked', async () => {
    const user = userEvent.setup();
    const handlePageChange = vi.fn();

    render(
      <Pagination
        meta={{ page: 2, limit: 20, total: 45, totalPages: 3 }}
        onPageChange={handlePageChange}
      />
    );

    await user.click(screen.getByTitle('Previous Page'));
    expect(handlePageChange).toHaveBeenCalledWith(1);
  });

  it('calls onPageChange when a specific page number button is clicked', async () => {
    const user = userEvent.setup();
    const handlePageChange = vi.fn();

    render(
      <Pagination
        meta={{ page: 1, limit: 20, total: 45, totalPages: 3 }}
        onPageChange={handlePageChange}
      />
    );

    const page3Btn = screen.getByRole('button', { name: '3' });
    await user.click(page3Btn);

    expect(handlePageChange).toHaveBeenCalledWith(3);
  });
});
