import { body, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

/**
 * Handle validation errors
 */
const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((err) => err.msg);
    res.status(400).json({
      success: false,
      status: 'error',
      message: errorMessages[0] || 'Dữ liệu không hợp lệ',
      errors: errorMessages,
    });
    return;
  }
  next();
};

/**
 * Validate Register
 * Matches FE Register.jsx: { fullName, email, phone, password, confirmPassword, role, agreeTerms }
 */
export const validateRegister = [
  body('fullName')
    .trim()
    .notEmpty()
    .withMessage('Vui lòng nhập họ và tên')
    .isLength({ min: 2, max: 100 })
    .withMessage('Họ và tên phải từ 2-100 ký tự'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Vui lòng nhập email')
    .isEmail()
    .withMessage('Email không hợp lệ')
    .toLowerCase(),

  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Vui lòng nhập số điện thoại')
    .matches(/^[0-9]{10,11}$/)
    .withMessage('Số điện thoại phải có 10-11 chữ số'),

  body('password')
    .notEmpty()
    .withMessage('Vui lòng nhập mật khẩu')
    .isLength({ min: 6 })
    .withMessage('Mật khẩu phải có ít nhất 6 ký tự'),

  body('confirmPassword')
    .notEmpty()
    .withMessage('Vui lòng xác nhận mật khẩu'),

  body('role')
    .notEmpty()
    .withMessage('Vui lòng chọn vai trò')
    .isIn(['farmer', 'enterprise'])
    .withMessage('Vai trò phải là "farmer" hoặc "enterprise"'),

  body('agreeTerms')
    .optional() // Make it optional in validation
    .custom((value) => {
      // If exists, must be truthy
      if (value === false || value === 'false') {
        return false;
      }
      return true;
    })
    .withMessage('Vui lòng đồng ý với điều khoản sử dụng'),

  handleValidationErrors,
];

/**
 * Validate Login
 * Matches FE Auth.jsx: { emailOrPhone, password }
 */
export const validateLogin = [
  body('emailOrPhone')
    .trim()
    .notEmpty()
    .withMessage('Vui lòng nhập email hoặc số điện thoại'),

  body('password')
    .notEmpty()
    .withMessage('Vui lòng nhập mật khẩu'),

  handleValidationErrors,
];

/**
 * Validate Forgot Password
 */
export const validateForgotPassword = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Vui lòng nhập email')
    .isEmail()
    .withMessage('Email không hợp lệ'),

  handleValidationErrors,
];

/**
 * Validate Reset Password
 */
export const validateResetPassword = [
  body('token')
    .notEmpty()
    .withMessage('Token đặt lại mật khẩu là bắt buộc'),

  body('password')
    .notEmpty()
    .withMessage('Vui lòng nhập mật khẩu mới')
    .isLength({ min: 6 })
    .withMessage('Mật khẩu phải có ít nhất 6 ký tự'),

  body('confirmPassword')
    .notEmpty()
    .withMessage('Vui lòng xác nhận mật khẩu mới'),

  handleValidationErrors,
];

/**
 * Validate Update Password
 */
export const validateUpdatePassword = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Vui lòng nhập mật khẩu hiện tại'),

  body('newPassword')
    .notEmpty()
    .withMessage('Vui lòng nhập mật khẩu mới')
    .isLength({ min: 6 })
    .withMessage('Mật khẩu mới phải có ít nhất 6 ký tự'),

  body('confirmNewPassword')
    .notEmpty()
    .withMessage('Vui lòng xác nhận mật khẩu mới'),

  handleValidationErrors,
];

// ============================================================
// Contract Validators
// ============================================================

/**
 * Validate Create Contract
 * Matches FE ContractFlow.jsx form fields
 */
export const validateCreateContract = [
  body('farmerId')
    .optional()
    .isMongoId()
    .withMessage('farmerId không hợp lệ'),

  body('enterpriseId')
    .optional()
    .isMongoId()
    .withMessage('enterpriseId không hợp lệ'),

  body('productName')
    .trim()
    .notEmpty()
    .withMessage('Vui lòng nhập tên sản phẩm'),

  body('quantity')
    .notEmpty()
    .withMessage('Vui lòng nhập số lượng')
    .isFloat({ min: 0.01 })
    .withMessage('Số lượng phải lớn hơn 0'),

  body('unit')
    .notEmpty()
    .withMessage('Vui lòng chọn đơn vị')
    .isIn(['tan', 'ta', 'kg', 'thung'])
    .withMessage('Đơn vị phải là tấn, tạ, hoặc kg'),

  body('pricePerUnit')
    .notEmpty()
    .withMessage('Vui lòng nhập giá')
    .isFloat({ min: 0 })
    .withMessage('Giá phải lớn hơn hoặc bằng 0'),

  body('paymentTerms')
    .optional()
    .isIn(['50_50', '30_70', '100_delivery', '100_upfront'])
    .withMessage('Phương thức thanh toán không hợp lệ'),

  body('deliveryDate')
    .optional()
    .isISO8601()
    .withMessage('Ngày giao hàng không hợp lệ'),

  body('deliveryLocation')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Địa điểm giao hàng tối đa 200 ký tự'),

  body('qualityRequirements')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Yêu cầu chất lượng tối đa 1000 ký tự'),

  body('terms')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Điều khoản tối đa 2000 ký tự'),

  handleValidationErrors,
];

// ============================================================
// Escrow Validators
// ============================================================

/**
 * Validate Deposit to Escrow
 */
export const validateDeposit = [
  body('amount')
    .notEmpty()
    .withMessage('Vui lòng nhập số tiền ký quỹ')
    .isFloat({ min: 1 })
    .withMessage('Số tiền ký quỹ phải lớn hơn 0'),

  handleValidationErrors,
];

/**
 * Validate Confirm Milestone
 */
export const validateConfirmMilestone = [
  body('milestoneIndex')
    .notEmpty()
    .withMessage('Vui lòng chọn bước cần xác nhận')
    .isInt({ min: 0, max: 4 })
    .withMessage('Bước xác nhận không hợp lệ (0-4)'),

  handleValidationErrors,
];

/**
 * Validate Raise Dispute
 */
export const validateRaiseDispute = [
  body('milestoneIndex')
    .notEmpty()
    .withMessage('Vui lòng chọn bước tranh chấp')
    .isInt({ min: 0, max: 4 })
    .withMessage('Bước tranh chấp không hợp lệ (0-4)'),

  body('reason')
    .trim()
    .notEmpty()
    .withMessage('Vui lòng nhập lý do tranh chấp')
    .isLength({ min: 10, max: 1000 })
    .withMessage('Lý do tranh chấp phải từ 10-1000 ký tự'),

  handleValidationErrors,
];

// ============================================================
// Product Validators
// ============================================================

/**
 * Validate Create Product
 */
export const validateCreateProduct = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Vui lòng nhập tên sản phẩm')
    .isLength({ min: 2, max: 200 })
    .withMessage('Tên sản phẩm phải từ 2-200 ký tự'),

  body('location')
    .trim()
    .notEmpty()
    .withMessage('Vui lòng nhập địa điểm'),

  body('farm')
    .trim()
    .notEmpty()
    .withMessage('Vui lòng nhập tên nông trại'),

  body('category')
    .notEmpty()
    .withMessage('Vui lòng chọn danh mục')
    .isIn(['fruit', 'vegetable', 'rice', 'coffee', 'tea', 'spice', 'grain', 'other'])
    .withMessage('Danh mục không hợp lệ'),

  body('region')
    .notEmpty()
    .withMessage('Vui lòng chọn vùng miền')
    .isIn(['north', 'central', 'south'])
    .withMessage('Vùng miền phải là north, central, hoặc south'),

  body('priceMin')
    .notEmpty()
    .withMessage('Vui lòng nhập giá tối thiểu')
    .isFloat({ min: 0 })
    .withMessage('Giá tối thiểu phải >= 0'),

  body('priceMax')
    .notEmpty()
    .withMessage('Vui lòng nhập giá tối đa')
    .isFloat({ min: 0 })
    .withMessage('Giá tối đa phải >= 0'),

  body('unit')
    .optional()
    .trim(),

  body('type')
    .optional()
    .isIn(['fresh', 'dried', 'processed'])
    .withMessage('Loại sản phẩm không hợp lệ'),

  handleValidationErrors,
];
