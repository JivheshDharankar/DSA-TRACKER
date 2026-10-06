import mongoose, { FilterQuery } from 'mongoose';
import { Problem, IProblem, IProblemDocument } from '../models/Problem.model.js';

export interface IProblemRepository {
  create(data: Partial<IProblem>, session?: mongoose.ClientSession): Promise<IProblemDocument>;
  findById(id: string, userId: string): Promise<IProblemDocument | null>;
  find(
    filter: FilterQuery<IProblemDocument>,
    sort: Record<string, 1 | -1>,
    skip: number,
    limit: number
  ): Promise<IProblemDocument[]>;
  count(filter: FilterQuery<IProblemDocument>): Promise<number>;
  update(
    id: string,
    userId: string,
    updateData: Partial<IProblem>
  ): Promise<IProblemDocument | null>;
  updateWithCondition(
    id: string,
    userId: string,
    condition: FilterQuery<IProblemDocument>,
    updateData: Partial<IProblem>
  ): Promise<IProblemDocument | null>;
  findDue(
    userId: string,
    section?: string,
    skip?: number,
    limit?: number
  ): Promise<IProblemDocument[]>;
  countDue(userId: string, section?: string): Promise<number>;
  delete(id: string, userId: string, session?: mongoose.ClientSession): Promise<boolean>;
}

export class ProblemRepository implements IProblemRepository {
  async create(data: Partial<IProblem>, session?: mongoose.ClientSession): Promise<IProblemDocument> {
    if (session) {
      const [created] = await Problem.create([data], { session });
      return created!;
    }
    return Problem.create(data);
  }

  async findById(id: string, userId: string): Promise<IProblemDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    return Problem.findOne({
      _id: new mongoose.Types.ObjectId(id),
      userId: new mongoose.Types.ObjectId(userId),
    });
  }

  async find(
    filter: FilterQuery<IProblemDocument>,
    sort: Record<string, 1 | -1>,
    skip: number,
    limit: number
  ): Promise<IProblemDocument[]> {
    return Problem.find(filter).sort(sort).skip(skip).limit(limit);
  }

  async count(filter: FilterQuery<IProblemDocument>): Promise<number> {
    return Problem.countDocuments(filter);
  }

  async update(
    id: string,
    userId: string,
    updateData: Partial<IProblem>
  ): Promise<IProblemDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    return Problem.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(id),
        userId: new mongoose.Types.ObjectId(userId),
      },
      { $set: updateData },
      { new: true, runValidators: true }
    );
  }

  async updateWithCondition(
    id: string,
    userId: string,
    condition: FilterQuery<IProblemDocument>,
    updateData: Partial<IProblem>
  ): Promise<IProblemDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    return Problem.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(id),
        userId: new mongoose.Types.ObjectId(userId),
        ...condition,
      },
      { $set: updateData },
      { new: true, runValidators: true }
    );
  }

  async findDue(
    userId: string,
    section?: string,
    skip: number = 0,
    limit: number = 20
  ): Promise<IProblemDocument[]> {
    const filter: FilterQuery<IProblemDocument> = {
      userId: new mongoose.Types.ObjectId(userId),
      nextReviewDate: { $lte: new Date() },
    };
    if (section) {
      filter.section = section;
    }
    // Most overdue first (ascending nextReviewDate), with S.No. tiebreaker
    return Problem.find(filter)
      .sort({ nextReviewDate: 1, sNo: 1 })
      .skip(skip)
      .limit(limit);
  }

  async countDue(userId: string, section?: string): Promise<number> {
    const filter: FilterQuery<IProblemDocument> = {
      userId: new mongoose.Types.ObjectId(userId),
      nextReviewDate: { $lte: new Date() },
    };
    if (section) {
      filter.section = section;
    }
    return Problem.countDocuments(filter);
  }

  async delete(id: string, userId: string, session?: mongoose.ClientSession): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return false;
    }
    const result = await Problem.deleteOne(
      {
        _id: new mongoose.Types.ObjectId(id),
        userId: new mongoose.Types.ObjectId(userId),
      },
      { session }
    );
    return result.deletedCount === 1;
  }
}

export const problemRepository = new ProblemRepository();

