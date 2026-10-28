import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PatternPickerModal } from '../../src/components/patterns/PatternPickerModal';
import { createMockPattern } from '../fixtures/pattern.fixture';
import { ProblemPatternAttachment } from '../../src/types';
import * as patternsApi from '../../src/api/patterns.api';

vi.mock('../../src/api/patterns.api', () => ({
  fetchPatterns: vi.fn(),
  fetchProblemPatterns: vi.fn(),
  syncProblemPatterns: vi.fn(),
}));

const patterns = [
  createMockPattern({ id: 'pat-1', name: 'Two Pointers', prerequisites: ['Arrays'] }),
  createMockPattern({
    id: 'pat-2',
    name: 'Binary Search',
    description: 'Halve the search space on sorted input.',
    prerequisites: ['Sorting'],
  }),
];

const renderPicker = (overrides: Partial<React.ComponentProps<typeof PatternPickerModal>> = {}) =>
  render(
    <PatternPickerModal
      isOpen={true}
      problemTitle="Invert Binary Tree"
      currentAttachments={[]}
      onClose={() => {}}
      onSave={async () => {}}
      {...overrides}
    />
  );

describe('PatternPickerModal component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(patternsApi.fetchPatterns).mockResolvedValue(patterns);
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <PatternPickerModal
        isOpen={false}
        problemTitle="Invert Binary Tree"
        currentAttachments={[]}
        onClose={() => {}}
        onSave={async () => {}}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders a labelled modal dialog with the pattern catalog', async () => {
    renderPicker();

    const dialog = screen.getByRole('dialog', { name: 'Assign Patterns' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('Invert Binary Tree');

    await waitFor(() => {
      expect(patternsApi.fetchPatterns).toHaveBeenCalled();
    });

    expect(await screen.findByRole('checkbox', { name: 'Two Pointers' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Binary Search' })).toBeInTheDocument();
    expect(screen.getByText('2 of 2 patterns')).toBeInTheDocument();
  });

  it('selects a pattern, exposes confidence and primary controls, and saves the payload', async () => {
    const user = userEvent.setup();
    const handleSave = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    renderPicker({ onSave: handleSave, onClose: handleClose });

    const patternCheckbox = await screen.findByRole('checkbox', { name: 'Two Pointers' });
    await user.click(patternCheckbox);

    // First selection becomes primary by default.
    expect(screen.getByRole('checkbox', { name: 'Primary' })).toBeChecked();

    await user.selectOptions(screen.getByLabelText('Confidence for Two Pointers'), 'HIGH');

    await user.click(screen.getByRole('button', { name: /save patterns \(1\)/i }));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith([
        { patternId: 'pat-1', confidence: 'HIGH', isPrimary: true },
      ]);
    });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('keeps a single primary pattern at a time', async () => {
    const user = userEvent.setup();
    const handleSave = vi.fn().mockResolvedValue(undefined);

    renderPicker({ onSave: handleSave });

    await user.click(await screen.findByRole('checkbox', { name: 'Two Pointers' }));
    await user.click(screen.getByRole('checkbox', { name: 'Binary Search' }));

    const primaryCheckboxes = screen.getAllByRole('checkbox', { name: 'Primary' });
    expect(primaryCheckboxes).toHaveLength(2);

    // Promote Binary Search; Two Pointers must be demoted.
    await user.click(primaryCheckboxes[1]);
    expect(primaryCheckboxes[1]).toBeChecked();
    expect(primaryCheckboxes[0]).not.toBeChecked();

    await user.click(screen.getByRole('button', { name: /save patterns \(2\)/i }));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith([
        { patternId: 'pat-1', confidence: 'MEDIUM', isPrimary: false },
        { patternId: 'pat-2', confidence: 'MEDIUM', isPrimary: true },
      ]);
    });
  });

  it('filters by search and offers a clear action when nothing matches', async () => {
    const user = userEvent.setup();
    renderPicker();

    const search = screen.getByRole('textbox', { name: 'Search patterns' });
    await user.type(search, 'binary');

    expect(screen.getByRole('checkbox', { name: 'Binary Search' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Two Pointers' })).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'zzzzz');

    expect(screen.getByText('No matching patterns')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /clear search/i }));
    expect(screen.getByRole('checkbox', { name: 'Two Pointers' })).toBeInTheDocument();
  });

  it('shows the catalog empty state when no patterns exist', async () => {
    vi.mocked(patternsApi.fetchPatterns).mockResolvedValue([]);
    renderPicker();

    expect(await screen.findByText('No patterns available')).toBeInTheDocument();
    expect(
      screen.getByText('There are no patterns in the catalog yet, so nothing can be attached.')
    ).toBeInTheDocument();
  });

  it('seeds the selection from the current attachments', async () => {
    const attachments: ProblemPatternAttachment[] = [
      {
        id: 'att-1',
        pattern: patterns[0],
        confidence: 'HIGH',
        isPrimary: true,
      },
    ];

    renderPicker({ currentAttachments: attachments });

    expect(await screen.findByRole('checkbox', { name: 'Two Pointers' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Primary' })).toBeChecked();
    expect(screen.getByRole('button', { name: /save patterns \(1\)/i })).toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    const Trigger = () => {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Assign patterns
          </button>
          <PatternPickerModal
            isOpen={open}
            problemTitle="Invert Binary Tree"
            currentAttachments={[]}
            onClose={() => {
              setOpen(false);
              handleClose();
            }}
            onSave={async () => {}}
          />
        </>
      );
    };

    render(<Trigger />);

    const trigger = screen.getByRole('button', { name: 'Assign patterns' });
    await user.click(trigger);
    expect(await screen.findByRole('dialog', { name: 'Assign Patterns' })).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(handleClose).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveFocus();
  });
});
