export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    message: string;
    code: string;
    details?: unknown;
  };
}

export interface HealthCheckData {
  status: 'healthy' | 'unhealthy';
  uptimeSeconds: number;
  timestamp: string;
  environment: string;
  database: {
    connected: boolean;
    state: string;
  };
}

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt?: string;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export type SectionType = 'COLLEGE' | 'PERSONAL';
export type DifficultyType = 'Easy' | 'Medium' | 'Hard';
export type StatusType = 'Not Started' | 'Attempted' | 'Solved';
export type RetentionType = 'Learning' | 'Familiar' | 'Independent' | 'Strong' | 'Locked';
export type MasteryStatus = 'UNLOCKED' | 'LOCKED';

export const COLLEGE_SOURCES = ['Lecture', 'Assignment', 'Lab', 'Exam', 'Other'] as const;
export const PERSONAL_SOURCES = ['LeetCode', 'Personal', 'Mentor', 'Practice', 'Other'] as const;

export type CollegeSourceType = (typeof COLLEGE_SOURCES)[number];
export type PersonalSourceType = (typeof PERSONAL_SOURCES)[number];
export type ProblemSourceType = CollegeSourceType | PersonalSourceType | string;

export interface Problem {
  id: string;
  userId: string;
  section: SectionType;
  sNo: number;
  title: string;
  collegeLink?: string | null;
  leetcodeLink?: string | null;
  leetcodeNumber?: number | null;
  topic: string;
  difficulty: DifficultyType;
  source: string;
  dateLearned: string;
  status: StatusType;
  retentionLevel: RetentionType;
  notes?: string;
  repetitionStage: number;
  intervalDays: number;
  nextReviewDate: string;
  lastReviewedAt?: string | null;
  recoveryStage?: number | null;
  masteryStatus: MasteryStatus;
  lockedAt?: string | null;
  unlockedAt?: string | null;
  lockVersion: number;
  createdAt: string;
  updatedAt: string;
}

export type RecallResultType = 'EASY' | 'STRUGGLED' | 'HINT' | 'FORGOT';
export type TimingStatusType = 'EARLY' | 'ON_TIME' | 'LATE';

export interface RevisionHistoryItem {
  id: string;
  userId: string;
  problemId: string;
  reviewedAt: string;
  scheduledReviewAt: string;
  recallResult: RecallResultType;
  timingStatus: TimingStatusType;
  latenessDays: number;
  previousStage: number;
  newStage: number;
  previousIntervalDays: number;
  newIntervalDays: number;
  previousRetention: RetentionType;
  newRetention: RetentionType;
  previousNextReviewDate: string;
  newNextReviewDate: string;
  timeSpentSeconds?: number | null;
  coldSolve?: boolean | null;
  createdAt: string;
  problem?: {
    id?: string;
    _id?: string;
    title: string;
    sNo: number;
    section: SectionType;
    difficulty: DifficultyType;
    topic?: string;
  };
}

export interface ReviewSubmissionResult {
  problem: Problem;
  history: RevisionHistoryItem;
  transition: {
    previousStage: number;
    newStage: number;
    previousIntervalDays: number;
    newIntervalDays: number;
    previousRetention: RetentionType;
    newRetention: RetentionType;
    scheduledReviewAt: string;
    reviewedAt: string;
    timingStatus: TimingStatusType;
    latenessDays: number;
    nextReviewDate: string;
  };
}

export interface DueQueryParams {
  section?: SectionType;
  page?: number;
  limit?: number;
}

export interface SubmitReviewPayload {
  problemId: string;
  recallResult: RecallResultType;
  timeSpentSeconds?: number | null;
  coldSolve?: boolean | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedProblems {
  items: Problem[];
  pagination: PaginationMeta;
}

export interface PaginatedHistory {
  items: RevisionHistoryItem[];
  pagination: PaginationMeta;
}

export interface ProblemQueryParams {
  section?: SectionType;
  topic?: string;
  difficulty?: DifficultyType;
  source?: string;
  status?: StatusType;
  retentionLevel?: RetentionType;
  masteryStatus?: MasteryStatus;
  search?: string;
  sortBy?: 'dateLearned' | 'sNo' | 'createdAt' | 'title' | 'difficulty' | 'status';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface CreateProblemInput {
  section: SectionType;
  title: string;
  collegeLink?: string | null;
  leetcodeLink?: string | null;
  leetcodeNumber?: number | null;
  topic: string;
  difficulty: DifficultyType;
  source: string;
  dateLearned?: string;
  status?: StatusType;
  retentionLevel?: RetentionType;
  notes?: string;
}

export interface UpdateProblemInput {
  title?: string;
  collegeLink?: string | null;
  leetcodeLink?: string | null;
  leetcodeNumber?: number | null;
  topic?: string;
  difficulty?: DifficultyType;
  source?: string;
  dateLearned?: string;
  status?: StatusType;
  retentionLevel?: RetentionType;
  notes?: string;
}

// ==================== PHASE 5: PATTERN & MASTERY TYPES ====================

export type PatternMasteryLevel = 'Learning' | 'Familiar' | 'Independent' | 'Strong';
export type PatternConfidence = 'LOW' | 'MEDIUM' | 'HIGH';

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

export interface Pattern {
  id: string;
  name: string;
  slug: string;
  description: string;
  recognitionSignals: string[];
  commonMistakes: string[];
  prerequisites: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface PatternWithMastery extends Pattern {
  mastery: PatternMasteryResult;
}

export interface ProblemPatternAttachment {
  id: string;
  pattern: Pattern;
  confidence: PatternConfidence;
  isPrimary: boolean;
}

export interface AssociatedProblemItem {
  problem: {
    id: string;
    sNo: number;
    title: string;
    section: SectionType;
    difficulty: DifficultyType;
    status: StatusType;
    retentionLevel: RetentionType;
    nextReviewDate: string;
  };
  confidence: PatternConfidence;
  isPrimary: boolean;
}

export interface PatternDetailResponse {
  pattern: Pattern;
  mastery: PatternMasteryResult;
  associatedProblems: AssociatedProblemItem[];
}

// ==================== PHASE 6: DASHBOARD TYPES ====================

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
  problemSection: SectionType;
  problemDifficulty: DifficultyType;
  recallResult: RecallResultType;
  timingStatus: TimingStatusType;
  latenessDays: number;
  coldSolve: boolean | null;
  reviewedAt: string;
  primaryPatternName: string | null;
}

export interface DashboardPatternItem {
  id: string;
  name: string;
  slug: string;
  score: number;
  masteryLevel: PatternMasteryLevel;
  problemCount: number;
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
    strongestPatterns: DashboardPatternItem[];
    needsPracticePatterns: DashboardPatternItem[];
  };
  recentActivity: RecentActivityItem[];
}

// ==================== PHASE 8: LOCKED MASTERY TYPES ====================

export interface GateADetails {
  passed: boolean;
  status: string;
  requiredStatus: string;
}

export interface GateBDetails {
  passed: boolean;
  successfulReviewsCount: number;
  requiredReviewsCount: number;
  hasStageThreeMilestone: boolean;
  maxStageReached: number;
}

export interface GateCDetails {
  passed: boolean;
  qualifyingColdSolvesCount: number;
  requiredColdSolvesCount: number;
}

export interface GateDDetails {
  passed: boolean;
  latestOutcome: string | null;
  latestTimestamp: string | null;
  totalReviewsCount?: number;
}

export interface MasteryGates {
  solved: GateADetails;
  srsEvidence: GateBDetails;
  coldRecall: GateCDetails;
  recentSuccess: GateDDetails;
}

export interface ProblemMasteryDetails {
  problemId: string;
  masteryStatus: MasteryStatus;
  isEligible: boolean;
  lockedAt: string | null;
  unlockedAt: string | null;
  lockVersion: number;
  gates: MasteryGates;
}

export interface MasteryEvaluateResponse {
  problemId: string;
  masteryStatus: MasteryStatus;
  lockedAt: string | null;
  unlockedAt: string | null;
  lockVersion: number;
  transitioned: boolean;
  evaluation: {
    isEligible: boolean;
    gates: MasteryGates;
  };
}

export interface ProblemMasteryOverviewItem {
  problem: {
    id: string;
    title: string;
    sNo: number;
    section: SectionType;
    difficulty: DifficultyType;
    status: StatusType;
    topic: string;
    retentionLevel: RetentionType;
    masteryStatus: MasteryStatus;
    lockedAt: string | null;
    unlockedAt: string | null;
    lockVersion: number;
  };
  isEligible: boolean;
  gates: MasteryGates;
}



