import User, { IUser } from '../models/User.model';
import { AppError } from '../middlewares/error.middleware';

export class UserService {
  /**
   * Get user by ID
   */
  static async getUserById(id: string): Promise<IUser> {
    const user = await User.findById(id);
    if (!user) {
      throw new AppError('Không tìm thấy người dùng', 404);
    }
    return user;
  }

  /**
   * Get user by email
   */
  static async getUserByEmail(email: string): Promise<IUser | null> {
    return await User.findOne({ email: email.toLowerCase() });
  }

  /**
   * Get all users (with pagination, for admin)
   */
  static async getAllUsers(
    page: number = 1,
    limit: number = 20,
    role?: string
  ): Promise<{ users: IUser[]; total: number }> {
    const filter: any = { isActive: true };
    if (role) filter.role = role;

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      User.countDocuments(filter),
    ]);

    return { users, total };
  }

  /**
   * Get all farmers
   */
  static async getFarmers(
    page: number = 1,
    limit: number = 20
  ): Promise<{ users: IUser[]; total: number }> {
    return this.getAllUsers(page, limit, 'farmer');
  }

  /**
   * Get all enterprises
   */
  static async getEnterprises(
    page: number = 1,
    limit: number = 20
  ): Promise<{ users: IUser[]; total: number }> {
    return this.getAllUsers(page, limit, 'enterprise');
  }
}
