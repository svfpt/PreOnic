import { ApiResponse, PaginatedResponse } from '../types';

/** Format a standard success response */
export const successResponse = <T>(data: T, message?: string): ApiResponse<T> => ({
  success: true,
  status: 'success',
  ...(message && { message }),
  data,
});

/** Format a standard error response */
export const errorResponse = (message: string, statusCode: number = 500) => ({
  success: false,
  status: 'error' as const,
  message,
  statusCode,
});

/**
 * Format paginated response
 */
export const paginatedResponse = (
  data: any[],
  page: number,
  limit: number,
  total: number
) => {
  return {
    success: true,
    status: 'success',
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
};
