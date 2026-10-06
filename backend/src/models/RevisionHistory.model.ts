import mongoose, { Document, Model, Schema } from 'mongoose';
import { ProblemRetention } from './Problem.model.js';

export type RecallResultType = 'EASY' | 'STRUGGLED' | 'HINT' | 'FORGOT';
export type TimingStatusType = 'EARLY' | 'ON_TIME' | 'LATE';

export interface IRevisionHistory {
  userId: mongoose.Types.ObjectId;
  problemId: mongoose.Types.ObjectId;
  reviewedAt: Date;
  scheduledReviewAt: Date;
  recallResult: RecallResultType;
  timingStatus: TimingStatusType;
  latenessDays: number; // Non-negative calendar-day difference
  previousStage: number;
  newStage: number;
  previousIntervalDays: number;
  newIntervalDays: number;
  previousRetention: ProblemRetention;
  newRetention: ProblemRetention;
  previousNextReviewDate: Date;
  newNextReviewDate: Date;
  timeSpentSeconds?: number | null;
  coldSolve?: boolean | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRevisionHistoryDocument extends IRevisionHistory, Document {
  _id: mongoose.Types.ObjectId;
}

interface MongooseDocWithPopulated {
  populated?: (path: string) => unknown;
}

export function transformRevisionHistory(
  doc: unknown,
  ret: Record<string, unknown>
): Record<string, unknown> {
  ret['id'] = ret['_id']?.toString();
  ret['userId'] = ret['userId']?.toString();

  if (ret['problemId'] && typeof ret['problemId'] === 'object') {
    const populatedProblem = ret['problemId'] as Record<string, unknown>;
    const problemIdStr = (populatedProblem['_id'] || populatedProblem['id'])?.toString();
    ret['problemId'] = problemIdStr;
    ret['problem'] = {
      id: problemIdStr,
      _id: problemIdStr,
      title: populatedProblem['title'],
      sNo: populatedProblem['sNo'],
      section: populatedProblem['section'],
      difficulty: populatedProblem['difficulty'],
      topic: populatedProblem['topic'],
    };
  } else if (
    doc &&
    typeof (doc as MongooseDocWithPopulated).populated === 'function' &&
    (doc as MongooseDocWithPopulated).populated?.('problemId')
  ) {
    ret['problemId'] = (doc as MongooseDocWithPopulated).populated?.('problemId')?.toString() || null;
    ret['problem'] = null;
  } else if (ret['problemId']) {
    ret['problemId'] = ret['problemId']?.toString();
  }

  delete ret['_id'];
  delete ret['__v'];
  return ret;
}

const revisionHistorySchema = new Schema<IRevisionHistoryDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    problemId: {
      type: Schema.Types.ObjectId,
      ref: 'Problem',
      required: [true, 'Problem ID is required'],
      index: true,
    },
    reviewedAt: {
      type: Date,
      required: [true, 'ReviewedAt timestamp is required'],
      default: Date.now,
    },
    scheduledReviewAt: {
      type: Date,
      required: [true, 'ScheduledReviewAt timestamp is required'],
    },
    recallResult: {
      type: String,
      enum: {
        values: ['EASY', 'STRUGGLED', 'HINT', 'FORGOT'],
        message: '{VALUE} is not a valid recall result',
      },
      required: [true, 'Recall result is required'],
    },
    timingStatus: {
      type: String,
      enum: {
        values: ['EARLY', 'ON_TIME', 'LATE'],
        message: '{VALUE} is not a valid timing status',
      },
      required: [true, 'Timing status is required'],
    },
    latenessDays: {
      type: Number,
      min: [0, 'Lateness days must be non-negative'],
      required: [true, 'Lateness days is required'],
    },
    previousStage: {
      type: Number,
      required: [true, 'Previous stage is required'],
    },
    newStage: {
      type: Number,
      required: [true, 'New stage is required'],
    },
    previousIntervalDays: {
      type: Number,
      required: [true, 'Previous interval days is required'],
    },
    newIntervalDays: {
      type: Number,
      required: [true, 'New interval days is required'],
    },
    previousRetention: {
      type: String,
      required: [true, 'Previous retention is required'],
    },
    newRetention: {
      type: String,
      required: [true, 'New retention is required'],
    },
    previousNextReviewDate: {
      type: Date,
      required: [true, 'Previous nextReviewDate is required'],
    },
    newNextReviewDate: {
      type: Date,
      required: [true, 'New nextReviewDate is required'],
    },
    timeSpentSeconds: {
      type: Number,
      min: [0, 'Time spent cannot be negative'],
      default: null,
    },
    coldSolve: {
      type: Boolean,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: transformRevisionHistory,
    },
    toObject: {
      transform: transformRevisionHistory,
    },
  }
);

// Compound index for user-scoped, problem-scoped fast chronological timeline retrieval
revisionHistorySchema.index({ userId: 1, problemId: 1, reviewedAt: -1 });
// Compound index for user-wide chronological review history retrieval
revisionHistorySchema.index({ userId: 1, reviewedAt: -1 });

export const RevisionHistory: Model<IRevisionHistoryDocument> =
  mongoose.model<IRevisionHistoryDocument>('RevisionHistory', revisionHistorySchema);
