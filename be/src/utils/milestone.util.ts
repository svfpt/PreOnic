// Tách helper xây dựng danh sách milestone của escrow ra utility riêng.
// Lý do: escrow.service.ts đã > 700 dòng và builder này thuần data — không phụ thuộc DB.

import { IMilestone } from '../models/Escrow.model';

export type PaymentTerms = '50_50' | '30_70' | '100_delivery' | '100_upfront' | string;

const MILESTONE_COUNT = 5;
const PERCENT_TOTAL = 100;

// Phân bổ phần trăm giải ngân theo từng mốc (step 1 → step 5) cho từng loại paymentTerms.
// Cơ chế mới: doanh nghiệp nạp 100% totalValue vào ký quỹ; hệ thống giải ngân ngay theo điều khoản.
// Step 1 = Ký quỹ (giải ngân ngay), Step 5 = Hoàn tất (giải ngân phần còn lại).
// 100_delivery: toàn bộ giải ngân tại Step 4 khi doanh nghiệp xác nhận nhận hàng.
const RELEASE_PERCENT_BY_TERMS: Record<string, [number, number, number, number, number]> = {
  '50_50':        [ 50, 0, 0,   0, 50],
  '30_70':        [ 30, 0, 0,   0, 70],
  '100_delivery': [  0, 0, 0, 100,  0],
  '100_upfront':  [100, 0, 0,   0,  0],
  'custom':       [ 25, 0, 0,   0, 75],
};

const MILESTONE_TEMPLATES = [
  { step: 1, name: 'Ký quỹ',              description: 'Doanh nghiệp đặt cọc ký quỹ theo giá trị hợp đồng',           requiredBy: 'enterprise' as const },
  { step: 2, name: 'Chuẩn bị hàng hóa',  description: 'Nông dân chuẩn bị và đóng gói sản phẩm theo yêu cầu',          requiredBy: 'farmer'     as const },
  { step: 3, name: 'Giao hàng',           description: 'Nông dân xác nhận đã gửi hàng và cung cấp thông tin vận chuyển', requiredBy: 'farmer'     as const },
  { step: 4, name: 'Kiểm tra chất lượng', description: 'Doanh nghiệp nhận hàng và kiểm tra chất lượng sản phẩm',        requiredBy: 'enterprise' as const },
  { step: 5, name: 'Hoàn tất',            description: 'Hai bên xác nhận hoàn thành — giải ngân số dư còn lại',         requiredBy: 'system'     as const },
];

export function buildMilestones(paymentTerms: PaymentTerms, totalAmount: number): IMilestone[] {
  const pcts = RELEASE_PERCENT_BY_TERMS[paymentTerms] ?? RELEASE_PERCENT_BY_TERMS['custom'];

  return MILESTONE_TEMPLATES.map((template, index) => ({
    ...template,
    status: 'pending' as const,
    farmerConfirmed: false,
    enterpriseConfirmed: false,
    releasePercentage: pcts[index],
    releaseAmount: (totalAmount * pcts[index]) / PERCENT_TOTAL,
  }));
}

export const MILESTONE_CONFIG = {
  COUNT: MILESTONE_COUNT,
  PERCENT_TOTAL,
} as const;
