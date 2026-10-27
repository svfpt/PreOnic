import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import paymentService from "../../services/payment.service";
import "./PaymentResult.css";

export default function PaymentResult({ type }) {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("verifying");
  const [result, setResult] = useState(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const orderCode = searchParams.get("orderCode");

  useEffect(() => {
    if (type === "success" && orderCode) {
      paymentService
        .verifyTopup(orderCode)
        .then((res) => {
          if (res.data?.data?.success) {
            setStatus("success");
            setResult(res.data.data);
            toast.success("Nạp tiền thành công!");
          } else {
            setStatus("pending");
          }
        })
        .catch(() => {
          setStatus("error");
          toast.error("Không thể xác minh giao dịch");
        });
    } else if (type === "cancel") {
      setStatus("cancelled");
      if (orderCode) {
        paymentService.cancelTopup(orderCode).catch(() => {});
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderCode, type]);

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
              Số dư mới: <strong>{result?.newBalance?.toLocaleString("vi-VN")} VND</strong>
            </p>
          </>
        )}

        {status === "pending" && (
          <>
            <div className="pr-icon pending">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" strokeLinecap="round" />
              </svg>
            </div>
            <h2>Giao dịch đang xử lý</h2>
            <p>Hệ thống sẽ tự động cập nhật khi thanh toán hoàn tất</p>
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
