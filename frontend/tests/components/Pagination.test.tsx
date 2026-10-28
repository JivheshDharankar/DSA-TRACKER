import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination } from '../../src/components/problems/Pagination';

const previousButton = () => screen.getByRole('button', { name: 'Previous page' });
const nextButton = () => screen.getByRole('button', { name: 'Next page' });

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

    const range = screen.getByText(/Showing/);
    expect(range.textContent?.replace(/\s+/g, ' ')).toBe('Showing 21–40 of 45 problems');
  });

  it('names the range with the caller’s item label', () => {
    render(
      <Pagination
        meta={{ page: 1, limit: 20, total: 3, totalPages: 1 }}
        onPageChange={() => {}}
        itemLabel="reviews"
      />
    );

    expect(screen.getByText(/Showing/).textContent?.replace(/\s+/g, ' ')).toBe(
      'Showing 1–3 of 3 reviews'
    );
  });

  it('disables previous button on first page and enables next button', () => {
    render(
      <Pagination
        meta={{ page: 1, limit: 20, total: 45, totalPages: 3 }}
        onPageChange={() => {}}
      />
    );

    expect(previousButton()).toBeDisabled();
    expect(nextButton()).not.toBeDisabled();
  });

  it('disables next button on last page and enables previous button', () => {
    render(
      <Pagination
        meta={{ page: 3, limit: 20, total: 45, totalPages: 3 }}
        onPageChange={() => {}}
      />
    );

    expect(previousButton()).not.toBeDisabled();
    expect(nextButton()).toBeDisabled();
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

    await user.click(nextButton());
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

    await user.click(previousButton());
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

  it('marks the current page and windows a long page list with an ellipsis', () => {
    render(
      <Pagination
        meta={{ page: 6, limit: 10, total: 200, totalPages: 20 }}
        onPageChange={() => {}}
      />
    );

    expect(screen.getByRole('button', { name: '6' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: '1' })).not.toHaveAttribute('aria-current');

    // 1 · 5 6 7 · 20 — the far pages are never rendered, so nothing can overflow.
    expect(screen.getByRole('button', { name: '5' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '7' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '20' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '12' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
  });

  it('exposes the landmark with an accessible name and the page position', () => {
    render(
      <Pagination
        meta={{ page: 2, limit: 20, total: 45, totalPages: 3 }}
        onPageChange={() => {}}
        label="Review history pagination"
      />
    );

    expect(
      screen.getByRole('navigation', { name: 'Review history pagination' })
    ).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
  });

  it('compact omits the range line and hides itself for a single page when asked', () => {
    const { container } = render(
      <Pagination
        meta={{ page: 1, limit: 20, total: 8, totalPages: 1 }}
        onPageChange={() => {}}
        variant="compact"
        hideForSinglePage
      />
    );

    expect(container.firstChild).toBeNull();

    render(
      <Pagination
        meta={{ page: 1, limit: 20, total: 45, totalPages: 3 }}
        onPageChange={() => {}}
        variant="compact"
      />
    );

    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
  });
});
