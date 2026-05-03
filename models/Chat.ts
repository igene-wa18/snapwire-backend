import mongoose, { Schema, Document } from 'mongoose';

export interface ILastMessage {
  messageId?: mongoose.Types.ObjectId;
  content?: string;
  sender?: mongoose.Types.ObjectId;
  type?: 'text' | 'image' | 'video' | 'audio' | 'file' | 'system';
  sentAt?: Date;
}

export interface IChat extends Document {
  isGroup: boolean;
  name?: string;
  groupIcon?: string;
  description?: string;
  createdBy?: mongoose.Types.ObjectId;
  participants: mongoose.Types.ObjectId[];
  admins: mongoose.Types.ObjectId[];
  lastMessage: ILastMessage;
  unreadCounts: Map<string, number>;
  mutedBy: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const ChatSchema = new Schema<IChat>(
  {
    isGroup: {
      type: Boolean,
      required: true,
      default: false,
    },
    name: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    groupIcon: {
      type: String,
      default: null,
    },
    description: {
      type: String,
      maxlength: 200,
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    admins: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    lastMessage: {
      messageId: {
        type: Schema.Types.ObjectId,
        ref: 'Message',
      },
      content: String,
      sender: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
      type: {
        type: String,
        enum: ['text', 'image', 'video', 'audio', 'file', 'system'],
      },
      sentAt: Date,
    },
    unreadCounts: {
      type: Map,
      of: Number,
      default: new Map(),
    },
    mutedBy: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  { timestamps: true }
);

// Indexes
ChatSchema.index({ participants: 1, 'lastMessage.sentAt': -1 });
ChatSchema.index({ participants: 1, isGroup: 1 });

export default mongoose.model<IChat>('Chat', ChatSchema);
