import { describe, it, expect } from 'vitest';
import { getRouteTitle, isSecondaryPath, TITLE_FALLBACK } from '../../src/components/layout/nav.config';

describe('nav.config route titles', () => {
  it('keeps the exact-path titles', () => {
    expect(getRouteTitle('/patterns')).toBe('Patterns');
    expect(getRouteTitle('/reviews/history')).toBe('Review History');
  });

  it('names the parent section on detail routes', () => {
    expect(getRouteTitle('/patterns/two-pointers')).toBe('Patterns');
  });

  it('names the problem detail route, which has no index destination', () => {
    expect(getRouteTitle('/problems/prob-1')).toBe('Problem Detail');
    // The exact destination still wins over the detail prefix.
    expect(getRouteTitle('/problems/locked')).toBe('Locked Problems');
  });

  it('only matches on a segment boundary', () => {
    expect(getRouteTitle('/patterns-archive')).toBe(TITLE_FALLBACK);
    expect(getRouteTitle('/problems/locked')).toBe('Locked Problems');
  });

  it('falls back to the app name for unknown paths', () => {
    expect(getRouteTitle('/nope')).toBe(TITLE_FALLBACK);
  });

  it('keeps a pattern detail route inside the secondary (More) navigation', () => {
    expect(isSecondaryPath('/patterns/two-pointers')).toBe(true);
  });
});
