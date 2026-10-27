/**
 * Application-wide constants
 * Single source of truth for shared values
 */

// ===== ROUTES =====
export const ROUTES = {
  HOME: '/',
  SOLUTIONS: '/solutions',
  CONTACT: '/contact',
  AUTH: '/auth',
  REGISTER: '/register',
  ENTERPRISE: '/enterprise',
  FARMER: '/farmer',
  ADMIN: '/admin',
  PRODUCTS: '/products',
  PRODUCT_DETAIL: '/products/:id',
  FARMER_HOME: '/farmer-home',
  ENTERPRISE_HOME: '/enterprise-home',
  MESSAGING: '/messaging',
  CONTRACT_FLOW: '/contract-flow',
  PROFILE: '/profile',
  CROP_HEALTH: '/crop-health',
  GUIDE_AI: '/guide-ai',
  RESET_PASSWORD: '/reset-password',
  VERIFY_EMAIL: '/verify-email',
};

// ===== NAV ITEMS =====
export const NAV_ITEMS = [
  { path: ROUTES.HOME, label: 'Trang chủ' },
  { path: ROUTES.PRODUCTS, label: 'Sản phẩm' },
  { path: ROUTES.SOLUTIONS, label: 'Giải pháp' },
  { path: ROUTES.CONTACT, label: 'Liên hệ' },
];

// ===== BRAND =====
export const BRAND_NAME = 'PreOnic';

// ===== TOAST DURATIONS (ms) =====
export const TOAST_DURATION = {
  SHORT: 3000,
  DEFAULT: 4000,
  LONG: 5000,
};

// ===== LOCAL STORAGE KEYS =====
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'accessToken',
  USER: 'user',
};

// ===== ĐỊNH DẠNG DÙNG CHUNG =====
export const DATE_FORMATS = {
  SHORT_DATE: {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  },
  FULL_DATE: {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  },
};

// ===== COMPANY INFO =====
export const COMPANY = {
  NAME: 'PreOnic',
  FULL_NAME: 'Công ty TNHH PreOnic Việt Nam',
  DESCRIPTION: 'Nền tảng kết nối nông nghiệp bền vững hàng đầu Việt Nam',
  EMAIL: 'contact@preonic.vn',
  SUPPORT_EMAIL: 'support@preonic.vn',
  HOTLINE: '1900 xxxx',
  ADDRESS: 'Hà Nội, Việt Nam',
  COPYRIGHT_YEAR: 2026,
  COMMISSION_RATE: 3, // % hoa hồng trung gian — phải khớp với CONTRACT_CONFIG.COMMISSION_RATE trong be/src/constants/index.ts
};

// ===== REGIONS =====
export const REGIONS = {
  NORTH: { key: 'north', label: 'Miền Bắc', icon: null, color: '#3b82f6', 
    highlight: 'Đất đai màu mỡ, khí hậu 4 mùa — lý tưởng cho rau củ, chè, và lúa gạo chất lượng cao' },
  CENTRAL: { key: 'central', label: 'Miền Trung', icon: null, color: '#f59e0b',
    highlight: 'Nắng gió đặc trưng tạo nên hương vị riêng cho ớt, tiêu, quế, và hải sản khô' },
  SOUTH: { key: 'south', label: 'Miền Nam', icon: null, color: '#10b981',
    highlight: 'Đồng bằng phì nhiêu, trái cây nhiệt đới quanh năm — xoài, thanh long, bưởi, cà phê' },
};

// ===== CONTRACT STATUS =====
export const CONTRACT_STATUS = {
  DRAFT: 'draft',
  PENDING: 'pending',
  APPROVED: 'approved',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

export const CONTRACT_STATUS_META = {
  [CONTRACT_STATUS.DRAFT]: { label: 'Bản nháp', color: '#9ca3af' },
  [CONTRACT_STATUS.PENDING]: { label: 'Chờ duyệt', color: '#f59e0b' },
  [CONTRACT_STATUS.APPROVED]: { label: 'Đã phê duyệt', color: '#0ea5e9' },
  [CONTRACT_STATUS.ACTIVE]: { label: 'Đang chạy', color: '#1d4ed8' },
  [CONTRACT_STATUS.COMPLETED]: { label: 'Hoàn thành', color: '#16a34a' },
  [CONTRACT_STATUS.CANCELLED]: { label: 'Đã hủy', color: '#ef4444' },
};

export const getContractStatusMeta = (status) =>
  CONTRACT_STATUS_META[status] || { label: status || 'Không xác định', color: '#9ca3af' };

// ===== CẤU HÌNH DASHBOARD =====
export const SEARCH_PLACEHOLDERS = {
  FARMER_DASHBOARD: 'Tìm kiếm mùa vụ, hợp đồng...',
  ENTERPRISE_DASHBOARD: 'Tìm kiếm nông dân, nông sản, hoặc hợp đồng...',
};

export const FARMER_DASHBOARD_NAV_ITEMS = [
  { key: 'muavu', label: 'Mùa vụ của tôi', cls: 'nav-season' },
  { key: 'hopdong', label: 'Hợp đồng', cls: 'nav-contract' },
  { key: 'donhang', label: 'Đơn hàng', cls: 'nav-order' },
  { key: 'escrow', label: 'Thanh toán trung gian', cls: 'nav-escrow' },
  { key: 'vi', label: 'Ví & Thanh toán', cls: 'nav-wallet' },
  { key: 'taichinh', label: 'Tài chính', cls: 'nav-finance' },
  { key: 'danhgia', label: 'Đánh giá đối tác', cls: 'nav-rating' },
  { key: 'thoitiet', label: 'Thời tiết & Bảo hiểm', cls: 'nav-weather' },
  { key: 'feedback', label: 'Phản hồi hệ thống', cls: 'nav-feedback' },
];

export const ENTERPRISE_DASHBOARD_NAV_ITEMS = [
  { key: 'tongguan', label: 'Tổng quan', cls: 'nav-overview' },
  { key: 'hopdong', label: 'Hợp đồng', cls: 'nav-contract' },
  { key: 'sanpham', label: 'Danh sách sản phẩm', cls: 'nav-product' },
  { key: 'donhang', label: 'Theo dõi đơn hàng', cls: 'nav-order' },
  { key: 'escrow', label: 'Thanh toán trung gian', cls: 'nav-escrow' },
  { key: 'vi', label: 'Ví & Thanh toán', cls: 'nav-wallet' },
  { key: 'nhacc', label: 'Nhà cung cấp', cls: 'nav-contacts' },
  { key: 'lichsu', label: 'Lịch sử giao dịch', cls: 'nav-warehouse' },
  { key: 'danhgia', label: 'Đánh giá đối tác', cls: 'nav-rating' },
  { key: 'thoitiet', label: 'Thời tiết & Bảo hiểm', cls: 'nav-weather' },
  { key: 'feedback', label: 'Phản hồi hệ thống', cls: 'nav-feedback' },
];

export const DEFAULT_UI_METRICS = {
  PROFILE_REPUTATION_SCORE: 0,
  PROFILE_VIRTUAL_BALANCE: 0,
};

// ===== INSURANCE PROGRAMS =====
export const INSURANCE_PROGRAMS = [
  {
    id: "agribank",
    name: "Bảo hiểm nông nghiệp Agribank",
    provider: "Agribank Insurance (ABIC)",
    hotline: "1900 55 88 99",
    accentColor: "#15803d",
    coverages: [
      "Thiên tai, lũ lụt, hạn hán",
      "Dịch bệnh cây trồng",
      "Cháy nổ kho lưu trữ",
      "Mất mùa do thời tiết cực đoan",
    ],
    suitable: ["Lúa, ngô, hoa màu", "Cây ăn quả", "Cây công nghiệp"],
    note: "Hỗ trợ nông dân vùng ĐBSCL và Tây Nguyên theo chương trình nhà nước.",
  },
  {
    id: "vbi",
    name: "Bảo hiểm cây trồng VBI",
    provider: "VietinBank Insurance (VBI)",
    hotline: "1800 588 878",
    accentColor: "#1d4ed8",
    coverages: [
      "Thiệt hại do bão, lũ",
      "Sâu bệnh, dịch hại",
      "Hỏa hoạn, sét đánh",
      "Rủi ro vận chuyển nông sản",
    ],
    suitable: ["Cà phê, tiêu, điều", "Rau màu, nấm", "Cây ăn quả cao cấp"],
    note: "Gói linh hoạt, phí thấp, phù hợp nông hộ nhỏ đến trang trại lớn.",
  },
  {
    id: "bvbh",
    name: "Bảo hiểm nông sản Bảo Việt",
    provider: "Bảo Việt Nhân Thọ (BVBH)",
    hotline: "1800 599 980",
    accentColor: "#dc2626",
    coverages: [
      "Thiên tai, mưa đá, sương giá",
      "Dịch bệnh quy mô lớn",
      "Mất thu hoạch trên 30%",
      "Thiệt hại cơ sở hạ tầng",
    ],
    suitable: ["Lúa gạo đặc sản", "Thanh long, xoài, sầu riêng", "Cây trồng xuất khẩu"],
    note: "Phối hợp chương trình hỗ trợ phí bảo hiểm Nhà nước theo Nghị định 58/2018.",
  },
  {
    id: "mic",
    name: "Bảo hiểm nông nghiệp MIC",
    provider: "Military Insurance Corporation (MIC)",
    hotline: "1900 54 54 52",
    accentColor: "#7c3aed",
    coverages: [
      "Rủi ro thời tiết theo mùa vụ",
      "Đảm bảo thu nhập tối thiểu",
      "Bảo vệ vốn đầu tư vụ mùa",
      "Hỗ trợ phục hồi sau thiên tai",
    ],
    suitable: ["Hoa màu ngắn ngày", "Nông sản ký hợp đồng bao tiêu", "Trang trại kết hợp"],
    note: "Đặc biệt phù hợp cho nông dân đã ký hợp đồng bao tiêu, bảo vệ đôi bên.",
  },
];

// ===== WALLET / TOPUP =====
export const GATEWAY_MIN_TOPUP = 10000; // VND
export const TOPUP_PRESETS = [100_000_000, 500_000_000, 1_000_000_000, 5_000_000_000, 10_000_000_000, 100_000_000_000]; // VND

// ===== FILE UPLOAD =====
export const FILE_SIZE_LIMIT = 5 * 1024 * 1024; // 5 MB
