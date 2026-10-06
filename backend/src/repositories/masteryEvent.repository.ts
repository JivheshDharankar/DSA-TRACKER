import mongoose from 'mongoose';
import { MasteryEvent, IMasteryEventDocument, IMasteryEvent } from '../models/MasteryEvent.model.js';

export interface IMasteryEventRepository {
  create(data: Partial<IMasteryEvent>): Promise<IMasteryEventDocument>;
  findByProblemId(userId: string, problemId: string): Promise<IMasteryEventDocument[]>;
  deleteByProblem(userId: string, problemId: string, session?: mongoose.ClientSession): Promise<number>;
}

export class MasteryEventRepository implements IMasteryEventRepository {
  async create(data: Partial<IMasteryEvent>): Promise<IMasteryEventDocument> {
    return MasteryEvent.create(data);
  }

  async findByProblemId(userId: string, problemId: string): Promise<IMasteryEventDocument[]> {
    if (!mongoose.Types.ObjectId.isValid(problemId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return [];
    }
    return MasteryEvent.find({
      problemId: new mongoose.Types.ObjectId(problemId),
      userId: new mongoose.Types.ObjectId(userId),
    }).sort({ occurredAt: -1 });
  }

  async deleteByProblem(
    userId: string,
    problemId: string,
    session?: mongoose.ClientSession
  ): Promise<number> {
    if (!mongoose.Types.ObjectId.isValid(problemId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return 0;
    }
    const result = await MasteryEvent.deleteMany(
      {
        problemId: new mongoose.Types.ObjectId(problemId),
        userId: new mongoose.Types.ObjectId(userId),
      },
      { session }
    );
    return result.deletedCount;
  }
}

export const masteryEventRepository = new MasteryEventRepository();
