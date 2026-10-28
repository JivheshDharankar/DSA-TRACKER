import { useEffect, useState } from 'react';

/**
 * Subscribe to a CSS media query from React.
 *
 * Used only where responsive *behaviour* differs and CSS alone cannot express it —
 * e.g. rendering a filter drawer instead of an inline toolbar, or an icon rail
 * instead of the full sidebar. Pure layout differences stay in CSS.
 *
 * Safe in non-browser environments (SSR, jsdom): returns `false` when `matchMedia`
 * is unavailable, and the listener is detached on cleanup.
 *
 * @param query A media query string, e.g. `MEDIA.mobile` from `styles/breakpoints`.
 */
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQueryList = window.matchMedia(query);
    setMatches(mediaQueryList.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQueryList.addEventListener('change', handleChange);
    return () => {
      mediaQueryList.removeEventListener('change', handleChange);
    };
  }, [query]);

  return matches;
};
