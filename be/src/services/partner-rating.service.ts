import mongoose from 'mongoose';
import Contract from '../models/Contract.model';
import PartnerRating from '../models/PartnerRating.model';
import User from '../models/User.model';
import { AppError } from '../middlewares/error.middleware';

type UserRole = 'farmer' | 'enterprise';

type FarmerToEnterpriseCriteria = {
  transparency: number;
  paymentPunctuality: number;
  coordination: number;
};

type EnterpriseToFarmerCriteria = {
  quality: number;
  onTimeDelivery: number;
  committedVolume: number;
};

type RatingCriteria = FarmerToEnterpriseCriteria | EnterpriseToFarmerCriteria;

interface CreatePartnerRatingBody {
  contractId: string;
  revieweeId: string;
  criteria: RatingCriteria;
  comment: string;
}

interface EligiblePartnerContract {
  contractId: string;
  contractCode: string;
  productName: string;
  status: string;
  deliveryDate: Date;
}

interface EligiblePartner {
  partnerId: string;
  partnerName: string;
  partnerRole: UserRole;
  reputationScore: number;
  totalRatings: number;
  contracts: EligiblePartnerContract[];
}

const ELIGIBLE_CONTRACT_STATUSES = ['approved', 'active', 'completed'];

const isValidScore = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 5;

const computeAverage = (values: number[]): number =>
  Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));

const getRefId = (value: unknown): string => {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof mongoose.Types.ObjectId) {
    return value.toString();
  }

  if (typeof value === 'object' && '_id' in value) {
    const objectId = (value as { _id?: unknown })._id;
    return objectId ? String(objectId) : '';
  }

  return String(value);
};

export class PartnerRatingService {
  private static ensureDirection(role: UserRole, revieweeRole: UserRole): void {
    if (role === revieweeRole) {
      throw new AppError('Bạn chỉ có thể đánh giá đối tác khác vai trò', 400);
    }

    if (role === 'farmer' && revieweeRole !== 'enterprise') {
      throw new AppError('Nông dân chỉ được đánh giá doanh nghiệp', 400);
    }

    if (role === 'enterprise' && revieweeRole !== 'farmer') {
      throw new AppError('Doanh nghiệp chỉ được đánh giá nông dân', 400);
    }
  }

  private static normalizeCriteriaByRole(role: UserRole, criteria: RatingCriteria): RatingCriteria {
    if (role === 'farmer') {
      const payload = criteria as Partial<FarmerToEnterpriseCriteria>;
      if (
        !isValidScore(payload.transparency) ||
        !isValidScore(payload.paymentPunctuality) ||
        !isValidScore(payload.coordination)
      ) {
        throw new AppError(
          'Điểm đánh giá doanh nghiệp không hợp lệ. Yêu cầu 3 tiêu chí từ 1 đến 5.',
          400
        );
      }

      return {
        transparency: payload.transparency,
        paymentPunctuality: payload.paymentPunctuality,
        coordination: payload.coordination,
      };
    }

    const payload = criteria as Partial<EnterpriseToFarmerCriteria>;
    if (
      !isValidScore(payload.quality) ||
      !isValidScore(payload.onTimeDelivery) ||
      !isValidScore(payload.committedVolume)
    ) {
      throw new AppError(
        'Điểm đánh giá nông dân không hợp lệ. Yêu cầu 3 tiêu chí từ 1 đến 5.',
        400
      );
    }

    return {
      quality: payload.quality,
      onTimeDelivery: payload.onTimeDelivery,
      committedVolume: payload.committedVolume,
    };
  }

  private static extractCriteriaScores(criteria: RatingCriteria): number[] {
    if ('transparency' in criteria) {
      return [criteria.transparency, criteria.paymentPunctuality, criteria.coordination];
    }

    return [criteria.quality, criteria.onTimeDelivery, criteria.committedVolume];
  }

  private static async recalculateUserReputation(userId: string): Promise<void> {
    const result = await PartnerRating.aggregate([
      { $match: { revieweeId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: '$revieweeId',
          totalRatings: { $sum: 1 },
          avgRating: { $avg: '$overallRating' },
        },
      },
    ]);

    const reputationScore = result[0]?.avgRating ? Number(result[0].avgRating.toFixed(2)) : 5;
    const totalRatings = result[0]?.totalRatings || 0;

    await User.findByIdAndUpdate(userId, {
      reputationScore,
      totalRatings,
    });
  }

  static async getEligiblePartners(userId: string, role: UserRole): Promise<EligiblePartner[]> {
    const query = role === 'farmer'
      ? { farmerId: userId }
      : { enterpriseId: userId };

    const contracts = await Contract.find({
      ...query,
      status: { $in: ELIGIBLE_CONTRACT_STATUSES },
      signedByFarmer: true,
      signedByEnterprise: true,
    })
      .populate('farmerId', 'fullName role reputationScore totalRatings')
      .populate('enterpriseId', 'fullName role reputationScore totalRatings')
      .sort({ createdAt: -1 });

    const map = new Map<string, EligiblePartner>();

    for (const contract of contracts) {
      const partner = role === 'farmer'
        ? contract.enterpriseId as any
        : contract.farmerId as any;

      const partnerId = String(partner?._id || '');
      if (!partnerId) {
        continue;
      }

      if (!map.has(partnerId)) {
        map.set(partnerId, {
          partnerId,
          partnerName: partner.fullName || 'Đối tác',
          partnerRole: partner.role,
          reputationScore: partner.reputationScore || 5,
          totalRatings: partner.totalRatings || 0,
          contracts: [],
        });
      }

      const target = map.get(partnerId)!;
      target.contracts.push({
        contractId: String(contract._id),
        contractCode: contract.contractCode,
        productName: contract.productName,
        status: contract.status,
        deliveryDate: contract.deliveryDate,
      });
    }

    return Array.from(map.values());
  }

  static async createRating(
    reviewerId: string,
    reviewerRole: UserRole,
    body: CreatePartnerRatingBody
  ) {
    const { contractId, revieweeId, criteria, comment } = body;

    if (!contractId || !revieweeId || !criteria || !comment?.trim()) {
      throw new AppError('Thiếu dữ liệu đánh giá bắt buộc', 400);
    }

    const contract = await Contract.findById(contractId)
      .populate('farmerId', 'fullName role')
      .populate('enterpriseId', 'fullName role');

    if (!contract) {
      throw new AppError('Hợp đồng không tồn tại', 404);
    }

    if (
      !ELIGIBLE_CONTRACT_STATUSES.includes(contract.status) ||
      !contract.signedByFarmer ||
      !contract.signedByEnterprise
    ) {
      throw new AppError('Chỉ có thể đánh giá hợp đồng đã hợp tác thực tế', 400);
    }

    const farmerPartyId = getRefId(contract.farmerId);
    const enterprisePartyId = getRefId(contract.enterpriseId);

    const isReviewerParty =
      (reviewerRole === 'farmer' && farmerPartyId === reviewerId) ||
      (reviewerRole === 'enterprise' && enterprisePartyId === reviewerId);

    if (!isReviewerParty) {
      throw new AppError('Bạn không thuộc hợp đồng này', 403);
    }

    const revieweeUser = await User.findById(revieweeId).select('role fullName');
    if (!revieweeUser) {
      throw new AppError('Đối tác cần đánh giá không tồn tại', 404);
    }

    if (revieweeUser.role === 'admin') {
      throw new AppError('Admin không thuộc đối tượng đánh giá đối tác', 400);
    }

    const revieweeRole = revieweeUser.role as UserRole;
    this.ensureDirection(reviewerRole, revieweeRole);

    const expectedRevieweeId = reviewerRole === 'farmer'
      ? enterprisePartyId
      : farmerPartyId;

    if (expectedRevieweeId !== revieweeId) {
      throw new AppError('Bạn chỉ được đánh giá đúng đối tác trong hợp đồng đã chọn', 400);
    }

    const normalizedCriteria = this.normalizeCriteriaByRole(reviewerRole, criteria);

    const existed = await PartnerRating.findOne({
      contractId,
      reviewerId,
    });

    if (existed) {
      throw new AppError('Bạn đã đánh giá đối tác trong hợp đồng này rồi', 400);
    }

    const overallRating = computeAverage(this.extractCriteriaScores(normalizedCriteria));

    const created = await PartnerRating.create({
      contractId,
      reviewerId,
      revieweeId,
      reviewerRole,
      revieweeRole,
      criteria: normalizedCriteria,
      overallRating,
      comment: comment.trim(),
    });

    await this.recalculateUserReputation(revieweeId);

    return created;
  }

  static async getMyRatings(userId: string, role: UserRole) {
    const [givenRatings, receivedRatings] = await Promise.all([
      PartnerRating.find({ reviewerId: userId, reviewerRole: role })
        .populate('revieweeId', 'fullName role')
        .populate('contractId', 'contractCode productName status')
        .sort({ createdAt: -1 }),
      PartnerRating.find({ revieweeId: userId, revieweeRole: role })
        .populate('reviewerId', 'fullName role')
        .populate('contractId', 'contractCode productName status')
        .sort({ createdAt: -1 }),
    ]);

    return { givenRatings, receivedRatings };
  }
}
