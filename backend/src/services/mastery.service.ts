import mongoose from 'mongoose';
import { Problem, IProblemDocument, MasteryStatus } from '../models/Problem.model.js';
import { RevisionHistory } from '../models/RevisionHistory.model.js';
import { IMasteryEventDocument, MasteryTransitionReason } from '../models/MasteryEvent.model.js';
import {
  masteryEventRepository,
  IMasteryEventRepository,
} from '../repositories/masteryEvent.repository.js';
import {
  LockedMasteryEvaluator,
  MasteryEvaluationBreakdown,
  EvaluatorReviewInput,
} from './mastery.evaluator.js';
import { AppError } from '../middleware/error.middleware.js';

export interface ProblemMasteryDetailsResponse {
  problemId: string;
  masteryStatus: MasteryStatus;
  isEligible: boolean;
  lockedAt: string | null;
  unlockedAt: string | null;
  lockVersion: number;
  gates: MasteryEvaluationBreakdown['gates'];
}

export interface ProblemMasteryOverviewItem {
  problem: {
    id: string;
    title: string;
    sNo: number;
    section: string;
    difficulty: string;
    status: string;
    topic: string;
    retentionLevel: string;
    masteryStatus: MasteryStatus;
    lockedAt: string | null;
    unlockedAt: string | null;
    lockVersion: number;
  };
  isEligible: boolean;
  gates: MasteryEvaluationBreakdown['gates'];
}

export interface MasteryEvaluationResult {
  problem: IProblemDocument;
  evaluation: MasteryEvaluationBreakdown;
  transitioned: boolean;
  event?: IMasteryEventDocument | null;
}

export class MasteryService {
  constructor(
    private readonly masteryEventRepo: IMasteryEventRepository = masteryEventRepository
  ) {}
  /**
   * Retrieves all user problems with their 4-gate mastery qualification status in bulk (2 queries, NO N+1).
   */
  async getUserMasteryOverview(userId: string): Promise<ProblemMasteryOverviewItem[]> {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const [problems, allReviews] = await Promise.all([
      Problem.find({ userId: userObjectId }).sort({ sNo: 1 }),
      RevisionHistory.find({ userId: userObjectId })
        .select('_id problemId reviewedAt recallResult newStage previousStage coldSolve')
        .sort({ reviewedAt: -1 })
        .lean(),
    ]);

    const reviewsByProblem = new Map<string, EvaluatorReviewInput[]>();
    for (const rev of allReviews) {
      const pid = rev.problemId.toString();
      if (!reviewsByProblem.has(pid)) {
        reviewsByProblem.set(pid, []);
      }
      reviewsByProblem.get(pid)!.push(rev);
    }

    return problems.map((problem) => {
      const pReviews = reviewsByProblem.get(problem._id.toString()) || [];
      const evaluation = LockedMasteryEvaluator.evaluate({ status: problem.status }, pReviews);
      return {
        problem: {
          id: problem._id.toString(),
          title: problem.title,
          sNo: problem.sNo,
          section: problem.section,
          difficulty: problem.difficulty,
          status: problem.status,
          topic: problem.topic,
          retentionLevel: problem.retentionLevel,
          masteryStatus: problem.masteryStatus,
          lockedAt: problem.lockedAt ? problem.lockedAt.toISOString() : null,
          unlockedAt: problem.unlockedAt ? problem.unlockedAt.toISOString() : null,
          lockVersion: problem.lockVersion,
        },
        isEligible: evaluation.isEligible,
        gates: evaluation.gates,
      };
    });
  }
  /**
   * Retrieves current mastery status and computes the 4-gate qualification breakdown.
   */
  async evaluateProblemMastery(
    userId: string,
    problemId: string
  ): Promise<ProblemMasteryDetailsResponse> {
    if (!mongoose.Types.ObjectId.isValid(problemId)) {
      throw new AppError('Invalid problem ID format.', 400, 'INVALID_ID_FORMAT');
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const problemObjectId = new mongoose.Types.ObjectId(problemId);

    const problem = await Problem.findOne({ _id: problemObjectId, userId: userObjectId });
    if (!problem) {
      throw new AppError('Problem not found.', 404, 'NOT_FOUND');
    }

    const reviews = await RevisionHistory.find({
      userId: userObjectId,
      problemId: problemObjectId,
    }).sort({ reviewedAt: -1 });

    const evaluation = LockedMasteryEvaluator.evaluate(
      { status: problem.status },
      reviews
    );

    return {
      problemId: problem._id.toString(),
      masteryStatus: problem.masteryStatus,
      isEligible: evaluation.isEligible,
      lockedAt: problem.lockedAt ? problem.lockedAt.toISOString() : null,
      unlockedAt: problem.unlockedAt ? problem.unlockedAt.toISOString() : null,
      lockVersion: problem.lockVersion,
      gates: evaluation.gates,
    };
  }

  /**
   * Evaluates all 4 gates and atomically transitions UNLOCKED -> LOCKED if eligible.
   * If already LOCKED or ineligible, returns current state without state mutation.
   */
  async evaluateAndTransition(
    userId: string,
    problemId: string,
    reason: MasteryTransitionReason = 'QUALIFICATION_MET'
  ): Promise<MasteryEvaluationResult> {
    if (!mongoose.Types.ObjectId.isValid(problemId)) {
      throw new AppError('Invalid problem ID format.', 400, 'INVALID_ID_FORMAT');
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const problemObjectId = new mongoose.Types.ObjectId(problemId);

    const problem = await Problem.findOne({ _id: problemObjectId, userId: userObjectId });
    if (!problem) {
      throw new AppError('Problem not found.', 404, 'NOT_FOUND');
    }

    const reviews = await RevisionHistory.find({
      userId: userObjectId,
      problemId: problemObjectId,
    }).sort({ reviewedAt: -1 });

    const evaluation = LockedMasteryEvaluator.evaluate(
      { status: problem.status },
      reviews
    );

    // If eligible and currently UNLOCKED, attempt atomic lock transition
    if (evaluation.isEligible && problem.masteryStatus === 'UNLOCKED') {
      const now = new Date();
      const updatedProblem = await Problem.findOneAndUpdate(
        {
          _id: problemObjectId,
          userId: userObjectId,
          masteryStatus: 'UNLOCKED',
        },
        {
          $set: {
            masteryStatus: 'LOCKED',
            lockedAt: now,
          },
          $inc: { lockVersion: 1 },
        },
        { new: true }
      );

      if (updatedProblem) {
        const eventDoc = await this.masteryEventRepo.create({
          userId: userObjectId,
          problemId: problemObjectId,
          eventType: 'LOCKED',
          occurredAt: now,
          reason,
          lockVersion: updatedProblem.lockVersion,
        });

        return {
          problem: updatedProblem,
          evaluation,
          transitioned: true,
          event: eventDoc,
        };
      }
    }

    return {
      problem,
      evaluation,
      transitioned: false,
      event: null,
    };
  }

  /**
   * Atomically transitions LOCKED -> UNLOCKED upon a genuine failure.
   * If already UNLOCKED, no-op (no version increment, no event).
   */
  async unlockProblemIfLocked(
    userId: string,
    problemId: string,
    reason: MasteryTransitionReason
  ): Promise<{ problem: IProblemDocument; transitioned: boolean; event: IMasteryEventDocument | null }> {
    if (!mongoose.Types.ObjectId.isValid(problemId)) {
      throw new AppError('Invalid problem ID format.', 400, 'INVALID_ID_FORMAT');
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const problemObjectId = new mongoose.Types.ObjectId(problemId);

    const now = new Date();
    const updatedProblem = await Problem.findOneAndUpdate(
      {
        _id: problemObjectId,
        userId: userObjectId,
        masteryStatus: 'LOCKED',
      },
      {
        $set: {
          masteryStatus: 'UNLOCKED',
          unlockedAt: now,
        },
        $inc: { lockVersion: 1 },
      },
      { new: true }
    );

    if (updatedProblem) {
      const eventDoc = await this.masteryEventRepo.create({
        userId: userObjectId,
        problemId: problemObjectId,
        eventType: 'UNLOCKED',
        occurredAt: now,
        reason,
        lockVersion: updatedProblem.lockVersion,
      });

      return {
        problem: updatedProblem,
        transitioned: true,
        event: eventDoc,
      };
    }

    const problem = await Problem.findOne({ _id: problemObjectId, userId: userObjectId });
    if (!problem) {
      throw new AppError('Problem not found.', 404, 'NOT_FOUND');
    }

    return {
      problem,
      transitioned: false,
      event: null,
    };
  }

  /**
   * Safe post-review hook called by ReviewService after revision history is successfully persisted.
   */
  async handlePostReviewEvent(
    userId: string,
    problemId: string,
    recallResult: string
  ): Promise<void> {
    try {
      if (recallResult === 'HINT' || recallResult === 'FORGOT') {
        await this.unlockProblemIfLocked(userId, problemId, 'SRS_FAILURE');
      } else if (recallResult === 'EASY' || recallResult === 'STRUGGLED') {
        await this.evaluateAndTransition(userId, problemId, 'QUALIFICATION_MET');
      }
    } catch (err) {
      console.error(`[MASTERY_POST_REVIEW_ERROR] User: ${userId}, Problem: ${problemId}:`, err);
    }
  }
}

export const masteryService = new MasteryService();
