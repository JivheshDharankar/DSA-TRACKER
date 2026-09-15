import mongoose, { Document, Model, Schema } from 'mongoose';

export type MasteryEventType = 'LOCKED' | 'UNLOCKED';
export type MasteryTransitionReason =
  | 'QUALIFICATION_MET'
  | 'SRS_FAILURE';

export interface IMasteryEvent {
  userId: mongoose.Types.ObjectId;
  problemId: mongoose.Types.ObjectId;
  eventType: MasteryEventType;
  occurredAt: Date;
  reason: MasteryTransitionReason;
  lockVersion: number;
  createdAt: Date;
}

export interface IMasteryEventDocument extends IMasteryEvent, Document {
  _id: mongoose.Types.ObjectId;
}

const masteryEventSchema = new Schema<IMasteryEventDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    problemId: {
      type: Schema.Types.ObjectId,
      ref: 'Problem',
      required: [true, 'Problem ID is required'],
      index: true,
    },
    eventType: {
      type: String,
      enum: {
        values: ['LOCKED', 'UNLOCKED'],
        message: '{VALUE} is not a valid mastery event type',
      },
      required: [true, 'Event type is required'],
    },
    occurredAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    reason: {
      type: String,
      enum: {
        values: [
          'QUALIFICATION_MET',
          'SRS_FAILURE',
        ],
        message: '{VALUE} is not a valid transition reason',
      },
      required: [true, 'Transition reason is required'],
    },
    lockVersion: {
      type: Number,
      required: [true, 'Lock version is required'],
      min: 1,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Append-only immutable records
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret['id'] = ret['_id']?.toString();
        ret['userId'] = ret['userId']?.toString();
        ret['problemId'] = ret['problemId']?.toString();
        delete ret['_id'];
        delete ret['__v'];
        return ret;
      },
    },
  }
);

// Indexes
masteryEventSchema.index({ userId: 1, problemId: 1, occurredAt: -1 });
masteryEventSchema.index({ userId: 1, eventType: 1 });

export const MasteryEvent: Model<IMasteryEventDocument> =
  mongoose.model<IMasteryEventDocument>('MasteryEvent', masteryEventSchema);
