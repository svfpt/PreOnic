// Default: inspect counts only. --apply merges duplicates transactionally, preserving redirects.
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
require('dns').setDefaultResultOrder('ipv4first');
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/preoonic', { serverSelectionTimeoutMS: 15000, family: 4 });
  const db = mongoose.connection.db;
  const rows = await db.collection('conversations').find({}, { projection: { participants: 1 } }).toArray();
  const pairs = new Map();
  for (const row of rows) {
    const ids = [...new Set((row.participants || []).map(String))].sort();
    if (ids.length === 2) pairs.set(ids.join(':'), (pairs.get(ids.join(':')) || 0) + 1);
  }
  const extra = [...pairs.values()].reduce((count, size) => count + size - 1, 0);
  const [messages, attachments, preservedRedirects] = await Promise.all(['messages', 'chatattachments', 'conversationredirects'].map(name => db.collection(name).countDocuments()));
  console.log(JSON.stringify({ mode: process.argv.includes('--apply') ? 'apply' : 'inspect', conversations: rows.length,
    duplicatePairs: [...pairs.values()].filter(size => size > 1).length, conversationsToMerge: extra,
    messages, attachments, preservedRedirects }));
  if (process.argv.includes('--apply')) {
    const before = await Promise.all(['messages', 'chatattachments'].map(name => db.collection(name).countDocuments()));
    const { migrateConversations } = require('../dist/services/conversation.service');
    const result = await migrateConversations();
    const after = await Promise.all(['messages', 'chatattachments'].map(name => db.collection(name).countDocuments()));
    console.log(JSON.stringify({ ...result, messagesBefore: before[0], messagesAfter: after[0], attachmentsBefore: before[1], attachmentsAfter: after[1] }));
    if (before.some((count, index) => count !== after[index])) throw new Error('Record count changed; inspect concurrent activity');
  }
})().catch(error => {
  console.error(JSON.stringify({ mergeCheck: 'failed', type: error.name || 'Error', code: error.code || null }));
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
