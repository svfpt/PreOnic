import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { asyncHandler } from '../middlewares/error.middleware';
import { successResponse } from '../utils/response.util';
import { PartnerRatingService } from '../services/partner-rating.service';

export const getEligiblePartners = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    if (req.user!.role === 'admin') {
      res.status(403).json(successResponse({}, 'Admin không có danh sách đối tác để đánh giá'));
      return;
    }

    const partners = await PartnerRatingService.getEligiblePartners(
      req.user!.id,
      req.user!.role
    );

    res.status(200).json(successResponse({ partners }));
  }
);

export const createPartnerRating = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    if (req.user!.role === 'admin') {
      res.status(403).json(successResponse({}, 'Admin không thể tạo đánh giá đối tác'));
      return;
    }

    const rating = await PartnerRatingService.createRating(
      req.user!.id,
      req.user!.role,
      req.body
    );

    res
      .status(201)
      .json(successResponse({ rating }, 'Gửi đánh giá đối tác thành công'));
  }
);

export const getMyPartnerRatings = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    if (req.user!.role === 'admin') {
      res.status(403).json(successResponse({}, 'Admin không có danh sách đánh giá đối tác'));
      return;
    }

    const result = await PartnerRatingService.getMyRatings(
      req.user!.id,
      req.user!.role
    );

    res.status(200).json(successResponse(result));
  }
);
