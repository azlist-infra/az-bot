import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
  from: string;
  message: string;
  caption?: string;
  deliveredAt: Date;
  status: 'sent' | 'failed' | 'pending';
  direction: 'in' | 'out';
  kind: 'text' | 'image' | 'system';
  meta?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    from: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
    },
    caption: {
      type: String,
      trim: true,
    },
    deliveredAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['sent', 'failed', 'pending'],
      required: true,
      default: 'pending',
    },
    direction: {
      type: String,
      enum: ['in', 'out'],
      required: true,
    },
    kind: {
      type: String,
      enum: ['text', 'image', 'system'],
      required: true,
      default: 'text',
    },
    meta: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'messages',
  },
);

// Indexes for better performance
MessageSchema.index({ from: 1, createdAt: -1 });
MessageSchema.index({ status: 1, direction: 1 });
MessageSchema.index({ deliveredAt: -1 });

export const Message = mongoose.model<IMessage>('Message', MessageSchema);
