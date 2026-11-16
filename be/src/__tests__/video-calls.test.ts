import express from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { createHmac } from 'crypto';
import messagingRoutes from '../routes/messaging.routes';
import { errorHandler } from '../middlewares/error.middleware';
import User from '../models/User.model';
import VideoCall from '../models/VideoCall.model';
import { connectTestDb, clearTestDb, disconnectTestDb } from './helpers/db';

jest.mock('../utils/logger', () => ({ createLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }) }));
describe('Authorized video call signaling and lifecycle', () => {
  let server: Server;
  let base: string;
  let users: string[];
  let tokens: string[];
  let conversationId: string;
  const callerSession = 'caller-session-123';
  const calleeSession = 'callee-session-123';
  beforeAll(async () => {
    await connectTestDb();
    process.env.JWT_SECRET = 'video-call-test-secret';
    const app = express();
    app.use(express.json()); app.use('/messaging', messagingRoutes); app.use(errorHandler);
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/messaging`;
  });
  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await disconnectTestDb();
  });
  beforeEach(async () => {
    await clearTestDb();
    const created = await User.create([0, 1, 2].map(i => ({ email: `video${i}@test.local`, password: 'password123',
      role: 'admin', isVerified: true, fullName: `User ${i}`, firstName: 'Test', lastName: 'User' })));
    users = created.map(user => String(user._id));
    tokens = users.map(id => jwt.sign({ id }, process.env.JWT_SECRET!));
    conversationId = (await request('/conversations', 0, { partnerId: users[1] })).data._id;
  });
  afterEach(() => { delete process.env.WEBRTC_TURN_URLS; delete process.env.WEBRTC_TURN_SECRET; });

  async function request(path: string, user: number | null, body?: object) {
    const response = await fetch(base + path, { method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', ...(user !== null ? { Authorization: `Bearer ${tokens[user]}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { ...(await response.json() as any), status: response.status };
  }
  const start = () => request(`/conversations/${conversationId}/calls`, 0, { sessionId: callerSession });

  it('requires login and conversation membership without exposing calls to outsiders', async () => {
    expect((await request('/calls/config', null)).status).toBe(401);
    expect((await request(`/conversations/${conversationId}/calls`, 2, { sessionId: 'outsider-session' })).status).toBe(404);
    const { data: call } = await start();
    expect((await request(`/calls/${call._id}`, 2)).status).toBe(404);
    expect((await request('/calls/current', 2)).data).toBeNull();
    expect((await request(`/calls/${call._id}/accept`, 2, { sessionId: 'outsider-session' })).status).toBe(409);
    expect((await request(`/calls/${call._id}/end`, 2, { sessionId: 'outsider-session', reason: 'ended' })).status).toBe(409);
  });

  it('only permits the selected caller and accepted receiver to exchange SDP and ICE', async () => {
    const { data: call } = await start();
    const offer = { sessionId: callerSession, kind: 'offer', payload: { type: 'offer', sdp: 'v=0\r\n' } };
    expect((await request(`/calls/${call._id}/signals`, 0, offer)).status).toBe(409);
    expect((await request(`/calls/${call._id}/accept`, 0, { sessionId: callerSession })).status).toBe(409);
    expect((await request(`/calls/${call._id}/accept`, 1, { sessionId: calleeSession })).status).toBe(200);
    expect((await request(`/calls/${call._id}/accept`, 1, { sessionId: 'second-tab-session' })).status).toBe(409);
    expect((await request(`/calls/${call._id}/signals`, 0, { ...offer, sessionId: 'another-caller-tab' })).status).toBe(409);
    expect((await request(`/calls/${call._id}/signals`, 0, offer)).status).toBe(200);
    const answer = { sessionId: calleeSession, kind: 'answer', payload: { type: 'answer', sdp: 'v=0\r\n' } };
    expect((await request(`/calls/${call._id}/signals`, 1, answer)).status).toBe(200);
    expect((await request(`/calls/${call._id}/signals`, 0, offer)).status).toBe(409);
    expect((await request(`/calls/${call._id}/signals`, 1, { sessionId: calleeSession, kind: 'ice',
      payload: { candidate: 'candidate:1', sdpMid: '0', sdpMLineIndex: 0 } })).status).toBe(200);
    const restored = (await request(`/calls/${call._id}`, 0)).data;
    expect(restored.signals.map((signal: any) => signal.kind)).toEqual(['offer', 'answer', 'ice']);
    expect((await request(`/calls/${call._id}/heartbeat`, 0, { sessionId: 'wrong-browser-tab' })).status).toBe(409);
    expect((await request(`/calls/${call._id}/heartbeat`, 0, { sessionId: callerSession })).status).toBe(200);
    expect((await request(`/calls/${call._id}/end`, 1, { sessionId: 'unselected-tab', reason: 'ended' })).status).toBe(409);
    expect((await request(`/calls/${call._id}/end`, 1, { sessionId: calleeSession, reason: 'ended' })).status).toBe(200);
    expect((await request(`/calls/${call._id}/signals`, 0, offer)).status).toBe(409);
    expect((await request('/calls/current', 0)).data).toBeNull();
  });

  it('reserves both participants atomically and releases them after decline or hangup', async () => {
    const crossed = await Promise.all([
      start(), request(`/conversations/${conversationId}/calls`, 1, { sessionId: calleeSession }),
    ]);
    expect(crossed.map(response => response.status).sort()).toEqual([201, 409]);
    const winner = crossed.find(response => response.status === 201)!.data;
    const receiver = String(winner.callee._id) === users[0] ? 0 : 1;
    await request(`/calls/${winner._id}/end`, receiver, { sessionId: 'receiver-declines', reason: 'declined' });
    expect((await start()).status).toBe(201);
    const call = (await request('/calls/current', 0)).data;
    await request(`/calls/${call._id}/end`, 0, { sessionId: callerSession, reason: 'ended' });
    expect((await start()).status).toBe(201);
    expect(await VideoCall.countDocuments({ state: 'ended' })).toBe(2);
  });

  it('expires unanswered and disconnected calls so users cannot stay busy indefinitely', async () => {
    let call = (await start()).data;
    await VideoCall.collection.updateOne({ _id: new mongoose.Types.ObjectId(call._id) }, { $set: { createdAt: new Date(Date.now() - 46000) } });
    expect((await request('/calls/current', 1)).data).toBeNull();
    expect((await request(`/calls/${call._id}`, 0)).data.reason).toBe('missed');
    call = (await start()).data;
    await request(`/calls/${call._id}/accept`, 1, { sessionId: calleeSession });
    await VideoCall.collection.updateOne({ _id: new mongoose.Types.ObjectId(call._id) }, { $set: { callerSeenAt: new Date(Date.now() - 46000) } });
    expect((await request('/calls/current', 1)).data).toBeNull();
    expect((await request(`/calls/${call._id}`, 1)).data.reason).toBe('disconnected');
    expect((await start()).status).toBe(201);
  });

  it('validates signal size and returns expiring TURN credentials without exposing the server secret', async () => {
    process.env.WEBRTC_TURN_URLS = 'turn:turn.example.com:3478,turns:turn.example.com:5349';
    process.env.WEBRTC_TURN_SECRET = 'test-coturn-secret';
    const config = (await request('/calls/config', 0)).data;
    expect(config.turnConfigured).toBe(true);
    const turn = config.iceServers[1];
    expect(turn.credential).toBe(createHmac('sha1', process.env.WEBRTC_TURN_SECRET).update(turn.username).digest('base64'));
    expect(JSON.stringify(config)).not.toContain(process.env.WEBRTC_TURN_SECRET);
    expect(Number(turn.username.split(':')[0])).toBeGreaterThan(Date.now() / 1000);
    const call = (await start()).data;
    await request(`/calls/${call._id}/accept`, 1, { sessionId: calleeSession });
    expect((await request(`/calls/${call._id}/signals`, 0, { sessionId: callerSession, kind: 'offer', payload: { type: 'offer', sdp: 'x'.repeat(65000) } })).status).toBe(400);
    expect((await request(`/calls/${call._id}/signals`, 0, { sessionId: callerSession, kind: 'ice', payload: { candidate: 'x', sdpMid: '0', sdpMLineIndex: -1 } })).status).toBe(400);
  });
});
