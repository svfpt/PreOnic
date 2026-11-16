import mongoose, { Schema } from 'mongoose';

const signalSchema = new Schema({
  kind: { type: String, enum: ['offer', 'answer', 'ice'], required: true },
  sessionId: { type: String, required: true },
  payload: { type: Schema.Types.Mixed, required: true },
}, { _id: false });
const schema = new Schema({
  conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
  caller: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  callee: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  callerSessionId: { type: String, required: true },
  calleeSessionId: { type: String },
  state: { type: String, enum: ['ringing', 'active', 'ended'], default: 'ringing', required: true },
  reason: { type: String, default: '' },
  // A unique multikey index reserves BOTH users, preventing crossed calls and busy users.
  busyUsers: { type: [Schema.Types.ObjectId], default: undefined },
  callerSeenAt: { type: Date, default: Date.now },
  calleeSeenAt: { type: Date, default: Date.now },
  signals: { type: [signalSchema], default: [] },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 86400000) },
}, { timestamps: true });
schema.index({ busyUsers: 1 }, { unique: true, sparse: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default mongoose.model('VideoCall', schema);
