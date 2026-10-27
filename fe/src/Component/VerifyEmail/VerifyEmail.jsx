import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useToast } from "../../contexts/ToastContext";
import { ROUTES } from "../../constants";
import authService from "../../services/auth.service";
import "./VerifyEmail.css";

// Possible verification states
const STATUS = {
  LOADING: "loading",
  SUCCESS: "success",
  ERROR: "error",
};

export default function VerifyEmail() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();

  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState(STATUS.LOADING);
  const [errorMessage, setErrorMessage] = useState("");
  // Đếm ngược tự chuyển về trang đăng nhập sau khi xác minh thành công.
  const REDIRECT_SECONDS = 10;
  const [countdown, setCountdown] = useState(REDIRECT_SECONDS);
  // Token xác minh chỉ dùng được MỘT lần (BE xóa token sau khi xác minh).
  // Guard này đảm bảo gọi API đúng một lần, tránh effect chạy lại (do StrictMode
  // hoặc do `toast` đổi identity mỗi khi danh sách toast thay đổi) khiến lần gọi
  // thứ hai thất bại và đè lên kết quả thành công.
  const verifiedRef = useRef(false);

  useEffect(() => {
    if (verifiedRef.current) return;
    verifiedRef.current = true;

    if (!token) {
      setStatus(STATUS.ERROR);
      setErrorMessage("Link xác minh không hợp lệ. Vui lòng thử lại.");
      return;
    }

    const verify = async () => {
      try {
        await authService.verifyEmail(token);
        setStatus(STATUS.SUCCESS);
        toast.success("Email đã được xác minh thành công!");
      } catch (err) {
        setStatus(STATUS.ERROR);
        setErrorMessage(err?.message || "Link đã hết hạn hoặc không hợp lệ.");
      }
    };

    verify();
    // Chỉ phụ thuộc `token`: KHÔNG đưa `toast` vào deps vì object toast đổi
    // identity mỗi lần thêm/bớt toast, sẽ làm effect chạy lại và verify trùng.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Sau khi xác minh thành công: đếm ngược và tự chuyển về trang đăng nhập sau 10s.
  useEffect(() => {
    if (status !== STATUS.SUCCESS) return;

    const interval = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    const timeout = setTimeout(() => {
      navigate(ROUTES.AUTH);
    }, REDIRECT_SECONDS * 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [status, navigate]);

  return (
    <div className="verify-page">
      <motion.div
        className="verify-card"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="verify-brand">
          <div className="verify-brand-icon" />
          <h2>PreOnic</h2>
        </div>

        {status === STATUS.LOADING && (
          <div className="verify-loading">
            <div className="verify-spinner" />
            <p>Đang xác minh email của bạn...</p>
          </div>
        )}

        {status === STATUS.SUCCESS && (
          <div className="verify-result success">
            <div className="verify-result-icon success-icon">✓</div>
            <h3>Email đã được xác minh!</h3>
            <p>Tài khoản của bạn đã được kích hoạt. Bạn có thể đăng nhập ngay bây giờ.</p>
            <button className="btn-verify-action" onClick={() => navigate(ROUTES.AUTH)}>
              Đăng nhập ngay
            </button>
            <p className="verify-redirect-hint">
              Tự động chuyển về trang đăng nhập sau {countdown}s...
            </p>
          </div>
        )}

        {status === STATUS.ERROR && (
          <div className="verify-result error">
            <div className="verify-result-icon error-icon">✕</div>
            <h3>Xác minh thất bại</h3>
            <p>{errorMessage}</p>
            <div className="verify-actions">
              <button className="btn-verify-secondary" onClick={() => navigate(ROUTES.AUTH)}>
                Quay lại đăng nhập
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
