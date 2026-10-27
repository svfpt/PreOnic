/**
 * Script tạo tài khoản admin một lần.
 * Chạy: npx ts-node src/seed/createAdmin.ts
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI || '';

const ADMIN_EMAIL    = 'admin123@gmail.com';
const ADMIN_PASSWORD = 'Phong123@';
const ADMIN_FIRST    = 'Admin';
const ADMIN_LAST     = 'PreOnic';

async function main() {
  if (!MONGO_URI) {
    console.error('❌  MONGODB_URI không tìm thấy trong .env');
    process.exit(1);
  }

  console.log('🔌  Đang kết nối MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('✅  Kết nối thành công');

  const db = mongoose.connection.db!;
  const users = db.collection('users');

  // Kiểm tra tồn tại
  const existing = await users.findOne({ email: ADMIN_EMAIL });
  if (existing) {
    if (existing.role === 'admin') {
      console.log(`⚠️  Admin "${ADMIN_EMAIL}" đã tồn tại. Không tạo mới.`);
    } else {
      // Nâng cấp role thành admin
      await users.updateOne(
        { email: ADMIN_EMAIL },
        { $set: { role: 'admin', isActive: true, isVerified: true } }
      );
      console.log(`✅  Đã nâng cấp "${ADMIN_EMAIL}" lên role admin.`);
    }
    await mongoose.disconnect();
    return;
  }

  // Hash password
  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, salt);

  const now = new Date();
  const adminDoc = {
    email: ADMIN_EMAIL,
    password: hashedPassword,
    role: 'admin',
    authProvider: 'local',
    firstName: ADMIN_FIRST,
    lastName: ADMIN_LAST,
    fullName: `${ADMIN_FIRST} ${ADMIN_LAST}`,
    isActive: true,
    isVerified: true,
    loginAttempts: 0,
    virtualBalance: 0,
    reputationScore: 5,
    totalRatings: 0,
    createdAt: now,
    updatedAt: now,
  };

  await users.insertOne(adminDoc);
  console.log('');
  console.log('✅  Tài khoản admin đã được tạo thành công!');
  console.log('    Email   :', ADMIN_EMAIL);
  console.log('    Password:', ADMIN_PASSWORD);
  console.log('    Role    : admin');
  console.log('');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('❌  Lỗi:', err.message);
  process.exit(1);
});
