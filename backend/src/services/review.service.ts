import mongoose from 'mongoose';
import { IProblemDocument, ProblemRetention } from '../models/Problem.model.js';
import { IRevisionHistoryDocument, RecallResultType, TimingStatusType } from '../models/RevisionHistory.model.js';
import { problemRepository, IProblemRepository } from '../repositories/problem.repository.js';
import { reviewRepository, IReviewRepository } from '../repositories/review.repository.js';
import { RevisionScheduler } from './revisionScheduler.js';
import {
  SubmitReviewInput,
  ListDueReviewsQuery,
  ListReviewHistoryQuery,
} from '../validators/review.validator.js';
import { AppError } from '../middleware/error.middleware.js';

export interface ReviewSubmissionResult {
  problem: IProblemDocument;
  history: IRevisionHistoryDocument;
  transition: {
    previousStage: number;
    newStage: number;
    previousIntervalDays: number;
    newIntervalDays: number;
    previousRetention: ProblemRetention;
    newRetention: ProblemRetention;
    scheduledReviewAt: Date;
    reviewedAt: Date;
    timingStatus: TimingStatusType;
    latenessDays: number;
    nextReviewDate: Date;
  };
}

export interface PaginatedDueProblemsResponse {
  items: IProblemDocument[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PaginatedHistoryResponse {
  items: IRevisionHistoryDocument[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class ReviewService {
  constructor(
    private readonly problemRepo: IProblemRepository = problemRepository,
    private readonly reviewRepo: IReviewRepository = reviewRepository
  ) {}

  /**
   * Submits a revision result, calculates deterministic adaptive scheduling,
   * atomically updates problem state with optimistic concurrency protection,
   * and appends a permanent RevisionHistory record.
   */
  async submitReview(userId: string, input: SubmitReviewInput): Promise<ReviewSubmissionResult> {
    const problem = await this.problemRepo.findById(input.problemId, userId);
    if (!problem) {
      throw new AppError('Problem not found.', 404, 'NOT_FOUND');
    }

    // Capture server-authoritative current scheduled state
    const previousStage = problem.repetitionStage ?? 0;
    const previousIntervalDays = problem.intervalDays ?? 0;
    const previousRetention = problem.retentionLevel ?? 'Learning';
    const previousNextReviewDate = problem.nextReviewDate;
    const scheduledReviewAt = problem.nextReviewDate;
    const recoveryStage = problem.recoveryStage ?? null;
    const previousLastReviewedAt = problem.lastReviewedAt ?? null;

    // Authoritative server timestamp for actual review
    const reviewedAt = new Date();

    // Pure deterministic scheduling calculation
    const scheduleResult = RevisionScheduler.calculateNextSchedule(
      {
        repetitionStage: previousStage,
        intervalDays: previousIntervalDays,
        nextReviewDate: scheduledReviewAt,
        lastReviewedAt: previousLastReviewedAt,
        recoveryStage,
        retentionLevel: previousRetention,
      },
      input.recallResult as RecallResultType,
      reviewedAt
    );

    // Optimistic concurrency condition: ensure problem was not modified by another concurrent review
    const concurrencyCondition: Record<string, unknown> = {
      repetitionStage: previousStage,
      lastReviewedAt: previousLastReviewedAt,
    };

    const updatePayload: Record<string, unknown> = {
      repetitionStage: scheduleResult.newStage,
      intervalDays: scheduleResult.newIntervalDays,
      nextReviewDate: scheduleResult.newNextReviewDate,
      retentionLevel: scheduleResult.newRetentionLevel,
      recoveryStage: scheduleResult.newRecoveryStage,
      lastReviewedAt: reviewedAt,
      // If problem was 'Not Started', mark it as 'Solved' upon completing a revision
      status: problem.status === 'Not Started' ? 'Solved' : problem.status,
    };

    const updatedProblem = await this.problemRepo.updateWithCondition(
      input.problemId,
      userId,
      concurrencyCondition,
      updatePayload
    );

    if (!updatedProblem) {
      throw new AppError(
        'Concurrent revision detected for this problem. Please refresh and try again.',
        409,
        'CONCURRENT_UPDATE'
      );
    }

    // Append-only RevisionHistory record
    const historyDoc = await this.reviewRepo.create({
      userId: new mongoose.Types.ObjectId(userId),
      problemId: new mongoose.Types.ObjectId(input.problemId),
      reviewedAt,
      scheduledReviewAt,
      recallResult: input.recallResult as RecallResultType,
      timingStatus: scheduleResult.timingStatus,
      latenessDays: scheduleResult.latenessDays,
      previousStage,
      newStage: scheduleResult.newStage,
      previousIntervalDays,
      newIntervalDays: scheduleResult.newIntervalDays,
      previousRetention,
      newRetention: scheduleResult.newRetentionLevel,
      previousNextReviewDate,
      newNextReviewDate: scheduleResult.newNextReviewDate,
      timeSpentSeconds: input.timeSpentSeconds ?? null,
      coldSolve: input.coldSolve ?? null,
    });

    // Safe post-review mastery hook (failure demotion or eligibility evaluation)
    const { masteryService } = await import('./mastery.service.js');
    await masteryService.handlePostReviewEvent(userId, input.problemId, input.recallResult);

    return {
      problem: updatedProblem,
      history: historyDoc,
      transition: {
        previousStage,
        newStage: scheduleResult.newStage,
        previousIntervalDays,
        newIntervalDays: scheduleResult.newIntervalDays,
        previousRetention,
        newRetention: scheduleResult.newRetentionLevel,
        scheduledReviewAt,
        reviewedAt,
        timingStatus: scheduleResult.timingStatus,
        latenessDays: scheduleResult.latenessDays,
        nextReviewDate: scheduleResult.newNextReviewDate,
      },
    };
  }

  /**
   * Retrieves due problems (scheduled UTC calendar day has arrived) ordered by most overdue first.
   */
  async getDueProblems(
    userId: string,
    query: ListDueReviewsQuery
  ): Promise<PaginatedDueProblemsResponse> {
    const page = Math.max(1, query.page);
    const limit = Math.min(100, Math.max(1, query.limit));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.problemRepo.findDue(userId, query.section, skip, limit),
      this.problemRepo.countDue(userId, query.section),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieves chronologically ordered revision history for a problem (newest first).
   */
  async getProblemHistory(
    userId: string,
    problemId: string,
    query: ListReviewHistoryQuery
  ): Promise<PaginatedHistoryResponse> {
    const problem = await this.problemRepo.findById(problemId, userId);
    if (!problem) {
      throw new AppError('Problem not found.', 404, 'NOT_FOUND');
    }

    const page = Math.max(1, query.page);
    const limit = Math.min(100, Math.max(1, query.limit));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.reviewRepo.findByProblemId(problemId, userId, skip, limit),
      this.reviewRepo.countByProblemId(problemId, userId),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieves chronologically ordered revision history across all problems for a user.
   */
  async getUserHistory(
    userId: string,
    query: ListReviewHistoryQuery
  ): Promise<PaginatedHistoryResponse> {
    const page = Math.max(1, query.page);
    const limit = Math.min(100, Math.max(1, query.limit));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.reviewRepo.findUserHistory(userId, skip, limit),
      this.reviewRepo.countUserHistory(userId),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}

export const reviewService = new ReviewService();
