import mongoose, { FilterQuery } from 'mongoose';
import { IProblemDocument, ProblemSource } from '../models/Problem.model.js';
import { problemRepository, IProblemRepository } from '../repositories/problem.repository.js';
import {
  problemSequenceRepository,
  IProblemSequenceRepository,
} from '../repositories/problemSequence.repository.js';
import {
  problemPatternRepository,
  IProblemPatternRepository,
} from '../repositories/problemPattern.repository.js';
import { reviewRepository, IReviewRepository } from '../repositories/review.repository.js';
import {
  masteryEventRepository,
  IMasteryEventRepository,
} from '../repositories/masteryEvent.repository.js';
import {
  CreateProblemInput,
  UpdateProblemInput,
  ListProblemsQuery,
} from '../validators/problem.validator.js';
import { AppError } from '../middleware/error.middleware.js';
import { escapeRegex } from '../utils/regex.util.js';

export interface PaginatedProblemsResponse {
  items: IProblemDocument[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface MongoTopologyDescription {
  type?: string;
  setName?: string;
}

interface MongoConnectionWithTopology {
  client?: {
    topology?: {
      description?: MongoTopologyDescription;
    };
  };
}

export function supportsTransactions(): boolean {
  const conn = mongoose.connection as unknown as MongoConnectionWithTopology;
  const topology = conn?.client?.topology;
  const desc = topology?.description;
  if (!desc) return false;
  return desc.type === 'ReplicaSetWithPrimary' || desc.type === 'Sharded' || Boolean(desc.setName);
}

export class ProblemService {
  constructor(
    private readonly problemRepo: IProblemRepository = problemRepository,
    private readonly seqRepo: IProblemSequenceRepository = problemSequenceRepository,
    private readonly patternRepo: IProblemPatternRepository = problemPatternRepository,
    private readonly reviewRepo: IReviewRepository = reviewRepository,
    private readonly masteryEventRepo: IMasteryEventRepository = masteryEventRepository
  ) {}

  /**
   * Creates a new problem with an atomically allocated S.No., optional dual links, and Day 0 spaced repetition state.
   * Uses native MongoDB replica-set transactions when available. In standalone environments, uses atomic sequence
   * allocation with conditional rollback on creation failure.
   */
  async createProblem(userId: string, input: CreateProblemInput): Promise<IProblemDocument> {
    const creationTime = new Date();
    const problemData = {
      userId: new mongoose.Types.ObjectId(userId),
      section: input.section,
      title: input.title,
      collegeLink: input.collegeLink ?? null,
      leetcodeLink: input.leetcodeLink ?? null,
      leetcodeNumber: input.leetcodeNumber ?? null,
      topic: input.topic,
      difficulty: input.difficulty,
      source: input.source as ProblemSource,
      dateLearned: input.dateLearned ?? creationTime,
      status: input.status,
      retentionLevel: input.retentionLevel,
      notes: input.notes ?? '',
      repetitionStage: 0,
      intervalDays: 0,
      nextReviewDate: creationTime,
      lastReviewedAt: null,
      recoveryStage: null,
    };

    if (supportsTransactions()) {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        const sNo = await this.seqRepo.getNextSNo(userId, input.section, session);
        const problem = await this.problemRepo.create({ ...problemData, sNo }, session);
        await session.commitTransaction();
        return problem;
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        await session.endSession();
      }
    }

    // Standalone fallback: atomic $inc + conditional rollback
    const sNo = await this.seqRepo.getNextSNo(userId, input.section);
    try {
      const problem = await this.problemRepo.create({ ...problemData, sNo });
      return problem;
    } catch (error) {
      await this.seqRepo.rollbackIfLatest(userId, input.section, sNo).catch(() => {
        // Suppress rollback failure to preserve root problem creation error
      });
      throw error;
    }
  }

  /**
   * Lists problems owned by the authenticated user with filtering, search, sorting, and pagination.
   */
  async getProblems(userId: string, query: ListProblemsQuery): Promise<PaginatedProblemsResponse> {
    const filter: FilterQuery<IProblemDocument> = {
      userId: new mongoose.Types.ObjectId(userId),
    };

    if (query.section) {
      filter.section = query.section;
    }

    if (query.topic) {
      const escapedTopic = escapeRegex(query.topic);
      filter.topic = { $regex: escapedTopic, $options: 'i' };
    }

    if (query.difficulty) {
      filter.difficulty = query.difficulty;
    }

    if (query.source) {
      filter.source = query.source;
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.retentionLevel) {
      filter.retentionLevel = query.retentionLevel;
    }

    if (query.masteryStatus) {
      filter.masteryStatus = query.masteryStatus;
    }

    if (query.search) {
      const escapedSearch = escapeRegex(query.search);
      filter.$or = [
        { title: { $regex: escapedSearch, $options: 'i' } },
        { topic: { $regex: escapedSearch, $options: 'i' } },
      ];
    }

    // Allowlisted sorting
    const sortField = query.sortBy || 'sNo';
    const sortDirection = query.sortOrder === 'desc' ? -1 : 1;
    const sort: Record<string, 1 | -1> = { [sortField]: sortDirection };

    const page = Math.max(1, query.page);
    const limit = Math.min(100, Math.max(1, query.limit));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.problemRepo.find(filter, sort, skip, limit),
      this.problemRepo.count(filter),
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
   * Retrieves a single problem ensuring ownership validation.
   */
  async getProblemById(userId: string, problemId: string): Promise<IProblemDocument> {
    const problem = await this.problemRepo.findById(problemId, userId);
    if (!problem) {
      // Safe generic 404 that never leaks existence of another user's problem
      throw new AppError('Problem not found.', 404, 'NOT_FOUND');
    }
    return problem;
  }

  /**
   * Updates problem fields while strictly protecting userId, sNo, and section immutability.
   */
  async updateProblem(
    userId: string,
    problemId: string,
    input: UpdateProblemInput
  ): Promise<IProblemDocument> {
    const updatePayload: Record<string, unknown> = { ...input };
    if (input.source) {
      updatePayload['source'] = input.source as ProblemSource;
    }

    const updatedProblem = await this.problemRepo.update(problemId, userId, updatePayload);
    if (!updatedProblem) {
      throw new AppError('Problem not found.', 404, 'NOT_FOUND');
    }
    return updatedProblem;
  }

  /**
   * Deletes a problem and cascades cleanup of all related ProblemPattern,
   * RevisionHistory, and MasteryEvent records scoped strictly by userId and problemId.
   */
  async deleteProblem(userId: string, problemId: string): Promise<void> {
    // 1. Verify existence and ownership strictly first
    const problem = await this.problemRepo.findById(problemId, userId);
    if (!problem) {
      throw new AppError('Problem not found.', 404, 'NOT_FOUND');
    }

    if (supportsTransactions()) {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        await this.patternRepo.deleteByProblem(userId, problemId, session);
        await this.reviewRepo.deleteByProblem(userId, problemId, session);
        await this.masteryEventRepo.deleteByProblem(userId, problemId, session);
        const deleted = await this.problemRepo.delete(problemId, userId, session);
        if (!deleted) {
          throw new AppError('Problem not found.', 404, 'NOT_FOUND');
        }
        await session.commitTransaction();
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        await session.endSession();
      }
      return;
    }

    // Standalone fallback: Reliable ordered cleanup (child dependencies first, then parent)
    await this.patternRepo.deleteByProblem(userId, problemId);
    await this.reviewRepo.deleteByProblem(userId, problemId);
    await this.masteryEventRepo.deleteByProblem(userId, problemId);
    const deleted = await this.problemRepo.delete(problemId, userId);
    if (!deleted) {
      throw new AppError('Problem not found.', 404, 'NOT_FOUND');
    }
  }
}

export const problemService = new ProblemService();
