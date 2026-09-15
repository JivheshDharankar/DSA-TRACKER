import mongoose, { FilterQuery } from 'mongoose';
import { IProblemDocument, ProblemSource } from '../models/Problem.model.js';
import { problemRepository, IProblemRepository } from '../repositories/problem.repository.js';
import {
  problemSequenceRepository,
  IProblemSequenceRepository,
} from '../repositories/problemSequence.repository.js';
import {
  CreateProblemInput,
  UpdateProblemInput,
  ListProblemsQuery,
} from '../validators/problem.validator.js';
import { AppError } from '../middleware/error.middleware.js';

export interface PaginatedProblemsResponse {
  items: IProblemDocument[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class ProblemService {
  constructor(
    private readonly problemRepo: IProblemRepository = problemRepository,
    private readonly seqRepo: IProblemSequenceRepository = problemSequenceRepository
  ) {}

  /**
   * Creates a new problem with an atomically allocated S.No., optional dual links, and Day 0 spaced repetition state.
   */
  async createProblem(userId: string, input: CreateProblemInput): Promise<IProblemDocument> {
    const sNo = await this.seqRepo.getNextSNo(userId, input.section);
    const creationTime = new Date();

    const problem = await this.problemRepo.create({
      userId: new mongoose.Types.ObjectId(userId),
      section: input.section,
      sNo,
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
    });

    return problem;
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
      filter.topic = { $regex: query.topic, $options: 'i' };
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
      const escapedSearch = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
   * Deletes a problem without renumbering existing problems or decrementing sequences.
   */
  async deleteProblem(userId: string, problemId: string): Promise<void> {
    const deleted = await this.problemRepo.delete(problemId, userId);
    if (!deleted) {
      throw new AppError('Problem not found.', 404, 'NOT_FOUND');
    }
    // Also clean up any pattern associations
    const { problemPatternRepository } = await import('../repositories/problemPattern.repository.js');
    await problemPatternRepository.deleteByProblem(userId, problemId);
  }
}

export const problemService = new ProblemService();
