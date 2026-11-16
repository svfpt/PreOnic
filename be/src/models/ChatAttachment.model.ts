import mongoose, { Schema } from 'mongoose';

const schema = new Schema({
  conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  publicId: { type: String, required: true, select: false },
  messageId: { type: Schema.Types.ObjectId, ref: 'Message', default: null },
  deleting: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model('ChatAttachment', schema);
