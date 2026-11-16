import mongoose from 'mongoose';
import { Conversation, Message } from '../models/Message.model';
import ChatAttachment from '../models/ChatAttachment.model';
import ConversationRedirect from '../models/ConversationRedirect.model';

export const conversationPairKey = (first: string, second: string): string =>
  [first.toLowerCase(), second.toLowerCase()].sort().join(':');

export async function migrateConversations() {
  await Promise.all([Conversation.init(), Message.init(), ChatAttachment.init(), ConversationRedirect.init()]);
  // Install the guard before accepting new conversations, including simultaneous requests.
  await Conversation.collection.createIndex({ pairKey: 1 }, { unique: true, sparse: true, name: 'conversation_pair_unique' });
  const rows = await Conversation.find().select('participants').lean();
  const pairs = new Map<string, string[]>();
  for (const row of rows) {
    const participants = [...new Set(row.participants.map(String))].sort();
    if (participants.length === 2) pairs.set(conversationPairKey(...participants as [string, string]), participants);
  }
  let merged = 0;
  for (const [pairKey, participants] of pairs) {
    const session = await mongoose.startSession();
    try {
      let mergedInTransaction = 0;
      await session.withTransaction(async () => {
        mergedInTransaction = 0;
        const group = await Conversation.find({ participants: { $all: participants, $size: 2 } }).sort({ _id: 1 }).session(session).lean();
        if (!group.length) return;
        const canonical = group.find(conversation => conversation.pairKey === pairKey) || group[0];
        const duplicates = group.filter(conversation => String(conversation._id) !== String(canonical._id));
        const duplicateIds = duplicates.map(conversation => conversation._id);
        if (duplicates.length) {
          await Message.updateMany({ conversationId: { $in: duplicateIds } }, { $set: { conversationId: canonical._id } }, { session, timestamps: false });
          await ChatAttachment.updateMany({ conversationId: { $in: duplicateIds } }, { $set: { conversationId: canonical._id } }, { session, timestamps: false });
          await ConversationRedirect.updateMany({ conversationId: { $in: duplicateIds } }, { $set: { conversationId: canonical._id } }, { session });
          for (const duplicate of duplicates) {
            await ConversationRedirect.updateOne({ _id: duplicate._id }, {
              $setOnInsert: { conversationId: canonical._id, snapshot: duplicate },
            }, { upsert: true, session });
          }
          // All messages and files have been moved; original metadata remains in redirects.
          await Conversation.deleteMany({ _id: { $in: duplicateIds } }, { session });
        }
        const latest = await Message.findOne({ conversationId: canonical._id }).sort({ _id: -1 }).session(session);
        const productSource = [...group].filter(conversation => conversation.productId)
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
        await Conversation.updateOne({ _id: canonical._id }, { $set: {
          pairKey,
          ...(productSource ? { productId: productSource.productId } : {}),
          ...(latest ? { lastMessage: (latest.text || `📎 ${latest.attachments.length} tệp đính kèm`).slice(0, 100), lastMessageAt: latest.createdAt } : {}),
        } }, { session, timestamps: false });
        mergedInTransaction = duplicates.length;
      });
      merged += mergedInTransaction;
    } finally { await session.endSession(); }
  }
  return { pairs: pairs.size, merged };
}

let initialization: Promise<unknown> | undefined;
export function ensureConversationIntegrity(): Promise<unknown> {
  if (!initialization) initialization = migrateConversations().catch(error => { initialization = undefined; throw error; });
  return initialization;
}

export async function getOrCreateConversation(userId: string, partnerId: string, productId?: string) {
  const pairKey = conversationPairKey(userId, partnerId);
  const update = {
    $setOnInsert: { participants: [userId, partnerId].sort() },
    ...(productId ? { $set: { productId } } : {}),
  };
  try {
    return await Conversation.findOneAndUpdate({ pairKey }, update, { new: true, upsert: true, setDefaultsOnInsert: true });
  } catch (error: any) {
    if (error.code !== 11000) throw error;
    // The other request inserted the same pair while this request was waiting.
    return Conversation.findOneAndUpdate({ pairKey }, productId ? { $set: { productId } } : { $set: { pairKey } }, { new: true });
  }
}
