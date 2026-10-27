import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { protect, requireCompleteProfile } from '../middlewares/auth.middleware';
import User from '../models/User.model';
import { Conversation, Message } from '../models/Message.model';
import { AuthRequest } from '../types';
import { createLogger } from '../utils/logger';

const log = createLogger('Messaging');

const router = Router();

router.use(protect);

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
      .sort({ lastMessageAt: -1 });

    const unreadMap = await getUnreadCountMap(
      userId,
      conversations.map((c) => c._id as mongoose.Types.ObjectId)
    );

    const result = conversations.map((conversation) => {
      const otherParticipant = conversation.participants.find(
        (participant: any) => participant._id.toString() !== userId
      );

      return {
        _id: conversation._id,
        partner: otherParticipant || null,
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
    const { partnerId } = req.body;

    if (!partnerId) {
      res.status(400).json({
        success: false,
        message: 'partnerId la bat buoc',
      });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(partnerId)) {
      res.status(400).json({
        success: false,
        message: 'partnerId khong hop le',
      });
      return;
    }

    if (partnerId === userId) {
      res.status(400).json({
        success: false,
        message: 'Khong the tao cuoc tro chuyen voi chinh ban',
      });
      return;
    }

    const partner = await User.findById(partnerId).select('fullName email role isActive');
    if (!partner || !partner.isActive) {
      res.status(404).json({
        success: false,
        message: 'Nguoi dung khong ton tai hoac da bi vo hieu hoa',
      });
      return;
    }

    let conversation = await Conversation.findOne({
      participants: { $all: [userId, partnerId], $size: 2 },
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [userId, partnerId],
      });
    }

    await conversation.populate('participants', 'fullName email role');

    const otherParticipant = conversation.participants.find(
      (participant: any) => participant._id.toString() !== userId
    );

    res.json({
      success: true,
      data: {
        _id: conversation._id,
        partner: otherParticipant || null,
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

    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);

    const messages = await Message.find({ conversationId })
      .populate('sender', 'fullName email role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    await Message.updateMany(
      { conversationId, sender: { $ne: userId }, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    );

    res.json({ success: true, data: messages.reverse() });
  } catch (err) {
    log.error('Failed to load messages', err);
    res.status(500).json({
      success: false,
      message: 'Khong the tai tin nhan',
    });
  }
});

// POST /messaging/conversations/:id/messages - send a message
router.post('/conversations/:id/messages', requireCompleteProfile, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const conversationId = req.params.id;
    const { text } = req.body;

    if (!text || !text.trim()) {
      res.status(400).json({
        success: false,
        message: 'Noi dung tin nhan khong duoc trong',
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

    const message = await Message.create({
      conversationId,
      sender: userId,
      text: text.trim(),
      readBy: [userId],
    });

    conversation.lastMessage = text.trim().substring(0, 100);
    conversation.lastMessageAt = new Date();
    await conversation.save();

    await message.populate('sender', 'fullName email role');

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
