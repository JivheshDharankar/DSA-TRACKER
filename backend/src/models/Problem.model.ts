import mongoose, { Document, Model, Schema } from 'mongoose';

export type ProblemSection = 'COLLEGE' | 'PERSONAL';
export type ProblemDifficulty = 'Easy' | 'Medium' | 'Hard';
export type ProblemStatus = 'Not Started' | 'Attempted' | 'Solved';
export type ProblemRetention = 'Learning' | 'Familiar' | 'Independent' | 'Strong' | 'Locked';
export type MasteryStatus = 'UNLOCKED' | 'LOCKED';

export const COLLEGE_SOURCES = ['Lecture', 'Assignment', 'Lab', 'Exam', 'Other'] as const;
export const PERSONAL_SOURCES = ['LeetCode', 'Personal', 'Mentor', 'Practice', 'Other'] as const;
export const ALL_SOURCES = [...new Set([...COLLEGE_SOURCES, ...PERSONAL_SOURCES])] as const;

export type ProblemSource = (typeof ALL_SOURCES)[number];

export interface IProblem {
  userId: mongoose.Types.ObjectId;
  section: ProblemSection;
  sNo: number;
  title: string;
  collegeLink?: string | null;
  leetcodeLink?: string | null;
  problemLink?: string | null; // Retained internally for legacy document backward-compatibility
  leetcodeNumber?: number | null;
  topic: string;
  difficulty: ProblemDifficulty;
  source: ProblemSource;
  dateLearned: Date;
  status: ProblemStatus;
  retentionLevel: ProblemRetention;
  notes?: string;
  repetitionStage: number;
  intervalDays: number;
  nextReviewDate: Date;
  lastReviewedAt?: Date | null;
  recoveryStage?: number | null;
  masteryStatus: MasteryStatus;
  lockedAt?: Date | null;
  unlockedAt?: Date | null;
  lockVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProblemDocument extends IProblem, Document {
  _id: mongoose.Types.ObjectId;
}

const problemSchema = new Schema<IProblemDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    section: {
      type: String,
      enum: {
        values: ['COLLEGE', 'PERSONAL'],
        message: '{VALUE} is not a valid problem section',
      },
      required: [true, 'Section is required'],
      index: true,
    },
    sNo: {
      type: Number,
      required: [true, 'S.No is required'],
    },
    title: {
      type: String,
      required: [true, 'Problem title is required'],
      trim: true,
      minlength: [1, 'Title cannot be empty'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    collegeLink: {
      type: String,
      trim: true,
      default: null,
    },
    leetcodeLink: {
      type: String,
      trim: true,
      default: null,
    },
    problemLink: {
      type: String,
      trim: true,
      default: null,
    },
    leetcodeNumber: {
      type: Number,
      min: [1, 'LeetCode number must be a positive integer'],
      validate: {
        validator: (val: number | null | undefined) =>
          val === null || val === undefined || Number.isInteger(val),
        message: '{VALUE} is not an integer value',
      },
      required: false,
      default: null,
    },
    topic: {
      type: String,
      required: [true, 'Topic is required'],
      trim: true,
      maxlength: [80, 'Topic cannot exceed 80 characters'],
    },
    difficulty: {
      type: String,
      enum: {
        values: ['Easy', 'Medium', 'Hard'],
        message: '{VALUE} is not a valid difficulty level',
      },
      required: [true, 'Difficulty is required'],
    },
    source: {
      type: String,
      required: [true, 'Source is required'],
      trim: true,
      maxlength: [80, 'Source cannot exceed 80 characters'],
    },
    dateLearned: {
      type: Date,
      required: [true, 'Date learned is required'],
      default: Date.now,
    },
    status: {
      type: String,
      enum: {
        values: ['Not Started', 'Attempted', 'Solved'],
        message: '{VALUE} is not a valid problem status',
      },
      default: 'Not Started',
    },
    retentionLevel: {
      type: String,
      enum: {
        values: ['Learning', 'Familiar', 'Independent', 'Strong', 'Locked'],
        message: '{VALUE} is not a valid retention level',
      },
      default: 'Learning',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [10000, 'Notes cannot exceed 10,000 characters'],
      default: '',
    },
    repetitionStage: {
      type: Number,
      min: [0, 'Repetition stage cannot be negative'],
      max: [9, 'Repetition stage cannot exceed 9'],
      default: 0,
    },
    intervalDays: {
      type: Number,
      min: [0, 'Interval days cannot be negative'],
      default: 0,
    },
    nextReviewDate: {
      type: Date,
      required: [true, 'Next review date is required'],
      default: Date.now,
      index: true,
    },
    lastReviewedAt: {
      type: Date,
      default: null,
    },
    recoveryStage: {
      type: Number,
      min: [0, 'Recovery stage cannot be negative'],
      max: [3, 'Recovery stage cannot exceed 3'],
      default: null,
    },
    masteryStatus: {
      type: String,
      enum: {
        values: ['UNLOCKED', 'LOCKED'],
        message: '{VALUE} is not a valid mastery status',
      },
      default: 'UNLOCKED',
      index: true,
    },
    lockedAt: {
      type: Date,
      default: null,
    },
    unlockedAt: {
      type: Date,
      default: null,
    },
    lockVersion: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret['id'] = ret['_id']?.toString();
        ret['userId'] = ret['userId']?.toString();

        // Non-destructive legacy migration: if legacy problemLink exists and dual links are empty, map safely
        if (ret['problemLink'] && !ret['collegeLink'] && !ret['leetcodeLink']) {
          const legacyUrl = String(ret['problemLink']);
          if (legacyUrl.includes('leetcode.com')) {
            ret['leetcodeLink'] = legacyUrl;
          } else {
            ret['collegeLink'] = legacyUrl;
          }
        }

        delete ret['_id'];
        delete ret['__v'];
        delete ret['problemLink'];
        return ret;
      },
    },
  }
);

// Compound indexes for user privacy and ultra-fast scoped queries
problemSchema.index({ userId: 1, section: 1, sNo: 1 }, { unique: true });
problemSchema.index({ userId: 1, section: 1, nextReviewDate: 1 });
problemSchema.index({ userId: 1, section: 1, status: 1 });
problemSchema.index({ userId: 1, section: 1, difficulty: 1 });
problemSchema.index({ userId: 1, section: 1, dateLearned: -1 });
problemSchema.index({ userId: 1, section: 1, createdAt: -1 });
problemSchema.index({ userId: 1, section: 1, masteryStatus: 1 });
problemSchema.index({ userId: 1, masteryStatus: 1 });

export const Problem: Model<IProblemDocument> = mongoose.model<IProblemDocument>(
  'Problem',
  problemSchema
);

