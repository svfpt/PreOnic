/**
 * Product utility functions
 * Product data is now fetched from BE API — see services/product.service.js
 */

// Helper: format price
export const formatPrice = (price) => price.toLocaleString('vi-VN') + 'đ';
export const formatPriceRange = (min, max) => `${formatPrice(min)} - ${formatPrice(max)}`;
