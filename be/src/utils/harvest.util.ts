function startOfDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function parseExpectedDate(expectedDate?: string | null): Date | null {
  if (!expectedDate) return null;

  const value = expectedDate.trim();
  if (!value || /^quanh nam$/i.test(value) || /^quanh năm$/i.test(value)) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : startOfDay(parsed);
  }

  const parts = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (parts) {
    const [, day, month, year] = parts;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(parsed.getTime()) ? null : startOfDay(parsed);
  }

  return null;
}

export function getHarvestEligibility(expectedDate?: string | null): {
  harvestDate: Date | null;
  shippingAllowed: boolean;
  reason: string | null;
} {
  const harvestDate = parseExpectedDate(expectedDate);
  if (!harvestDate) {
    return {
      harvestDate: null,
      shippingAllowed: true,
      reason: null,
    };
  }

  const today = startOfDay(new Date());
  const shippingAllowed = today >= harvestDate;

  return {
    harvestDate,
    shippingAllowed,
    reason: shippingAllowed
      ? null
      : `Chưa đến ngày thu hoạch. Bạn chỉ có thể lên đơn vận chuyển từ ${harvestDate.toLocaleDateString('vi-VN')}.`,
  };
}