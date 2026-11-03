import EmailOtpForm from "../VerifyEmail/EmailOtpForm";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiUser,
  FiBriefcase,
  FiAlertTriangle,
  FiMail,
  FiPhone,
  FiLock,
  FiMapPin,
  FiEye,
  FiEyeOff,
  FiCheckCircle,
  FiArrowRight,
  FiShield,
  FiTrendingUp,
  FiAward,
} from "react-icons/fi";
import { LuLeaf } from "react-icons/lu";
import { motion } from "framer-motion";
import Navbar from "../Navbar/Navbar";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { ROUTES, TOAST_DURATION } from "../../constants";
import { getDistricts, getWards } from "../../data/vn-locations";
import "./Register.css";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?w=1400&q=85&auto=format&fit=crop";

const BENEFITS = [
  {
    icon: <FiShield />,
    title: "Giao dịch an toàn",
    desc: "Ký quỹ Escrow bảo lãnh 100%, không lo mất tiền.",
  },
  {
    icon: <FiTrendingUp />,
    title: "Tăng trưởng bền vững",
    desc: "Phân tích thị trường + dự báo giá bằng AI.",
  },
  {
    icon: <FiAward />,
    title: "Đối tác uy tín",
    desc: "Chứng nhận và đánh giá minh bạch hai chiều.",
  },
];

const Register = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { register } = useAuth();
  const [selectedRole, setSelectedRole] = useState("farmer");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(null);
  const [verificationSent, setVerificationSent] = useState(null);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    province: "",
    district: "",
    ward: "",
    password: "",
    confirmPassword: "",
    agreeTerms: false,
  });

  const districtOptions = useMemo(
    () => getDistricts(formData.province),
    [formData.province]
  );
  const wardOptions = useMemo(
    () => getWards(formData.district),
    [formData.district]
  );

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === "province") {
      setFormData((prev) => ({
        ...prev,
        province: value,
        district: "",
        ward: "",
      }));
      return;
    }
    if (name === "district") {
      setFormData((prev) => ({ ...prev, district: value, ward: "" }));
      return;
    }
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (
      !formData.fullName ||
      !formData.email ||
      !formData.phone ||
      !formData.password ||
      !formData.confirmPassword
    ) {
      setError("Vui lòng điền đầy đủ thông tin");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(formData.email.trim())) {
      setError("Email không hợp lệ");
      return;
    }
    if (!/^[0-9]{10,11}$/.test(formData.phone.trim())) {
      setError("Số điện thoại phải có 10-11 chữ số");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }
    if (!formData.agreeTerms) {
      setError("Vui lòng đồng ý với điều khoản sử dụng");
      return;
    }

    setLoading(true);
    try {
      const response = await register({
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        province: formData.province,
        district: formData.district,
        ward: formData.ward,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        role: selectedRole,
        agreeTerms: formData.agreeTerms,
      });

      if (response.success) {
        if (response.requiresVerification) {
          setVerificationSent(response.data?.email || formData.email);
          toast.success(
            "Vui lòng kiểm tra email để kích hoạt tài khoản.",
            TOAST_DURATION.LONG
          );
          return;
        }
        toast.success(
          "Tạo tài khoản thành công! Vui lòng đăng nhập để tiếp tục.",
          TOAST_DURATION.LONG
        );
        setTimeout(() => {
          navigate(ROUTES.AUTH);
        }, 1000);
      }
    } catch (err) {
      if (err.code === 'EMAIL_NOT_VERIFIED') {
        navigate('/verify-email?email=' + encodeURIComponent(err.data?.email || formData.email));
        return;
      }
      const errorMessage = err.message || "Đăng ký thất bại. Vui lòng thử lại.";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reg-v2-page">
      <Navbar />

      <main className="reg-v2-main">
        <div className="reg-v2-grid">
          {/* LEFT — FORM */}
          <motion.div
            className="reg-v2-form-wrap"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            {verificationSent ? (
              <div className="reg-v2-card"><EmailOtpForm initialEmail={verificationSent} initiallySent /></div>
            ) : (
              <div className="reg-v2-card">
                <div className="reg-v2-header">
                  <span className="reg-v2-badge">
                    <LuLeaf /> Đăng ký
                  </span>
                  <h1>Tạo tài khoản PreOnic</h1>
                  <p>
                    Bắt đầu hành trình kết nối nông nghiệp bền vững cùng hàng
                    ngàn đối tác.
                  </p>
                </div>

                {/* Role segment */}
                <div className="reg-v2-role-segment">
                  <button
                    type="button"
                    className={`reg-v2-role-btn ${selectedRole === "farmer" ? "active" : ""}`}
                    onClick={() => setSelectedRole("farmer")}
                  >
                    <FiUser /> Nông dân
                  </button>
                  <button
                    type="button"
                    className={`reg-v2-role-btn ${selectedRole === "enterprise" ? "active" : ""}`}
                    onClick={() => setSelectedRole("enterprise")}
                  >
                    <FiBriefcase /> Doanh nghiệp
                  </button>
                </div>

                <form className="reg-v2-form" onSubmit={handleSubmit}>
                  {error && (
                    <motion.div
                      className="reg-v2-error"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <FiAlertTriangle /> {error}
                    </motion.div>
                  )}

                  <div className="reg-v2-field">
                    <label>Họ và tên</label>
                    <div className="reg-v2-input-wrap">
                      <FiUser className="reg-v2-input-icon" />
                      <input
                        type="text"
                        name="fullName"
                        placeholder="Nhập họ và tên"
                        value={formData.fullName}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  <div className="reg-v2-row">
                    <div className="reg-v2-field">
                      <label>Email</label>
                      <div className="reg-v2-input-wrap">
                        <FiMail className="reg-v2-input-icon" />
                        <input
                          type="email"
                          name="email"
                          placeholder="example@gmail.com"
                          value={formData.email}
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>
                    <div className="reg-v2-field">
                      <label>Số điện thoại</label>
                      <div className="reg-v2-input-wrap">
                        <FiPhone className="reg-v2-input-icon" />
                        <input
                          type="tel"
                          name="phone"
                          placeholder="09xx xxx xxx"
                          value={formData.phone}
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="reg-v2-row">
                    <div className="reg-v2-field">
                      <label>Tỉnh / Thành phố</label>
                      <div className="reg-v2-input-wrap">
                        <FiMapPin className="reg-v2-input-icon" />
                        <input
                          type="text"
                          name="province"
                          placeholder="VD: Hà Nội, Lâm Đồng..."
                          value={formData.province}
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>
                    <div className="reg-v2-field">
                      <label>Quận / Huyện</label>
                      {districtOptions.length > 0 ? (
                        <select
                          name="district"
                          value={formData.district}
                          onChange={handleInputChange}
                          className="reg-v2-select"
                        >
                          <option value="">-- Chọn Quận/Huyện --</option>
                          {districtOptions.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="reg-v2-input-wrap">
                          <FiMapPin className="reg-v2-input-icon" />
                          <input
                            type="text"
                            name="district"
                            placeholder="Cầu Giấy, Đà Lạt..."
                            value={formData.district}
                            onChange={handleInputChange}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="reg-v2-field">
                    <label>
                      Xã / Phường / Thị trấn{" "}
                      <span className="reg-v2-optional">(tùy chọn)</span>
                    </label>
                    {wardOptions.length > 0 ? (
                      <select
                        name="ward"
                        value={formData.ward}
                        onChange={handleInputChange}
                        className="reg-v2-select"
                      >
                        <option value="">
                          -- Chọn Xã/Phường/Thị trấn --
                        </option>
                        {wardOptions.map((w) => (
                          <option key={w} value={w}>
                            {w}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="reg-v2-input-wrap">
                        <FiMapPin className="reg-v2-input-icon" />
                        <input
                          type="text"
                          name="ward"
                          placeholder="VD: Phường Dịch Vọng, Xã Xuân Thọ..."
                          value={formData.ward}
                          onChange={handleInputChange}
                        />
                      </div>
                    )}
                  </div>

                  <div className="reg-v2-row">
                    <div className="reg-v2-field">
                      <label>Mật khẩu</label>
                      <div className="reg-v2-input-wrap">
                        <FiLock className="reg-v2-input-icon" />
                        <input
                          type={showPassword ? "text" : "password"}
                          name="password"
                          placeholder="••••••••"
                          value={formData.password}
                          onChange={handleInputChange}
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          className="reg-v2-eye"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label="Toggle password"
                        >
                          {showPassword ? <FiEyeOff /> : <FiEye />}
                        </button>
                      </div>
                    </div>
                    <div className="reg-v2-field">
                      <label>Xác nhận mật khẩu</label>
                      <div className="reg-v2-input-wrap">
                        <FiLock className="reg-v2-input-icon" />
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          name="confirmPassword"
                          placeholder="••••••••"
                          value={formData.confirmPassword}
                          onChange={handleInputChange}
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          className="reg-v2-eye"
                          onClick={() => setShowConfirmPassword((v) => !v)}
                          aria-label="Toggle confirm password"
                        >
                          {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="reg-v2-terms">
                    <input
                      type="checkbox"
                      id="terms"
                      name="agreeTerms"
                      checked={formData.agreeTerms}
                      onChange={handleInputChange}
                    />
                    <label htmlFor="terms">
                      Tôi đồng ý với{" "}
                      <button
                        type="button"
                        className="reg-v2-link"
                        onClick={() => setShowModal("terms")}
                      >
                        Điều khoản sử dụng
                      </button>{" "}
                      và{" "}
                      <button
                        type="button"
                        className="reg-v2-link"
                        onClick={() => setShowModal("privacy")}
                      >
                        Chính sách bảo mật
                      </button>{" "}
                      của PreOnic.
                    </label>
                  </div>

                  <motion.button
                    type="submit"
                    className="reg-v2-btn-primary"
                    disabled={loading}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {loading ? "Đang xử lý..." : "Tạo tài khoản"}{" "}
                    {!loading && <FiArrowRight />}
                  </motion.button>

                  <p className="reg-v2-login-link">
                    Đã có tài khoản?{" "}
                    <button
                      type="button"
                      onClick={() => navigate(ROUTES.AUTH)}
                    >
                      Đăng nhập ngay
                    </button>
                  </p>
                </form>
              </div>
            )}
          </motion.div>

          {/* RIGHT — HERO IMAGE + BENEFITS */}
          <motion.aside
            className="reg-v2-hero"
            style={{ backgroundImage: `url(${HERO_IMAGE})` }}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="reg-v2-hero-overlay" />
            <div className="reg-v2-hero-inner">
              <div className="reg-v2-hero-top">
                <span className="reg-v2-hero-badge">
                  <LuLeaf /> Nông nghiệp 4.0
                </span>
                <h2>
                  Kết nối <span>5,000+ nông dân</span>
                  <br />
                  và <span>1,200+ doanh nghiệp</span>
                </h2>
                <p>
                  Gia nhập nền tảng bao tiêu nông sản hàng đầu Việt Nam —
                  minh bạch, an toàn, công bằng.
                </p>
              </div>

              <div className="reg-v2-benefits">
                {BENEFITS.map((b, i) => (
                  <motion.div
                    className="reg-v2-benefit"
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.1, duration: 0.4 }}
                  >
                    <span className="reg-v2-benefit-icon">{b.icon}</span>
                    <div>
                      <div className="reg-v2-benefit-title">{b.title}</div>
                      <div className="reg-v2-benefit-desc">{b.desc}</div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="reg-v2-hero-trust">
                <FiCheckCircle />
                Tham gia miễn phí · Bảo mật SSL 256-bit · Hỗ trợ 24/7
              </div>
            </div>
          </motion.aside>
        </div>
      </main>

      {showModal && (
        <div
          className="terms-modal-overlay"
          onClick={() => setShowModal(null)}
        >
          <div
            className="terms-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="terms-modal-header">
              <h3>
                {showModal === "terms"
                  ? "Điều khoản Sử dụng PreOnic"
                  : "Chính sách Bảo mật PreOnic"}
              </h3>
              <button
                className="terms-modal-close"
                onClick={() => setShowModal(null)}
              >
                ✕
              </button>
            </div>
            <div className="terms-modal-body">
              {showModal === "terms" ? (
                <>
                  <h4>1. Chấp nhận điều khoản</h4>
                  <p>
                    Bằng việc đăng ký tài khoản trên PreOnic, bạn đồng ý
                    tuân thủ toàn bộ các điều khoản sử dụng này.
                  </p>
                  <h4>2. Điều kiện sử dụng tài khoản</h4>
                  <p>
                    Bạn phải từ 18 tuổi trở lên và có đủ năng lực pháp lý
                    để sử dụng dịch vụ. Thông tin đăng ký phải trung thực
                    và chính xác.
                  </p>
                  <h4>3. Hành vi bị cấm</h4>
                  <p>
                    Nghiêm cấm: đăng tải thông tin sai lệch; sử dụng nền
                    tảng để lừa đảo; phá hoại hệ thống; thu thập thông tin
                    người dùng khác trái phép.
                  </p>
                  <h4>4. Trách nhiệm của người dùng</h4>
                  <p>
                    Người dùng tự chịu trách nhiệm về tính chính xác của
                    thông tin sản phẩm, hợp đồng và giao dịch.
                  </p>
                  <h4>5. Giới hạn trách nhiệm</h4>
                  <p>
                    PreOnic không chịu trách nhiệm về thiệt hại gián tiếp
                    phát sinh từ việc sử dụng dịch vụ.
                  </p>
                </>
              ) : (
                <>
                  <h4>1. Thông tin chúng tôi thu thập</h4>
                  <p>
                    Họ tên, email, số điện thoại, địa chỉ + dữ liệu hoạt
                    động trên nền tảng + dữ liệu kỹ thuật (IP, thiết bị).
                  </p>
                  <h4>2. Mục đích sử dụng</h4>
                  <p>
                    Xác minh tài khoản, xử lý giao dịch Escrow, gửi thông
                    báo hợp đồng, cải thiện trải nghiệm, tuân thủ pháp luật.
                  </p>
                  <h4>3. Chia sẻ thông tin</h4>
                  <p>
                    PreOnic <strong>không bán</strong> thông tin của bạn.
                    Chỉ chia sẻ với đối tác giao dịch + đơn vị thanh toán
                    + cơ quan nhà nước khi có yêu cầu hợp pháp.
                  </p>
                  <h4>4. Bảo mật</h4>
                  <p>
                    Mã hóa SSL 256-bit, mật khẩu băm bcrypt, kiểm tra bảo
                    mật định kỳ.
                  </p>
                  <h4>5. Liên hệ</h4>
                  <p>
                    <strong>privacy@preonic.vn</strong>
                  </p>
                </>
              )}
            </div>
            <div className="terms-modal-footer">
              <button
                className="reg-v2-btn-primary"
                onClick={() => setShowModal(null)}
              >
                Tôi đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Register;
