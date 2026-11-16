import { Router, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { AuthRequest } from '../types';
import { requireCompleteProfile } from '../middlewares/auth.middleware';
import { AppError, asyncHandler } from '../middlewares/error.middleware';
import { Conversation } from '../models/Message.model';
import User from '../models/User.model';
import VideoCall from '../models/VideoCall.model';
import { expireVideoCalls, notifyVideoCall, videoIceConfig } from '../services/video-call.service';

// Mounted inside the authenticated messaging router, after conversation redirects.
const router = Router();
router.use('/calls', (_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); });
const sessionValid = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(value);
const participant = (userId: string) => ({ $or: [{ caller: userId }, { callee: userId }] });
const selected = (userId: string, sessionId: string) => ({ $or: [{ caller: userId, callerSessionId: sessionId }, { callee: userId, calleeSessionId: sessionId }] });

router.get('/calls/config', (_req: AuthRequest, res: Response) => { res.json({ success: true, data: videoIceConfig(_req.user!.id) }); });
router.get('/calls/current', asyncHandler(async (req: AuthRequest, res: Response) => {
  await expireVideoCalls();
  const call = await VideoCall.findOne({ busyUsers: req.user!.id }).select('-signals').populate('caller callee', 'fullName role');
  res.json({ success: true, data: call });
}));

router.post('/conversations/:id/calls', requireCompleteProfile,
  rateLimit({ windowMs: 60000, limit: 10, standardHeaders: true, legacyHeaders: false,
    keyGenerator: (req: AuthRequest) => req.user!.id,
    message: { success: false, message: 'Bạn gọi quá nhiều lần. Vui lòng đợi một phút.' } }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id) || !sessionValid(req.body.sessionId)) throw new AppError('Yêu cầu gọi không hợp lệ', 400);
    const conversation = await Conversation.findOne({ _id: req.params.id, participants: req.user!.id });
    if (!conversation || conversation.participants.length !== 2) throw new AppError('Cuộc trò chuyện không tồn tại', 404);
    const callee = conversation.participants.map(String).find(id => id !== req.user!.id)!;
    if (!await User.exists({ _id: callee, isActive: true, isHidden: { $ne: true }, isVerified: true })) throw new AppError('Người nhận không khả dụng', 404);
    await expireVideoCalls();
    let call;
    try {
      await VideoCall.init();
      call = await VideoCall.create({ conversationId: conversation._id, caller: req.user!.id, callee,
        callerSessionId: req.body.sessionId, busyUsers: [req.user!.id, callee] });
    } catch (error: any) {
      if (error.code === 11000) throw new AppError('Bạn hoặc đối tác đang có cuộc gọi khác', 409);
      throw error;
    }
    notifyVideoCall(call);
    await call.populate('caller callee', 'fullName role');
    res.status(201).json({ success: true, data: call });
  }));

router.use('/calls/:callId', (req: AuthRequest, _res: Response, next: NextFunction) => {
  next(mongoose.isValidObjectId(req.params.callId) ? undefined : new AppError('Cuộc gọi không hợp lệ', 400));
});
router.get('/calls/:callId', asyncHandler(async (req: AuthRequest, res: Response) => {
  await expireVideoCalls();
  const call = await VideoCall.findOne({ _id: req.params.callId, ...participant(req.user!.id) }).populate('caller callee', 'fullName role');
  if (!call) throw new AppError('Cuộc gọi không tồn tại', 404);
  res.json({ success: true, data: call });
}));
router.post('/calls/:callId/accept', requireCompleteProfile, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!sessionValid(req.body.sessionId)) throw new AppError('Phiên gọi không hợp lệ', 400);
  await expireVideoCalls();
  const call = await VideoCall.findOneAndUpdate({ _id: req.params.callId, callee: req.user!.id, state: 'ringing' }, {
    $set: { state: 'active', calleeSessionId: req.body.sessionId, callerSeenAt: new Date(), calleeSeenAt: new Date() },
  }, { new: true });
  if (!call) throw new AppError('Cuộc gọi đã kết thúc hoặc được nhận ở tab khác', 409);
  notifyVideoCall(call);
  await call.populate('caller callee', 'fullName role');
  res.json({ success: true, data: call });
}));
router.post('/calls/:callId/end', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { sessionId, reason } = req.body;
  if (!sessionValid(sessionId) || !['ended', 'declined', 'failed'].includes(reason)) throw new AppError('Yêu cầu không hợp lệ', 400);
  const call = await VideoCall.findOneAndUpdate({ _id: req.params.callId, state: { $in: ['ringing', 'active'] },
    $or: [...selected(req.user!.id, sessionId).$or, { callee: req.user!.id, state: 'ringing' }],
  }, { $set: { state: 'ended', reason }, $unset: { busyUsers: 1 } }, { new: true });
  if (!call) {
    if (!await VideoCall.exists({ _id: req.params.callId, state: 'ended', ...participant(req.user!.id) })) throw new AppError('Cuộc gọi không khả dụng trong tab này', 409);
  } else notifyVideoCall(call);
  res.json({ success: true });
}));
router.post('/calls/:callId/heartbeat', asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!sessionValid(req.body.sessionId)) throw new AppError('Phiên gọi không hợp lệ', 400);
  const call = await VideoCall.findOne({ _id: req.params.callId, state: { $in: ['ringing', 'active'] }, ...selected(req.user!.id, req.body.sessionId) });
  if (!call) throw new AppError('Cuộc gọi đã kết thúc hoặc ở tab khác', 409);
  await VideoCall.updateOne({ _id: call._id }, { $set: String(call.caller) === req.user!.id ? { callerSeenAt: new Date() } : { calleeSeenAt: new Date() } });
  res.json({ success: true });
}));
router.post('/calls/:callId/signals', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { kind, payload, sessionId } = req.body;
  if (!sessionValid(sessionId) || !['offer', 'answer', 'ice'].includes(kind)) throw new AppError('Tín hiệu gọi không hợp lệ', 400);
  const valid = kind === 'ice'
    ? payload && typeof payload.candidate === 'string' && payload.candidate.length < 5000
      && (payload.sdpMid === null || typeof payload.sdpMid === 'string')
      && (payload.sdpMLineIndex === null || (Number.isInteger(payload.sdpMLineIndex) && payload.sdpMLineIndex >= 0))
    : payload && payload.type === kind && typeof payload.sdp === 'string' && payload.sdp.length > 0 && payload.sdp.length < 64000;
  if (!valid || JSON.stringify(payload).length > 65000) throw new AppError('Nội dung tín hiệu không hợp lệ', 400);
  const clean = kind === 'ice' ? { candidate: payload.candidate, sdpMid: payload.sdpMid, sdpMLineIndex: payload.sdpMLineIndex,
    ...(typeof payload.usernameFragment === 'string' ? { usernameFragment: payload.usernameFragment.slice(0, 256) } : {}) } : { type: payload.type, sdp: payload.sdp };
  const role = kind === 'offer' ? { caller: req.user!.id, callerSessionId: sessionId }
    : kind === 'answer' ? { callee: req.user!.id, calleeSessionId: sessionId } : selected(req.user!.id, sessionId);
  const call = await VideoCall.findOneAndUpdate({ _id: req.params.callId, state: 'active', ...role,
    'signals.299': { $exists: false }, ...(kind !== 'ice' ? { 'signals.kind': { $ne: kind } } : {}),
  }, { $push: { signals: { kind, payload: clean, sessionId } } }, { new: true });
  if (!call) throw new AppError('Cuộc gọi không cho phép tín hiệu này', 409);
  notifyVideoCall(call);
  res.json({ success: true });
}));
export default router;
