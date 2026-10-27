/**
 * Product Seed Script
 * Seeds MongoDB with the 12 products from fe/src/data/products.js
 *
 * Usage:  npx ts-node src/seed/products.seed.ts
 *   or :  npm run seed
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

import Product from '../models/Product.model';

const productsData = [
  // ===== MIỀN NAM =====
  {
    name: 'Thanh Long Ruột Đỏ',
    location: 'Bình Thuận',
    farm: 'Hợp tác xã Hòa Thắng',
    image: 'https://images.unsplash.com/photo-1527325678964-54921661f888?w=600',
    priceMin: 12000,
    priceMax: 18000,
    unit: 'kg',
    expectedDate: '15/10/2025',
    progress: 75,
    remaining: 5000,
    totalQuantity: 20000,
    note: 'Còn lại 5 tấn cần cam kết',
    badge: 'GLOBALGAP',
    category: 'fruit',
    region: 'south',
    type: 'fresh',
    rating: 4.8,
    reviewCount: 124,
    description:
      'Thanh long ruột đỏ Bình Thuận được trồng theo tiêu chuẩn GLOBALGAP, quả to đều, ruột đỏ đậm, vị ngọt thanh đặc trưng. Không sử dụng thuốc bảo vệ thực vật hóa học.',
    nutritionInfo:
      'Giàu vitamin C, chất xơ, chất chống oxy hóa. Hỗ trợ tiêu hóa và tăng cường miễn dịch.',
    certifications: ['GLOBALGAP', 'Organic'],
    seller: { name: 'HTX Hòa Thắng', avatar: 'HT', rating: 4.8, totalContracts: 45 },
    commitments: [
      'Cam kết chất lượng theo chuẩn GLOBALGAP',
      'Đền bù 150% nếu không đạt chất lượng',
      'Giao hàng đúng hẹn hoặc miễn phí vận chuyển',
      'Hỗ trợ đổi trả trong 48h nếu sản phẩm lỗi',
    ],
  },
  {
    name: 'Xoài Cát Hòa Lộc',
    location: 'Tiền Giang',
    farm: 'Vườn Ông Bảy',
    image: 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=600',
    priceMin: 55000,
    priceMax: 70000,
    unit: 'kg',
    expectedDate: '20/06/2025',
    progress: 60,
    remaining: 3000,
    totalQuantity: 8000,
    note: 'Đặc sản Tiền Giang',
    badge: 'VIETGAP',
    category: 'fruit',
    region: 'south',
    type: 'fresh',
    rating: 4.9,
    reviewCount: 89,
    description:
      'Xoài Cát Hòa Lộc nổi tiếng với vị ngọt lịm, thịt dày, ít xơ. Được trồng tại vùng đất phù sa Tiền Giang, chất lượng hàng đầu Việt Nam.',
    nutritionInfo: 'Giàu vitamin A, C, kali. Tốt cho mắt và hệ miễn dịch.',
    certifications: ['VIETGAP'],
    seller: { name: 'Vườn Ông Bảy', avatar: 'VB', rating: 4.5, totalContracts: 22 },
    commitments: [
      'Cam kết quả tự nhiên, không ép chín',
      'Đền bù 120% nếu không đạt trọng lượng',
      'Bảo hành chất lượng 72h',
      'Đóng gói cẩn thận theo tiêu chuẩn xuất khẩu',
    ],
  },
  {
    name: 'Bưởi Da Xanh',
    location: 'Bến Tre',
    farm: 'Nhà vườn Sông Tiền',
    image: 'https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5b?w=600',
    priceMin: 35000,
    priceMax: 50000,
    unit: 'kg',
    expectedDate: 'Quanh năm',
    progress: 92,
    remaining: 800,
    totalQuantity: 10000,
    note: 'Sắp hết - đặt sớm',
    badge: 'Organic',
    category: 'fruit',
    region: 'south',
    type: 'fresh',
    rating: 4.7,
    reviewCount: 67,
    description:
      'Bưởi da xanh Bến Tre tép mọng nước, vị ngọt thanh, không hạt. Là đặc sản truyền thống của xứ dừa.',
    nutritionInfo: 'Giàu vitamin C, folate. Hỗ trợ giảm cân và tăng cường sức đề kháng.',
    certifications: ['Organic', 'VIETGAP'],
    seller: {
      name: 'Nhà vườn Sông Tiền',
      avatar: 'ST',
      rating: 4.7,
      totalContracts: 35,
    },
    commitments: [
      '100% bưởi hữu cơ',
      'Đền bù nếu quả không đạt tiêu chuẩn',
      'Giao hàng tận nơi miền Nam',
      'Tư vấn bảo quản miễn phí',
    ],
  },
  // ===== MIỀN TRUNG =====
  {
    name: 'Cà Phê Robusta Loại 1',
    location: 'Đắk Lắk',
    farm: "Farm H'Hen Niê",
    image: 'https://images.unsplash.com/photo-1447933601403-56dc2df2a3e3?w=600',
    priceMin: 40000,
    priceMax: 52000,
    unit: 'kg',
    expectedDate: '30/12/2025',
    progress: 45,
    remaining: 15000,
    totalQuantity: 25000,
    note: 'Mùa thu hoạch sắp tới',
    badge: 'UTZ',
    category: 'coffee',
    region: 'central',
    type: 'dried',
    rating: 4.9,
    reviewCount: 156,
    description:
      'Cà phê Robusta loại 1 từ vùng đất đỏ bazan Đắk Lắk. Hạt đều, rang lên thơm nồng, vị đắng đậm đặc trưng Tây Nguyên.',
    nutritionInfo:
      'Chứa caffeine tự nhiên, chất chống oxy hóa. Tăng cường tỉnh táo và tập trung.',
    certifications: ['UTZ', 'Rainforest Alliance'],
    seller: {
      name: "Farm H'Hen Niê",
      avatar: 'HN',
      rating: 4.9,
      totalContracts: 62,
    },
    commitments: [
      'Cam kết hạt cà phê chín đỏ 100%',
      'Quy trình sơ chế đạt chuẩn quốc tế',
      'Truy xuất nguồn gốc rõ ràng',
      'Hỗ trợ logistic Tây Nguyên',
    ],
  },
  {
    name: 'Ớt Chuông Đà Lạt',
    location: 'Lâm Đồng',
    farm: 'Đà Lạt Fresh Farm',
    image: 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=600',
    priceMin: 28000,
    priceMax: 38000,
    unit: 'kg',
    expectedDate: 'Quanh năm',
    progress: 80,
    remaining: 2000,
    totalQuantity: 10000,
    note: 'Cung cấp liên tục',
    badge: 'VIETGAP',
    category: 'vegetable',
    region: 'central',
    type: 'fresh',
    rating: 4.6,
    reviewCount: 45,
    description:
      'Ớt chuông được trồng trong nhà kính tại Đà Lạt, quả to, giòn, nhiều màu sắc. Đạt tiêu chuẩn xuất khẩu sang EU.',
    nutritionInfo: 'Cực giàu vitamin C (gấp 3 lần cam), vitamin A, chất xơ.',
    certifications: ['VIETGAP'],
    seller: {
      name: 'Đà Lạt Fresh Farm',
      avatar: 'DF',
      rating: 4.6,
      totalContracts: 28,
    },
    commitments: [
      'Trồng trong nhà kính kiểm soát',
      'Không dư lượng thuốc BVTV',
      'Giao hàng lạnh 2-8°C',
      'Đổi trả miễn phí nếu hàng hư',
    ],
  },
  {
    name: 'Hạt Tiêu Gia Lai',
    location: 'Gia Lai',
    farm: 'Nông Trường Chư Sê',
    image: 'https://images.unsplash.com/photo-1599909533681-74a0d344ba58?w=600',
    priceMin: 80000,
    priceMax: 95000,
    unit: 'kg',
    expectedDate: '15/03/2026',
    progress: 35,
    remaining: 8000,
    totalQuantity: 12000,
    note: 'Đang vào vụ mới',
    badge: 'Organic',
    category: 'spice',
    region: 'central',
    type: 'dried',
    rating: 4.8,
    reviewCount: 78,
    description:
      'Hạt tiêu đen Gia Lai - vùng đất bazan nổi tiếng. Hạt chắc, đều, thơm nồng, vị cay mạnh đặc trưng. Là nguyên liệu yêu thích của đầu bếp.',
    nutritionInfo:
      'Chứa piperine hỗ trợ tiêu hóa, kháng viêm, chống oxy hóa.',
    certifications: ['Organic'],
    seller: {
      name: 'Nông Trường Chư Sê',
      avatar: 'CS',
      rating: 4.8,
      totalContracts: 31,
    },
    commitments: [
      'Hạt tiêu 100% hữu cơ',
      'Phơi sấy tự nhiên dưới nắng',
      'Đóng gói chân không chống ẩm',
      'Cam kết tỷ lệ hạt lép dưới 2%',
    ],
  },
  // ===== MIỀN BẮC =====
  {
    name: 'Gạo ST25',
    location: 'Sóc Trăng',
    farm: 'HTX Lúa Vàng',
    image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600',
    priceMin: 25000,
    priceMax: 32000,
    unit: 'kg',
    expectedDate: '20/11/2025',
    progress: 55,
    remaining: 20000,
    totalQuantity: 50000,
    note: 'Gạo ngon nhất thế giới',
    badge: 'VIETGAP',
    category: 'rice',
    region: 'south',
    type: 'dried',
    rating: 4.9,
    reviewCount: 203,
    description:
      'Gạo ST25 đạt giải Gạo ngon nhất thế giới. Hạt dài, thơm tự nhiên, cơm mềm dẻo, vị ngọt hậu. Sản xuất tại Sóc Trăng.',
    nutritionInfo:
      'Giàu tinh bột, vitamin B1, sắt. Nguồn năng lượng chính cho bữa ăn.',
    certifications: ['VIETGAP', "World's Best Rice"],
    seller: {
      name: 'HTX Lúa Vàng',
      avatar: 'LV',
      rating: 4.7,
      totalContracts: 38,
    },
    commitments: [
      'Cam kết gạo ST25 chính gốc Sóc Trăng',
      'Không pha trộn giống lúa khác',
      'Đóng gói hút chân không',
      'Bảo hành chất lượng 6 tháng',
    ],
  },
  {
    name: 'Chè Thái Nguyên',
    location: 'Thái Nguyên',
    farm: 'HTX Chè Tân Cương',
    image: 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=600',
    priceMin: 150000,
    priceMax: 350000,
    unit: 'kg',
    expectedDate: '01/04/2026',
    progress: 20,
    remaining: 5000,
    totalQuantity: 6000,
    note: 'Chè xuân đầu mùa',
    badge: 'Organic',
    category: 'tea',
    region: 'north',
    type: 'dried',
    rating: 4.8,
    reviewCount: 91,
    description:
      'Chè Tân Cương - Thái Nguyên, đệ nhất danh trà Việt Nam. Búp chè non, sao suốt bằng tay, nước xanh trong, vị chát ngọt hậu tự nhiên.',
    nutritionInfo:
      'Giàu catechin, polyphenol, theanine. Tốt cho tim mạch, chống lão hóa.',
    certifications: ['Organic', 'Geographical Indication'],
    seller: {
      name: 'HTX Chè Tân Cương',
      avatar: 'TC',
      rating: 4.8,
      totalContracts: 40,
    },
    commitments: [
      '100% chè búp 1 tôm 2 lá',
      'Sao suốt truyền thống bằng tay',
      'Truy xuất nguồn gốc từng lô',
      'Đổi trả nếu không đúng hương vị',
    ],
  },
  {
    name: 'Cam Vinh',
    location: 'Nghệ An',
    farm: 'Xã Minh Hợp, Quỳ Hợp',
    image: 'https://images.unsplash.com/photo-1547514701-42782101795e?w=600',
    priceMin: 30000,
    priceMax: 45000,
    unit: 'kg',
    expectedDate: '15/12/2025',
    progress: 40,
    remaining: 7000,
    totalQuantity: 12000,
    note: 'Vụ cam chính đang đến',
    badge: 'VIETGAP',
    category: 'fruit',
    region: 'north',
    type: 'fresh',
    rating: 4.6,
    reviewCount: 56,
    description:
      'Cam Vinh Nghệ An nổi tiếng với vị ngọt đậm, mọng nước, vỏ mỏng. Trồng trên đất đồi pha cát đặc trưng xứ Nghệ.',
    nutritionInfo:
      'Giàu vitamin C, hesperidin, chất xơ. Tăng cường miễn dịch mùa đông.',
    certifications: ['VIETGAP'],
    seller: {
      name: 'HTX Cam Vinh',
      avatar: 'CV',
      rating: 4.6,
      totalContracts: 25,
    },
    commitments: [
      'Cam chín tự nhiên trên cây',
      'Không sử dụng chất bảo quản',
      'Bảo hành tươi 7 ngày',
      'Giao hàng nhanh 24-48h',
    ],
  },
  {
    name: 'Vải Thiều Lục Ngạn',
    location: 'Bắc Giang',
    farm: 'HTX Vải Hồng Giang',
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600',
    priceMin: 25000,
    priceMax: 60000,
    unit: 'kg',
    expectedDate: '01/06/2026',
    progress: 10,
    remaining: 15000,
    totalQuantity: 18000,
    note: 'Đặt trước cho vụ 2026',
    badge: 'GLOBALGAP',
    category: 'fruit',
    region: 'north',
    type: 'fresh',
    rating: 4.7,
    reviewCount: 112,
    description:
      'Vải thiều Lục Ngạn - thương hiệu nông sản nổi tiếng cả nước. Quả to, cùi dày, hạt nhỏ, vị ngọt thanh, thơm nức.',
    nutritionInfo:
      'Giàu vitamin C, polyphenol, đồng. Bổ máu, tăng cường sức khỏe.',
    certifications: ['GLOBALGAP', 'Geographical Indication'],
    seller: {
      name: 'HTX Vải Hồng Giang',
      avatar: 'HG',
      rating: 4.7,
      totalContracts: 55,
    },
    commitments: [
      'Cam kết quả loại 1 đạt chuẩn xuất khẩu',
      'Đóng gói bảo quản lạnh',
      'Giao hàng trong 24h sau thu hoạch',
      'Đền bù 100% nếu không đúng phẩm cấp',
    ],
  },
  {
    name: 'Rau Sạch Đà Lạt',
    location: 'Lâm Đồng',
    farm: 'Đà Lạt Fresh Farm',
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600',
    priceMin: 15000,
    priceMax: 25000,
    unit: 'kg',
    expectedDate: 'Quanh năm',
    progress: 85,
    remaining: 1500,
    totalQuantity: 10000,
    note: 'Cung cấp hàng ngày',
    badge: 'VIETGAP',
    category: 'vegetable',
    region: 'central',
    type: 'fresh',
    rating: 4.5,
    reviewCount: 38,
    description:
      'Rau sạch trồng trong nhà kính tại Đà Lạt: xà lách, cải thìa, cà chua bi. Tươi ngon, an toàn, giao hàng mỗi sáng.',
    nutritionInfo:
      'Đa dạng vitamin và khoáng chất, chất xơ cao. Tốt cho sức khỏe hàng ngày.',
    certifications: ['VIETGAP'],
    seller: {
      name: 'Đà Lạt Fresh Farm',
      avatar: 'DF',
      rating: 4.6,
      totalContracts: 28,
    },
    commitments: [
      'Thu hoạch và giao trong ngày',
      'Không thuốc trừ sâu hóa học',
      'Kiểm tra chất lượng mỗi lô',
      'Giảm 10% cho đơn hàng định kỳ',
    ],
  },
  {
    name: 'Cà Phê Arabica Sơn La',
    location: 'Sơn La',
    farm: 'HTX Cà Phê Sơn La',
    image: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=600',
    priceMin: 120000,
    priceMax: 180000,
    unit: 'kg',
    expectedDate: '01/01/2026',
    progress: 30,
    remaining: 3000,
    totalQuantity: 5000,
    note: 'Cà phê specialty',
    badge: 'SCA Score 84+',
    category: 'coffee',
    region: 'north',
    type: 'dried',
    rating: 4.9,
    reviewCount: 67,
    description:
      'Arabica Sơn La trồng ở độ cao 1200m, khí hậu mát lạnh tạo nên hương vị phức tạp: hoa quả, chocolate, hậu vị dài. SCA Score 84+.',
    nutritionInfo:
      'Caffeine vừa phải, giàu chất chống oxy hóa, chlorogenic acid.',
    certifications: ['SCA Score 84+', 'Organic'],
    seller: {
      name: 'HTX Cà Phê Sơn La',
      avatar: 'SL',
      rating: 4.9,
      totalContracts: 18,
    },
    commitments: [
      'Chỉ thu hoạch quả chín đỏ',
      'Chế biến ướt honey process',
      'Cupping score cam kết trên 82',
      'Bao bì khử khí chuyên dụng',
    ],
  },
];

async function seed() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/preoonic';
    console.log('Connecting to MongoDB:', mongoUri);
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Clear existing products
    const deleted = await Product.deleteMany({});
    console.log(`Cleared ${deleted.deletedCount} existing products`);

    // Insert all products
    const result = await Product.insertMany(productsData);
    console.log(`Seeded ${result.length} products:`);
    result.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.name} (${p.region} - ${p.category})`);
    });

    console.log('\nSeeding completed successfully!');
  } catch (error) {
    console.error('Seeding failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
}

seed();
