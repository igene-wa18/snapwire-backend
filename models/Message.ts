import mongoose, { Schema, Document } from 'mongoose';

export interface IReadBy {
  user: mongoose.Types.ObjectId;
  readAt: Date;
}

export interface IDeliveredTo {
  user: mongoose.Types.ObjectId;
  deliveredAt: Date;
}

export interface IMedia {
  url?: string;
  mimeType?: string;
  size?: number;
  thumbnail?: string;
  duration?: number;
}

export interface IMessage extends Document {
  chat: mongoose.Types.ObjectId;
  sender?: mongoose.Types.ObjectId;
  type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'system';
  content?: string;
  media?: IMedia;
  replyTo?: mongoose.Types.ObjectId;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  readBy: IReadBy[];
  deliveredTo: IDeliveredTo[];
  deletedFor: mongoose.Types.ObjectId[];
  deletedForEveryone: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MediaSchema = new Schema<IMedia>({
  url: String,
  mimeType: String,
  size: Number,
  thumbnail: String,
  duration: Number,
});

const ReadBySchema = new Schema<IReadBy>({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  readAt: {
    type: Date,
    default: Date.now,
  },
});

const DeliveredToSchema = new Schema<IDeliveredTo>({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  deliveredAt: {
    type: Date,
    default: Date.now,
  },
});

const MessageSchema = new Schema<IMessage>(
  {
    chat: {
      type: Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    type: {
      type: String,
      enum: ['text', 'image', 'video', 'audio', 'file', 'system'],
      default: 'text',
    },
    content: {
      type: String,
      maxlength: 5000,
      validate: {
        validator: function (this: IMessage) {
          return (this.type === 'text' || this.type === 'system') ? !!this.content : true;
        },
        message: 'Content is required for text and system messages',
      },
    },
    media: MediaSchema,
    replyTo: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    status: {
      type: String,
      enum: ['sending', 'sent', 'delivered', 'read'],
      default: 'sending',
    },
    readBy: [ReadBySchema],
    deliveredTo: [DeliveredToSchema],
    deletedFor: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    deletedForEveryone: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Indexes
MessageSchema.index({ chat: 1, createdAt: -1 });
MessageSchema.index({ chat: 1, sender: 1, createdAt: 1 });
MessageSchema.index({ chat: 1, _id: -1 });

export default mongoose.model<IMessage>('Message', MessageSchema);
