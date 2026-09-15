import { describe, it, expect } from 'vitest';
import {
  PatternMasteryCalculator,
  ProblemSummaryForMastery,
  ReviewSummaryForMastery,
} from '../src/services/patternMasteryCalculator.js';

describe('PatternMasteryCalculator', () => {
  it('should return 0 score and Learning level for empty problem list', () => {
    const result = PatternMasteryCalculator.calculate([], []);
    expect(result.score).toBe(0);
    expect(result.masteryLevel).toBe('Learning');
    expect(result.problemCount).toBe(0);
    expect(result.solvedCount).toBe(0);
    expect(result.breakdown).toEqual({
      coverage: 0,
      independentRecall: 0,
      recallQuality: 0,
      recentConsistency: 0,
      transferEvidence: 0,
    });
  });

  describe('Coverage Factor', () => {
    it('should calculate capped coverage without allowing 5 solved problems to yield 100%', () => {
      const problems: ProblemSummaryForMastery[] = [
        { id: '1', status: 'Solved' },
        { id: '2', status: 'Solved' },
        { id: '3', status: 'Solved' },
        { id: '4', status: 'Solved' },
        { id: '5', status: 'Solved' },
      ];
      // 5 solved / 5 total:
      // solvedPart = (5/10)*100 = 50
      // totalPart = (5/15)*100 = 33.33
      // coverage = round(0.6*50 + 0.4*33.33) = round(30 + 13.33) = 43
      const result = PatternMasteryCalculator.calculate(problems, []);
      expect(result.breakdown.coverage).toBe(43);
      expect(result.problemCount).toBe(5);
      expect(result.solvedCount).toBe(5);
    });

    it('should reach 100% coverage when user has >= 10 solved and >= 15 total problems', () => {
      const problems: ProblemSummaryForMastery[] = [];
      for (let i = 1; i <= 10; i++) {
        problems.push({ id: `p${i}`, status: 'Solved' });
      }
      for (let i = 11; i <= 15; i++) {
        problems.push({ id: `p${i}`, status: 'Attempted' });
      }

      const result = PatternMasteryCalculator.calculate(problems, []);
      expect(result.breakdown.coverage).toBe(100);
      expect(result.problemCount).toBe(15);
      expect(result.solvedCount).toBe(10);
    });
  });

  describe('Independent Recall vs Recall Quality', () => {
    it('should evaluate independent recall strictly on cold solves (coldSolve === true)', () => {
      const problems: ProblemSummaryForMastery[] = [{ id: 'p1', status: 'Solved' }];
      const now = new Date();
      const reviews: ReviewSummaryForMastery[] = [
        { problemId: 'p1', recallResult: 'EASY', coldSolve: true, reviewedAt: now }, // 100
        { problemId: 'p1', recallResult: 'STRUGGLED', coldSolve: true, reviewedAt: now }, // 60
        { problemId: 'p1', recallResult: 'FORGOT', coldSolve: false, reviewedAt: now }, // ignored in independentRecall
      ];

      const result = PatternMasteryCalculator.calculate(problems, reviews);
      // Independent Recall = (100 + 60) / 2 = 80
      expect(result.breakdown.independentRecall).toBe(80);

      // Recall Quality = (100 + 60 + 0) / 3 = 53
      expect(result.breakdown.recallQuality).toBe(53);
    });

    it('should report 0 independent recall if no cold solves exist', () => {
      const problems: ProblemSummaryForMastery[] = [{ id: 'p1', status: 'Solved' }];
      const now = new Date();
      const reviews: ReviewSummaryForMastery[] = [
        { problemId: 'p1', recallResult: 'EASY', coldSolve: false, reviewedAt: now },
        { problemId: 'p1', recallResult: 'EASY', coldSolve: null, reviewedAt: now },
      ];

      const result = PatternMasteryCalculator.calculate(problems, reviews);
      expect(result.breakdown.independentRecall).toBe(0);
      expect(result.breakdown.recallQuality).toBe(100);
    });
  });

  describe('Recent Consistency', () => {
    it('should weigh the last 5 reviews with weights [5, 4, 3, 2, 1] by recency', () => {
      const problems: ProblemSummaryForMastery[] = [{ id: 'p1', status: 'Solved' }];
      const d1 = new Date('2026-09-01');
      const d2 = new Date('2026-09-02');
      const d3 = new Date('2026-09-03');
      const d4 = new Date('2026-09-04');
      const d5 = new Date('2026-09-05'); // newest -> weight 5
      const d6 = new Date('2026-09-06'); // newest -> weight 5 (if sorted newest first)

      // Let's create reviews with distinct dates
      const reviews: ReviewSummaryForMastery[] = [
        { problemId: 'p1', recallResult: 'FORGOT', coldSolve: true, reviewedAt: d1 }, // older, dropped if > 5
        { problemId: 'p1', recallResult: 'HINT', coldSolve: true, reviewedAt: d2 }, // weight 1: 30
        { problemId: 'p1', recallResult: 'STRUGGLED', coldSolve: true, reviewedAt: d3 }, // weight 2: 60
        { problemId: 'p1', recallResult: 'STRUGGLED', coldSolve: true, reviewedAt: d4 }, // weight 3: 60
        { problemId: 'p1', recallResult: 'EASY', coldSolve: true, reviewedAt: d5 }, // weight 4: 100
        { problemId: 'p1', recallResult: 'EASY', coldSolve: true, reviewedAt: d6 }, // weight 5: 100
      ];

      // Window (newest to oldest):
      // d6: EASY (100) * 5 = 500
      // d5: EASY (100) * 4 = 400
      // d4: STRUGGLED (60) * 3 = 180
      // d3: STRUGGLED (60) * 2 = 120
      // d2: HINT (30) * 1 = 30
      // Total weighted = 500 + 400 + 180 + 120 + 30 = 1230
      // Total weight = 5 + 4 + 3 + 2 + 1 = 15
      // recentConsistency = 1230 / 15 = 82
      const result = PatternMasteryCalculator.calculate(problems, reviews);
      expect(result.breakdown.recentConsistency).toBe(82);
    });
  });

  describe('Transfer Evidence', () => {
    it('should measure breadth of distinct problems solved independently', () => {
      const problems: ProblemSummaryForMastery[] = [
        { id: 'p1', status: 'Solved' },
        { id: 'p2', status: 'Solved' },
        { id: 'p3', status: 'Solved' },
        { id: 'p4', status: 'Solved' },
      ];
      const now = new Date();
      const reviews: ReviewSummaryForMastery[] = [
        { problemId: 'p1', recallResult: 'EASY', coldSolve: true, reviewedAt: now },
        { problemId: 'p2', recallResult: 'STRUGGLED', coldSolve: true, reviewedAt: now },
        { problemId: 'p3', recallResult: 'FORGOT', coldSolve: true, reviewedAt: now }, // not successful
        { problemId: 'p4', recallResult: 'EASY', coldSolve: false, reviewedAt: now }, // not cold
        { problemId: 'p1', recallResult: 'EASY', coldSolve: true, reviewedAt: now }, // duplicate p1
      ];

      // Distinct successful cold solves: p1, p2 (count = 2)
      // transferEvidence = round(min(100, (2 / 8) * 100)) = 25
      const result = PatternMasteryCalculator.calculate(problems, reviews);
      expect(result.breakdown.transferEvidence).toBe(25);
    });

    it('should reach 100% transfer evidence at 8 distinct problems', () => {
      const problems: ProblemSummaryForMastery[] = [];
      const reviews: ReviewSummaryForMastery[] = [];
      const now = new Date();

      for (let i = 1; i <= 8; i++) {
        problems.push({ id: `p${i}`, status: 'Solved' });
        reviews.push({
          problemId: `p${i}`,
          recallResult: 'EASY',
          coldSolve: true,
          reviewedAt: now,
        });
      }

      const result = PatternMasteryCalculator.calculate(problems, reviews);
      expect(result.breakdown.transferEvidence).toBe(100);
    });
  });

  describe('Mastery Levels and Overall Composite', () => {
    it('should accurately classify Learning, Familiar, Independent, and Strong levels', () => {
      // 1. High scores across all factors -> Strong (>=85)
      const strongProblems: ProblemSummaryForMastery[] = [];
      const strongReviews: ReviewSummaryForMastery[] = [];
      const now = new Date();
      for (let i = 1; i <= 15; i++) {
        strongProblems.push({ id: `p${i}`, status: 'Solved' });
        strongReviews.push({
          problemId: `p${i}`,
          recallResult: 'EASY',
          coldSolve: true,
          reviewedAt: now,
        });
      }
      const strongResult = PatternMasteryCalculator.calculate(strongProblems, strongReviews);
      expect(strongResult.score).toBe(100);
      expect(strongResult.masteryLevel).toBe('Strong');

      // 2. Mid score -> Independent (65-84)
      // Let's create a scenario that produces ~70 score
      const indepProblems: ProblemSummaryForMastery[] = [];
      const indepReviews: ReviewSummaryForMastery[] = [];
      for (let i = 1; i <= 8; i++) {
        indepProblems.push({ id: `p${i}`, status: 'Solved' });
        indepReviews.push({
          problemId: `p${i}`,
          recallResult: i % 2 === 0 ? 'EASY' : 'STRUGGLED',
          coldSolve: true,
          reviewedAt: now,
        });
      }
      const indepResult = PatternMasteryCalculator.calculate(indepProblems, indepReviews);
      expect(indepResult.score).toBeGreaterThanOrEqual(65);
      expect(indepResult.score).toBeLessThanOrEqual(84);
      expect(indepResult.masteryLevel).toBe('Independent');
    });
  });
});
