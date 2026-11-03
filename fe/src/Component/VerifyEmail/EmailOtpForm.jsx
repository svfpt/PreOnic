import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import authService from "../../services/auth.service";
import { ROUTES } from "../../constants";
import { FiArrowLeft, FiArrowRight, FiClock, FiMail, FiShield } from "react-icons/fi";
import "./VerifyEmail.css";

export default function EmailOtpForm({ initialEmail = "", initiallySent = false }) {
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState(initiallySent ? "OTP đã được gửi. Kiểm tra hộp thư và thư mục Spam." : "Yêu cầu OTP mới để xác thực email trước khi đăng nhập.");
  const [remaining, setRemaining] = useState(initiallySent ? 60 : 0);
  useEffect(() => {
    if (!remaining) return undefined;
    const timer = setTimeout(() => setRemaining(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);
  const resend = async () => {
    if (busy || remaining) return;
    setBusy(true); setAction("send"); setError(""); setMessage("");
    try {
      const response = await authService.resendVerification(email.trim());
      setOtp(""); setRemaining(response.data?.resendAfterSeconds || 60);
      setMessage(response.message);
    } catch (err) { setError(err.message || "Không gửi được OTP. Vui lòng thử lại."); }
    finally { setBusy(false); setAction(""); }
  };
  const verify = async event => {
    event.preventDefault();
    if (busy) return;
    if (!/^\d{6}$/.test(otp)) { setError("OTP phải gồm 6 chữ số."); return; }
    setBusy(true); setAction("verify"); setError("");
    try {
      const response = await authService.verifyEmail({ email: email.trim(), otp });
      const user = response.data?.user;
      if (!user || !response.data?.accessToken) throw new Error("Chưa nhận được phiên đăng nhập. Vui lòng đăng nhập lại.");
      updateUser(user);
      const destination = user.role === "admin" ? ROUTES.ADMIN
        : user.role === "farmer" ? ROUTES.FARMER
        : user.role === "enterprise" ? ROUTES.ENTERPRISE : ROUTES.HOME;
      navigate(destination, { replace: true });
    } catch (err) { setError(err.message || "Không xác thực được OTP."); }
    finally { setBusy(false); setAction(""); }
  };
  return <form className="email-otp-form" onSubmit={verify} aria-busy={busy}>
    <header className="email-otp-header">
      <span className="email-otp-icon"><FiMail aria-hidden="true" /></span>
      <span className="email-otp-eyebrow"><FiShield aria-hidden="true" /> BẢO VỆ TÀI KHOẢN</span>
      <h2>Xác thực email của bạn</h2>
      <p>Chỉ còn một bước để bắt đầu. Nhập mã 6 chữ số được gửi đến email đăng ký của bạn.</p>
    </header>
    <div className="email-otp-field">
      <label htmlFor="verification-email">Email đăng ký</label>
      <div className="email-otp-email-wrap"><FiMail aria-hidden="true" />
        <input id="verification-email" type="email" autoComplete="email" required maxLength={254}
          value={email} disabled={busy} onChange={event => { setEmail(event.target.value); setOtp(""); setError(""); setMessage(""); }} />
      </div>
    </div>
    <div className="email-otp-field">
      <label htmlFor="verification-otp">Mã OTP</label>
      <div className={`email-otp-code${error ? " has-error" : ""}`}>
        <div className="email-otp-digits" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => <span key={index}
            className={`${otp[index] ? "is-filled" : ""} ${index === otp.length ? "is-current" : ""}`}>{otp[index] || ""}</span>)}
        </div>
        <input id="verification-otp" type="text" inputMode="numeric" autoComplete="one-time-code"
          aria-describedby="email-otp-hint" aria-invalid={Boolean(error)} aria-label="Mã OTP"
          maxLength={6} value={otp} disabled={busy}
          onChange={event => { setOtp(event.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }} />
      </div>
      <p id="email-otp-hint" className="email-otp-hint"><FiClock aria-hidden="true" /> Mã có hiệu lực trong 10 phút</p>
    </div>
    {message && <p role="status" className="email-otp-notice">{message}</p>}
    {error && <p role="alert" className="email-otp-error">{error}</p>}
    <button className="btn-verify-action" type="submit" disabled={busy}>
      {action === "verify" ? "Đang xác thực…" : "Xác thực OTP"} <FiArrowRight aria-hidden="true" />
    </button>
    <div className="email-otp-resend"><span>Chưa nhận được mã?</span>
    <button className="btn-verify-secondary" type="button"
      disabled={busy || remaining > 0 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())} onClick={resend}>
      {action === "send" ? "Đang gửi…" : remaining > 0 ? `Gửi lại sau ${remaining}s` : "Gửi mã OTP"}
    </button>
    </div>
    <p className="email-otp-footer">Kiểm tra cả thư mục Spam. Bạn có tối đa 5 lần nhập sai cho mỗi mã.</p>
    <Link className="email-otp-back" to={ROUTES.AUTH}><FiArrowLeft aria-hidden="true" /> Quay lại đăng nhập</Link>
  </form>;
}
