import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FiAlertTriangle } from "react-icons/fi";
import { motion } from "framer-motion";
import { useToast } from "../../contexts/ToastContext";
import { ROUTES, TOAST_DURATION } from "../../constants";
import authService from "../../services/auth.service";
import "./ResetPassword.css";

const MIN_PASSWORD_LENGTH = 6;

export default function ResetPassword() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();

  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Redirect if no token provided
  useEffect(() => {
    if (!token) {
      toast.error("Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.");
      navigate(ROUTES.AUTH);
    }
  }, [token, navigate, toast]);

  const isFormValid = password.length >= MIN_PASSWORD_LENGTH && password === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`);
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword({ token, password, confirmPassword });
      setSuccess(true);
      toast.success("Đặt lại mật khẩu thành công!", TOAST_DURATION.DEFAULT);
      setTimeout(() => navigate(ROUTES.AUTH), 2500);
    } catch (err) {
      const message = err?.message || "Link đã hết hạn hoặc không hợp lệ. Vui lòng yêu cầu lại.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reset-page">
      <motion.div
        className="reset-card"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="reset-brand">
          <div className="reset-brand-icon" />
          <h2>PreOnic</h2>
        </div>

        {success ? (
          <div className="reset-success">
            <div className="reset-success-icon">✓</div>
            <h3>Mật khẩu đã được cập nhật!</h3>
            <p>Bạn sẽ được chuyển đến trang đăng nhập trong giây lát...</p>
            <button className="btn-reset-submit" onClick={() => navigate(ROUTES.AUTH)}>
              Đăng nhập ngay
            </button>
          </div>
        ) : (
          <>
            <div className="reset-header">
              <h3>Đặt lại mật khẩu</h3>
              <p>Nhập mật khẩu mới cho tài khoản của bạn.</p>
            </div>

            {error && (
              <motion.div
                className="reset-error"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <FiAlertTriangle size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />{error}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="reset-form">
              <div className="form-group">
                <label>Mật khẩu mới</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="form-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={`Tối thiểu ${MIN_PASSWORD_LENGTH} ký tự`}
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <span className={`icon-eye ${showPassword ? "active" : ""}`} />
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Xác nhận mật khẩu mới</label>
                <div className="password-input-wrapper">
                  <input
                    type="password"
                    className="form-input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới"
                    required
                  />
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p className="input-hint error">Mật khẩu không khớp</p>
                )}
              </div>

              <button
                type="submit"
                className="btn-reset-submit"
                disabled={loading || !isFormValid}
              >
                {loading ? "Đang xử lý..." : "Xác nhận đặt lại mật khẩu"}
              </button>
            </form>

            <button className="reset-back-link" onClick={() => navigate(ROUTES.AUTH)}>
              ← Quay lại đăng nhập
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}
