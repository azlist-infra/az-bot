import { Document, Schema, model } from 'mongoose';

export interface IChat extends Document {
  phone: string;
  name: string;
  archived: boolean;
  pinned: boolean;
  messagesUnread: number;
  unread: string;
  lastMessageTime: string;
  isMuted: string;
  isMarkedSpam: boolean;
  muteEndTime?: number;
  sentMessage: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const chatSchema = new Schema<IChat>({
  phone: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  archived: {
    type: Boolean,
    default: false
  },
  pinned: {
    type: Boolean,
    default: false
  },
  messagesUnread: {
    type: Number,
    default: 0
  },
  unread: {
    type: String,
    default: '0'
  },
  lastMessageTime: {
    type: String,
    required: true
  },
  isMuted: {
    type: String,
    default: '0'
  },
  isMarkedSpam: {
    type: Boolean,
    default: false
  },
  muteEndTime: {
    type: Number,
    required: false
  },
  sentMessage: {
    type: Boolean,
    default: true,
    required: true
  }
}, {
  timestamps: true
});

// Índices para otimização
chatSchema.index({ phone: 1 });
chatSchema.index({ lastMessageTime: -1 });
chatSchema.index({ sentMessage: 1 });

export const Chat = model<IChat>('Chat', chatSchema);
