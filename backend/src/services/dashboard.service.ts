import mongoose from 'mongoose';
import { Problem } from '../models/Problem.model.js';
import { RevisionHistory } from '../models/RevisionHistory.model.js';
import { ProblemPattern } from '../models/ProblemPattern.model.js';
import { User } from '../models/User.model.js';
import { patternService, PatternService } from './pattern.service.js';
import { AppError } from '../middleware/error.middleware.js';

export interface ActivityHeatmapDay {
  date: string; // YYYY-MM-DD
  count: number;
  easy: number;
  struggled: number;
  hint: number;
  forgot: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface RecentActivityItem {
  id: string;
  problemId: string;
  problemTitle: string;
  problemSection: string;
  problemDifficulty: string;
  recallResult: string;
  timingStatus: string;
  latenessDays: number;
  coldSolve: boolean | null;
  reviewedAt: string;
  primaryPatternName: string | null;
}

export interface DashboardData {
  user: {
    name: string;
    email: string;
  };
  reviewQueue: {
    dueNow: number;
    overdue: number;
    dueToday: number;
    upcoming: number;
  };
  problemStats: {
    total: number;
    solved: number;
    attempted: number;
    notStarted: number;
    locked: number;
    unlocked: number;
    college: {
      total: number;
      solved: number;
      attempted: number;
      notStarted: number;
    };
    personal: {
      total: number;
      solved: number;
      attempted: number;
      notStarted: number;
    };
  };
  reviewStats: {
    totalReviews: number;
    easy: number;
    struggled: number;
    hint: number;
    forgot: number;
    independentColdSolves: number;
    successRate: number;
  };
  retention: {
    learning: number;
    familiar: number;
    independent: number;
    strong: number;
  };
  timing: {
    onTime: number;
    late: number;
    early: number;
    averageLatenessDays: number;
  };
  streak: {
    current: number;
    longest: number;
    lastActiveDate: string | null;
  };
  activityHeatmap: ActivityHeatmapDay[];
  patternSummary: {
    totalPatterns: number;
    strong: number;
    independent: number;
    familiar: number;
    learning: number;
    strongestPatterns: Array<{
      id: string;
      name: string;
      slug: string;
      score: number;
      masteryLevel: string;
      problemCount: number;
    }>;
    needsPracticePatterns: Array<{
      id: string;
      name: string;
      slug: string;
      score: number;
      masteryLevel: string;
      problemCount: number;
    }>;
  };
  recentActivity: RecentActivityItem[];
}

export class DashboardService {
  constructor(private readonly patternSvc: PatternService = patternService) { }

  /**
   * Builds the complete derived dashboard read model for the authenticated user.
   */
  async getDashboardData(userId: string): Promise<DashboardData> {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Fetch user profile info
    const user = await User.findById(userObjectId);
    if (!user) {
      throw new AppError('User not found.', 404, 'NOT_FOUND');
    }

    const now = new Date();
    const startOfTodayUTC = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
    );
    const endOfTodayUTC = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)
    );

    // 1. Problem aggregation (Queue, Status, Section split, Retention)
    const problemAggregationPromise = Problem.aggregate([
      { $match: { userId: userObjectId } },
      {
        $facet: {
          queueStats: [
            {
              $group: {
                _id: null,
                dueNow: {
                  $sum: { $cond: [{ $lte: ['$nextReviewDate', now] }, 1, 0] },
                },
                overdue: {
                  $sum: { $cond: [{ $lt: ['$nextReviewDate', startOfTodayUTC] }, 1, 0] },
                },
                dueToday: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $gte: ['$nextReviewDate', startOfTodayUTC] },
                          { $lte: ['$nextReviewDate', endOfTodayUTC] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                upcoming: {
                  $sum: { $cond: [{ $gt: ['$nextReviewDate', endOfTodayUTC] }, 1, 0] },
                },
              },
            },
          ],
          statusAndSectionStats: [
            {
              $group: {
                _id: { section: '$section', status: '$status' },
                count: { $sum: 1 },
              },
            },
          ],
          retentionStats: [
            {
              $group: {
                _id: '$retentionLevel',
                count: { $sum: 1 },
              },
            },
          ],
          masteryStats: [
            {
              $group: {
                _id: '$masteryStatus',
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]);

    // 2. Review aggregation (Outcomes, Timing, Lateness, Daily activity for heatmap & streak)
    const reviewAggregationPromise = RevisionHistory.aggregate([
      { $match: { userId: userObjectId } },
      {
        $facet: {
          outcomeStats: [
            {
              $group: {
                _id: null,
                totalReviews: { $sum: 1 },
                easy: { $sum: { $cond: [{ $eq: ['$recallResult', 'EASY'] }, 1, 0] } },
                struggled: { $sum: { $cond: [{ $eq: ['$recallResult', 'STRUGGLED'] }, 1, 0] } },
                hint: { $sum: { $cond: [{ $eq: ['$recallResult', 'HINT'] }, 1, 0] } },
                forgot: { $sum: { $cond: [{ $eq: ['$recallResult', 'FORGOT'] }, 1, 0] } },
                independentColdSolves: {
                  $sum: { $cond: [{ $eq: ['$coldSolve', true] }, 1, 0] },
                },
              },
            },
          ],
          timingStats: [
            {
              $group: {
                _id: null,
                onTime: { $sum: { $cond: [{ $eq: ['$timingStatus', 'ON_TIME'] }, 1, 0] } },
                late: { $sum: { $cond: [{ $eq: ['$timingStatus', 'LATE'] }, 1, 0] } },
                early: { $sum: { $cond: [{ $eq: ['$timingStatus', 'EARLY'] }, 1, 0] } },
                totalLatenessDays: {
                  $sum: { $cond: [{ $eq: ['$timingStatus', 'LATE'] }, '$latenessDays', 0] },
                },
                lateCount: { $sum: { $cond: [{ $eq: ['$timingStatus', 'LATE'] }, 1, 0] } },
              },
            },
          ],
          dailyActivity: [
            {
              $group: {
                _id: {
                  $dateToString: { format: '%Y-%m-%d', date: '$reviewedAt', timezone: 'UTC' },
                },
                count: { $sum: 1 },
                easy: { $sum: { $cond: [{ $eq: ['$recallResult', 'EASY'] }, 1, 0] } },
                struggled: { $sum: { $cond: [{ $eq: ['$recallResult', 'STRUGGLED'] }, 1, 0] } },
                hint: { $sum: { $cond: [{ $eq: ['$recallResult', 'HINT'] }, 1, 0] } },
                forgot: { $sum: { $cond: [{ $eq: ['$recallResult', 'FORGOT'] }, 1, 0] } },
              },
            },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ]);

    // 3. Patterns with Phase 5 mastery
    const patternsPromise = this.patternSvc.getPatternsWithMastery(userId);

    // 4. Recent activity with problem details
    const recentActivityPromise = RevisionHistory.find({ userId: userObjectId })
      .sort({ reviewedAt: -1 })
      .limit(10)
      .populate('problemId');

    // 5. ProblemPattern primary patterns for user
    const problemPatternsPromise = ProblemPattern.find({
      userId: userObjectId,
      isPrimary: true,
    }).populate('patternId');

    // Execute all queries in parallel
    const [
      [problemAggResult],
      [reviewAggResult],
      patternsWithMastery,
      recentReviews,
      primaryProblemPatterns,
    ] = await Promise.all([
      problemAggregationPromise,
      reviewAggregationPromise,
      patternsPromise,
      recentActivityPromise,
      problemPatternsPromise,
    ]);

    // --- Format Review Queue ---
    const queueData = problemAggResult?.queueStats?.[0] || {
      dueNow: 0,
      overdue: 0,
      dueToday: 0,
      upcoming: 0,
    };
    const reviewQueue = {
      dueNow: queueData.dueNow || 0,
      overdue: queueData.overdue || 0,
      dueToday: queueData.dueToday || 0,
      upcoming: queueData.upcoming || 0,
    };

    // --- Format Problem Stats ---
    const statusSectionDocs = problemAggResult?.statusAndSectionStats || [];
    let collegeSolved = 0;
    let collegeAttempted = 0;
    let collegeNotStarted = 0;
    let personalSolved = 0;
    let personalAttempted = 0;
    let personalNotStarted = 0;

    for (const doc of statusSectionDocs) {
      const section = doc._id?.section;
      const status = doc._id?.status;
      const count = doc.count || 0;

      if (section === 'COLLEGE') {
        if (status === 'Solved') collegeSolved += count;
        else if (status === 'Attempted') collegeAttempted += count;
        else if (status === 'Not Started') collegeNotStarted += count;
      } else if (section === 'PERSONAL') {
        if (status === 'Solved') personalSolved += count;
        else if (status === 'Attempted') personalAttempted += count;
        else if (status === 'Not Started') personalNotStarted += count;
      }
    }

    const collegeTotal = collegeSolved + collegeAttempted + collegeNotStarted;
    const personalTotal = personalSolved + personalAttempted + personalNotStarted;
    const totalSolved = collegeSolved + personalSolved;
    const totalAttempted = collegeAttempted + personalAttempted;
    const totalNotStarted = collegeNotStarted + personalNotStarted;
    const totalProblems = collegeTotal + personalTotal;

    const masteryDocs = problemAggResult?.masteryStats || [];
    let lockedCount = 0;
    let unlockedCount = 0;
    for (const doc of masteryDocs) {
      if (doc._id === 'LOCKED') {
        lockedCount += doc.count || 0;
      } else {
        unlockedCount += doc.count || 0;
      }
    }

    const problemStats = {
      total: totalProblems,
      solved: totalSolved,
      attempted: totalAttempted,
      notStarted: totalNotStarted,
      locked: lockedCount,
      unlocked: unlockedCount,
      college: {
        total: collegeTotal,
        solved: collegeSolved,
        attempted: collegeAttempted,
        notStarted: collegeNotStarted,
      },
      personal: {
        total: personalTotal,
        solved: personalSolved,
        attempted: personalAttempted,
        notStarted: personalNotStarted,
      },
    };

    // --- Format Retention Stats ---
    const retentionDocs = problemAggResult?.retentionStats || [];
    const retention = {
      learning: 0,
      familiar: 0,
      independent: 0,
      strong: 0,
    };

    for (const doc of retentionDocs) {
      const lvl = doc._id as string;
      const count = doc.count || 0;
      if (lvl === 'Learning') retention.learning += count;
      else if (lvl === 'Familiar') retention.familiar += count;
      else if (lvl === 'Independent') retention.independent += count;
      else if (lvl === 'Strong') retention.strong += count;
    }

    // --- Format Review Stats ---
    const outcomeData = reviewAggResult?.outcomeStats?.[0] || {
      totalReviews: 0,
      easy: 0,
      struggled: 0,
      hint: 0,
      forgot: 0,
      independentColdSolves: 0,
    };
    const totalReviews = outcomeData.totalReviews || 0;
    const easy = outcomeData.easy || 0;
    const struggled = outcomeData.struggled || 0;
    const hint = outcomeData.hint || 0;
    const forgot = outcomeData.forgot || 0;
    const independentColdSolves = outcomeData.independentColdSolves || 0;
    const successRate =
      totalReviews > 0 ? Math.round(((easy + struggled) / totalReviews) * 100) : 0;

    const reviewStats = {
      totalReviews,
      easy,
      struggled,
      hint,
      forgot,
      independentColdSolves,
      successRate,
    };

    // --- Format Timing Stats ---
    const timingData = reviewAggResult?.timingStats?.[0] || {
      onTime: 0,
      late: 0,
      early: 0,
      totalLatenessDays: 0,
      lateCount: 0,
    };
    const lateCount = timingData.lateCount || 0;
    const totalLatenessDays = timingData.totalLatenessDays || 0;
    const averageLatenessDays =
      lateCount > 0 ? Math.round(totalLatenessDays / lateCount) : 0;

    const timing = {
      onTime: timingData.onTime || 0,
      late: timingData.late || 0,
      early: timingData.early || 0,
      averageLatenessDays,
    };

    // --- Format Activity Heatmap & Streaks ---
    const dailyActivityDocs = reviewAggResult?.dailyActivity || [];
    const activityMap = new Map<
      string,
      { count: number; easy: number; struggled: number; hint: number; forgot: number }
    >();

    for (const doc of dailyActivityDocs) {
      if (doc._id) {
        activityMap.set(doc._id, {
          count: doc.count || 0,
          easy: doc.easy || 0,
          struggled: doc.struggled || 0,
          hint: doc.hint || 0,
          forgot: doc.forgot || 0,
        });
      }
    }

    // Build 365-day range up to today
    const activityHeatmap: ActivityHeatmapDay[] = [];
    const activeDateStrings = new Set<string>();

    for (let i = 364; i >= 0; i--) {
      const d = new Date(startOfTodayUTC.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split('T')[0]!;
      const act = activityMap.get(dateStr);

      const count = act?.count || 0;
      if (count > 0) {
        activeDateStrings.add(dateStr);
      }

      let level: 0 | 1 | 2 | 3 | 4 = 0;
      if (count >= 7) level = 4;
      else if (count >= 4) level = 3;
      else if (count >= 2) level = 2;
      else if (count === 1) level = 1;

      activityHeatmap.push({
        date: dateStr,
        count,
        easy: act?.easy || 0,
        struggled: act?.struggled || 0,
        hint: act?.hint || 0,
        forgot: act?.forgot || 0,
        level,
      });
    }

    // Streak calculations
    const todayStr = startOfTodayUTC.toISOString().split('T')[0]!;
    const yesterdayDate = new Date(startOfTodayUTC.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = yesterdayDate.toISOString().split('T')[0]!;

    let currentStreak = 0;
    let anchorDate: Date | null = null;

    if (activeDateStrings.has(todayStr)) {
      anchorDate = new Date(startOfTodayUTC.getTime());
    } else if (activeDateStrings.has(yesterdayStr)) {
      anchorDate = new Date(yesterdayDate.getTime());
    }

    if (anchorDate) {
      let checkDate = new Date(anchorDate.getTime());
      while (true) {
        const checkStr = checkDate.toISOString().split('T')[0]!;
        if (activeDateStrings.has(checkStr)) {
          currentStreak++;
          checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
        } else {
          break;
        }
      }
    }

    // Longest streak across all history
    let longestStreak = 0;
    const sortedAllActiveDates = Array.from(activityMap.keys()).sort();
    let runningStreak = 0;
    let prevDateTime: number | null = null;

    for (const dStr of sortedAllActiveDates) {
      const currentDateTime = new Date(`${dStr}T00:00:00.000Z`).getTime();
      if (prevDateTime === null) {
        runningStreak = 1;
      } else {
        const diffDays = Math.round((currentDateTime - prevDateTime) / (24 * 60 * 60 * 1000));
        if (diffDays === 1) {
          runningStreak++;
        } else {
          runningStreak = 1;
        }
      }
      prevDateTime = currentDateTime;
      if (runningStreak > longestStreak) {
        longestStreak = runningStreak;
      }
    }

    const lastActiveDate =
      sortedAllActiveDates.length > 0
        ? sortedAllActiveDates[sortedAllActiveDates.length - 1]!
        : null;

    const streak = {
      current: currentStreak,
      longest: longestStreak,
      lastActiveDate,
    };

    // --- Format Pattern Mastery Summary ---
    const totalPatterns = patternsWithMastery.length;
    let strongCount = 0;
    let independentCount = 0;
    let familiarCount = 0;
    let learningCount = 0;

    for (const p of patternsWithMastery) {
      const lvl = p.mastery.masteryLevel;
      if (lvl === 'Strong') strongCount++;
      else if (lvl === 'Independent') independentCount++;
      else if (lvl === 'Familiar') familiarCount++;
      else if (lvl === 'Learning') learningCount++;
    }

    // Strongest Patterns: sorted by score descending, then name ascending
    const sortedStrongest = [...patternsWithMastery].sort((a, b) => {
      if (b.mastery.score !== a.mastery.score) {
        return b.mastery.score - a.mastery.score;
      }
      return a.name.localeCompare(b.name);
    });

    const strongestPatterns = sortedStrongest.slice(0, 3).map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      score: p.mastery.score,
      masteryLevel: p.mastery.masteryLevel,
      problemCount: p.mastery.problemCount,
    }));

    // Needs Practice Patterns: prioritized by level: Learning (1) -> Familiar (2) -> Independent (3) -> Strong (4), then score ascending, then name ascending
    const levelRank: Record<string, number> = {
      Learning: 1,
      Familiar: 2,
      Independent: 3,
      Strong: 4,
    };

    const sortedNeedsPractice = [...patternsWithMastery].sort((a, b) => {
      const rankA = levelRank[a.mastery.masteryLevel] ?? 5;
      const rankB = levelRank[b.mastery.masteryLevel] ?? 5;
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      if (a.mastery.score !== b.mastery.score) {
        return a.mastery.score - b.mastery.score;
      }
      return a.name.localeCompare(b.name);
    });

    const needsPracticePatterns = sortedNeedsPractice.slice(0, 3).map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      score: p.mastery.score,
      masteryLevel: p.mastery.masteryLevel,
      problemCount: p.mastery.problemCount,
    }));

    const patternSummary = {
      totalPatterns,
      strong: strongCount,
      independent: independentCount,
      familiar: familiarCount,
      learning: learningCount,
      strongestPatterns,
      needsPracticePatterns,
    };

    // --- Format Recent Activity ---
    const primaryPatternByProblemId = new Map<string, string>();
    for (const pp of primaryProblemPatterns) {
      const probId = pp.problemId ? pp.problemId.toString() : '';
      const pat = pp.patternId as unknown as { name?: string };
      if (probId && pat?.name) {
        primaryPatternByProblemId.set(probId, pat.name);
      }
    }

    const recentActivity: RecentActivityItem[] = [];
    for (const rev of recentReviews) {
      if (!rev.problemId) {
        continue;
      }

      const p = rev.problemId as unknown as {
        _id?: mongoose.Types.ObjectId | string;
        title?: string;
        section?: string;
        difficulty?: string;
      };

      const pId = p._id ? p._id.toString() : '';
      const pTitle = typeof p.title === 'string' ? p.title.trim() : '';

      if (!pId || !pTitle) {
        continue;
      }

      recentActivity.push({
        id: rev._id.toString(),
        problemId: pId,
        problemTitle: pTitle,
        problemSection: p.section || 'PERSONAL',
        problemDifficulty: p.difficulty || 'Medium',
        recallResult: rev.recallResult,
        timingStatus: rev.timingStatus,
        latenessDays: rev.latenessDays,
        coldSolve: rev.coldSolve ?? null,
        reviewedAt: rev.reviewedAt.toISOString(),
        primaryPatternName: primaryPatternByProblemId.get(pId) || null,
      });
    }

    return {
      user: {
        name: user.name,
        email: user.email,
      },
      reviewQueue,
      problemStats,
      reviewStats,
      retention,
      timing,
      streak,
      activityHeatmap,
      patternSummary,
      recentActivity,
    };
  }
}

export const dashboardService = new DashboardService();
