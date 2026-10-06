import { Problem, PaginatedProblems, SectionType } from '../../src/types';

export const createMockProblem = (overrides: Partial<Problem> = {}): Problem => {
  return {
    id: 'prob-1',
    userId: 'user-1',
    section: 'COLLEGE' as SectionType,
    sNo: 1,
    title: 'Two Sum',
    collegeLink: 'https://college.edu/assignment-1',
    leetcodeLink: 'https://leetcode.com/problems/two-sum',
    leetcodeNumber: 1,
    topic: 'Arrays',
    difficulty: 'Easy',
    source: 'Lecture',
    dateLearned: '2026-09-01T00:00:00.000Z',
    status: 'Solved',
    retentionLevel: 'Learning',
    notes: 'Use a hash map for O(n) time and O(n) space.',
    repetitionStage: 1,
    intervalDays: 1,
    nextReviewDate: '2026-09-02T00:00:00.000Z',
    lastReviewedAt: '2026-09-01T00:00:00.000Z',
    recoveryStage: null,
    masteryStatus: 'UNLOCKED',
    lockedAt: null,
    unlockedAt: null,
    lockVersion: 0,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
};

export const createMockPaginatedProblems = (
  count: number = 2,
  overrides: Partial<Problem> = {}
): PaginatedProblems => {
  const items = Array.from({ length: count }, (_, idx) =>
    createMockProblem({
      id: `prob-${idx + 1}`,
      sNo: idx + 1,
      title: `Problem ${idx + 1}`,
      ...overrides,
    })
  );

  return {
    items,
    pagination: {
      page: 1,
      limit: 20,
      total: count,
      totalPages: Math.max(1, Math.ceil(count / 20)),
    },
  };
};
