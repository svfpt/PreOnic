import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { protect, requireCompleteProfile } from '../middlewares/auth.middleware';
import User from '../models/User.model';
import { Conversation, Message } from '../models/Message.model';
import { AuthRequest } from '../types';
import { createLogger } from '../utils/logger';
import { isMessagingOnline, publishMessagingEvent, subscribeToMessages } from '../services/messaging-events';
import ChatAttachment from '../models/ChatAttachment.model';
import attachmentRoutes from './chat-attachment.routes';
import Product from '../models/Product.model';
import ConversationRedirect from '../models/ConversationRedirect.model';
import { ensureConversationIntegrity, getOrCreateConversation } from '../services/conversation.service';
import videoCallRoutes from './video-call.routes';

const log = createLogger('Messaging');

const router = Router();

router.use(protect);
router.use(async (req: AuthRequest, res: Response, next) => {
  try {
    // Finish the idempotent legacy merge before reads, uploads, or sends can race it.
    await ensureConversationIntegrity();
    const match = /^\/conversations\/([a-f\d]{24})(?=\/|\?|$)/i.exec(req.url);
    if (match) {
      const redirect = await ConversationRedirect.findById(match[1]).select('conversationId');
      if (redirect) {
        if (!await Conversation.exists({ _id: redirect.conversationId, participants: req.user!.id })) {
          res.status(404).json({ success: false, message: 'Cuộc trò chuyện không tồn tại' }); return;
        }
        req.url = req.url.replace(`/conversations/${match[1]}`, `/conversations/${redirect.conversationId}`);
      }
    }
    next();
  } catch (err) { next(err); }
});
router.use(attachmentRoutes);
router.use(videoCallRoutes);

async function notifyPresence(userId: string): Promise<void> {
  const conversations = await Conversation.find({ participants: userId }).select('participants');
  const partners = conversations.flatMap(conversation => conversation.participants.map(String)).filter(id => id !== userId);
  publishMessagingEvent(partners, { type: 'presence', userId, online: isMessagingOnline(userId) });
}

// Bearer authentication stays in the header, never in URLs or logs.
router.get('/events', (req: AuthRequest, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  const unsubscribe = subscribeToMessages(req.user!.id, res);
  void notifyPresence(req.user!.id).catch(() => undefined);
  res.write('data: {"type":"connected"}\n\n');
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 20000);
  // Reauthenticate periodically, including account deactivation and JWT expiry.
  const expiry = setTimeout(() => res.end(), 60000);
  res.on('close', () => {
    clearInterval(heartbeat);
    clearTimeout(expiry);
    unsubscribe();
    void notifyPresence(req.user!.id).catch(() => undefined);
  });
});

// Đếm số tin nhắn chưa đọc theo từng cuộc trò chuyện cho 1 user.
// Trả về map { conversationId: count }.
async function getUnreadCountMap(
  userId: string,
  conversationIds: mongoose.Types.ObjectId[]
): Promise<Record<string, number>> {
  if (conversationIds.length === 0) return {};
  const rows = await Message.aggregate([
    {
      $match: {
        conversationId: { $in: conversationIds },
        sender: { $ne: new mongoose.Types.ObjectId(userId) },
        readBy: { $ne: new mongoose.Types.ObjectId(userId) },
      },
    },
    { $group: { _id: '$conversationId', count: { $sum: 1 } } },
  ]);
  const map: Record<string, number> = {};
  rows.forEach((r: any) => { map[r._id.toString()] = r.count; });
  return map;
}

// GET /messaging/conversations - list user's conversations
router.get('/conversations', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const conversations = await Conversation.find({ participants: userId })
      .populate('participants', 'fullName email role')
      .populate('productId', 'name image priceMin priceMax unit')
      .sort({ lastMessageAt: -1 });

    const unreadMap = await getUnreadCountMap(
      userId,
      conversations.map((c) => c._id as mongoose.Types.ObjectId)
    );

    const redirects = await ConversationRedirect.find({ conversationId: { $in: conversations.map(conversation => conversation._id) } }).select('conversationId');

    const result = conversations.map((conversation) => {
      const otherParticipant = conversation.participants.find(
        (participant: any) => participant._id.toString() !== userId
      );

      return {
        _id: conversation._id,
        aliases: redirects.filter(redirect => String(redirect.conversationId) === String(conversation._id)).map(redirect => String(redirect._id)),
        partner: otherParticipant || null,
        online: otherParticipant ? isMessagingOnline(String((otherParticipant as any)._id)) : false,
        product: conversation.productId || null,
        lastMessage: conversation.lastMessage,
        lastMessageAt: conversation.lastMessageAt,
        unreadCount: unreadMap[(conversation._id as mongoose.Types.ObjectId).toString()] || 0,
      };
    });

    res.json({ success: true, data: result });
  } catch (err) {
    log.error('Failed to load conversations', err);
    res.status(500).json({
      success: false,
      message: 'Không thể tải danh sách cuộc trò chuyện',
    });
  }
});

// GET /messaging/unread-count - tổng số tin chưa đọc + các cuộc trò chuyện có tin mới
// Phục vụ chuông thông báo Tin nhắn (deep-link thẳng vào cuộc trò chuyện).
router.get('/unread-count', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const conversations = await Conversation.find({ participants: userId })
      .populate('participants', 'fullName email role')
      .sort({ lastMessageAt: -1 });

    const unreadMap = await getUnreadCountMap(
      userId,
      conversations.map((c) => c._id as mongoose.Types.ObjectId)
    );

    let total = 0;
    const items = conversations
      .map((conversation) => {
        const cid = (conversation._id as mongoose.Types.ObjectId).toString();
        const count = unreadMap[cid] || 0;
        total += count;
        const partner = conversation.participants.find(
          (p: any) => p._id.toString() !== userId
        ) as any;
        return {
          conversationId: cid,
          partnerName: partner?.fullName || 'Người dùng',
          partnerRole: partner?.role || 'farmer',
          lastMessage: conversation.lastMessage || '',
          lastMessageAt: conversation.lastMessageAt,
          unreadCount: count,
        };
      })
      .filter((c) => c.unreadCount > 0);

    res.json({ success: true, data: { total, conversations: items } });
  } catch (err) {
    log.error('Failed to load unread count', err);
    res.status(500).json({ success: false, message: 'Không thể tải số tin chưa đọc' });
  }
});

// POST /messaging/conversations - create or get a conversation with a user
router.post('/conversations', requireCompleteProfile, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { partnerId, productId } = req.body;

    if (!partnerId) {
      res.status(400).json({
        success: false,
        message: 'partnerId la bat buoc',
      });
      return;
    }

    if (typeof partnerId !== 'string' || !mongoose.Types.ObjectId.isValid(partnerId)) {
      res.status(400).json({
        success: false,
        message: 'partnerId khong hop le',
      });
      return;
    }

    if (partnerId.toLowerCase() === userId.toLowerCase()) {
      res.status(400).json({
        success: false,
        message: 'Khong the tao cuoc tro chuyen voi chinh ban',
      });
      return;
    }

    const partner = await User.findById(partnerId).select('fullName email role isActive isHidden');
    if (!partner || !partner.isActive || partner.isHidden) {
      res.status(404).json({
        success: false,
        message: 'Nguoi dung khong ton tai hoac da bi vo hieu hoa',
      });
      return;
    }

    if (productId) {
      if (typeof productId !== 'string' || !mongoose.isValidObjectId(productId)) {
        res.status(400).json({ success: false, message: 'Sản phẩm không hợp lệ' });
        return;
      }
      const product = await Product.findById(productId);
      if (!product || String(product.createdBy || product.seller?.userId) !== partnerId) {
        res.status(400).json({ success: false, message: 'Sản phẩm không thuộc người bán này' });
        return;
      }
    }

    const conversation = await getOrCreateConversation(userId, partnerId, productId);
    if (!conversation) throw new Error('Conversation creation failed');

    await conversation.populate('participants', 'fullName email role');
    await conversation.populate('productId', 'name image priceMin priceMax unit');
    if (productId) publishMessagingEvent(conversation.participants.map((participant: any) => String(participant._id)), {
      type: 'product', conversationId: String(conversation._id), product: conversation.productId,
    });

    const otherParticipant = conversation.participants.find(
      (participant: any) => participant._id.toString() !== userId
    );
    const aliases = await ConversationRedirect.find({ conversationId: conversation._id }).select('_id');

    res.json({
      success: true,
      data: {
        _id: conversation._id,
        aliases: aliases.map(alias => String(alias._id)),
        partner: otherParticipant || null,
        product: conversation.productId || null,
        lastMessage: conversation.lastMessage,
        lastMessageAt: conversation.lastMessageAt,
      },
    });
  } catch (err) {
    log.error('Failed to create conversation', err);
    res.status(500).json({
      success: false,
      message: 'Khong the tao cuoc tro chuyen',
    });
  }
});

// GET /messaging/conversations/:id/messages - get messages in a conversation
router.get('/conversations/:id/products', async (req: AuthRequest, res: Response) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      res.status(400).json({ success: false, message: 'Cuộc trò chuyện không hợp lệ' }); return;
    }
    const conversation = await Conversation.findOne({ _id: req.params.id, participants: req.user!.id });
    if (!conversation) { res.status(404).json({ success: false, message: 'Cuộc trò chuyện không tồn tại' }); return; }
    const before = req.query.before;
    if (before && (typeof before !== 'string' || !mongoose.isValidObjectId(before))) {
      res.status(400).json({ success: false, message: 'Mốc tải sản phẩm không hợp lệ' }); return;
    }
    const search = String(req.query.search || '').trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const products = await Product.find({ isActive: true,
      $or: [{ createdBy: { $in: conversation.participants } }, { 'seller.userId': { $in: conversation.participants } }],
      ...(search ? { name: { $regex: search, $options: 'i' } } : {}),
      ...(before ? { _id: { $lt: before } } : {}),
    }).select('name image priceMin priceMax unit').sort({ _id: -1 }).limit(31);
    const data = products.slice(0, 30);
    res.json({ success: true, data, pagination: { hasMore: products.length > 30, nextCursor: data.length ? data[data.length - 1]._id : null } });
  } catch { res.status(500).json({ success: false, message: 'Không thể tải sản phẩm để gắn vào trò chuyện' }); }
});

router.post('/conversations/:id/product', requireCompleteProfile, async (req: AuthRequest, res: Response) => {
  try {
    const { productId } = req.body;
    if (!mongoose.isValidObjectId(req.params.id) || typeof productId !== 'string' || !mongoose.isValidObjectId(productId)) {
      res.status(400).json({ success: false, message: 'Sản phẩm không hợp lệ' }); return;
    }
    const conversation = await Conversation.findOne({ _id: req.params.id, participants: req.user!.id });
    if (!conversation) { res.status(404).json({ success: false, message: 'Cuộc trò chuyện không tồn tại' }); return; }
    const product = await Product.findOne({ _id: productId, isActive: true,
      $or: [{ createdBy: { $in: conversation.participants } }, { 'seller.userId': { $in: conversation.participants } }],
    }).select('name image priceMin priceMax unit');
    if (!product) { res.status(400).json({ success: false, message: 'Chỉ được gắn sản phẩm của hai bên trong cuộc trò chuyện' }); return; }
    await Conversation.updateOne({ _id: conversation._id }, { $set: { productId: product._id } });
    publishMessagingEvent(conversation.participants.map(String), { type: 'product', conversationId: req.params.id, product });
    res.json({ success: true, data: product });
  } catch { res.status(500).json({ success: false, message: 'Không thể gắn sản phẩm. Vui lòng thử lại.' }); }
});

router.get('/conversations/:id/messages', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const conversationId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      res.status(400).json({ success: false, message: 'ID khong hop le' });
      return;
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    });

    if (!conversation) {
      res.status(404).json({
        success: false,
        message: 'Cuoc tro chuyen khong ton tai',
      });
      return;
    }

    const limit = Math.max(1, Math.min(parseInt(req.query.limit as string, 10) || 50, 100));
    const { before, after } = req.query;
    if ((before && after) || [before, after].some(value => value && (typeof value !== 'string' || !mongoose.isValidObjectId(value)))) {
      res.status(400).json({ success: false, message: 'Mốc tải tin nhắn không hợp lệ' });
      return;
    }

    const messages = await Message.find({ conversationId,
      ...(before ? { _id: { $lt: before } } : after ? { _id: { $gt: after } } : {}),
    })
      .populate('sender', 'fullName email role')
      .populate('attachments', 'originalName mimeType size')
      .sort({ _id: after ? 1 : -1 })
      .limit(limit + 1);

    const hasMore = messages.length > limit;
    const batch = messages.slice(0, limit);
    const data = after ? batch : batch.reverse();
    res.json({ success: true, data, pagination: { hasMore,
      nextCursor: data.length ? String(after ? data[data.length - 1]._id : data[0]._id) : null } });
  } catch (err) {
    log.error('Failed to load messages', err);
    res.status(500).json({
      success: false,
      message: 'Khong the tai tin nhan',
    });
  }
});

// Reading history never marks unseen messages as read. Clients acknowledge only visible bubbles.
router.post('/conversations/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    const { messageIds } = req.body;
    if (!mongoose.isValidObjectId(req.params.id) || !Array.isArray(messageIds) || messageIds.length > 100
      || messageIds.some(id => typeof id !== 'string' || !mongoose.isValidObjectId(id))) {
      res.status(400).json({ success: false, message: 'Danh sách tin nhắn không hợp lệ' });
      return;
    }
    const conversation = await Conversation.findOne({ _id: req.params.id, participants: req.user!.id });
    if (!conversation) { res.status(404).json({ success: false, message: 'Cuộc trò chuyện không tồn tại' }); return; }
    const visible = await Message.find({ _id: { $in: messageIds }, conversationId: conversation._id,
      sender: { $ne: req.user!.id }, readBy: { $ne: req.user!.id } }).select('_id');
    const ids = visible.map(message => String(message._id));
    await Message.updateMany({ _id: { $in: ids } }, { $addToSet: { readBy: req.user!.id } });
    if (ids.length) publishMessagingEvent(conversation.participants.map(String), {
      type: 'read', conversationId: req.params.id, userId: req.user!.id, messageIds: ids,
    });
    res.json({ success: true, data: { messageIds: ids } });
  } catch (err) {
    log.error('Failed to mark visible messages read', err);
    res.status(500).json({ success: false, message: 'Không thể cập nhật trạng thái đã đọc' });
  }
});

router.post('/conversations/:id/typing', async (req: AuthRequest, res: Response) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id) || typeof req.body.typing !== 'boolean') {
      res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ' }); return;
    }
    const conversation = await Conversation.findOne({ _id: req.params.id, participants: req.user!.id });
    if (!conversation) { res.status(404).json({ success: false, message: 'Cuộc trò chuyện không tồn tại' }); return; }
    publishMessagingEvent(conversation.participants.map(String).filter(id => id !== req.user!.id), {
      type: 'typing', conversationId: req.params.id, userId: req.user!.id, typing: req.body.typing,
    });
    res.json({ success: true });
  } catch { res.status(500).json({ success: false, message: 'Không thể cập nhật trạng thái nhập' }); }
});

// Resync receipts missed while the browser was disconnected, including older loaded messages.
router.post('/conversations/:id/receipts', async (req: AuthRequest, res: Response) => {
  try {
    const { messageIds } = req.body;
    if (!mongoose.isValidObjectId(req.params.id) || !Array.isArray(messageIds) || messageIds.length > 100
      || messageIds.some(id => typeof id !== 'string' || !mongoose.isValidObjectId(id))) {
      res.status(400).json({ success: false, message: 'Danh sách tin nhắn không hợp lệ' }); return;
    }
    if (!await Conversation.exists({ _id: req.params.id, participants: req.user!.id })) {
      res.status(404).json({ success: false, message: 'Cuộc trò chuyện không tồn tại' }); return;
    }
    const receipts = await Message.find({ _id: { $in: messageIds }, conversationId: req.params.id }).select('readBy');
    res.json({ success: true, data: receipts });
  } catch { res.status(500).json({ success: false, message: 'Không thể tải trạng thái đã đọc' }); }
});

// POST /messaging/conversations/:id/messages - send a message
router.post('/conversations/:id/messages', requireCompleteProfile, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const conversationId = req.params.id;
    const { text = '', attachments = [] } = req.body;

    if (typeof text !== 'string' || text.trim().length > 5000 || !Array.isArray(attachments)
      || attachments.length > 5 || (!text.trim() && !attachments.length)
      || attachments.some((id: unknown) => typeof id !== 'string' || !mongoose.isValidObjectId(id))
      || new Set(attachments).size !== attachments.length) {
      res.status(400).json({
        success: false,
        message: 'Tin nhắn cần nội dung hoặc tệp đính kèm, tối đa 5000 ký tự và 5 tệp',
      });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      res.status(400).json({ success: false, message: 'ID khong hop le' });
      return;
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    });

    if (!conversation) {
      res.status(404).json({
        success: false,
        message: 'Cuoc tro chuyen khong ton tai',
      });
      return;
    }

    const files = await ChatAttachment.find({ _id: { $in: attachments }, conversationId, uploadedBy: userId, messageId: null, deleting: { $ne: true } });
    if (files.length !== attachments.length) {
      res.status(400).json({ success: false, message: 'Tệp đính kèm không hợp lệ hoặc đã được gửi' });
      return;
    }

    const messageId = new mongoose.Types.ObjectId();
    const claimed = await ChatAttachment.updateMany({ _id: { $in: attachments }, conversationId, uploadedBy: userId, messageId: null, deleting: { $ne: true } },
      { $set: { messageId } });
    if (claimed.modifiedCount !== attachments.length) {
      await ChatAttachment.updateMany({ messageId }, { $set: { messageId: null } });
      res.status(400).json({ success: false, message: 'Tệp đã được gửi trong một tin nhắn khác' });
      return;
    }
    let message;
    try {
      message = await Message.create({
        _id: messageId, conversationId, sender: userId, text: text.trim(), attachments, readBy: [userId],
      });
    } catch (err) {
      await ChatAttachment.updateMany({ messageId }, { $set: { messageId: null } });
      throw err;
    }
    conversation.lastMessage = (text.trim() || `📎 ${files.length} tệp đính kèm`).substring(0, 100);
    conversation.lastMessageAt = new Date();
    await conversation.save();

    await message.populate('sender', 'fullName email role');
    await message.populate('attachments', 'originalName mimeType size');

    publishMessagingEvent(conversation.participants.map(String), {
      type: 'message', conversationId, message,
    });

    res.status(201).json({ success: true, data: message });
  } catch (err) {
    log.error('Failed to send message', err);
    res.status(500).json({
      success: false,
      message: 'Khong the gui tin nhan',
    });
  }
});

export default router;
