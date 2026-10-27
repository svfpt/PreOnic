import Feedback, {
  FeedbackCategory,
  FeedbackStatus,
  IFeedback,
} from '../models/Feedback.model';
import User from '../models/User.model';
import { AppError } from '../middlewares/error.middleware';

interface CreateFeedbackInput {
  userId: string;
  userRole: 'farmer' | 'enterprise';
  userName: string;
  userEmail: string;
  category?: FeedbackCategory;
  subject: string;
  message: string;
}

const VALID_CATEGORIES: FeedbackCategory[] = ['bug', 'feature', 'ux', 'payment', 'other'];
const VALID_STATUSES: FeedbackStatus[] = ['new', 'read', 'resolved'];

export class FeedbackService {
  // User (farmer/enterprise) gửi phản hồi → tạo bản ghi trạng thái 'new'.
  static async create(input: CreateFeedbackInput): Promise<IFeedback> {
    const subject = (input.subject || '').trim();
    const message = (input.message || '').trim();

    if (!subject) throw new AppError('Vui lòng nhập tiêu đề phản hồi', 400);
    if (!message) throw new AppError('Vui lòng nhập nội dung phản hồi', 400);

    const category =
      input.category && VALID_CATEGORIES.includes(input.category)
        ? input.category
        : 'other';

    return Feedback.create({
      userId: input.userId,
      userRole: input.userRole,
      userName: input.userName,
      userEmail: input.userEmail,
      category,
      subject,
      message,
      status: 'new',
    });
  }

  // Danh sách phản hồi của chính user.
  static async getMine(userId: string) {
    return Feedback.find({ userId }).sort({ createdAt: -1 });
  }

  // ===== Admin =====

  static async adminList(filters: {
    status?: string;
    category?: string;
    role?: string;
    page?: number;
    limit?: number;
  }) {
    const query: Record<string, unknown> = {};
    // Ẩn feedback của các account bị ẩn mềm khỏi danh sách admin.
    const hiddenUserIds = await User.find({ isHidden: true }).distinct('_id');
    if (hiddenUserIds.length) {
      query.userId = { $nin: hiddenUserIds };
    }
    if (filters.status && VALID_STATUSES.includes(filters.status as FeedbackStatus)) {
      query.status = filters.status;
    }
    if (filters.category && VALID_CATEGORIES.includes(filters.category as FeedbackCategory)) {
      query.category = filters.category;
    }
    if (filters.role === 'farmer' || filters.role === 'enterprise') {
      query.userRole = filters.role;
    }

    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    const [items, total, unresolved] = await Promise.all([
      // Admin không được xem email người dùng → loại userEmail khỏi payload.
      Feedback.find(query).select('-userEmail').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Feedback.countDocuments(query),
      Feedback.countDocuments({ status: { $ne: 'resolved' } }),
    ]);

    return { items, total, page, limit, unresolved };
  }

  static async adminUpdateStatus(id: string, status: FeedbackStatus, adminNote?: string) {
    if (!VALID_STATUSES.includes(status)) {
      throw new AppError('Trạng thái không hợp lệ', 400);
    }
    const update: Record<string, unknown> = { status };
    if (typeof adminNote === 'string') update.adminNote = adminNote.trim();

    const feedback = await Feedback.findByIdAndUpdate(id, update, { new: true });
    if (!feedback) throw new AppError('Phản hồi không tồn tại', 404);
    return feedback;
  }

  static async adminUnresolvedCount(): Promise<number> {
    return Feedback.countDocuments({ status: { $ne: 'resolved' } });
  }
}
