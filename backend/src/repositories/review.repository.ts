import mongoose from 'mongoose';
import {
  RevisionHistory,
  IRevisionHistory,
  IRevisionHistoryDocument,
} from '../models/RevisionHistory.model.js';

export interface IReviewRepository {
  create(data: Partial<IRevisionHistory>): Promise<IRevisionHistoryDocument>;
  findByProblemId(
    problemId: string,
    userId: string,
    skip?: number,
    limit?: number
  ): Promise<IRevisionHistoryDocument[]>;
  countByProblemId(problemId: string, userId: string): Promise<number>;
  findUserHistory(
    userId: string,
    skip?: number,
    limit?: number
  ): Promise<IRevisionHistoryDocument[]>;
  countUserHistory(userId: string): Promise<number>;
  deleteByProblem(userId: string, problemId: string, session?: mongoose.ClientSession): Promise<number>;
}

export class ReviewRepository implements IReviewRepository {
  async create(data: Partial<IRevisionHistory>): Promise<IRevisionHistoryDocument> {
    return RevisionHistory.create(data);
  }

  async findByProblemId(
    problemId: string,
    userId: string,
    skip: number = 0,
    limit: number = 50
  ): Promise<IRevisionHistoryDocument[]> {
    if (!mongoose.Types.ObjectId.isValid(problemId)) {
      return [];
    }
    return RevisionHistory.find({
      problemId: new mongoose.Types.ObjectId(problemId),
      userId: new mongoose.Types.ObjectId(userId),
    })
      .sort({ reviewedAt: -1 })
      .skip(skip)
      .limit(limit);
  }

  async countByProblemId(problemId: string, userId: string): Promise<number> {
    if (!mongoose.Types.ObjectId.isValid(problemId)) {
      return 0;
    }
    return RevisionHistory.countDocuments({
      problemId: new mongoose.Types.ObjectId(problemId),
      userId: new mongoose.Types.ObjectId(userId),
    });
  }

  async findUserHistory(
    userId: string,
    skip: number = 0,
    limit: number = 50
  ): Promise<IRevisionHistoryDocument[]> {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return [];
    }
    return RevisionHistory.find({
      userId: new mongoose.Types.ObjectId(userId),
    })
      .populate('problemId', 'title sNo section difficulty topic')
      .sort({ reviewedAt: -1 })
      .skip(skip)
      .limit(limit);
  }

  async countUserHistory(userId: string): Promise<number> {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return 0;
    }
    return RevisionHistory.countDocuments({
      userId: new mongoose.Types.ObjectId(userId),
    });
  }

  async deleteByProblem(
    userId: string,
    problemId: string,
    session?: mongoose.ClientSession
  ): Promise<number> {
    if (!mongoose.Types.ObjectId.isValid(problemId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return 0;
    }
    const result = await RevisionHistory.deleteMany(
      {
        problemId: new mongoose.Types.ObjectId(problemId),
        userId: new mongoose.Types.ObjectId(userId),
      },
      { session }
    );
    return result.deletedCount;
  }
}

export const reviewRepository = new ReviewRepository();
