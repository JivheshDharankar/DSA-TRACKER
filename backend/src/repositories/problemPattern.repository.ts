import mongoose from 'mongoose';
import {
  ProblemPattern,
  IProblemPatternDocument,
  PatternConfidence,
} from '../models/ProblemPattern.model.js';

export interface IProblemPatternRepository {
  create(data: {
    userId: string;
    problemId: string;
    patternId: string;
    confidence?: PatternConfidence;
    isPrimary?: boolean;
  }): Promise<IProblemPatternDocument>;
  delete(userId: string, problemId: string, patternId: string): Promise<boolean>;
  deleteByProblem(userId: string, problemId: string, session?: mongoose.ClientSession): Promise<number>;
  findByProblem(userId: string, problemId: string): Promise<IProblemPatternDocument[]>;
  findByPattern(userId: string, patternId: string): Promise<IProblemPatternDocument[]>;
  findByUser(userId: string): Promise<IProblemPatternDocument[]>;
  syncPatternsForProblem(
    userId: string,
    problemId: string,
    patterns: Array<{ patternId: string; confidence?: PatternConfidence; isPrimary?: boolean }>
  ): Promise<IProblemPatternDocument[]>;
}

export class ProblemPatternRepository implements IProblemPatternRepository {
  async create(data: {
    userId: string;
    problemId: string;
    patternId: string;
    confidence?: PatternConfidence;
    isPrimary?: boolean;
  }): Promise<IProblemPatternDocument> {
    return ProblemPattern.create({
      userId: new mongoose.Types.ObjectId(data.userId),
      problemId: new mongoose.Types.ObjectId(data.problemId),
      patternId: new mongoose.Types.ObjectId(data.patternId),
      confidence: data.confidence || 'MEDIUM',
      isPrimary: data.isPrimary ?? false,
    });
  }

  async delete(userId: string, problemId: string, patternId: string): Promise<boolean> {
    if (
      !mongoose.Types.ObjectId.isValid(problemId) ||
      !mongoose.Types.ObjectId.isValid(patternId)
    ) {
      return false;
    }
    const result = await ProblemPattern.deleteOne({
      userId: new mongoose.Types.ObjectId(userId),
      problemId: new mongoose.Types.ObjectId(problemId),
      patternId: new mongoose.Types.ObjectId(patternId),
    });
    return result.deletedCount === 1;
  }

  async deleteByProblem(
    userId: string,
    problemId: string,
    session?: mongoose.ClientSession
  ): Promise<number> {
    if (!mongoose.Types.ObjectId.isValid(problemId)) {
      return 0;
    }
    const result = await ProblemPattern.deleteMany(
      {
        userId: new mongoose.Types.ObjectId(userId),
        problemId: new mongoose.Types.ObjectId(problemId),
      },
      { session }
    );
    return result.deletedCount;
  }

  async findByProblem(userId: string, problemId: string): Promise<IProblemPatternDocument[]> {
    if (!mongoose.Types.ObjectId.isValid(problemId)) {
      return [];
    }
    return ProblemPattern.find({
      userId: new mongoose.Types.ObjectId(userId),
      problemId: new mongoose.Types.ObjectId(problemId),
    }).populate('patternId');
  }

  async findByPattern(userId: string, patternId: string): Promise<IProblemPatternDocument[]> {
    if (!mongoose.Types.ObjectId.isValid(patternId)) {
      return [];
    }
    return ProblemPattern.find({
      userId: new mongoose.Types.ObjectId(userId),
      patternId: new mongoose.Types.ObjectId(patternId),
    }).populate('problemId');
  }

  async findByUser(userId: string): Promise<IProblemPatternDocument[]> {
    return ProblemPattern.find({
      userId: new mongoose.Types.ObjectId(userId),
    }).populate('patternId');
  }

  async syncPatternsForProblem(
    userId: string,
    problemId: string,
    patterns: Array<{ patternId: string; confidence?: PatternConfidence; isPrimary?: boolean }>
  ): Promise<IProblemPatternDocument[]> {
    if (!mongoose.Types.ObjectId.isValid(problemId)) {
      return [];
    }

    const uId = new mongoose.Types.ObjectId(userId);
    const pId = new mongoose.Types.ObjectId(problemId);

    // Delete existing associations
    await ProblemPattern.deleteMany({ userId: uId, problemId: pId });

    if (patterns.length === 0) {
      return [];
    }

    // Insert new associations
    const docsToInsert = patterns.map((p) => ({
      userId: uId,
      problemId: pId,
      patternId: new mongoose.Types.ObjectId(p.patternId),
      confidence: p.confidence || 'MEDIUM',
      isPrimary: p.isPrimary ?? false,
    }));

    await ProblemPattern.insertMany(docsToInsert);
    return this.findByProblem(userId, problemId);
  }
}

export const problemPatternRepository = new ProblemPatternRepository();
