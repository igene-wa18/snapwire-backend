import mongoose, { Schema, Document } from 'mongoose';

export interface IStatusViewer {
  user: mongoose.Types.ObjectId;
  viewedAt: Date;
}

export interface IStatus extends Document {
  user: mongoose.Types.ObjectId;
  imageUrl: string;
  viewers: IStatusViewer[];
  createdAt: Date;
}

const StatusSchema = new Schema<IStatus>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    viewers: [
      {
        user: { type: Schema.Types.ObjectId, ref: 'User' },
        viewedAt: { type: Date, default: Date.now },
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  // Disable updatedAt since statuses are immutable once created
  { timestamps: false }
);

// ─── TTL INDEX: auto-delete after 24 hours (86400 seconds) ───────────
StatusSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

// ─── Compound index for efficient feed queries ───────────────────────
StatusSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model<IStatus>('Status', StatusSchema);
