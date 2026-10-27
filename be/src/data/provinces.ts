// Toạ độ xấp xỉ trung tâm tỉnh/thành Việt Nam — single source of truth.
// Dùng cho weather lookup (BE service) và bản đồ Windy (FE qua endpoint /weather/provinces).

export type ProvinceCoord = { lat: number; lng: number };

export const PROVINCE_COORDS: Record<string, ProvinceCoord> = {
  'Ha Noi': { lat: 21.0285, lng: 105.8542 },
  'Ho Chi Minh': { lat: 10.8231, lng: 106.6297 },
  'Da Nang': { lat: 16.0544, lng: 108.2022 },
  'Can Tho': { lat: 10.0452, lng: 105.7469 },
  'Hai Phong': { lat: 20.8449, lng: 106.6881 },
  'Binh Duong': { lat: 11.3254, lng: 106.477 },
  'Dong Nai': { lat: 10.9453, lng: 106.8243 },
  'Lam Dong': { lat: 11.9404, lng: 108.4583 },
  'Dak Lak': { lat: 12.71, lng: 108.2378 },
  'Gia Lai': { lat: 13.9833, lng: 108.0 },
  'Long An': { lat: 10.5364, lng: 106.4134 },
  'Tien Giang': { lat: 10.3599, lng: 106.3631 },
  'Ben Tre': { lat: 10.2434, lng: 106.3756 },
  'An Giang': { lat: 10.5216, lng: 105.1259 },
  'Binh Thuan': { lat: 10.9333, lng: 108.1 },
  'Khanh Hoa': { lat: 12.2585, lng: 109.0526 },
  'Tay Ninh': { lat: 11.3635, lng: 106.1016 },
  'Thai Nguyen': { lat: 21.5671, lng: 105.825 },
  'Bac Giang': { lat: 21.2731, lng: 106.1946 },
  'Thanh Hoa': { lat: 19.8, lng: 105.7667 },
  'Nghe An': { lat: 18.6733, lng: 105.6922 },
  'Ha Tinh': { lat: 18.3559, lng: 105.8877 },
  'Quang Binh': { lat: 17.4688, lng: 106.6224 },
  'Hue': { lat: 16.4637, lng: 107.5909 },
  'Quang Nam': { lat: 15.5394, lng: 108.019 },
  'Quang Ngai': { lat: 15.1214, lng: 108.8044 },
  'Binh Dinh': { lat: 13.782, lng: 109.2197 },
  'Phu Yen': { lat: 13.0882, lng: 109.0929 },
};
