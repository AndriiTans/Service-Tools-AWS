import mongoose, { Schema, Document } from 'mongoose';

export type IContent = {
  content_type: string;
  parts: string[];
};
export interface IMessage extends Document {
  _id: mongoose.Types.ObjectId;
  bucketName: string;
  fileName: string;
  authorRole: string;
  content: IContent;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const contentSchema: Schema = new Schema({
  content_type: {
    type: String,
    required: true,
  },
  parts: [
    {
      type: String,
      // required: true,
    },
  ],
});

const MessageSchema: Schema<IMessage> = new mongoose.Schema(
  {
    bucketName: {
      type: String,
      required: true,
      trim: true,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    authorRole: {
      type: String,
      required: true,
    },
    content: {
      type: contentSchema,
      required: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Create a compound index to ensure order is unique within the same bucketName
MessageSchema.index({ order: 1, bucketName: 1, fileName: 1 }, { unique: true });

const Message = mongoose.model<IMessage>('Message', MessageSchema);

export default Message;
