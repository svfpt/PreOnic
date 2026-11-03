import crypto from 'crypto';
import Contract, { IContract } from '../models/Contract.model';
import Product, { IProduct } from '../models/Product.model';
import User from '../models/User.model';
import { AppError } from '../middlewares/error.middleware';
import { EscrowService } from './escrow.service';
import { NotificationService } from './notification.service';
import { sendSignOtpEmail } from './email.service';
import { CONTRACT_CONFIG, UNIT_TO_KG } from '../constants';

export interface CreateContractBody {
  farmerId?: string;
  enterpriseId?: string;
  farmerName: string;
  enterpriseName: string;
  productName: string;
  productId?: string;
  quantity: number;
  unit: 'tan' | 'ta' | 'kg' | 'thung';
  pricePerUnit: number;
  depositPercentage: number;
  breachCompensationRate?: number;
  paymentTerms: '50_50' | '30_70' | '100_delivery' | '100_upfront';
  deliveryDate: string;
  notes?: string;
}

type ContractActorRole = 'farmer' | 'enterprise' | 'admin';

interface ContractParticipants {
  farmerId: string;
  enterpriseId: string;
}

interface ContractFinancials {
  totalValue: number;
  commission: number;
  depositAmount: number;
}

export class ContractService {
  private static getContractContentHash(contract: IContract): string {
    const content = {
      contractCode: contract.contractCode,
      farmerId: contract.farmerId.toString(),
      enterpriseId: contract.enterpriseId.toString(),
      farmerName: contract.farmerName,
      enterpriseName: contract.enterpriseName,
      productId: contract.productId?.toString(),
      productName: contract.productName,
      quantity: contract.quantity,
      unit: contract.unit,
      pricePerUnit: contract.pricePerUnit,
      totalValue: contract.totalValue,
      commission: contract.commission,
      commissionRate: contract.commissionRate,
      depositAmount: contract.depositAmount,
      depositPercentage: contract.depositPercentage,
      breachCompensationRate: contract.breachCompensationRate,
      paymentTerms: contract.paymentTerms,
      deliveryDate: contract.deliveryDate.toISOString(),
      notes: contract.notes,
      farmLocation: contract.farmLocation,
      insuranceFarmer: contract.insuranceFarmer,
      insuranceEnterprise: contract.insuranceEnterprise,
      riskSharingTerms: contract.riskSharingTerms,
    };

    return crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex');
  }

  // Khối helper này gom toàn bộ quy tắc nghiệp vụ để các hàm public bên dưới chỉ còn điều phối luồng chính.
  private static async resolveParticipants(
    body: CreateContractBody,
    userId: string,
    role: ContractActorRole
  ): Promise<ContractParticipants> {
    let farmerId = body.farmerId;
    let enterpriseId = body.enterpriseId;

    if (role === 'enterprise') {
      enterpriseId = userId;

      if (body.productId) {
        const product = await Product.findById(body.productId);
        if (product?.createdBy) {
          farmerId = product.createdBy.toString();
        }
      }
    } else {
      farmerId = userId;
    }

    if (!farmerId || !enterpriseId) {
      throw new AppError('Không thể xác định nông dân hoặc doanh nghiệp', 400);
    }

    return { farmerId, enterpriseId };
  }

  private static calculateFinancials(body: CreateContractBody): ContractFinancials {
    const totalValue = Math.round(body.quantity * body.pricePerUnit * UNIT_TO_KG[body.unit]);
    const commission = Math.round((totalValue * CONTRACT_CONFIG.COMMISSION_RATE) / 100);
    const depositAmount = Math.round((totalValue * body.depositPercentage) / 100);

    return { totalValue, commission, depositAmount };
  }

  private static toKg(quantity: number, unit: CreateContractBody['unit']): number {
    return quantity * UNIT_TO_KG[unit];
  }

  private static getAvailableProductQuantityKg(product: IProduct): number {
    return Math.max(0, Number(product.remaining ?? product.totalQuantity ?? 0));
  }

  private static formatQuantityForDisplay(
    quantityKg: number,
    unit: string = 'kg'
  ): string {
    if (unit === 'tan') {
      return `${Number((quantityKg / UNIT_TO_KG.tan).toFixed(2)).toLocaleString('vi-VN')} tấn`;
    }

    if (unit === 'ta') {
      return `${Number((quantityKg / UNIT_TO_KG.ta).toFixed(2)).toLocaleString('vi-VN')} tạ`;
    }

    if (unit === 'thung') {
      return `${Number((quantityKg / UNIT_TO_KG.thung).toFixed(2)).toLocaleString('vi-VN')} thùng`;
    }

    return `${Number(quantityKg.toFixed(2)).toLocaleString('vi-VN')} kg`;
  }

  private static async ensureRequestedQuantityAvailable(
    productId: string | undefined,
    quantity: number,
    unit: CreateContractBody['unit']
  ): Promise<void> {
    if (!productId) {
      return;
    }

    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      throw new AppError('Sản phẩm không tồn tại hoặc đã ngừng hiển thị', 404);
    }

    const requestedKg = this.toKg(quantity, unit);
    const availableKg = this.getAvailableProductQuantityKg(product);

    if (requestedKg - availableKg > 1e-9) {
      throw new AppError(
        `Số lượng hợp đồng vượt quá sản lượng còn lại của sản phẩm. Tối đa còn ${this.formatQuantityForDisplay(availableKg, product.unit)}.`,
        400
      );
    }
  }

  private static async generateContractCode(): Promise<string> {
    const year = new Date().getFullYear();

    for (
      let attempt = 0;
      attempt < CONTRACT_CONFIG.MAX_CODE_GENERATION_ATTEMPTS;
      attempt += 1
    ) {
      const sequence = Math.floor(
        Math.random() * CONTRACT_CONFIG.CODE_SEQUENCE_SPAN +
          CONTRACT_CONFIG.CODE_SEQUENCE_MIN
      );
      const contractCode = `${CONTRACT_CONFIG.CODE_PREFIX}-${year}-${sequence}`;
      const existingContract = await Contract.exists({ contractCode });

      if (!existingContract) {
        return contractCode;
      }
    }

    throw new AppError('Không thể tạo mã hợp đồng duy nhất. Vui lòng thử lại.', 500);
  }

  private static ensureContractExists(contract: IContract | null): IContract {
    if (!contract) {
      throw new AppError('Hợp đồng không tồn tại', 404);
    }

    return contract;
  }

  private static ensurePartyAccess(contract: IContract, userId: string): void {
    const isParty =
      contract.farmerId.toString() === userId ||
      contract.enterpriseId.toString() === userId;

    if (!isParty) {
      throw new AppError('Bạn không có quyền xem hợp đồng này', 403);
    }
  }

  // Sau khi cả hai bên ký, helper này cập nhật tiến độ sản phẩm để dashboard phản ánh đúng cam kết thực tế.
  private static async updateProductCommitment(contract: IContract): Promise<void> {
    if (!contract.productId) {
      return;
    }

    const product = await Product.findById(contract.productId);
    if (!product || product.totalQuantity <= 0) {
      return;
    }

    const committedKg = contract.quantity * UNIT_TO_KG[contract.unit];
    const availableKg = this.getAvailableProductQuantityKg(product);

    if (committedKg - availableKg > 1e-9) {
      throw new AppError(
        `Sản lượng còn lại của sản phẩm không đủ để ký hợp đồng này. Tối đa còn ${this.formatQuantityForDisplay(availableKg, product.unit)}.`,
        400
      );
    }

    const addedProgressPercent = (committedKg / product.totalQuantity) * 100;

    product.progress = Math.min(100, (product.progress || 0) + addedProgressPercent);
    product.remaining = Math.max(
      0,
      (product.remaining ?? product.totalQuantity) - committedKg
    );
    await product.save();
  }

  private static async notifyContractCreated(
    role: ContractActorRole,
    body: CreateContractBody,
    farmerId: string,
    contractId: string
  ): Promise<void> {
    if (role !== 'enterprise') {
      return;
    }

    try {
      await NotificationService.create({
        userId: farmerId,
        type: 'contract',
        title: 'Hợp đồng mới từ doanh nghiệp',
        message: `Doanh nghiệp "${body.enterpriseName}" đã tạo hợp đồng mua ${body.productName} (${body.quantity} ${body.unit}). Vui lòng xem xét và ký hợp đồng.`,
        severity: 'info',
        relatedId: contractId,
        relatedModel: 'Contract',
      });
    } catch {
      // Không chặn luồng chính nếu bước gửi thông báo phụ thất bại.
    }
  }

  private static async notifyContractSigned(
    contract: IContract,
    role: ContractActorRole
  ): Promise<void> {
    try {
      if (contract.signedByFarmer && contract.signedByEnterprise) {
        await EscrowService.createEscrowForContract(contract);

        await Promise.all([
          NotificationService.create({
            userId: contract.farmerId.toString(),
            type: 'contract',
            title: 'Hợp đồng đã được ký kết',
            message: `Hợp đồng ${contract.contractCode} đã được cả hai bên ký kết. Đang chờ doanh nghiệp đặt cọc ký quỹ để kích hoạt hợp đồng.`,
            severity: 'info',
            relatedId: String(contract._id),
            relatedModel: 'Contract',
          }),
          NotificationService.create({
            userId: contract.enterpriseId.toString(),
            type: 'contract',
            title: 'Hợp đồng đã được ký kết — cần đặt cọc',
            message: `Hợp đồng ${contract.contractCode} đã được cả hai bên ký kết. Vui lòng vào mục Ký quỹ để đặt cọc và kích hoạt hợp đồng.`,
            severity: 'warning',
            relatedId: String(contract._id),
            relatedModel: 'Contract',
          }),
        ]);
        return;
      }

      if (role === 'farmer') {
        await NotificationService.create({
          userId: contract.enterpriseId.toString(),
          type: 'contract',
          title: 'Nông dân đã ký hợp đồng',
          message: `Nông dân "${contract.farmerName}" đã ký hợp đồng ${contract.contractCode}. Vui lòng ký để hoàn tất.`,
          severity: 'info',
          relatedId: String(contract._id),
          relatedModel: 'Contract',
        });
        return;
      }

      await NotificationService.create({
        userId: contract.farmerId.toString(),
        type: 'contract',
        title: 'Doanh nghiệp đã ký hợp đồng',
        message: `Doanh nghiệp "${contract.enterpriseName}" đã ký hợp đồng ${contract.contractCode}. Vui lòng ký để hoàn tất.`,
        severity: 'info',
        relatedId: String(contract._id),
        relatedModel: 'Contract',
      });
    } catch {
      // Không làm hỏng thao tác ký chỉ vì bước thông báo phụ thất bại.
    }
  }

  /**
   * Create a new contract
   */
  static async create(
    body: CreateContractBody,
    userId: string,
    role: ContractActorRole
  ): Promise<IContract> {
    const breachCompensationRate = body.breachCompensationRate ?? 8;
    if (
      !Number.isFinite(breachCompensationRate) ||
      breachCompensationRate <= 0 ||
      breachCompensationRate > 100
    ) {
      throw new AppError('Tỷ lệ đền bù phải lớn hơn 0 và không vượt quá 100%', 400);
    }

    const { farmerId, enterpriseId } = await this.resolveParticipants(
      body,
      userId,
      role
    );
    await this.ensureRequestedQuantityAvailable(
      body.productId,
      body.quantity,
      body.unit
    );
    const { totalValue, commission, depositAmount } =
      this.calculateFinancials(body);
    const contractCode = await this.generateContractCode();

    const contract = await Contract.create({
      ...body,
      contractCode,
      farmerId,
      enterpriseId,
      breachCompensationRate,
      productId: body.productId || undefined,
      totalValue,
      commission,
      commissionRate: CONTRACT_CONFIG.COMMISSION_RATE,
      depositAmount,
      status: 'pending',
    });

    await this.notifyContractCreated(role, body, farmerId, String(contract._id));

    return contract;
  }

  /**
   * Get contract by ID (only for parties)
   */
  static async getById(contractId: string, userId: string): Promise<IContract> {
    const contract = this.ensureContractExists(await Contract.findById(contractId));
    this.ensurePartyAccess(contract, userId);

    return contract;
  }

  /**
   * List contracts for a user
   */
  static async listByUser(
    userId: string,
    role: ContractActorRole,
    status?: string
  ): Promise<IContract[]> {
    const query = role === 'farmer' ? { farmerId: userId } : { enterpriseId: userId };

    if (status) {
      return Contract.find({ ...query, status }).sort({ createdAt: -1 });
    }

    return Contract.find(query).sort({ createdAt: -1 });
  }

  /** Generate and email a one-time code to a contract participant. */
  static async requestSignOtp(contractId: string, userId: string): Promise<void> {
    const contract = this.ensureContractExists(
      await Contract.findById(contractId).select(
        '+signOtpHash +signOtpExpiry +signOtpSentAt +signOtpAttempts +signOtpContractHash'
      )
    );

    const isFarmer = contract.farmerId.toString() === userId;
    const isEnterprise = contract.enterpriseId.toString() === userId;
    if (!isFarmer && !isEnterprise) {
      throw new AppError('Bạn không phải là bên tham gia hợp đồng này', 403);
    }
    if (contract.status !== 'pending') {
      throw new AppError('Chỉ có thể ký hợp đồng đang chờ ký', 400);
    }
    if ((isFarmer && contract.signedByFarmer) || (isEnterprise && contract.signedByEnterprise)) {
      throw new AppError('Hợp đồng này đã được bạn ký rồi', 400);
    }
    if (contract.signOtpSentAt && Date.now() - contract.signOtpSentAt.getTime() < 60_000) {
      throw new AppError('Vui lòng đợi một phút trước khi yêu cầu mã OTP mới', 429);
    }

    const user = await User.findById(userId).select('email fullName');
    if (!user) throw new AppError('Không tìm thấy người dùng', 404);

    const otp = String(crypto.randomInt(100000, 1_000_000));
    const hash = crypto.createHash('sha256').update(otp).digest('hex');
    contract.signOtpHash = hash;
    contract.signOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    contract.signOtpSentAt = new Date();
    contract.signOtpAttempts = 0;
    contract.signOtpContractHash = this.getContractContentHash(contract);
    await contract.save();

    try {
      await sendSignOtpEmail(user.email, user.fullName, otp, contract.contractCode);
    } catch (error) {
      contract.signOtpHash = undefined;
      contract.signOtpExpiry = undefined;
      contract.signOtpSentAt = undefined;
      contract.signOtpAttempts = 0;
      contract.signOtpContractHash = undefined;
      await contract.save();
      throw error;
    }
  }

  /** Verify a one-time email code and record the exact content each participant approved. */
  static async sign(
    contractId: string,
    userId: string,
    role: ContractActorRole,
    otp: string,
    signingContext: { ipAddress?: string; userAgent?: string } = {}
  ): Promise<IContract> {
    const contract = this.ensureContractExists(
      await Contract.findById(contractId).select(
        '+signOtpHash +signOtpExpiry +signOtpAttempts +signOtpContractHash'
      )
    );

    if (role !== 'farmer' && role !== 'enterprise') {
      throw new AppError('Chỉ các bên tham gia mới có thể ký hợp đồng', 403);
    }
    if (contract.status !== 'pending') {
      throw new AppError('Chỉ có thể ký hợp đồng đang chờ ký', 400);
    }

    if (role === 'farmer') {
      if (contract.farmerId.toString() !== userId) {
        throw new AppError('Bạn không phải là nông dân trong hợp đồng này', 403);
      }
      if (contract.signedByFarmer) {
        throw new AppError('Bạn đã ký hợp đồng này rồi', 400);
      }
    } else {
      if (contract.enterpriseId.toString() !== userId) {
        throw new AppError('Bạn không phải là doanh nghiệp trong hợp đồng này', 403);
      }
      if (contract.signedByEnterprise) {
        throw new AppError('Bạn đã ký hợp đồng này rồi', 400);
      }
    }

    if (!/^\d{6}$/.test(otp || '')) {
      throw new AppError('Vui lòng nhập mã OTP gồm 6 chữ số', 400);
    }
    if (!contract.signOtpHash || !contract.signOtpExpiry || !contract.signOtpContractHash) {
      throw new AppError('Hãy yêu cầu mã OTP trước khi ký hợp đồng', 400);
    }
    if (contract.signOtpExpiry.getTime() <= Date.now()) {
      contract.signOtpHash = undefined;
      contract.signOtpExpiry = undefined;
      contract.signOtpContractHash = undefined;
      contract.signOtpAttempts = 0;
      await contract.save();
      throw new AppError('Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới', 400);
    }
    if (contract.signOtpAttempts >= 5) {
      throw new AppError('Bạn đã nhập sai OTP quá số lần cho phép. Vui lòng yêu cầu mã mới', 429);
    }

    const submittedHash = crypto.createHash('sha256').update(otp).digest();
    const storedHash = Buffer.from(contract.signOtpHash, 'hex');
    if (storedHash.length !== submittedHash.length || !crypto.timingSafeEqual(storedHash, submittedHash)) {
      const failedAttempt = await Contract.findOneAndUpdate(
        {
          _id: contract._id,
          signOtpHash: contract.signOtpHash,
          signOtpExpiry: { $gt: new Date() },
          signOtpAttempts: { $lt: 5 },
        },
        { $inc: { signOtpAttempts: 1 } },
        { new: true }
      ).select('+signOtpAttempts');

      if (!failedAttempt) {
        throw new AppError('Mã OTP đã hết hạn hoặc cần được gửi lại', 429);
      }
      const attemptsExhausted = failedAttempt.signOtpAttempts >= 5;
      if (attemptsExhausted) {
        await Contract.updateOne(
          { _id: contract._id, signOtpHash: contract.signOtpHash },
          {
            $unset: {
              signOtpHash: 1,
              signOtpExpiry: 1,
              signOtpContractHash: 1,
            },
          }
        );
      }
      throw new AppError(
        attemptsExhausted
          ? 'Bạn đã nhập sai OTP quá số lần cho phép. Vui lòng yêu cầu mã mới'
          : 'Mã OTP không đúng',
        attemptsExhausted ? 429 : 400
      );
    }

    const contractHash = this.getContractContentHash(contract);
    if (contract.signOtpContractHash !== contractHash) {
      contract.signOtpHash = undefined;
      contract.signOtpExpiry = undefined;
      contract.signOtpContractHash = undefined;
      contract.signOtpAttempts = 0;
      await contract.save();
      throw new AppError('Nội dung hợp đồng đã thay đổi. Vui lòng tải lại và yêu cầu OTP mới', 409);
    }
    const previousSignature = contract.signatures.find(signature => signature.role !== role);
    if (previousSignature && previousSignature.contractHash !== contractHash) {
      throw new AppError('Nội dung hợp đồng không khớp với chữ ký trước đó', 409);
    }

    const signer = await User.findById(userId).select('email fullName');
    if (!signer) throw new AppError('Không tìm thấy người ký', 404);

    const roleSignedField =
      role === 'farmer' ? { signedByFarmer: false } : { signedByEnterprise: false };
    const consumedOtp = await Contract.findOneAndUpdate(
      {
        _id: contract._id,
        status: 'pending',
        ...roleSignedField,
        signOtpHash: contract.signOtpHash,
        signOtpContractHash: contractHash,
        signOtpExpiry: { $gt: new Date() },
        signOtpAttempts: { $lt: 5 },
        updatedAt: contract.updatedAt,
      },
      {
        $unset: {
          signOtpHash: 1,
          signOtpExpiry: 1,
          signOtpSentAt: 1,
          signOtpContractHash: 1,
        },
        $set: { signOtpAttempts: 0 },
      },
      { new: true }
    );
    if (!consumedOtp) {
      throw new AppError('Mã OTP đã được sử dụng hoặc hợp đồng vừa thay đổi. Vui lòng thử lại', 409);
    }

    contract.signatures.push({
      role,
      userId: signer._id,
      signerName: signer.fullName,
      signerEmail: signer.email,
      signedAt: new Date(),
      contractHash,
      ipAddress: signingContext.ipAddress,
      userAgent: signingContext.userAgent?.slice(0, 500),
    });
    contract.signOtpHash = undefined;
    contract.signOtpExpiry = undefined;
    contract.signOtpSentAt = undefined;
    contract.signOtpAttempts = 0;
    contract.signOtpContractHash = undefined;
    if (role === 'farmer') {
      contract.signedByFarmer = true;
    } else {
      contract.signedByEnterprise = true;
    }

    // If both signed, update status and product progress
    if (contract.signedByFarmer && contract.signedByEnterprise) {
      contract.signedAt = new Date();
      contract.status = 'approved';
      await this.updateProductCommitment(contract);
    }

    await contract.save();
    await this.notifyContractSigned(contract, role);

    return contract;
  }

  /**
   * Reject a contract (farmer rejects before signing — different from cancel)
   */
  static async reject(
    contractId: string,
    userId: string,
    reason: string
  ): Promise<IContract> {
    const contract = this.ensureContractExists(await Contract.findById(contractId));

    if (contract.farmerId.toString() !== userId) {
      throw new AppError('Chỉ nông dân mới có thể từ chối hợp đồng', 403);
    }

    if (contract.status !== 'pending') {
      throw new AppError('Chỉ có thể từ chối hợp đồng đang chờ xác nhận', 400);
    }

    if (contract.signedByFarmer) {
      throw new AppError('Không thể từ chối sau khi một bên đã ký hợp đồng', 400);
    }
    if (contract.signedByEnterprise) {
      throw new AppError('Không thể từ chối sau khi một bên đã ký hợp đồng', 400);
    }

    const rejectedContract = await Contract.findOneAndUpdate(
      {
        _id: contract._id,
        status: 'pending',
        signedByFarmer: false,
        signedByEnterprise: false,
      },
      {
        $set: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelReason: `[TỪ CHỐI] ${reason}`,
        },
      },
      { new: true }
    );
    if (!rejectedContract) {
      throw new AppError('Hợp đồng đã thay đổi hoặc đã có bên ký, không thể từ chối', 409);
    }

    // Notify enterprise
    try {
      await NotificationService.create({
        userId: contract.enterpriseId.toString(),
        type: 'contract',
        title: 'Nông dân từ chối hợp đồng',
        message: `Nông dân "${contract.farmerName}" đã từ chối hợp đồng ${contract.contractCode}. Lý do: ${reason}`,
        severity: 'warning',
        relatedId: String(contract._id),
        relatedModel: 'Contract',
      });
    } catch {
      // Không làm gián đoạn thao tác từ chối nếu chỉ lỗi bước thông báo.
    }

    return rejectedContract;
  }

  /**
   * Cancel a contract
   */
  static async cancel(
    contractId: string,
    userId: string,
    reason: string
  ): Promise<IContract> {
    const contract = this.ensureContractExists(await Contract.findById(contractId));

    const isParty =
      contract.farmerId.toString() === userId ||
      contract.enterpriseId.toString() === userId;
    if (!isParty) {
      throw new AppError('Bạn không có quyền hủy hợp đồng này', 403);
    }

    if (contract.status !== 'pending' || contract.signedByFarmer || contract.signedByEnterprise) {
      throw new AppError(
        'Không thể đơn phương hủy hợp đồng sau khi một bên đã ký. Hai bên cần thực hiện hợp đồng hoặc thỏa thuận chấm dứt theo quy định.',
        400
      );
    }

    const cancelledContract = await Contract.findOneAndUpdate(
      {
        _id: contract._id,
        status: 'pending',
        signedByFarmer: false,
        signedByEnterprise: false,
      },
      {
        $set: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelReason: reason,
        },
      },
      { new: true }
    );
    if (!cancelledContract) {
      throw new AppError('Hợp đồng đã thay đổi hoặc đã có bên ký, không thể hủy', 409);
    }

    const cancelledByRole = contract.farmerId.toString() === userId ? 'farmer' : 'enterprise';

    // Notify the other party
    try {
      const otherPartyId = cancelledByRole === 'farmer'
        ? contract.enterpriseId.toString()
        : contract.farmerId.toString();
      const cancellerName = cancelledByRole === 'farmer' ? contract.farmerName : contract.enterpriseName;
      await NotificationService.create({
        userId: otherPartyId,
        type: 'contract',
        title: 'Hợp đồng đã bị hủy',
        message: `${cancellerName} đã hủy hợp đồng ${contract.contractCode}. Lý do: ${reason}`,
        severity: 'warning',
        relatedId: String(contract._id),
        relatedModel: 'Contract',
      });
    } catch {
      // Không làm hỏng thao tác hủy nếu chỉ lỗi bước thông báo.
    }

    return cancelledContract;
  }
}
