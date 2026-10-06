import { PatternWithMastery } from '../../src/types';

export const createMockPattern = (overrides: Partial<PatternWithMastery> = {}): PatternWithMastery => {
  return {
    id: 'pat-1',
    name: 'Two Pointers',
    slug: 'two-pointers',
    description: 'Use two pointers moving in coordinated fashion across a sequence.',
    recognitionSignals: ['Sorted array or linked list', 'Searching pairs'],
    commonMistakes: ['Off-by-one errors on convergence'],
    prerequisites: ['Arrays'],
    mastery: {
      score: 75,
      masteryLevel: 'Independent',
      breakdown: {
        coverage: 60,
        independentRecall: 80,
        recallQuality: 75,
        recentConsistency: 70,
        transferEvidence: 15,
      },
      problemCount: 5,
      solvedCount: 4,
    },
    ...overrides,
  };
};
