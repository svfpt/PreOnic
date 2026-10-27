import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { asyncHandler } from '../middlewares/error.middleware';
import { WeatherService } from '../services/weather.service';
import { successResponse } from '../utils/response.util';
import { PROVINCE_COORDS } from '../data/provinces';

/**
 * @desc    Liệt kê toạ độ tỉnh/thành (public, dùng cho bản đồ FE)
 * @route   GET /api/v1/weather/provinces
 * @access  Public
 */
export const getProvinceCoords = asyncHandler(
  async (_req: Request, res: Response, _next: NextFunction) => {
    res.status(200).json(successResponse(PROVINCE_COORDS, 'Danh sách toạ độ tỉnh/thành'));
  }
);

/**
 * @desc    Get current weather for logged-in user's location
 * @route   GET /api/v1/weather/current
 * @access  Private
 */
export const getCurrentWeather = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const province = req.query.province as string | undefined;
    const weather = await WeatherService.getWeatherForUser(req.user!.id, province);
    res.status(200).json(successResponse(weather, 'Lấy thông tin thời tiết thành công'));
  }
);

/**
 * @desc    Get 5-day forecast for logged-in user's location
 * @route   GET /api/v1/weather/forecast
 * @access  Private
 */
export const getForecast = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const province = req.query.province as string | undefined;
    const forecast = await WeatherService.getForecastForUser(req.user!.id, province);
    res.status(200).json(successResponse(forecast, 'Lấy dự báo thời tiết thành công'));
  }
);

/**
 * @desc    Get weather alerts for logged-in user
 * @route   GET /api/v1/weather/alerts
 * @access  Private
 */
export const getWeatherAlerts = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await WeatherService.getAlertsForUser(req.user!.id, page, limit);
    res.status(200).json({
      success: true,
      status: 'success',
      data: result.alerts,
      pagination: result.pagination,
    });
  }
);

/**
 * @desc    Get unread weather alert count
 * @route   GET /api/v1/weather/alerts/unread-count
 * @access  Private
 */
export const getUnreadAlertCount = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const count = await WeatherService.getUnreadAlertCount(req.user!.id);
    res.status(200).json(successResponse({ count }));
  }
);

/**
 * @desc    Mark a weather alert as read
 * @route   PATCH /api/v1/weather/alerts/:id/read
 * @access  Private
 */
export const markAlertAsRead = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const alert = await WeatherService.markAlertAsRead(req.params.id, req.user!.id);
    res.status(200).json(successResponse(alert, 'Đã đánh dấu đã đọc'));
  }
);

/**
 * @desc    Mark all weather alerts as read
 * @route   PATCH /api/v1/weather/alerts/read-all
 * @access  Private
 */
export const markAllAlertsAsRead = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    await WeatherService.markAllAlertsAsRead(req.user!.id);
    res.status(200).json(successResponse(null, 'Đã đánh dấu tất cả đã đọc'));
  }
);

/**
 * @desc    Get weather thresholds (system defaults)
 * @route   GET /api/v1/weather/thresholds
 * @access  Private
 */
export const getThresholds = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const thresholds = WeatherService.getThresholds();
    res.status(200).json(successResponse(thresholds));
  }
);
