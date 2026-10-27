/**
 * Kiểm kê (READ-ONLY) toàn bộ dữ liệu liên quan tới 1 user theo email.
 * KHÔNG xóa gì. Chạy: npx ts-node src/seed/inspectUser.ts <email>
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI || '';
const TARGET_EMAIL = process.argv[2] || 'haonkds180493@fpt.edu.vn';

async function main() {
  if (!MONGO_URI) { console.error('❌ MONGODB_URI không có'); process.exit(1); }
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db!;

  const user = await db.collection('users').findOne({ email: TARGET_EMAIL });
  if (!user) { console.log(`❌ Không tìm thấy user email=${TARGET_EMAIL}`); await mongoose.disconnect(); return; }

  const id = user._id;
  console.log(`👤 User: ${user.fullName} | ${user.email} | role=${user.role} | balance=${user.virtualBalance} | _id=${id}`);
  console.log('');

  const count = (c: string, q: any) => db.collection(c).countDocuments(q);

  // Sở hữu riêng (chỉ của user này)
  const owned = {
    'products (createdBy)': await count('products', { createdBy: id }),
    'products (seller.userId)': await count('products', { 'seller.userId': id }),
    'reviews (reviewerId)': await count('reviews', { reviewerId: id }),
    'notifications': await count('notifications', { userId: id }),
    'paymenttransactions': await count('paymenttransactions', { userId: id }),
    'withdrawalrequests': await count('withdrawalrequests', { userId: id }),
    'weatheralerts': await count('weatheralerts', { userId: id }),
    'feedbacks': await count('feedbacks', { userId: id }),
  };

  // Dùng chung (liên quan bên thứ 2)
  const shared = {
    'contracts (farmer/enterprise)': await count('contracts', { $or: [{ farmerId: id }, { enterpriseId: id }] }),
    'escrows (farmer/enterprise)': await count('escrows', { $or: [{ farmerId: id }, { enterpriseId: id }] }),
    'disputes (raisedBy/against)': await count('disputes', { $or: [{ raisedBy: id }, { againstUserId: id }] }),
    'partnerratings (reviewer/reviewee)': await count('partnerratings', { $or: [{ reviewerId: id }, { revieweeId: id }] }),
    'conversations (participants)': await count('conversations', { participants: id }),
    'messages (sender)': await count('messages', { sender: id }),
  };

  console.log('📦 DỮ LIỆU SỞ HỮU RIÊNG (xóa an toàn):');
  for (const [k, v] of Object.entries(owned)) console.log(`   ${v > 0 ? '•' : ' '} ${k}: ${v}`);
  console.log('');
  console.log('🔗 DỮ LIỆU DÙNG CHUNG (đụng tới bên thứ 2 — cần cân nhắc):');
  for (const [k, v] of Object.entries(shared)) console.log(`   ${v > 0 ? '⚠️' : '  '} ${k}: ${v}`);
  console.log('');

  // Chi tiết hợp đồng dùng chung
  const contracts = await db.collection('contracts')
    .find({ $or: [{ farmerId: id }, { enterpriseId: id }] })
    .project({ contractCode: 1, status: 1, farmerName: 1, enterpriseName: 1, totalValue: 1 })
    .toArray();
  if (contracts.length) {
    console.log('📄 Chi tiết hợp đồng liên quan:');
    for (const c of contracts) {
      console.log(`   - ${c.contractCode || c._id} | ${c.status} | ${c.farmerName} ↔ ${c.enterpriseName} | ${c.totalValue?.toLocaleString?.('vi-VN') || c.totalValue} VND`);
    }
  }

  await mongoose.disconnect();
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
