import { useState, useEffect, useCallback } from "react";
import { DATE_FORMATS } from "../constants";

const currencyFormatter = new Intl.NumberFormat("vi-VN");

// Chuẩn hóa dữ liệu API để component không phải tự đoán response nằm ở đâu.
const normalizeApiData = (result) => result?.data ?? result;

// Gom logic lấy message lỗi về một chỗ để tránh lặp ở nhiều component.
const normalizeErrorMessage = (error) =>
  error?.message || error?.response?.data?.message || "Có lỗi xảy ra";

const toValidDate = (value) => {
  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

/**
 * Custom hook for fetching API data with loading/error states.
 * Keeps components clean by extracting fetch logic.
 *
 * @param {Function} fetchFn - Async function that returns data
 * @param {Object} options - { immediate: bool, fallback: any }
 * @returns {{ data, loading, error, refetch }}
 */
export function useApiData(fetchFn, options = {}) {
  const { immediate = true, fallback = null } = options;
  const [data, setData] = useState(fallback);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);

  const refetch = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn(...args);
      setData(normalizeApiData(result));
      return result;
    } catch (err) {
      setError(normalizeErrorMessage(err));
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchFn]);

  useEffect(() => {
    if (immediate) refetch();
  }, [immediate, refetch]);

  return { data, loading, error, refetch, setData };
}

/**
 * Format number as Vietnamese currency string
 */
export function formatMoney(value) {
  if (value == null || Number.isNaN(Number(value))) return "0 VNĐ";
  return `${currencyFormatter.format(Number(value))} VNĐ`;
}

/**
 * Format date string to Vietnamese locale
 */
export function formatDate(dateStr) {
  if (!dateStr) return "";
  const parsedDate = toValidDate(dateStr);
  if (!parsedDate) return "";

  return parsedDate.toLocaleDateString("vi-VN", DATE_FORMATS.SHORT_DATE);
}
