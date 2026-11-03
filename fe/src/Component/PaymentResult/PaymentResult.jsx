import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import paymentService from "../../services/payment.service";
import "./PaymentResult.css";

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 60;

export default function PaymentResult({ type }) {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("verifying");
  const [result, setResult] = useState(null);
  const [retry, setRetry] = useState(0);
  const navigate = useNavigate();
  const { user } = useAuth();

  const orderCode = searchParams.get("orderCode");

  useEffect(() => {
    let stopped = false;
    let timer;
    let attempts = 0;
    if (!orderCode || !/^\d+$/.test(orderCode) || !Number.isSafeInteger(Number(orderCode)) || Number(orderCode) <= 0) {
      setStatus("error");
      return undefined;
    }
    setStatus("verifying");
    setResult(null);
    const check = async () => {
      try {
        const res = await paymentService.verifyTopup(orderCode);
        if (stopped) return;
        const data = res.data?.data;
        if (data?.success) {
          setStatus("success");
          setResult(data);
        } else if (data?.status === "cancelled") {
          setStatus("cancelled");
        } else if (data?.status === "failed") {
          setStatus("error");
        } else {
          if (++attempts < MAX_POLL_ATTEMPTS) {
            setStatus("pending");
            timer = setTimeout(check, POLL_INTERVAL_MS);
          } else {
            setStatus("timeout");
          }
        }
      } catch {
        if (!stopped) setStatus("error");
      }
    };
    const init = async () => {
      if (type === "cancel" && retry === 0) await paymentService.cancelTopup(orderCode).catch(() => {});
      if (!stopped) await check();
    };
    init();
    return () => { stopped = true; clearTimeout(timer); };
  }, [orderCode, type, retry]);

  const dashboardPath = user?.role === "farmer" ? "/farmer" : "/enterprise";

  return (
    <div className="payment-result-page">
      <div className="pr-card">
        {status === "verifying" && (
          <>
            <div className="pr-icon verifying">
              <div className="pr-spinner" />
            </div>
            <h2>Đang xác minh giao dịch...</h2>
            <p>Vui lòng chờ trong giây lát</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="pr-icon success">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2>Nạp tiền thành công!</h2>
            <p className="pr-amount">
              +{result?.transaction?.amount?.toLocaleString("vi-VN")} VND
            </p>
            <p className="pr-balance">
              Số dư sau giao dịch: <strong>{result?.newBalance?.toLocaleString("vi-VN")} VND</strong>
            </p>
          </>
        )}

        {["pending", "timeout"].includes(status) && (
          <>
            <div className="pr-icon pending">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" strokeLinecap="round" />
              </svg>
            </div>
            <h2>{status === "timeout" ? "Chưa nhận được xác nhận thanh toán" : "Giao dịch đang xử lý"}</h2>
            <p>{status === "timeout" ? "Bạn có thể kiểm tra lại hoặc quay về ví để theo dõi. Nếu đã chuyển tiền, không chuyển lại." : "Hệ thống đang tự động kiểm tra trạng thái thanh toán."}</p>
          </>
        )}

        {status === "cancelled" && (
          <>
            <div className="pr-icon cancelled">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2>Giao dịch đã bị hủy</h2>
            <p>Bạn có thể thử nạp tiền lại bất kỳ lúc nào</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="pr-icon error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4m0 4h.01" strokeLinecap="round" />
              </svg>
            </div>
            <h2>Có lỗi xảy ra</h2>
            <p>Không thể xác minh giao dịch. Vui lòng liên hệ hỗ trợ nếu tiền đã bị trừ.</p>
          </>
        )}

        <div className="pr-actions">
          {["pending", "timeout", "error"].includes(status) && (
            <button className="pr-btn secondary" onClick={() => setRetry(value => value + 1)}>Kiểm tra lại</button>
          )}
          <button className="pr-btn primary" onClick={() => navigate(dashboardPath, { state: { activeNav: "vi", activeTab: "vi" } })}>
            Về ví của tôi
          </button>
          <button className="pr-btn secondary" onClick={() => navigate(dashboardPath)}>
            Về trang chủ
          </button>
        </div>
      </div>
    </div>
  );
}
