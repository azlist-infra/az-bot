import mongoose, { Document, Schema } from 'mongoose';

export type ConversationState = 'initial' | 'awaiting_cpf' | 'resolved_found' | 'resolved_not_found';

export interface IConversation extends Document {
  phoneNumber: string;
  state: ConversationState;
  cpf?: string;
  lastMessageAt: Date;
  attempts: number;
  userData?: {
    name?: string;
    searchKey?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  
  // Instance methods
  updateState(newState: ConversationState): void;
  incrementAttempts(): number;
  reset(): void;
}

const ConversationSchema = new Schema<IConversation>(
  {
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      enum: ['initial', 'awaiting_cpf', 'resolved_found', 'resolved_not_found'],
      required: true,
      default: 'initial',
    },
    cpf: {
      type: String,
      trim: true,
    },
    lastMessageAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    attempts: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    userData: {
      name: {
        type: String,
        trim: true,
      },
      searchKey: {
        type: String,
        trim: true,
      },
    },
  },
  {
    timestamps: true,
    collection: 'conversations',
  },
);

// Indexes for better performance
ConversationSchema.index({ phoneNumber: 1 }, { unique: true });
ConversationSchema.index({ state: 1, lastMessageAt: -1 });
ConversationSchema.index({ cpf: 1 }, { sparse: true });

// Instance methods
ConversationSchema.methods.updateState = function(newState: ConversationState): void {
  this.state = newState;
  this.lastMessageAt = new Date();
};

ConversationSchema.methods.incrementAttempts = function(): number {
  this.attempts += 1;
  this.lastMessageAt = new Date();
  return this.attempts;
};

ConversationSchema.methods.reset = function(): void {
  this.state = 'initial';
  this.attempts = 0;
  this.cpf = undefined;
  this.userData = undefined;
  this.lastMessageAt = new Date();
};

export const Conversation = mongoose.model<IConversation>('Conversation', ConversationSchema);
