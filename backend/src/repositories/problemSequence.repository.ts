import mongoose from 'mongoose';
import { ProblemSequence } from '../models/ProblemSequence.model.js';
import { ProblemSection } from '../models/Problem.model.js';

export interface IProblemSequenceRepository {
  getNextSNo(userId: string, section: ProblemSection, session?: mongoose.ClientSession): Promise<number>;
  rollbackIfLatest(
    userId: string,
    section: ProblemSection,
    allocatedSNo: number,
    session?: mongoose.ClientSession
  ): Promise<boolean>;
}

export class ProblemSequenceRepository implements IProblemSequenceRepository {
  /**
   * Atomically increments and returns the next sequential display number (S.No.)
   * scoped strictly by (userId, section).
   */
  async getNextSNo(
    userId: string,
    section: ProblemSection,
    session?: mongoose.ClientSession
  ): Promise<number> {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const sequenceDoc = await ProblemSequence.findOneAndUpdate(
      { userId: userObjectId, section },
      { $inc: { nextSNo: 1 } },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: false,
        session,
      }
    );

    return sequenceDoc.nextSNo;
  }

  /**
   * Conditionally rolls back an allocated S.No. if it is still the latest allocated number
   * and no concurrent operation has advanced the sequence counter.
   */
  async rollbackIfLatest(
    userId: string,
    section: ProblemSection,
    allocatedSNo: number,
    session?: mongoose.ClientSession
  ): Promise<boolean> {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    if (allocatedSNo <= 1) {
      const deleteResult = await ProblemSequence.deleteOne(
        { userId: userObjectId, section, nextSNo: allocatedSNo },
        { session }
      );
      return (deleteResult.deletedCount ?? 0) > 0;
    }

    const updatedDoc = await ProblemSequence.findOneAndUpdate(
      { userId: userObjectId, section, nextSNo: allocatedSNo },
      { $inc: { nextSNo: -1 } },
      { session, new: true }
    );

    return Boolean(updatedDoc);
  }
}

export const problemSequenceRepository = new ProblemSequenceRepository();
