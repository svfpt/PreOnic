import { createHmac } from 'crypto';
import VideoCall from '../models/VideoCall.model';
import { publishMessagingEvent } from './messaging-events';

export function notifyVideoCall(call: { _id: unknown; caller: unknown; callee: unknown }): void {
  publishMessagingEvent([String(call.caller), String(call.callee)], { type: 'call', callId: String(call._id) });
}

export async function expireVideoCalls(): Promise<void> {
  const expired = await VideoCall.find({ state: { $in: ['ringing', 'active'] }, $or: [
    { state: 'ringing', createdAt: { $lt: new Date(Date.now() - 45000) } },
    { state: 'active', callerSeenAt: { $lt: new Date(Date.now() - 45000) } },
    { state: 'active', calleeSeenAt: { $lt: new Date(Date.now() - 45000) } },
  ] });
  for (const call of expired) {
    const updated = await VideoCall.findOneAndUpdate({ _id: call._id, state: call.state, updatedAt: call.updatedAt }, {
      $set: { state: 'ended', reason: call.state === 'ringing' ? 'missed' : 'disconnected' }, $unset: { busyUsers: 1 },
    }, { new: true });
    if (updated) notifyVideoCall(updated);
  }
}

export function videoIceConfig(userId: string) {
  const stun = (process.env.WEBRTC_STUN_URLS || 'stun:stun.l.google.com:19302').split(',').map(url => url.trim()).filter(url => /^stuns?:[^\s]+$/.test(url));
  const turn = (process.env.WEBRTC_TURN_URLS || '').split(',').map(url => url.trim()).filter(url => /^turns?:[^\s]+$/.test(url));
  const secret = process.env.WEBRTC_TURN_SECRET;
  const iceServers: Array<{ urls: string[]; username?: string; credential?: string }> = stun.length ? [{ urls: stun }] : [];
  if (turn.length && secret) {
    const username = `${Math.floor(Date.now() / 1000) + 3600}:${userId}`;
    iceServers.push({ urls: turn, username, credential: createHmac('sha1', secret).update(username).digest('base64') });
  }
  return { iceServers, turnConfigured: Boolean(turn.length && secret) };
}
