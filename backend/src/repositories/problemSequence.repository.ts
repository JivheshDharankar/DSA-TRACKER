import mongoose from 'mongoose';
import { ProblemSequence } from '../models/ProblemSequence.model.js';
import { ProblemSection } from '../models/Problem.model.js';

export interface IProblemSequenceRepository {
  getNextSNo(userId: string, section: ProblemSection): Promise<number>;
}

export class ProblemSequenceRepository implements IProblemSequenceRepository {
  /**
   * Atomically increments and returns the next sequential display number (S.No.)
   * scoped strictly by (userId, section).
   */
  async getNextSNo(userId: string, section: ProblemSection): Promise<number> {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const sequenceDoc = await ProblemSequence.findOneAndUpdate(
      { userId: userObjectId, section },
      { $inc: { nextSNo: 1 } },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: false,
      }
    );

    return sequenceDoc.nextSNo;
  }
}

export const problemSequenceRepository = new ProblemSequenceRepository();
