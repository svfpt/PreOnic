import express from 'express';
import mongoose from 'mongoose';
import { Server } from 'http';
import { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';
import { Writable } from 'stream';
import axios from 'axios';
import { getCloudinary } from '../config/cloudinary';
import messagingRoutes from '../routes/messaging.routes';
import { errorHandler } from '../middlewares/error.middleware';
import User from '../models/User.model';
import { Conversation, Message } from '../models/Message.model';
import { connectTestDb, disconnectTestDb, clearTestDb } from './helpers/db';
import ChatAttachment from '../models/ChatAttachment.model';
import { cleanupPendingAttachments } from '../services/chat-attachment-cleanup';
import { ProductService } from '../services/product.service';
import { conversationPairKey, migrateConversations } from '../services/conversation.service';
import ConversationRedirect from '../models/ConversationRedirect.model';

jest.mock('../config/cloudinary', () => ({ getCloudinary: jest.fn() }));

describe('Private real time messaging', () => {
  let server: Server;
  let base: string;
  let ids: string[];
  let tokens: string[];
  const streams: AbortController[] = [];
  const uploadStream = jest.fn();
  const cloudUrl = jest.fn();

  beforeAll(async () => {
    await connectTestDb();
    process.env.JWT_SECRET = 'messaging-test-secret';
    const app = express();
    app.use(express.json());
    app.use('/messaging', messagingRoutes);
    app.use(errorHandler);
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/messaging`;
  });
  beforeEach(async () => {
    await clearTestDb();
    // Admin fixtures bypass profile completion so these tests focus on membership.
    const users = await User.create([0, 1, 2].map(i => ({
      email: `chat${i}@test.local`, password: 'password123', role: 'admin',
      fullName: `User ${i}`, firstName: 'Test', lastName: 'User', isVerified: true,
    })));
    ids = users.map(user => String(user._id));
    tokens = ids.map(id => jwt.sign({ id }, process.env.JWT_SECRET!));
    uploadStream.mockImplementation((_options, callback) => new Writable({
      write(_chunk, _encoding, done) { done(); },
      final(done) { callback(null, { public_id: `preonic/chat/${new mongoose.Types.ObjectId()}` }); done(); },
    }));
    cloudUrl.mockReturnValue('https://res.cloudinary.com/test/raw/authenticated/s--signed--/test');
    (getCloudinary as jest.Mock).mockReturnValue({ uploader: { upload_stream: uploadStream, destroy: jest.fn().mockResolvedValue({ result: 'ok' }) }, url: cloudUrl });
  });
  afterEach(() => streams.splice(0).forEach(controller => controller.abort()));
  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await disconnectTestDb();
  });

  async function request(path: string, user: number, data?: object) {
    const response = await fetch(base + path, {
      method: data ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${tokens[user]}`, 'Content-Type': 'application/json' },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    return { status: response.status, body: await response.json() as any };
  }

  async function openStream(user: number) {
    const controller = new AbortController();
    streams.push(controller);
    const response = await fetch(base + '/events', {
      headers: { Authorization: `Bearer ${tokens[user]}` }, signal: controller.signal,
    });
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    return async function nextEvent(): Promise<any> {
      while (!buffer.includes('\n\n')) {
        const chunk = await reader.read();
        if (chunk.done) throw new Error('Stream ended');
        buffer += decoder.decode(chunk.value, { stream: true });
      }
      const boundary = buffer.indexOf('\n\n');
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const event = JSON.parse(frame.slice(6));
      return event.type === 'presence' ? nextEvent() : event;
    };
  }

  async function uploadFile(conversationId: string, user: number, name = 'notes.txt', content = 'Hello') {
    const form = new FormData();
    form.append('file', new Blob([content]), name);
    const response = await fetch(`${base}/conversations/${conversationId}/attachments`, {
      method: 'POST', headers: { Authorization: `Bearer ${tokens[user]}` }, body: form,
    });
    return { status: response.status, body: await response.json() as any };
  }

  it('uploads privately, sends attachment-only messages in realtime and restricts downloads to participants', async () => {
    const created = await request('/conversations', 0, { partnerId: ids[1] });
    const id = created.body.data._id;
    const uploaded = await uploadFile(id, 0);
    expect(uploaded.status).toBe(201);
    expect(uploadStream.mock.calls[0][0]).toMatchObject({ resource_type: 'raw', type: 'authenticated' });
    const file = uploaded.body.data;
    expect(file.originalName).toBe('notes.txt');
    expect(file.publicId).toBeUndefined();
    expect((await request(`/attachments/${file._id}`, 1)).status).toBe(404);
    const event = await openStream(1);
    await event();
    const sent = await request(`/conversations/${id}/messages`, 0, { attachments: [file._id] });
    expect(sent.status).toBe(201);
    expect((await event()).message.attachments[0].originalName).toBe('notes.txt');
    expect((await request(`/attachments/${file._id}`, 2)).status).toBe(404);
    jest.spyOn(axios, 'get').mockResolvedValue({ data: Buffer.from('Hello') });
    const download = await fetch(`${base}/attachments/${file._id}`, { headers: { Authorization: `Bearer ${tokens[1]}` } });
    expect(download.status).toBe(200);
    expect(download.headers.get('content-disposition')).toContain('attachment;');
    expect(await download.text()).toBe('Hello');
    expect(cloudUrl).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ type: 'authenticated', sign_url: true }));
    const history = await request(`/conversations/${id}/messages`, 1);
    expect(history.body.data[0].attachments[0]._id).toBe(file._id);
    expect((await request(`/conversations/${id}/messages`, 0, { attachments: [file._id] })).status).toBe(400);
  });

  it('rejects outsider uploads, spoofed images, oversized files and attachments from other conversations', async () => {
    const first = (await request('/conversations', 0, { partnerId: ids[1] })).body.data._id;
    const other = (await request('/conversations', 0, { partnerId: ids[2] })).body.data._id;
    expect((await uploadFile(first, 2)).status).toBe(404);
    expect((await uploadFile(first, 0, 'fake.png', '<html>fake</html>')).status).toBe(400);
    expect((await uploadFile(first, 0, 'large.txt', 'a'.repeat(5 * 1024 * 1024 + 1))).status).toBe(400);
    const file = (await uploadFile(first, 0)).body.data;
    expect((await request(`/conversations/${other}/messages`, 0, { attachments: [file._id] })).status).toBe(400);
    expect((await request(`/conversations/${first}/messages`, 1, { attachments: [file._id] })).status).toBe(400);
    expect(await Message.countDocuments()).toBe(0);
  });

  it('requires authentication and prevents nonparticipants reading or sending', async () => {
    expect((await fetch(base + '/events')).status).toBe(401);
    const created = await request('/conversations', 0, { partnerId: ids[1] });
    const id = created.body.data._id;
    expect((await request(`/conversations/${id}/messages`, 2)).status).toBe(404);
    expect((await request(`/conversations/${id}/messages`, 2, { text: 'intrusion' })).status).toBe(404);
    expect(await Message.countDocuments()).toBe(0);
  });

  it('pushes persisted messages to both participants, updates unread counts, and reuses the conversation', async () => {
    const created = await request('/conversations', 0, { partnerId: ids[1] });
    const id = created.body.data._id;
    expect((await request('/conversations', 1, { partnerId: ids[0] })).body.data._id).toBe(id);
    expect(await Conversation.countDocuments()).toBe(1);
    const senderEvent = await openStream(0);
    const recipientEvent = await openStream(1);
    expect((await senderEvent()).type).toBe('connected');
    expect((await recipientEvent()).type).toBe('connected');
    const sent = await request(`/conversations/${id}/messages`, 0, { text: 'Xin chào doanh nghiệp' });
    expect(sent.status).toBe(201);
    for (const next of [senderEvent, recipientEvent]) {
      const event = await next();
      expect(event.type).toBe('message');
      expect(event.message._id).toBe(sent.body.data._id);
      expect(event.conversationId).toBe(id);
    }
    expect((await request('/unread-count', 1)).body.data.total).toBe(1);
    const history = await request(`/conversations/${id}/messages`, 1);
    expect(history.body.data[0].text).toBe('Xin chào doanh nghiệp');
    expect((await request('/unread-count', 1)).body.data.total).toBe(1);
    await request(`/conversations/${id}/read`, 1, { messageIds: [sent.body.data._id] });
    expect((await request('/unread-count', 1)).body.data.total).toBe(0);
    expect((await recipientEvent()).type).toBe('read');
  });

  it('rejects malformed or oversized messages without saving them', async () => {
    const created = await request('/conversations', 0, { partnerId: ids[1] });
    for (const text of [123, {}, ' ', 'a'.repeat(5001)]) {
      expect((await request(`/conversations/${created.body.data._id}/messages`, 0, { text })).status).toBe(400);
    }
    expect(await Message.countDocuments()).toBe(0);
  });

  it('paginates stable history while new messages arrive and marks only acknowledged messages read', async () => {
    const id = (await request('/conversations', 0, { partnerId: ids[1] })).body.data._id;
    const old = await Message.insertMany(Array.from({ length: 55 }, (_, i) => ({
      conversationId: id, sender: ids[0], text: `message ${i}`, readBy: [ids[0]],
    })));
    const first = await request(`/conversations/${id}/messages`, 1);
    expect(first.body.data).toHaveLength(50);
    expect(first.body.pagination.hasMore).toBe(true);
    expect((await request('/unread-count', 1)).body.data.total).toBe(55);
    const sent = await request(`/conversations/${id}/messages`, 0, { text: 'new message' });
    const earlier = await request(`/conversations/${id}/messages?before=${first.body.pagination.nextCursor}`, 1);
    expect(earlier.body.data.map((message: any) => message._id)).toEqual(old.slice(0, 5).map(message => String(message._id)));
    expect(earlier.body.pagination.hasMore).toBe(false);
    const newer = await request(`/conversations/${id}/messages?after=${first.body.data[49]._id}`, 1);
    expect(newer.body.data.map((message: any) => message._id)).toEqual([sent.body.data._id]);
    const idsToRead = first.body.data.slice(-2).map((message: any) => message._id);
    expect((await request(`/conversations/${id}/read`, 2, { messageIds: idsToRead })).status).toBe(404);
    await request(`/conversations/${id}/read`, 1, { messageIds: idsToRead });
    expect((await request('/unread-count', 1)).body.data.total).toBe(54);
    expect((await request(`/conversations/${id}/receipts`, 2, { messageIds: idsToRead })).status).toBe(404);
    const receipts = await request(`/conversations/${id}/receipts`, 0, { messageIds: idsToRead });
    expect(receipts.body.data).toHaveLength(2);
    expect(receipts.body.data.every((receipt: any) => receipt.readBy.includes(ids[1]))).toBe(true);
    const again = await request(`/conversations/${id}/messages`, 0);
    expect(again.body.data.filter((message: any) => idsToRead.includes(message._id)).every((message: any) => message.readBy.includes(ids[1]))).toBe(true);
  });

  it('deletes only owned pending uploads and expires abandoned files without touching sent files', async () => {
    const id = (await request('/conversations', 0, { partnerId: ids[1] })).body.data._id;
    const first = (await uploadFile(id, 0)).body.data;
    const remove = (fileId: string, user: number) => fetch(`${base}/attachments/${fileId}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${tokens[user]}` },
    });
    expect((await remove(first._id, 1)).status).toBe(404);
    expect((await remove(first._id, 0)).status).toBe(200);
    expect(await ChatAttachment.findById(first._id)).toBeNull();
    const pending = (await uploadFile(id, 0)).body.data;
    const sent = (await uploadFile(id, 0)).body.data;
    await request(`/conversations/${id}/messages`, 0, { attachments: [sent._id] });
    const oldDate = new Date(Date.now() - 8 * 86400000);
    await ChatAttachment.collection.updateMany({}, { $set: { createdAt: oldDate, updatedAt: oldDate } });
    await cleanupPendingAttachments();
    expect(await ChatAttachment.findById(pending._id)).toBeNull();
    expect(await ChatAttachment.findById(sent._id)).not.toBeNull();
    expect((await remove(sent._id, 0)).status).toBe(404);
  });

  it('reuses one conversation for the same pair across product pages and rejects forged product context', async () => {
    const product = await ProductService.create({ name: 'Xoai', location: 'VN', farm: 'Farm', category: 'fruit',
      region: 'south', priceMin: 10000, priceMax: 15000 }, ids[1], 'Seller');
    const body = { partnerId: ids[1], productId: String(product._id) };
    const first = await request('/conversations', 0, body);
    expect(first.body.data.product.name).toBe('Xoai');
    expect((await request('/conversations', 0, body)).body.data._id).toBe(first.body.data._id);
    expect((await request('/conversations', 0, { ...body, partnerId: ids[2] })).status).toBe(400);
    expect((await request('/conversations', 0, { partnerId: ids[1] })).body.data._id).toBe(first.body.data._id);
    const other = await ProductService.create({ name: 'Cam', location: 'VN', farm: 'Farm', category: 'fruit',
      region: 'south', priceMin: 10000, priceMax: 15000 }, ids[1], 'Seller');
    expect((await request('/conversations', 0, { partnerId: ids[1], productId: String(other._id) })).body.data._id).toBe(first.body.data._id);
    expect(await Conversation.countDocuments()).toBe(1);
    expect((await request('/conversations', 0)).body.data.find((chat: any) => chat._id === first.body.data._id).product.name).toBe('Cam');
  });

  it('prevents duplicate conversations when both users start chatting simultaneously', async () => {
    const responses = await Promise.all(Array.from({ length: 12 }, (_, i) =>
      request('/conversations', i % 2, { partnerId: ids[(i + 1) % 2] })));
    expect(responses.every(response => response.status === 200)).toBe(true);
    expect(new Set(responses.map(response => response.body.data._id)).size).toBe(1);
    expect(await Conversation.countDocuments()).toBe(1);
    expect((await Conversation.findOne())?.pairKey).toBe(conversationPairKey(ids[0], ids[1]));
  });

  it('merges legacy duplicates without losing messages, read states, files or old deep links', async () => {
    const first = await Conversation.create({ participants: [ids[0], ids[1]] });
    const second = await Conversation.create({ participants: [ids[1], ids[0]] });
    const [earlier, later] = await Message.create([
      { conversationId: first._id, sender: ids[0], text: 'Earlier', readBy: [ids[0], ids[1]] },
      { conversationId: second._id, sender: ids[1], text: 'Later', readBy: [ids[1]] },
    ]);
    const uploaded = await ChatAttachment.create({ conversationId: second._id, uploadedBy: ids[1],
      originalName: 'notes.txt', mimeType: 'text/plain', size: 5, publicId: 'private-file', messageId: later._id });
    await Message.updateOne({ _id: later._id }, { $set: { attachments: [uploaded._id] } });
    expect((await migrateConversations()).merged).toBe(1);
    expect((await migrateConversations()).merged).toBe(0);
    expect(await Conversation.countDocuments()).toBe(1);
    expect(await Message.countDocuments()).toBe(2);
    expect(String((await ChatAttachment.findById(uploaded._id))?.conversationId)).toBe(String(first._id));
    expect((await ConversationRedirect.findById(second._id))?.snapshot.participants.map(String)).toEqual([ids[1], ids[0]]);
    const listed = await request('/conversations', 0);
    expect(listed.body.data).toHaveLength(1);
    expect(listed.body.data[0]).toMatchObject({ _id: String(first._id), lastMessage: 'Later', unreadCount: 1, aliases: [String(second._id)] });
    const history = await request(`/conversations/${second._id}/messages`, 0);
    expect(history.body.data.map((message: any) => message.text)).toEqual(['Earlier', 'Later']);
    expect(history.body.data[0].readBy).toContain(ids[1]);
    expect(history.body.data[1].attachments[0]._id).toBe(String(uploaded._id));
    const sent = await request(`/conversations/${second._id}/messages`, 0, { text: 'Using the old link' });
    expect(sent.status).toBe(201);
    expect(sent.body.data.conversationId).toBe(String(first._id));
    expect((await request(`/conversations/${second._id}/messages`, 2)).status).toBe(404);
    expect((await Message.findById(earlier._id))?.text).toBe('Earlier');
  });

  it('rolls back the entire merge if preserving legacy metadata fails', async () => {
    const first = await Conversation.create({ participants: [ids[0], ids[1]] });
    const second = await Conversation.create({ participants: [ids[1], ids[0]] });
    const message = await Message.create({ conversationId: second._id, sender: ids[0], text: 'Must survive', readBy: [ids[0]] });
    const backup = jest.spyOn(ConversationRedirect, 'updateOne').mockRejectedValueOnce(new Error('Simulated backup failure'));
    await expect(migrateConversations()).rejects.toThrow('Simulated backup failure');
    backup.mockRestore();
    expect(await Conversation.countDocuments()).toBe(2);
    expect(String((await Message.findById(message._id))?.conversationId)).toBe(String(second._id));
    expect(await ConversationRedirect.countDocuments()).toBe(0);
    expect((await migrateConversations()).merged).toBe(1);
    expect(await Conversation.findById(first._id)).not.toBeNull();
  });

  it('sends typing events only to the conversation partner and rejects outsiders', async () => {
    const id = (await request('/conversations', 0, { partnerId: ids[1] })).body.data._id;
    const event = await openStream(1);
    await event();
    expect((await request(`/conversations/${id}/typing`, 2, { typing: true })).status).toBe(404);
    expect((await request(`/conversations/${id}/typing`, 0, { typing: 'yes' })).status).toBe(400);
    expect((await request(`/conversations/${id}/typing`, 0, { typing: true })).status).toBe(200);
    expect(await event()).toMatchObject({ type: 'typing', conversationId: id, userId: ids[0], typing: true });
    await request(`/conversations/${id}/typing`, 0, { typing: false });
    expect((await event()).typing).toBe(false);
  });

  it('attaches a product to an existing chat, persists the card and notifies the partner', async () => {
    const id = (await request('/conversations', 0, { partnerId: ids[1] })).body.data._id;
    const body = { name: 'Xoai', location: 'VN', farm: 'Farm', category: 'fruit', region: 'south', priceMin: 10000, priceMax: 15000 };
    const mine = await ProductService.create(body, ids[1], 'Seller');
    const unrelated = await ProductService.create({ ...body, name: 'Unrelated' }, ids[2], 'Other Seller');
    const products = await request(`/conversations/${id}/products`, 0);
    expect(products.body.data.map((product: any) => product._id)).toEqual([String(mine._id)]);
    expect((await request(`/conversations/${id}/products`, 2)).status).toBe(404);
    expect((await request(`/conversations/${id}/product`, 2, { productId: String(mine._id) })).status).toBe(404);
    expect((await request(`/conversations/${id}/product`, 0, { productId: String(unrelated._id) })).status).toBe(400);
    const event = await openStream(1);
    await event();
    const attached = await request(`/conversations/${id}/product`, 0, { productId: String(mine._id) });
    expect(attached.status).toBe(200);
    expect((await event())).toMatchObject({ type: 'product', conversationId: id, product: { name: 'Xoai' } });
    const conversations = await request('/conversations', 1);
    expect(conversations.body.data.find((chat: any) => chat._id === id).product._id).toBe(String(mine._id));
  });
});
