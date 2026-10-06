import mongoose, { Document, Model, Schema } from 'mongoose';
import { ProblemSection } from './Problem.model.js';

export interface IProblemSequence {
  userId: mongoose.Types.ObjectId;
  section: ProblemSection;
  nextSNo: number;
  updatedAt: Date;
}

export interface IProblemSequenceDocument extends IProblemSequence, Document {
  _id: mongoose.Types.ObjectId;
}

const problemSequenceSchema = new Schema<IProblemSequenceDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    section: {
      type: String,
      enum: ['COLLEGE', 'PERSONAL'],
      required: [true, 'Section is required'],
    },
    nextSNo: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  {
    timestamps: true,
  }
);

// Strict unique compound constraint to guarantee independent per-user, per-section counter documents
problemSequenceSchema.index({ userId: 1, section: 1 }, { unique: true });

export const ProblemSequence: Model<IProblemSequenceDocument> =
  mongoose.model<IProblemSequenceDocument>('ProblemSequence', problemSequenceSchema);
