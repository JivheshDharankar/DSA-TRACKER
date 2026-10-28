import React, { useState, useMemo, useRef } from 'react';
import { Flame, Calendar as CalendarIcon } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { ActivityHeatmapDay } from '../../types';
import styles from './ActivityHeatmap.module.css';

/**
 * DSA Tracker — Practice activity heatmap (Phase 5)
 * ================================================
 * Area 8 of the dashboard: always its own full-width panel beneath the rest, never
 * folded into the analytics cards.
 *
 * The 12-month grid is ~720px wide, so it scrolls inside its own bounded container —
 * `overflow-x: auto` on a box that is itself `min-width: 0`. That is the one place in
 * the dashboard where content may exceed its column, and it never widens the page.
 *
 * The week/month geometry, the tooltip, the legend, the UTC date labels and the
 * intensity aggregation are unchanged; only the palette moved to the design tokens
 * (a restrained indigo ramp, no neon glow, no white-outline hover).
 */

/** Intensity ramp — the two intermediate steps are alpha steps of `--color-accent`,
 *  because the token set has no five-step ramp. */
const LEVEL_CLASS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: styles.level0,
  1: styles.level1,
  2: styles.level2,
  3: styles.level3,
  4: styles.level4,
};

interface ActivityHeatmapProps {
  data: ActivityHeatmapDay[];
  currentStreak: number;
  longestStreak: number;
}

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({
  data,
  currentStreak,
  longestStreak,
}) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  /** `x` is measured inside the scroll container, not the viewport, so the tooltip stays
   *  pinned to its day cell when the year grid is scrolled horizontally. */
  const [hoveredDay, setHoveredDay] = useState<{ day: ActivityHeatmapDay; x: number } | null>(
    null
  );

  const showTooltip = (element: HTMLElement, day: ActivityHeatmapDay) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const cellRect = element.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();
    const x = cellRect.left - scrollerRect.left + scroller.scrollLeft + cellRect.width / 2;

    setHoveredDay({ day, x });
  };

  // Group the 365 days into 53 weeks (columns)
  const { weeks, monthLabels } = useMemo(() => {
    if (!data || data.length === 0) return { weeks: [], monthLabels: [] };

    const firstDate = new Date(`${data[0]!.date}T00:00:00.000Z`);
    const firstDayOfWeek = firstDate.getUTCDay(); // 0 = Sunday

    // Pad beginning of first week
    const paddedDays: Array<ActivityHeatmapDay | null> = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      paddedDays.push(null);
    }
    for (const d of data) {
      paddedDays.push(d);
    }

    // Chunk into 7-day columns
    const weekCols: Array<Array<ActivityHeatmapDay | null>> = [];
    for (let i = 0; i < paddedDays.length; i += 7) {
      weekCols.push(paddedDays.slice(i, i + 7));
    }

    // Month label positions
    const months: Array<{ label: string; weekIndex: number }> = [];
    let lastMonth = -1;

    weekCols.forEach((week, wIndex) => {
      const firstValid = week.find((d) => d !== null);
      if (firstValid) {
        const dObj = new Date(`${firstValid.date}T00:00:00.000Z`);
        const m = dObj.getUTCMonth();
        if (m !== lastMonth) {
          months.push({
            label: dObj.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
            weekIndex: wIndex,
          });
          lastMonth = m;
        }
      }
    });

    return { weeks: weekCols, monthLabels: months };
  }, [data]);

  const totalReviewsInYear = useMemo(() => {
    return data.reduce((acc, d) => acc + d.count, 0);
  }, [data]);

  const formatDate = (dateStr: string) => {
    const d = new Date(`${dateStr}T00:00:00.000Z`);
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
  };

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          <CalendarIcon size={16} aria-hidden="true" />
          Practice Activity Heatmap
        </h2>

        <div className={styles.streakSummary}>
          <span>
            {totalReviewsInYear} {totalReviewsInYear === 1 ? 'revision' : 'revisions'} in the last
            12 months
          </span>
          <Badge tone="warning" shape="pill">
            <Flame size={12} aria-hidden="true" />
            {currentStreak} Day Streak
          </Badge>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className={styles.scroller}
        role="group"
        aria-label="Practice activity by day"
      >
        <div className={styles.heatmapContainer}>
          {/* Month Header Labels */}
          <div className={styles.monthLabels} aria-hidden="true">
            {monthLabels.map((m, idx) => (
              <span
                key={idx}
                className={styles.monthLabel}
                style={{ left: `${m.weekIndex * 15}px` }}
              >
                {m.label}
              </span>
            ))}
          </div>

          <div className={styles.gridArea}>
            {/* Weekday Row Labels */}
            <div className={styles.dayLabels} aria-hidden="true">
              <span>Sun</span>
              <span>Tue</span>
              <span>Thu</span>
              <span>Sat</span>
            </div>

            {/* Weeks Grid */}
            <div className={styles.weeksGrid}>
              {weeks.map((week, wIdx) => (
                <div key={wIdx} className={styles.weekColumn}>
                  {week.map((day, dIdx) => {
                    if (!day) {
                      return (
                        <div key={`empty-${wIdx}-${dIdx}`} className={styles.emptyCell} aria-hidden="true" />
                      );
                    }

                    return (
                      <button
                        key={day.date}
                        type="button"
                        className={`${styles.dayCell} ${LEVEL_CLASS[day.level]}`}
                        aria-label={`${formatDate(day.date)}: ${day.count} reviews`}
                        onMouseEnter={(e) => showTooltip(e.currentTarget, day)}
                        onMouseLeave={() => setHoveredDay(null)}
                        onFocus={(e) => showTooltip(e.currentTarget, day)}
                        onBlur={() => setHoveredDay(null)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Hovered Day Tooltip */}
        {hoveredDay && (
          <div className={styles.tooltipBox} style={{ left: `${hoveredDay.x}px` }}>
            <span className={styles.tooltipDate}>{formatDate(hoveredDay.day.date)}</span>
            <span className={styles.tooltipCount}>
              {hoveredDay.day.count} {hoveredDay.day.count === 1 ? 'review' : 'reviews'} completed
            </span>
            {hoveredDay.day.count > 0 && (
              <span className={styles.tooltipBreakdown}>
                {hoveredDay.day.easy} EASY · {hoveredDay.day.struggled} STRUGGLED ·{' '}
                {hoveredDay.day.hint} HINT · {hoveredDay.day.forgot} FORGOT
              </span>
            )}
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <span>
          Longest Practice Streak: <strong className={styles.footerStrong}>{longestStreak} days</strong>
        </span>

        <div className={styles.legend}>
          <span>Less</span>
          <div className={styles.legendCells} aria-hidden="true">
            <div className={`${styles.legendCell} ${styles.level0}`} />
            <div className={`${styles.legendCell} ${styles.level1}`} />
            <div className={`${styles.legendCell} ${styles.level2}`} />
            <div className={`${styles.legendCell} ${styles.level3}`} />
            <div className={`${styles.legendCell} ${styles.level4}`} />
          </div>
          <span>More</span>
        </div>
      </div>
    </Card>
  );
};
