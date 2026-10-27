/**
 * Script seed phản hồi hệ thống: mỗi user (trừ admin) 1 bài feedback (xen kẽ tốt/xấu).
 * Bỏ qua user đã có feedback để chạy lại không bị nhân đôi.
 * Chạy: npx ts-node src/seed/feedback.seed.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Feedback from '../models/Feedback.model';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI || '';

type Tmpl = { category: 'bug' | 'feature' | 'ux' | 'payment' | 'other'; subject: string; message: string };

// ===== Nội dung TÍCH CỰC =====
const POSITIVE: Record<'farmer' | 'enterprise', Tmpl[]> = {
  farmer: [
    { category: 'other', subject: 'Rất hài lòng với cơ chế ký quỹ', message: 'Từ ngày dùng PreOnic tôi yên tâm hơn hẳn. Tiền được giữ trong ký quỹ và giải ngân theo từng mốc giao hàng nên không sợ bị quỵt như bán ngoài chợ. Cảm ơn đội ngũ rất nhiều!' },
    { category: 'feature', subject: 'Cảnh báo thời tiết rất hữu ích', message: 'Tính năng cảnh báo thời tiết giúp tôi chủ động thu hoạch sớm trước đợt mưa lớn tuần trước, tránh được thiệt hại đáng kể. Mong có thêm dự báo sâu bệnh nữa thì tuyệt vời.' },
    { category: 'ux', subject: 'Giao diện dễ dùng cho nông dân', message: 'Tôi lớn tuổi, không rành công nghệ nhưng vẫn đăng bán nông sản và ký hợp đồng được. Các bước rõ ràng, chữ to dễ đọc. Làm tốt lắm!' },
    { category: 'other', subject: 'Thanh toán nhanh sau khi giao hàng', message: 'Sau khi doanh nghiệp xác nhận nhận hàng, tiền về ví gần như ngay lập tức. Rút về ngân hàng cũng nhanh. Quá ổn so với cách bán truyền thống.' },
  ],
  enterprise: [
    { category: 'other', subject: 'Quản lý hợp đồng thu mua tiện lợi', message: 'Doanh nghiệp tôi quản lý hàng chục hợp đồng cùng lúc, nhờ PreOnic mà theo dõi tiến độ giao hàng và giải ngân rất gọn gàng. Báo cáo tổng quan trực quan, tiết kiệm nhiều thời gian.' },
    { category: 'feature', subject: 'Hệ thống đánh giá đối tác minh bạch', message: 'Việc đánh giá hai chiều giúp chúng tôi chọn được nông dân uy tín, giao hàng đúng cam kết. Điểm uy tín là tiêu chí rất giá trị khi ký hợp đồng mới.' },
    { category: 'ux', subject: 'Luồng tạo ký quỹ rõ ràng', message: 'Các mốc giải ngân theo phần trăm được trình bày dễ hiểu, đội thu mua mới vào cũng nắm được ngay. Trải nghiệm tổng thể rất chuyên nghiệp.' },
    { category: 'other', subject: 'Nạp tiền qua SePay mượt mà', message: 'Tạo lệnh nạp, quét QR và hệ thống tự cộng ví sau vài giây. Không phải nhập tay, ít sai sót. Rất hài lòng với phần thanh toán.' },
  ],
};

// ===== Nội dung TIÊU CỰC / GÓP Ý =====
const NEGATIVE: Record<'farmer' | 'enterprise', Tmpl[]> = {
  farmer: [
    { category: 'bug', subject: 'Tải trang chủ đôi lúc không ra sản phẩm', message: 'Có hôm tôi mở trang chủ mục "Mùa vụ đang mở đăng ký" trống trơn, phải tải lại vài lần mới hiện. Mong đội kỹ thuật kiểm tra giúp, lúc mạng yếu càng hay bị.' },
    { category: 'payment', subject: 'Rút tiền chờ duyệt hơi lâu', message: 'Đơn rút tiền của tôi chờ admin duyệt khá lâu mới được chuyển khoản. Nếu có thông báo rõ thời gian xử lý dự kiến thì nông dân yên tâm hơn nhiều.' },
    { category: 'ux', subject: 'Khó tìm lại hợp đồng cũ', message: 'Khi có nhiều hợp đồng, tôi không tìm thấy chỗ lọc theo trạng thái hay theo tháng. Phải kéo rất lâu mới thấy hợp đồng cần xem. Đề nghị thêm bộ lọc và tìm kiếm.' },
    { category: 'bug', subject: 'Ảnh nông sản tải lên bị lỗi', message: 'Vài lần tôi đăng ảnh sản phẩm thì báo lỗi tải lên dù ảnh nhỏ. Phải thử lại nhiều lần mới được. Mong khắc phục để đăng bán đỡ mất công.' },
  ],
  enterprise: [
    { category: 'bug', subject: 'Cửa sổ theo dõi đơn hàng bị kẹt cuộn', message: 'Ở màn hình "Theo dõi đơn hàng", phần kiểm tra chất lượng đôi khi không cuộn xuống hết được ở mức zoom 100%. Mong fix dứt điểm vì ảnh hưởng thao tác xác nhận.' },
    { category: 'feature', subject: 'Cần xuất báo cáo hợp đồng ra Excel', message: 'Bộ phận kế toán cần số liệu hợp đồng và giao dịch dạng Excel/PDF để đối soát. Hiện tại phải chép tay rất mất công. Đề nghị bổ sung chức năng xuất file.' },
    { category: 'payment', subject: 'Thiếu hóa đơn/biên lai cho giao dịch', message: 'Sau mỗi lần giải ngân ký quỹ, chúng tôi không có biên lai chính thức để lưu chứng từ. Mong hệ thống sinh biên lai có mã giao dịch cho minh bạch.' },
    { category: 'ux', subject: 'Thông báo nhiều nhưng khó lọc', message: 'Chuông thông báo dồn rất nhiều mục, khó tách riêng cảnh báo thời tiết với cập nhật hợp đồng. Nên cho phân nhóm hoặc lọc theo loại thông báo.' },
  ],
};

// Trạng thái phân bố cho thực tế: phần lớn mới gửi, một số đã xem / đã xử lý.
const STATUS_CYCLE: Array<'new' | 'read' | 'resolved'> = ['new', 'new', 'read', 'resolved'];

async function main() {
  if (!MONGO_URI) {
    console.error('❌  MONGODB_URI không tìm thấy trong .env');
    process.exit(1);
  }

  console.log('🔌  Đang kết nối MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('✅  Kết nối thành công');

  const db = mongoose.connection.db!;
  const users = await db
    .collection('users')
    .find({ role: { $ne: 'admin' } })
    .project({ _id: 1, fullName: 1, email: 1, role: 1 })
    .toArray();

  console.log(`👥  Tìm thấy ${users.length} user (không tính admin)`);

  let created = 0;
  let skipped = 0;

  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    const role: 'farmer' | 'enterprise' = u.role === 'enterprise' ? 'enterprise' : 'farmer';

    // Bỏ qua nếu user đã có feedback (idempotent khi chạy lại).
    const existing = await Feedback.findOne({ userId: u._id });
    if (existing) {
      skipped++;
      console.log(`⏭️   Bỏ qua ${u.fullName} (đã có feedback)`);
      continue;
    }

    // Xen kẽ tốt/xấu: index chẵn = tích cực, lẻ = tiêu cực/góp ý.
    const isPositive = i % 2 === 0;
    const pool = (isPositive ? POSITIVE : NEGATIVE)[role];
    const tmpl = pool[Math.floor(i / 2) % pool.length];
    const status = STATUS_CYCLE[i % STATUS_CYCLE.length];

    await Feedback.create({
      userId: u._id,
      userRole: role,
      userName: u.fullName || 'Người dùng',
      userEmail: u.email || 'unknown@preonic.vn',
      category: tmpl.category,
      subject: tmpl.subject,
      message: tmpl.message,
      status,
      ...(status === 'resolved' && {
        adminNote: 'Cảm ơn phản hồi của bạn. Đội ngũ đã ghi nhận và xử lý.',
      }),
    });

    created++;
    console.log(`✅  [${isPositive ? 'TỐT' : 'GÓP Ý'}] ${u.fullName} → "${tmpl.subject}" (${status})`);
  }

  console.log('');
  console.log(`🎉  Hoàn tất: tạo mới ${created}, bỏ qua ${skipped}.`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('❌  Lỗi:', err.message);
  process.exit(1);
});
