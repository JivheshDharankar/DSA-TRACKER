import { RecallResultType } from '../models/RevisionHistory.model.js';

export type PatternMasteryLevel = 'Learning' | 'Familiar' | 'Independent' | 'Strong';

export interface PatternMasteryBreakdown {
  coverage: number;
  independentRecall: number;
  recallQuality: number;
  recentConsistency: number;
  transferEvidence: number;
}

export interface PatternMasteryResult {
  score: number;
  masteryLevel: PatternMasteryLevel;
  breakdown: PatternMasteryBreakdown;
  problemCount: number;
  solvedCount: number;
}

export interface ProblemSummaryForMastery {
  id: string;
  status: string; // 'Solved' | 'Attempted' | 'Not Started'
}

export interface ReviewSummaryForMastery {
  problemId: string;
  recallResult: RecallResultType;
  coldSolve?: boolean | null;
  reviewedAt: Date;
}

export class PatternMasteryCalculator {
  /**
   * Calculates deterministic pattern mastery score and breakdown.
   */
  static calculate(
    problems: ProblemSummaryForMastery[],
    reviews: ReviewSummaryForMastery[]
  ): PatternMasteryResult {
    const totalCount = problems.length;
    const solvedCount = problems.filter((p) => p.status === 'Solved').length;

    // 0 problems -> 0 score and Learning
    if (totalCount === 0) {
      return {
        score: 0,
        masteryLevel: 'Learning',
        breakdown: {
          coverage: 0,
          independentRecall: 0,
          recallQuality: 0,
          recentConsistency: 0,
          transferEvidence: 0,
        },
        problemCount: 0,
        solvedCount: 0,
      };
    }

    // 1. Coverage (25%): 60% solved breadth + 40% total breadth (capped at 10 solved, 15 total)
    const solvedPart = Math.min(100, (solvedCount / 10) * 100);
    const totalPart = Math.min(100, (totalCount / 15) * 100);
    const coverage = Math.round(0.6 * solvedPart + 0.4 * totalPart);

    // 2. Independent Recall (25%): Only reviews where coldSolve === true
    const coldReviews = reviews.filter((r) => r.coldSolve === true);
    let independentRecall = 0;
    if (coldReviews.length > 0) {
      const totalColdScore = coldReviews.reduce((sum, r) => sum + this.getQualityScore(r.recallResult), 0);
      independentRecall = Math.round(totalColdScore / coldReviews.length);
    }

    // 3. Recall Quality (20%): All reviews regardless of coldSolve
    let recallQuality = 0;
    if (reviews.length > 0) {
      const totalScore = reviews.reduce((sum, r) => sum + this.getQualityScore(r.recallResult), 0);
      recallQuality = Math.round(totalScore / reviews.length);
    }

    // 4. Recent Consistency (15%): Last 5 reviews with linear recency weighting (5, 4, 3, 2, 1)
    let recentConsistency = 0;
    if (reviews.length > 0) {
      // Sort newest first
      const sortedReviews = [...reviews].sort(
        (a, b) => new Date(b.reviewedAt).getTime() - new Date(a.reviewedAt).getTime()
      );
      const recentWindow = sortedReviews.slice(0, 5);
      const weights = [5, 4, 3, 2, 1].slice(0, recentWindow.length);
      const totalWeight = weights.reduce((a, b) => a + b, 0);

      let weightedSum = 0;
      for (let i = 0; i < recentWindow.length; i++) {
        const r = recentWindow[i]!;
        const w = weights[i]!;
        weightedSum += w * this.getQualityScore(r.recallResult);
      }
      recentConsistency = Math.round(weightedSum / totalWeight);
    }

    // 5. Transfer Evidence (15%): Breadth of distinct problems with successful cold solve (EASY or STRUGGLED)
    const successfulColdSolvedProblemIds = new Set<string>();
    for (const r of coldReviews) {
      if (r.recallResult === 'EASY' || r.recallResult === 'STRUGGLED') {
        successfulColdSolvedProblemIds.add(r.problemId);
      }
    }
    const distinctSuccessfulCount = successfulColdSolvedProblemIds.size;
    const transferEvidence = Math.round(Math.min(100, (distinctSuccessfulCount / 8) * 100));

    // Weighted composite score (0-100)
    const compositeScore = Math.round(
      0.25 * coverage +
        0.25 * independentRecall +
        0.20 * recallQuality +
        0.15 * recentConsistency +
        0.15 * transferEvidence
    );

    const score = Math.min(100, Math.max(0, compositeScore));
    const masteryLevel = this.determineLevel(score);

    return {
      score,
      masteryLevel,
      breakdown: {
        coverage,
        independentRecall,
        recallQuality,
        recentConsistency,
        transferEvidence,
      },
      problemCount: totalCount,
      solvedCount,
    };
  }

  private static getQualityScore(result: RecallResultType): number {
    switch (result) {
      case 'EASY':
        return 100;
      case 'STRUGGLED':
        return 60;
      case 'HINT':
        return 30;
      case 'FORGOT':
        return 0;
      default:
        return 0;
    }
  }

  private static determineLevel(score: number): PatternMasteryLevel {
    if (score >= 85) return 'Strong';
    if (score >= 65) return 'Independent';
    if (score >= 35) return 'Familiar';
    return 'Learning';
  }
}
