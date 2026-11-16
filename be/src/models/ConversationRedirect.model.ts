import mongoose, { Schema } from 'mongoose';

// Preserve old deep links and the original conversation metadata after merging.
const schema = new Schema({
  conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  snapshot: { type: Schema.Types.Mixed, required: true },
}, { timestamps: true });

export default mongoose.model('ConversationRedirect', schema);
