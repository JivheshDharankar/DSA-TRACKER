import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IPattern {
  name: string;
  slug: string;
  description: string;
  recognitionSignals: string[];
  commonMistakes: string[];
  prerequisites: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IPatternDocument extends IPattern, Document {
  _id: mongoose.Types.ObjectId;
}

const patternSchema = new Schema<IPatternDocument>(
  {
    name: {
      type: String,
      required: [true, 'Pattern name is required'],
      trim: true,
      maxlength: [100, 'Pattern name cannot exceed 100 characters'],
    },
    slug: {
      type: String,
      required: [true, 'Pattern slug is required'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Pattern description is required'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    recognitionSignals: {
      type: [String],
      required: [true, 'Recognition signals are required'],
      default: [],
    },
    commonMistakes: {
      type: [String],
      required: [true, 'Common mistakes are required'],
      default: [],
    },
    prerequisites: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret['id'] = ret['_id']?.toString();
        delete ret['_id'];
        delete ret['__v'];
        return ret;
      },
    },
  }
);

export const Pattern: Model<IPatternDocument> = mongoose.model<IPatternDocument>(
  'Pattern',
  patternSchema
);
