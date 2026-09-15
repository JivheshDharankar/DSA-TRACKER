import React, { useState, useMemo } from 'react';
import { Flame, Calendar as CalendarIcon } from 'lucide-react';
import { ActivityHeatmapDay } from '../../types';
import styles from './ActivityHeatmap.module.css';

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
  const [hoveredDay, setHoveredDay] = useState<{
    day: ActivityHeatmapDay;
    x: number;
    y: number;
  } | null>(null);

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
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.title}>
          <CalendarIcon size={18} color="var(--accent-cyan)" />
          <span>Practice Activity Heatmap</span>
        </div>
        <div className={styles.streakSummary}>
          <span>
            {totalReviewsInYear} {totalReviewsInYear === 1 ? 'revision' : 'revisions'} in the last 12 months
          </span>
          <div className={styles.streakBadge}>
            <Flame size={14} color="#f59e0b" />
            <span>{currentStreak} Day Streak</span>
          </div>
        </div>
      </div>

      <div className={styles.heatmapWrapper}>
        <div className={styles.heatmapContainer}>
          {/* Month Header Labels */}
          <div className={styles.monthLabels}>
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
            <div className={styles.dayLabels}>
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
                        <div
                          key={`empty-${wIdx}-${dIdx}`}
                          style={{ width: 12, height: 12, opacity: 0 }}
                        />
                      );
                    }

                    const levelClass = styles[`level${day.level}`];

                    return (
                      <button
                        key={day.date}
                        type="button"
                        className={`${styles.dayCell} ${levelClass}`}
                        aria-label={`${formatDate(day.date)}: ${day.count} reviews`}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredDay({ day, x: rect.left + rect.width / 2, y: rect.top });
                        }}
                        onMouseLeave={() => setHoveredDay(null)}
                        onFocus={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredDay({ day, x: rect.left + rect.width / 2, y: rect.top });
                        }}
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
          <div
            className={styles.tooltipBox}
            style={{
              left: `${Math.max(120, Math.min(window.innerWidth - 120, hoveredDay.x))}px`,
              top: '10px',
              position: 'absolute',
            }}
          >
            <span className={styles.tooltipDate}>{formatDate(hoveredDay.day.date)}</span>
            <span className={styles.tooltipCount}>
              {hoveredDay.day.count} {hoveredDay.day.count === 1 ? 'review' : 'reviews'} completed
            </span>
            {hoveredDay.day.count > 0 && (
              <span className={styles.tooltipBreakdown}>
                {hoveredDay.day.easy} EASY · {hoveredDay.day.struggled} STRUGGLED · {hoveredDay.day.hint} HINT · {hoveredDay.day.forgot} FORGOT
              </span>
            )}
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <div>
          <span>Longest Practice Streak: </span>
          <strong style={{ color: 'var(--text-main)' }}>{longestStreak} days</strong>
        </div>

        <div className={styles.legend}>
          <span>Less</span>
          <div className={styles.legendCells}>
            <div className={`${styles.legendCell} ${styles.level0}`} />
            <div className={`${styles.legendCell} ${styles.level1}`} />
            <div className={`${styles.legendCell} ${styles.level2}`} />
            <div className={`${styles.legendCell} ${styles.level3}`} />
            <div className={`${styles.legendCell} ${styles.level4}`} />
          </div>
          <span>More</span>
        </div>
      </div>
    </div>
  );
};
