import mongoose, { Document, Model, Schema } from 'mongoose';

export type PatternConfidence = 'LOW' | 'MEDIUM' | 'HIGH';

export interface IProblemPattern {
  userId: mongoose.Types.ObjectId;
  problemId: mongoose.Types.ObjectId;
  patternId: mongoose.Types.ObjectId;
  confidence: PatternConfidence;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProblemPatternDocument extends IProblemPattern, Document {
  _id: mongoose.Types.ObjectId;
}

const problemPatternSchema = new Schema<IProblemPatternDocument>(
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
    patternId: {
      type: Schema.Types.ObjectId,
      ref: 'Pattern',
      required: [true, 'Pattern ID is required'],
      index: true,
    },
    confidence: {
      type: String,
      enum: {
        values: ['LOW', 'MEDIUM', 'HIGH'],
        message: '{VALUE} is not a valid confidence level',
      },
      default: 'MEDIUM',
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret['id'] = ret['_id']?.toString();
        if (ret['userId'] instanceof mongoose.Types.ObjectId) {
          ret['userId'] = ret['userId'].toString();
        }
        if (ret['problemId'] instanceof mongoose.Types.ObjectId) {
          ret['problemId'] = ret['problemId'].toString();
        }
        if (ret['patternId'] instanceof mongoose.Types.ObjectId) {
          ret['patternId'] = ret['patternId'].toString();
        }
        delete ret['_id'];
        delete ret['__v'];
        return ret;
      },
    },
  }
);

// Compound unique index: a user cannot attach the same pattern to the same problem twice
problemPatternSchema.index({ userId: 1, problemId: 1, patternId: 1 }, { unique: true });

// Compound index for querying all problems for a pattern by user
problemPatternSchema.index({ userId: 1, patternId: 1 });

// Compound index for dashboard primary pattern lookups
problemPatternSchema.index({ userId: 1, isPrimary: 1 });

export const ProblemPattern: Model<IProblemPatternDocument> =
  mongoose.model<IProblemPatternDocument>('ProblemPattern', problemPatternSchema);
