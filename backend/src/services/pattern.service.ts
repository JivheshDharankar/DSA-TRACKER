import mongoose from 'mongoose';
import { IPatternDocument } from '../models/Pattern.model.js';
import { IProblemPatternDocument, PatternConfidence } from '../models/ProblemPattern.model.js';
import { patternRepository, IPatternRepository } from '../repositories/pattern.repository.js';
import {
  problemPatternRepository,
  IProblemPatternRepository,
} from '../repositories/problemPattern.repository.js';
import { problemRepository, IProblemRepository } from '../repositories/problem.repository.js';
import { RevisionHistory } from '../models/RevisionHistory.model.js';
import {
  PatternMasteryCalculator,
  PatternMasteryResult,
  ProblemSummaryForMastery,
  ReviewSummaryForMastery,
} from './patternMasteryCalculator.js';
import { AppError } from '../middleware/error.middleware.js';
import { AttachPatternInput } from '../validators/pattern.validator.js';

export interface PatternWithMastery {
  id: string;
  name: string;
  slug: string;
  description: string;
  recognitionSignals: string[];
  commonMistakes: string[];
  prerequisites: string[];
  mastery: PatternMasteryResult;
}

export interface PatternDetailWithMastery {
  pattern: IPatternDocument;
  mastery: PatternMasteryResult;
  associatedProblems: Array<{
    problem: {
      id: string;
      sNo: number;
      title: string;
      section: string;
      difficulty: string;
      status: string;
      retentionLevel: string;
      nextReviewDate: Date;
    };
    confidence: PatternConfidence;
    isPrimary: boolean;
  }>;
}

export class PatternService {
  constructor(
    private readonly patternRepo: IPatternRepository = patternRepository,
    private readonly problemPatternRepo: IProblemPatternRepository = problemPatternRepository,
    private readonly problemRepo: IProblemRepository = problemRepository
  ) {}

  /**
   * Retrieves all global patterns enriched with the authenticated user's calculated mastery.
   */
  async getPatternsWithMastery(
    userId: string,
    search?: string
  ): Promise<PatternWithMastery[]> {
    const allPatterns = await this.patternRepo.findAll();
    const userProblemPatterns = await this.problemPatternRepo.findByUser(userId);

    // Group problem IDs by pattern ID
    const patternProblemMap = new Map<string, string[]>();
    const allUserProblemIds = new Set<string>();

    for (const pp of userProblemPatterns) {
      const patId = (pp.patternId as unknown as { _id?: mongoose.Types.ObjectId })?._id
        ? (pp.patternId as unknown as { _id: mongoose.Types.ObjectId })._id.toString()
        : pp.patternId
        ? pp.patternId.toString()
        : '';
      const probId = (pp.problemId as unknown as { _id?: mongoose.Types.ObjectId })?._id
        ? (pp.problemId as unknown as { _id: mongoose.Types.ObjectId })._id.toString()
        : pp.problemId
        ? pp.problemId.toString()
        : '';
      if (patId && probId) {
        if (!patternProblemMap.has(patId)) {
          patternProblemMap.set(patId, []);
        }
        patternProblemMap.get(patId)!.push(probId);
        allUserProblemIds.add(probId);
      }
    }

    // Fetch problem statuses for all referenced problems
    const problemSummariesMap = new Map<string, ProblemSummaryForMastery>();
    if (allUserProblemIds.size > 0) {
      const problems = await this.problemRepo.find(
        {
          _id: { $in: Array.from(allUserProblemIds).map((id) => new mongoose.Types.ObjectId(id)) },
          userId: new mongoose.Types.ObjectId(userId),
        },
        {},
        0,
        10000
      );
      for (const p of problems) {
        problemSummariesMap.set(p._id.toString(), {
          id: p._id.toString(),
          status: p.status,
        });
      }
    }

    // Fetch revision histories for all referenced problems
    const problemReviewsMap = new Map<string, ReviewSummaryForMastery[]>();
    if (allUserProblemIds.size > 0) {
      const reviews = await RevisionHistory.find({
        userId: new mongoose.Types.ObjectId(userId),
        problemId: { $in: Array.from(allUserProblemIds).map((id) => new mongoose.Types.ObjectId(id)) },
      });
      for (const r of reviews) {
        const pId = r.problemId.toString();
        if (!problemReviewsMap.has(pId)) {
          problemReviewsMap.set(pId, []);
        }
        problemReviewsMap.get(pId)!.push({
          problemId: pId,
          recallResult: r.recallResult,
          coldSolve: r.coldSolve,
          reviewedAt: r.reviewedAt,
        });
      }
    }

    // Compute mastery for each pattern
    const results: PatternWithMastery[] = allPatterns.map((pattern) => {
      const patId = pattern._id.toString();
      const associatedProblemIds = patternProblemMap.get(patId) || [];

      const patternProblems: ProblemSummaryForMastery[] = [];
      const patternReviews: ReviewSummaryForMastery[] = [];

      for (const probId of associatedProblemIds) {
        const probSummary = problemSummariesMap.get(probId);
        if (probSummary) {
          patternProblems.push(probSummary);
        }
        const probReviews = problemReviewsMap.get(probId) || [];
        patternReviews.push(...probReviews);
      }

      const mastery = PatternMasteryCalculator.calculate(patternProblems, patternReviews);

      return {
        id: pattern._id.toString(),
        name: pattern.name,
        slug: pattern.slug,
        description: pattern.description,
        recognitionSignals: pattern.recognitionSignals,
        commonMistakes: pattern.commonMistakes,
        prerequisites: pattern.prerequisites,
        mastery,
      };
    });

    // Optional search filtering
    if (search && search.trim().length > 0) {
      const q = search.trim().toLowerCase();
      return results.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.recognitionSignals.some((s) => s.toLowerCase().includes(q)) ||
          p.prerequisites.some((pre) => pre.toLowerCase().includes(q))
      );
    }

    return results;
  }

  /**
   * Retrieves full details for a single pattern with user mastery breakdown and associated problems list.
   */
  async getPatternDetail(
    userId: string,
    patternIdOrSlug: string
  ): Promise<PatternDetailWithMastery> {
    let pattern: IPatternDocument | null = null;
    if (mongoose.Types.ObjectId.isValid(patternIdOrSlug)) {
      pattern = await this.patternRepo.findById(patternIdOrSlug);
    }
    if (!pattern) {
      pattern = await this.patternRepo.findBySlug(patternIdOrSlug);
    }

    if (!pattern) {
      throw new AppError('Pattern not found.', 404, 'NOT_FOUND');
    }

    const patternId = pattern._id.toString();
    const problemPatterns = await this.problemPatternRepo.findByPattern(userId, patternId);

    const problemIds = problemPatterns
      .map((pp) => (pp.problemId as unknown as { _id?: mongoose.Types.ObjectId })?._id?.toString() || pp.problemId?.toString())
      .filter(Boolean);

    // Fetch problem details & revision histories
    const problems = await this.problemRepo.find(
      {
        _id: { $in: problemIds.map((id) => new mongoose.Types.ObjectId(id)) },
        userId: new mongoose.Types.ObjectId(userId),
      },
      { sNo: 1 },
      0,
      1000
    );

    const problemSummaries: ProblemSummaryForMastery[] = problems.map((p) => ({
      id: p._id.toString(),
      status: p.status,
    }));

    const reviews = await RevisionHistory.find({
      userId: new mongoose.Types.ObjectId(userId),
      problemId: { $in: problemIds.map((id) => new mongoose.Types.ObjectId(id)) },
    });

    const reviewSummaries: ReviewSummaryForMastery[] = reviews.map((r) => ({
      problemId: r.problemId.toString(),
      recallResult: r.recallResult,
      coldSolve: r.coldSolve,
      reviewedAt: r.reviewedAt,
    }));

    const mastery = PatternMasteryCalculator.calculate(problemSummaries, reviewSummaries);

    // Map associated problems with confidence & primary status
    const problemMap = new Map(problems.map((p) => [p._id.toString(), p]));
    const associatedProblems = problemPatterns
      .map((pp) => {
        const pId = (pp.problemId as unknown as { _id?: mongoose.Types.ObjectId })?._id?.toString() || pp.problemId?.toString();
        const p = problemMap.get(pId);
        if (!p) return null;
        return {
          problem: {
            id: p._id.toString(),
            sNo: p.sNo,
            title: p.title,
            section: p.section,
            difficulty: p.difficulty,
            status: p.status,
            retentionLevel: p.retentionLevel,
            nextReviewDate: p.nextReviewDate,
          },
          confidence: pp.confidence,
          isPrimary: pp.isPrimary,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return {
      pattern,
      mastery,
      associatedProblems,
    };
  }

  /**
   * Retrieves all patterns attached to a specific problem owned by the user.
   */
  async getPatternsForProblem(
    userId: string,
    problemId: string
  ): Promise<Array<{ id: string; pattern: IPatternDocument; confidence: PatternConfidence; isPrimary: boolean }>> {
    // Validate problem ownership
    const problem = await this.problemRepo.findById(problemId, userId);
    if (!problem) {
      throw new AppError('Problem not found.', 404, 'NOT_FOUND');
    }

    const problemPatterns = await this.problemPatternRepo.findByProblem(userId, problemId);

    return problemPatterns
      .filter((pp) => pp.patternId)
      .map((pp) => ({
        id: pp._id.toString(),
        pattern: pp.patternId as unknown as IPatternDocument,
        confidence: pp.confidence,
        isPrimary: pp.isPrimary,
      }));
  }

  /**
   * Attaches a pattern to a user's problem.
   */
  async attachPattern(
    userId: string,
    problemId: string,
    input: AttachPatternInput
  ): Promise<IProblemPatternDocument> {
    // Validate problem ownership
    const problem = await this.problemRepo.findById(problemId, userId);
    if (!problem) {
      throw new AppError('Problem not found.', 404, 'NOT_FOUND');
    }

    // Validate pattern exists
    const pattern = await this.patternRepo.findById(input.patternId);
    if (!pattern) {
      throw new AppError('Pattern not found.', 404, 'NOT_FOUND');
    }

    try {
      const created = await this.problemPatternRepo.create({
        userId,
        problemId,
        patternId: input.patternId,
        confidence: input.confidence,
        isPrimary: input.isPrimary,
      });
      return created;
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: number }).code === 11000) {
        throw new AppError('Pattern is already attached to this problem.', 409, 'DUPLICATE_RESOURCE');
      }
      throw err;
    }
  }

  /**
   * Detaches a pattern from a user's problem.
   */
  async detachPattern(userId: string, problemId: string, patternId: string): Promise<void> {
    // Validate problem ownership
    const problem = await this.problemRepo.findById(problemId, userId);
    if (!problem) {
      throw new AppError('Problem not found.', 404, 'NOT_FOUND');
    }

    const deleted = await this.problemPatternRepo.delete(userId, problemId, patternId);
    if (!deleted) {
      throw new AppError('Pattern attachment not found.', 404, 'NOT_FOUND');
    }
  }

  /**
   * Replaces/syncs all pattern associations for a problem in a single operation.
   */
  async syncPatterns(
    userId: string,
    problemId: string,
    patterns: Array<{ patternId: string; confidence?: PatternConfidence; isPrimary?: boolean }>
  ): Promise<IProblemPatternDocument[]> {
    // Validate problem ownership
    const problem = await this.problemRepo.findById(problemId, userId);
    if (!problem) {
      throw new AppError('Problem not found.', 404, 'NOT_FOUND');
    }

    return this.problemPatternRepo.syncPatternsForProblem(userId, problemId, patterns);
  }
}

export const patternService = new PatternService();
