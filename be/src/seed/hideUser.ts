/**
 * Ẩn mềm / khôi phục một account khỏi toàn hệ thống (kể cả admin). CÓ THỂ ĐẢO NGƯỢC.
 *
 *   Ẩn:       npx ts-node src/seed/hideUser.ts <email> hide
 *   Khôi phục: npx ts-node src/seed/hideUser.ts <email> restore
 *
 * "Ẩn" sẽ: isActive=false, isHidden=true (chặn đăng nhập + ẩn khỏi admin),
 * và tắt (isActive=false) các sản phẩm đang bật của user — lưu lại danh sách để khôi phục đúng.
 * Dữ liệu KHÔNG bị xóa: hợp đồng/escrow/giao dịch giữ nguyên, khôi phục là hiện lại như cũ.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI || '';
const EMAIL = process.argv[2] || 'haonkds180493@fpt.edu.vn';
const MODE = (process.argv[3] || 'hide').toLowerCase(); // 'hide' | 'restore'

async function main() {
  if (!MONGO_URI) { console.error('❌ MONGODB_URI không có'); process.exit(1); }
  if (!['hide', 'restore'].includes(MODE)) { console.error('❌ MODE phải là hide hoặc restore'); process.exit(1); }

  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db!;
  const usersCol = db.collection('users');
  const productsCol = db.collection('products');

  const user = await usersCol.findOne({ email: EMAIL });
  if (!user) { console.log(`❌ Không tìm thấy user email=${EMAIL}`); await mongoose.disconnect(); return; }
  const id = user._id;
  console.log(`👤 ${user.fullName} | ${user.email} | role=${user.role}`);

  if (MODE === 'hide') {
    // 1) Tắt sản phẩm đang bật của user, lưu lại danh sách để khôi phục.
    const activeProducts = await productsCol
      .find({ $or: [{ createdBy: id }, { 'seller.userId': id }], isActive: true })
      .project({ _id: 1 })
      .toArray();
    const productIds = activeProducts.map((p) => p._id);

    if (productIds.length) {
      await productsCol.updateMany({ _id: { $in: productIds } }, { $set: { isActive: false } });
    }

    // 2) Ẩn user + chặn đăng nhập + lưu snapshot.
    await usersCol.updateOne(
      { _id: id },
      {
        $set: {
          isHidden: true,
          isActive: false,
          hiddenMeta: {
            hiddenAt: new Date(),
            deactivatedProductIds: productIds,
          },
        },
      }
    );

    console.log(`✅ ĐÃ ẨN account. Tắt ${productIds.length} sản phẩm. isActive=false, isHidden=true.`);
    console.log('   → Ẩn khỏi: danh sách user admin, dashboard, feedback admin, listing sản phẩm. Đăng nhập bị chặn.');
    console.log('   → Dữ liệu hợp đồng/escrow/giao dịch GIỮ NGUYÊN (không xóa).');
    console.log(`   → Khôi phục: npx ts-node src/seed/hideUser.ts ${EMAIL} restore`);
  } else {
    // Khôi phục: bật lại đúng các sản phẩm đã tắt, mở khóa account.
    const meta = (user as any).hiddenMeta;
    const productIds: any[] = meta?.deactivatedProductIds || [];
    if (productIds.length) {
      await productsCol.updateMany({ _id: { $in: productIds } }, { $set: { isActive: true } });
    }
    await usersCol.updateOne(
      { _id: id },
      { $set: { isHidden: false, isActive: true }, $unset: { hiddenMeta: '' } }
    );
    console.log(`✅ ĐÃ KHÔI PHỤC account. Bật lại ${productIds.length} sản phẩm. isActive=true, isHidden=false.`);
  }

  await mongoose.disconnect();
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
