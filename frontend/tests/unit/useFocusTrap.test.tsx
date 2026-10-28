import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useRef } from 'react';
import { useFocusTrap } from '../../src/hooks/useFocusTrap';

/**
 * jsdom has no layout, so `getClientRects()` is empty for every element and the trap
 * deliberately treats the dialog as having no focusable children. `mockLayout()` fakes a
 * rendered box for every element, which lets these tests exercise real cycling. Genuine
 * browser focus behaviour (including the opening-transition race) is covered by
 * `e2e/focus-trap.spec.ts`.
 */
const mockLayout = () => {
  const rect = {
    width: 10,
    height: 10,
    top: 0,
    left: 0,
    bottom: 10,
    right: 10,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect;

  const list = {
    0: rect,
    length: 1,
    item: () => rect,
    [Symbol.iterator]: function* () {
      yield rect;
    },
  } as unknown as DOMRectList;

  return vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue(list);
};

interface HarnessProps {
  active?: boolean;
  empty?: boolean;
  onEscape?: () => void;
  restoreFocus?: boolean;
  showTabIndex?: boolean;
}

const Harness = ({
  active = true,
  empty = false,
  onEscape,
  restoreFocus = true,
  showTabIndex = true,
}: HarnessProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap({ active, containerRef, onEscape, restoreFocus });

  return (
    <div>
      <button data-testid="trigger">Trigger</button>
      <div ref={containerRef} tabIndex={showTabIndex ? -1 : undefined} data-testid="panel">
        {empty ? (
          <p>Nothing to focus here</p>
        ) : (
          <>
            <button data-testid="first">First</button>
            <button data-testid="second">Second</button>
          </>
        )}
      </div>
    </div>
  );
};

const NestedHarness = ({ innerOpen }: { innerOpen: boolean }) => {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useFocusTrap({ active: true, containerRef: outerRef });
  useFocusTrap({ active: innerOpen, containerRef: innerRef });

  return (
    <div>
      <button data-testid="outside">Outside</button>
      <div ref={outerRef} tabIndex={-1} data-testid="outer">
        <button data-testid="outer-first">Outer first</button>
        <button data-testid="outer-last">Outer last</button>
        <div ref={innerRef} data-testid="inner">
          <button data-testid="inner-first">Inner first</button>
          <button data-testid="inner-last">Inner last</button>
        </div>
      </div>
    </div>
  );
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useFocusTrap', () => {
  it('moves focus to the first focusable descendant when activated', () => {
    mockLayout();
    render(<Harness />);

    expect(screen.getByTestId('first')).toHaveFocus();
  });

  it('does nothing while inactive', () => {
    mockLayout();
    render(<Harness active={false} />);

    expect(screen.getByTestId('panel')).not.toHaveFocus();
    expect(screen.getByTestId('first')).not.toHaveFocus();
  });

  it('cycles forward with Tab and wraps from the last element to the first', () => {
    mockLayout();
    render(<Harness />);

    expect(fireEvent.keyDown(document.activeElement as Element, { key: 'Tab' })).toBe(false);
    expect(screen.getByTestId('second')).toHaveFocus();

    expect(fireEvent.keyDown(document.activeElement as Element, { key: 'Tab' })).toBe(false);
    expect(screen.getByTestId('first')).toHaveFocus();
  });

  it('cycles backward with Shift+Tab and wraps from the first element to the last', () => {
    mockLayout();
    render(<Harness />);

    expect(
      fireEvent.keyDown(document.activeElement as Element, { key: 'Tab', shiftKey: true })
    ).toBe(false);
    expect(screen.getByTestId('second')).toHaveFocus();

    expect(
      fireEvent.keyDown(document.activeElement as Element, { key: 'Tab', shiftKey: true })
    ).toBe(false);
    expect(screen.getByTestId('first')).toHaveFocus();
  });

  it('enters the dialog at the first element when Tab is pressed on the panel itself', () => {
    mockLayout();
    render(<Harness />);

    const panel = screen.getByTestId('panel');
    act(() => panel.focus());

    fireEvent.keyDown(panel, { key: 'Tab' });
    expect(screen.getByTestId('first')).toHaveFocus();
  });

  it('keeps Tab on the panel when there is nothing focusable, without throwing', () => {
    // No layout mock: every element reports empty client rects, exactly like jsdom.
    render(<Harness empty />);

    const panel = screen.getByTestId('panel');
    expect(panel).toHaveFocus();

    expect(fireEvent.keyDown(panel, { key: 'Tab' })).toBe(false);
    expect(panel).toHaveFocus();

    expect(fireEvent.keyDown(panel, { key: 'Tab', shiftKey: true })).toBe(false);
    expect(panel).toHaveFocus();
  });

  it('pulls focus back inside when something outside the dialog is focused', () => {
    mockLayout();
    const { getByTestId } = render(<Harness />);

    const trigger = getByTestId('trigger');
    act(() => trigger.focus());

    expect(trigger).not.toHaveFocus();
    expect(getByTestId('first')).toHaveFocus();
  });

  it('calls onEscape when Escape is pressed while active', () => {
    mockLayout();
    const onEscape = vi.fn();
    render(<Harness onEscape={onEscape} />);

    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('restores focus to the previously focused element on deactivation', () => {
    mockLayout();
    const { getByTestId, rerender } = render(<Harness active={false} />);

    const trigger = getByTestId('trigger');
    act(() => trigger.focus());

    rerender(<Harness active />);
    expect(getByTestId('first')).toHaveFocus();

    rerender(<Harness active={false} />);
    expect(trigger).toHaveFocus();
  });

  it('removes its listeners when deactivated so Tab is no longer intercepted', () => {
    mockLayout();
    const { getByTestId, rerender } = render(<Harness />);

    rerender(<Harness active={false} />);

    const trigger = getByTestId('trigger');
    act(() => trigger.focus());
    expect(trigger).toHaveFocus();

    expect(fireEvent.keyDown(trigger, { key: 'Tab' })).toBe(true);
    expect(trigger).toHaveFocus();
  });

  it('leaves a consumer-provided tabindex in place on cleanup', () => {
    const { getByTestId, rerender } = render(<Harness empty />);

    const panel = getByTestId('panel');
    expect(panel).toHaveAttribute('tabindex', '-1');
    expect(panel).toHaveFocus();

    rerender(<Harness active={false} empty />);
    expect(panel).toHaveAttribute('tabindex', '-1');
  });

  it('lets only the innermost trap handle Tab and focus recapture', () => {
    mockLayout();
    const { getByTestId } = render(<NestedHarness innerOpen />);

    expect(getByTestId('inner-first')).toHaveFocus();

    fireEvent.keyDown(document.activeElement as Element, { key: 'Tab' });
    expect(getByTestId('inner-last')).toHaveFocus();

    fireEvent.keyDown(document.activeElement as Element, { key: 'Tab' });
    expect(getByTestId('inner-first')).toHaveFocus();

    // A background control must not steal focus from the nested dialog.
    act(() => getByTestId('outside').focus());
    expect(getByTestId('inner-first')).toHaveFocus();
  });

  it('hands the trap back to the parent dialog when the nested one closes', () => {
    mockLayout();
    const { getByTestId, rerender } = render(<NestedHarness innerOpen />);

    expect(getByTestId('inner-first')).toHaveFocus();

    rerender(<NestedHarness innerOpen={false} />);
    expect(getByTestId('outer-first')).toHaveFocus();

    fireEvent.keyDown(document.activeElement as Element, { key: 'Tab' });
    expect(getByTestId('outer-last')).toHaveFocus();
  });
});
