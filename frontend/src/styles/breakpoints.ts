/**
 * DSA Tracker — Responsive breakpoints (Phase 0 foundation)
 * =========================================================
 * CSS custom properties cannot be referenced inside `@media` queries, so the approved
 * breakpoint values live here for JavaScript consumers, and `tokens.css` documents the
 * same values for CSS authors. This module is that single source of truth.
 *
 *   sm   640   large phone / small tablet
 *   md   768   tablet — navigation switches from bottom-nav to icon rail
 *   lg  1024   desktop — full sidebar, full tables
 *   xl  1280   wide — three-column layouts
 *   xxl 1536   extra wide
 *
 * `mqDown(key)` is exclusive: it subtracts 1px so that `mqDown('md')` (< 768) and
 * `mqUp('md')` (>= 768) never overlap.
 */

export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  xxl: 1536,
} as const;

export type BreakpointKey = keyof typeof BREAKPOINTS;

/** `min-width` query — at or above the breakpoint. */
export const mqUp = (key: BreakpointKey): string => `(min-width: ${BREAKPOINTS[key]}px)`;

/** `max-width` query — strictly below the breakpoint (exclusive). */
export const mqDown = (key: BreakpointKey): string =>
  `(max-width: ${BREAKPOINTS[key] - 1}px)`;

/** Range query — inclusive lower bound, exclusive upper bound. */
export const mqBetween = (from: BreakpointKey, to: BreakpointKey): string =>
  `(min-width: ${BREAKPOINTS[from]}px) and (max-width: ${BREAKPOINTS[to] - 1}px)`;

/** Named queries for the navigational modes described in the redesign architecture. */
export const MEDIA = {
  /** < 768px — top bar + bottom navigation + nav drawer. */
  mobile: mqDown('md'),
  /** 768–1023px — top bar + icon rail. */
  tablet: mqBetween('md', 'lg'),
  /** >= 1024px — full sidebar. */
  desktop: mqUp('lg'),
  /** >= 1280px — widest layouts (dashboard three-column, right rail). */
  wide: mqUp('xl'),
  /** Anything below the desktop sidebar boundary. */
  belowDesktop: mqDown('lg'),
} as const;
