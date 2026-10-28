import {
  Code2,
  GraduationCap,
  History,
  LayoutDashboard,
  Lock,
  LogIn,
  Network,
  Repeat,
  UserPlus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * DSA Tracker — Navigation source of truth (Phase 3)
 * ==================================================
 * Every destination is declared here exactly once. The sidebar, the tablet rail, the
 * mobile bottom bar, the "More" drawer and the topbar heading all read from this file,
 * so a route path or label can never drift between presentations again.
 *
 * Phase 3 note: this module replaces the destinations that used to be hardcoded in
 * `Sidebar.tsx` and the `routeTitleMap` that used to live in `Header.tsx`. Both lists
 * contained the same nine paths, so nothing was added, removed or renamed.
 *
 * It is a plain data module: no routing abstraction, no path matching beyond the
 * exact-path title lookup and the segment-boundary helper at the bottom.
 */

export interface NavDestination {
  /** Route path — identical to the pre-Phase-3 hardcoded destinations. */
  to: string;
  /** Sidebar, drawer and tooltip label. */
  label: string;
  /** Compact label for the mobile bottom bar; falls back to `label`. */
  tabLabel?: string;
  /** Topbar heading text (the former `routeTitleMap` value). */
  title: string;
  icon: LucideIcon;
  /** Sidebar group heading, or `null` for an ungrouped destination. */
  group: string | null;
  /** Guest-only destinations (`/login`, `/register`) set this to `false`. */
  requiresAuth: boolean;
  /** `tab` = mobile bottom bar · `drawer` = inside the "More" drawer. */
  mobile: 'tab' | 'drawer';
}

export const NAV_DESTINATIONS: readonly NavDestination[] = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    title: 'Dashboard',
    icon: LayoutDashboard,
    group: null,
    requiresAuth: true,
    mobile: 'tab',
  },
  {
    to: '/college-dsa',
    label: 'College DSA',
    tabLabel: 'College',
    title: 'College DSA Tracker',
    icon: GraduationCap,
    group: 'MY DSA',
    requiresAuth: true,
    mobile: 'tab',
  },
  {
    to: '/personal-dsa',
    label: 'Personal DSA',
    tabLabel: 'Personal',
    title: 'Personal DSA Tracker',
    icon: Code2,
    group: 'MY DSA',
    requiresAuth: true,
    mobile: 'tab',
  },
  {
    to: '/review',
    label: 'Reviews',
    tabLabel: 'Review',
    title: 'Review Queue',
    icon: Repeat,
    group: 'SPACED REPETITION',
    requiresAuth: true,
    mobile: 'tab',
  },
  {
    to: '/reviews/history',
    label: 'Review History',
    title: 'Review History',
    icon: History,
    group: 'SPACED REPETITION',
    requiresAuth: true,
    mobile: 'drawer',
  },
  {
    to: '/patterns',
    label: 'Patterns',
    title: 'Patterns',
    icon: Network,
    group: 'MASTERY',
    requiresAuth: true,
    mobile: 'drawer',
  },
  {
    to: '/problems/locked',
    label: 'Locked Problems',
    title: 'Locked Problems',
    icon: Lock,
    group: 'MASTERY',
    requiresAuth: true,
    mobile: 'drawer',
  },
  {
    to: '/login',
    label: 'Sign In',
    title: 'Sign In',
    icon: LogIn,
    group: 'Account',
    requiresAuth: false,
    mobile: 'drawer',
  },
  {
    to: '/register',
    label: 'Register',
    title: 'Create Account',
    icon: UserPlus,
    group: 'Account',
    requiresAuth: false,
    mobile: 'drawer',
  },
];

export interface NavGroup {
  heading: string | null;
  items: NavDestination[];
}

/** Destinations in declaration order, folded into their groups (preserves the
 *  pre-Phase-3 sidebar structure: ungrouped Dashboard, then four named groups). */
const buildGroups = (): NavGroup[] => {
  const groups: NavGroup[] = [];
  for (const destination of NAV_DESTINATIONS) {
    const current: NavGroup | undefined = groups[groups.length - 1];
    if (current && current.heading === destination.group) {
      current.items.push(destination);
    } else {
      groups.push({ heading: destination.group, items: [destination] });
    }
  }
  return groups;
};

export const NAV_GROUPS: readonly NavGroup[] = buildGroups();

/** The four primary destinations of the mobile bottom bar, in tab order. */
export const MOBILE_TABS: readonly NavDestination[] = NAV_DESTINATIONS.filter(
  (destination) => destination.mobile === 'tab'
);

/** Everything that lives in the mobile "More" drawer. */
export const MOBILE_SECONDARY: readonly NavDestination[] = NAV_DESTINATIONS.filter(
  (destination) => destination.mobile === 'drawer'
);

/** Same fallback string the topbar used before Phase 3. */
export const TITLE_FALLBACK = 'DSA Tracker';

/** Exact-path lookup — the same semantics `routeTitleMap[location.pathname]` had. */
export const findDestination = (pathname: string): NavDestination | undefined =>
  NAV_DESTINATIONS.find((destination) => destination.to === pathname);

/**
 * Detail routes (`/patterns/:id`) are not destinations of their own, but the topbar should
 * still name the section they belong to instead of falling back to the app name. Matching
 * is done on a `/` boundary so `/problems/locked` is never claimed by a `/problems` entry.
 */
const findDestinationTitleForChild = (pathname: string): string | undefined =>
  NAV_DESTINATIONS.find(
    (destination) =>
      destination.to.startsWith('/') && pathname.startsWith(`${destination.to}/`)
  )?.title;

/**
 * Detail routes that are not destinations and have no destination to inherit from, but do
 * have a section name the topbar should show — `/problems/:id` is the only one, because
 * there is no `/problems` index route (only `/problems/locked`, which is matched exactly
 * before this lookup runs).
 */
const DETAIL_TITLES: ReadonlyArray<{ prefix: string; title: string }> = [
  { prefix: '/problems/', title: 'Problem Detail' },
];

export const getRouteTitle = (pathname: string): string =>
  findDestination(pathname)?.title ??
  findDestinationTitleForChild(pathname) ??
  DETAIL_TITLES.find((entry) => pathname.startsWith(entry.prefix))?.title ??
  TITLE_FALLBACK;

/**
 * Paths that make the mobile "More" tab read as active: the authenticated secondary
 * destinations only. The guest account pages (`/login`, `/register`) are deliberately
 * excluded, so "More" stays visually inactive on the auth screens even though the
 * drawer still offers those destinations.
 */
const MORE_ACTIVE_PATHS = NAV_DESTINATIONS.filter(
  (destination) => destination.mobile === 'drawer' && destination.requiresAuth
).map((destination) => destination.to);

/**
 * Segment-boundary match that mirrors `NavLink`'s default behaviour (no `end`, no custom
 * matcher): `/patterns/:id` keeps `/patterns` active, while `/problems/:id` never claims
 * `/problems/locked`.
 */
export const isSecondaryPath = (pathname: string): boolean =>
  MORE_ACTIVE_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

/** The guest account routes (`/login`, `/register`). */
const AUTH_PATHS = NAV_DESTINATIONS.filter((destination) => !destination.requiresAuth).map(
  (destination) => destination.to
);

export const isAuthPath = (pathname: string): boolean => AUTH_PATHS.includes(pathname);

/**
 * Whether the mobile "More" tab should look active.
 *
 * `/login` and `/register` are excluded from both terms: "More" stays visually inactive
 * on the auth screens even when the drawer is open, because those pages are not part of
 * the secondary navigation group.
 */
export const isMoreTabActive = (pathname: string, isDrawerOpen: boolean): boolean =>
  !isAuthPath(pathname) && (isDrawerOpen || isSecondaryPath(pathname));
