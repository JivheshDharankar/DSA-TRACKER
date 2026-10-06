import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrackerHeader } from '../../src/components/problems/TrackerHeader';

describe('TrackerHeader component', () => {
  it('renders the title and subtitle correctly', () => {
    render(
      <TrackerHeader
        title="College DSA Tracker"
        subtitle="Track college lecture and assignment problems"
        viewMode="table"
        onViewModeChange={() => {}}
      />
    );

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('College DSA Tracker');
    expect(screen.getByText('Track college lecture and assignment problems')).toBeInTheDocument();
  });

  it('renders both table and card view toggle buttons with titles', () => {
    render(
      <TrackerHeader
        title="Personal DSA Tracker"
        subtitle="Independent LeetCode practice"
        viewMode="table"
        onViewModeChange={() => {}}
      />
    );

    expect(screen.getByTitle('Table view')).toBeInTheDocument();
    expect(screen.getByTitle('Card view')).toBeInTheDocument();
  });

  it('calls onViewModeChange with "cards" when user clicks the card view button', async () => {
    const user = userEvent.setup();
    const handleViewModeChange = vi.fn();

    render(
      <TrackerHeader
        title="Personal DSA Tracker"
        subtitle="Independent LeetCode practice"
        viewMode="table"
        onViewModeChange={handleViewModeChange}
      />
    );

    const cardBtn = screen.getByTitle('Card view');
    await user.click(cardBtn);

    expect(handleViewModeChange).toHaveBeenCalledTimes(1);
    expect(handleViewModeChange).toHaveBeenCalledWith('cards');
  });

  it('calls onViewModeChange with "table" when user clicks the table view button', async () => {
    const user = userEvent.setup();
    const handleViewModeChange = vi.fn();

    render(
      <TrackerHeader
        title="Personal DSA Tracker"
        subtitle="Independent LeetCode practice"
        viewMode="cards"
        onViewModeChange={handleViewModeChange}
      />
    );

    const tableBtn = screen.getByTitle('Table view');
    await user.click(tableBtn);

    expect(handleViewModeChange).toHaveBeenCalledTimes(1);
    expect(handleViewModeChange).toHaveBeenCalledWith('table');
  });

  it('marks the active view button based on viewMode prop', () => {
    const { rerender } = render(
      <TrackerHeader
        title="DSA Tracker"
        subtitle="Testing active view"
        viewMode="table"
        onViewModeChange={() => {}}
      />
    );

    const tableBtn = screen.getByTitle('Table view');
    const cardBtn = screen.getByTitle('Card view');

    expect(tableBtn.className).toContain('viewBtnActive');
    expect(cardBtn.className).not.toContain('viewBtnActive');

    rerender(
      <TrackerHeader
        title="DSA Tracker"
        subtitle="Testing active view"
        viewMode="cards"
        onViewModeChange={() => {}}
      />
    );

    expect(tableBtn.className).not.toContain('viewBtnActive');
    expect(cardBtn.className).toContain('viewBtnActive');
  });
});
