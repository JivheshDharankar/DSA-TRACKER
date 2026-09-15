import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserDocument extends IUser, Document {
  _id: mongoose.Types.ObjectId;
}

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

const userSchema = new Schema<IUserDocument>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false, // Excluded from default queries to prevent accidental leakage
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret['id'] = ret['_id']?.toString();
        delete ret['_id'];
        delete ret['__v'];
        delete ret['passwordHash'];
        return ret;
      },
    },
  }
);

export const User: Model<IUserDocument> = mongoose.model<IUserDocument>('User', userSchema);
