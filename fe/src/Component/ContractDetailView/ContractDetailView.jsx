// Giao diện chi tiết hợp đồng DÙNG CHUNG cho cả Nông dân và Doanh nghiệp.
// Mục tiêu: cả hai bên đều thấy CÙNG MỘT bản hợp đồng điện tử (layout văn bản đầy đủ
// + cột tóm tắt + bảng ký), thống nhất trải nghiệm trên toàn nền tảng PreOnic.
//
// Ký kết: ký trực tiếp sau khi tick xác nhận điều khoản (đã bỏ OTP — xác thực qua phiên đăng nhập).
import { useState } from "react";
import { FiFileText, FiShield, FiCheckCircle, FiClock, FiArrowLeft } from "react-icons/fi";
import { useToast } from "../../contexts/ToastContext";
import { COMPANY } from "../../constants";
import contractService from "../../services/contract.service";
import { formatMoney, formatDate } from "../../hooks/useApiData";
import "./ContractDetailView.css";

const STATUS_VI = {
  draft: "Nháp",
  pending: "Chờ ký",
  approved: "Chờ ký quỹ",
  active: "Đang thực hiện",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
  rejected: "Đã từ chối",
  disputed: "Đang tranh chấp",
};

const PAYMENT_LABELS = {
  "50_50": "50% trả trước – 50% khi nhận hàng",
  "30_70": "30% trả trước – 70% khi nhận hàng",
  "100_delivery": "100% sau khi giao hàng",
  "100_upfront": "100% trả trước",
  custom: "Theo thỏa thuận",
};

const UNIT_LABELS = { tan: "Tấn", ta: "Tạ", kg: "kg", thung: "Thùng" };

// Chuẩn hóa contract để dùng chung dù dữ liệu đến từ enterprise (denormalized)
// hay farmer (populated enterpriseId/productId).
function normalize(c) {
  const unitRaw = c.unit || c.productId?.unit || "";
  return {
    raw: c,
    _id: c._id,
    contractCode: c.contractCode || c.id || "—",
    farmerName: c.farmerName || c.farmerId?.fullName || "Nông dân",
    enterpriseName: c.enterpriseName || c.enterpriseId?.fullName || "Doanh nghiệp",
    productName: c.productName || c.productId?.name || "Nông sản",
    quantity: c.quantity,
    unit: unitRaw,
    unitLabel: UNIT_LABELS[unitRaw] || unitRaw,
    pricePerUnit: c.pricePerUnit,
    totalValue: c.totalValue || 0,
    depositAmount: c.depositAmount || 0,
    depositPercentage: c.depositPercentage,
    commission: c.commission || 0,
    commissionRate: c.commissionRate || COMPANY.COMMISSION_RATE,
    paymentTerms: c.paymentTerms,
    deliveryDate: c.deliveryDate,
    notes: c.notes,
    status: c.status,
    signedByFarmer: !!c.signedByFarmer,
    signedByEnterprise: !!c.signedByEnterprise,
    cancelReason: c.cancelReason || c.cancellationReason,
    createdAt: c.createdAt,
  };
}

export default function ContractDetailView({
  contract,
  role,                  // 'farmer' | 'enterprise'
  onBack,
  onChanged,             // gọi sau khi ký/hủy/từ chối thành công (để reload danh sách)
  onNavigateEscrow,      // optional: điều hướng sang mục ký quỹ
}) {
  const toast = useToast();
  const c = normalize(contract);

  const [agreed, setAgreed] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signSuccess, setSignSuccess] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const isFarmer = role === "farmer";
  const mySigned = isFarmer ? c.signedByFarmer : c.signedByEnterprise;
  const otherSigned = isFarmer ? c.signedByEnterprise : c.signedByFarmer;
  const canSign = c.status === "pending" && !mySigned;
  const canCancel = c.status === "pending" || c.status === "approved" || c.status === "active";

  const notify = (msg, type = "success") => {
    if (toast?.success && type === "success") toast.success(msg);
    else if (toast?.error && type === "error") toast.error(msg);
    else if (toast?.showToast) toast.showToast(msg, type);
  };

  const handleSign = async () => {
    if (!agreed || signing) return;
    setSigning(true);
    try {
      await contractService.sign(c._id);
      setSignSuccess(true);
      onChanged?.();
    } catch (err) {
      notify(err?.message || "Ký hợp đồng thất bại.", "error");
    } finally {
      setSigning(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim() || actionLoading) return;
    setActionLoading(true);
    try {
      // Nông dân chưa ký → từ chối; ngược lại → hủy hợp đồng
      if (isFarmer && c.status === "pending" && !c.signedByFarmer) {
        await contractService.reject(c._id, cancelReason);
        notify("Đã từ chối hợp đồng.");
      } else {
        await contractService.cancel(c._id, cancelReason);
        notify("Đã hủy hợp đồng.");
      }
      setShowCancel(false);
      setCancelReason("");
      onChanged?.();
      onBack?.();
    } catch (err) {
      notify(err?.message || "Thao tác thất bại.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // ===== Màn hình ký thành công =====
  if (signSuccess) {
    return (
      <div className="cdv-root">
        <div className="cdv-success">
          <div className="cdv-success-icon"><FiCheckCircle size={42} /></div>
          <h2>Ký hợp đồng thành công!</h2>
          <p>Hợp đồng <strong>{c.contractCode}</strong> đã được bạn ký điện tử.</p>
          <div className="cdv-success-grid">
            <div><span>Nông dân</span><strong>{c.farmerName}</strong></div>
            <div><span>Doanh nghiệp</span><strong>{c.enterpriseName}</strong></div>
            <div><span>Sản phẩm</span><strong>{c.productName}</strong></div>
            <div><span>Giá trị</span><strong>{formatMoney(c.totalValue)}</strong></div>
          </div>
          <p className="cdv-success-note">
            {otherSigned
              ? "Cả hai bên đã ký. Hệ thống Escrow (ký quỹ) đã được kích hoạt."
              : `Đang chờ ${isFarmer ? "doanh nghiệp" : "nông dân"} ký. Khi cả hai bên ký xong, hệ thống Escrow sẽ được kích hoạt.`}
          </p>
          <button className="cdv-btn-primary" onClick={onBack}>
            <FiArrowLeft size={15} /> Về danh sách hợp đồng
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cdv-root">
      <div className="cdv-topnav">
        <button className="cdv-back-btn" onClick={onBack}>
          <FiArrowLeft size={15} /> Danh sách hợp đồng
        </button>
        <div className="cdv-topnav-right">
          <span className="cdv-code-badge">{c.contractCode}</span>
          <span className={`cdv-status cdv-status-${c.status}`}>{STATUS_VI[c.status] || c.status}</span>
        </div>
      </div>

      <div className="cdv-grid">
        {/* ===== TRÁI: Văn bản hợp đồng ===== */}
        <div className="cdv-preview">
          <div className="cdv-preview-head">
            <div className="cdv-preview-title"><FiFileText size={16} /><span>Nội dung hợp đồng</span></div>
            <div className="cdv-preview-status">
              <span className={`cdv-dot ${c.signedByEnterprise ? "signed" : "waiting"}`} />
              <span>{c.signedByEnterprise ? "DN đã ký" : "Chờ DN ký"}</span>
              <span className="cdv-sep">|</span>
              <span className={`cdv-dot ${c.signedByFarmer ? "signed" : "waiting"}`} />
              <span>{c.signedByFarmer ? "Nông dân đã ký" : "Chờ nông dân ký"}</span>
            </div>
          </div>

          <div className="cdv-doc">
            <div className="cdv-doc-header">
              <span className="cdv-doc-logo">{COMPANY.NAME}</span>
              <h3>THỎA THUẬN MUA BÁN NÔNG SẢN</h3>
              <p>Mã: <strong>{c.contractCode}</strong></p>
              <p className="cdv-doc-date">Ngày lập: {formatDate(c.createdAt) || "—"}</p>
            </div>

            <section className="cdv-doc-section">
              <h4>1. CÁC BÊN THAM GIA</h4>
              <div className="cdv-parties">
                <div className="cdv-party">
                  <span className="cdv-party-role">Bên bán (Nông dân)</span>
                  <span className="cdv-party-name">{c.farmerName}</span>
                </div>
                <div className="cdv-party-div">—</div>
                <div className="cdv-party">
                  <span className="cdv-party-role">Bên mua (Doanh nghiệp)</span>
                  <span className="cdv-party-name">{c.enterpriseName}</span>
                </div>
              </div>
            </section>

            <section className="cdv-doc-section">
              <h4>2. ĐỐI TƯỢNG HỢP ĐỒNG</h4>
              <div className="cdv-table">
                <div className="cdv-row"><span>Sản phẩm</span><strong>{c.productName}</strong></div>
                <div className="cdv-row"><span>Số lượng</span><strong>{c.quantity} {c.unitLabel}</strong></div>
                <div className="cdv-row"><span>Đơn giá</span><strong>{formatMoney(c.pricePerUnit)} / {c.unitLabel}</strong></div>
                {c.notes && <div className="cdv-row"><span>Ghi chú</span><strong>{c.notes}</strong></div>}
              </div>
            </section>

            <section className="cdv-doc-section">
              <h4>3. GIÁ TRỊ &amp; THANH TOÁN</h4>
              <div className="cdv-table">
                <div className="cdv-row cdv-row-hl"><span>Tổng giá trị</span><strong>{formatMoney(c.totalValue)}</strong></div>
                <div className="cdv-row"><span>Hình thức</span><strong>{PAYMENT_LABELS[c.paymentTerms] || c.paymentTerms || "—"}</strong></div>
                {c.depositPercentage != null && (
                  <div className="cdv-row"><span>Đặt cọc ({c.depositPercentage}%)</span><strong>{formatMoney(c.depositAmount)}</strong></div>
                )}
                <div className="cdv-row cdv-row-muted"><span>Phí {COMPANY.NAME} ({c.commissionRate}%)</span><strong>{formatMoney(c.commission)}</strong></div>
              </div>
            </section>

            <section className="cdv-doc-section">
              <h4>4. THỜI GIAN GIAO HÀNG</h4>
              <div className="cdv-table">
                <div className="cdv-row"><span>Ngày giao</span><strong>{formatDate(c.deliveryDate) || "—"}</strong></div>
              </div>
            </section>

            <div className="cdv-signatures">
              <div className={`cdv-sig ${c.signedByEnterprise ? "signed" : "pending"}`}>
                <p className="cdv-sig-name">{c.enterpriseName}</p>
                <p className="cdv-sig-stat">{c.signedByEnterprise ? "✓ Đã ký" : "Chờ ký"}</p>
                <span className="cdv-sig-role">BÊN MUA</span>
              </div>
              <div className={`cdv-sig ${c.signedByFarmer ? "signed" : "pending"}`}>
                <p className="cdv-sig-name">{c.farmerName}</p>
                <p className="cdv-sig-stat">{c.signedByFarmer ? "✓ Đã ký" : "Chờ ký"}</p>
                <span className="cdv-sig-role">BÊN BÁN</span>
              </div>
            </div>

            {(c.status === "cancelled" || c.status === "rejected") && c.cancelReason && (
              <div className="cdv-cancel-reason">
                <strong>Lý do hủy/từ chối:</strong> {c.cancelReason}
              </div>
            )}
          </div>
        </div>

        {/* ===== PHẢI: Tóm tắt + ký ===== */}
        <div className="cdv-sidebar">
          <div className="cdv-info">
            <div className="cdv-info-head">Tóm tắt hợp đồng</div>
            <div className="cdv-info-body">
              <div className="cdv-info-row"><span>Nông dân</span><strong>{c.farmerName}</strong></div>
              <div className="cdv-info-row"><span>Doanh nghiệp</span><strong>{c.enterpriseName}</strong></div>
              <div className="cdv-info-row"><span>Sản phẩm</span><strong>{c.productName}</strong></div>
              <div className="cdv-info-row"><span>Giá trị</span><strong className="cdv-hl">{formatMoney(c.totalValue)}</strong></div>
              <div className="cdv-info-row"><span>Ngày giao</span><strong>{formatDate(c.deliveryDate) || "—"}</strong></div>
              {c.depositAmount > 0 && <div className="cdv-info-row"><span>Đặt cọc</span><strong>{formatMoney(c.depositAmount)}</strong></div>}
            </div>
          </div>

          {/* Panel ký — chưa ký */}
          {canSign && (
            <div className="cdv-sign-panel">
              <div className="cdv-sign-head">
                <h4>Ký điện tử phê duyệt</h4>
                <p>Xác nhận và ký kết hợp đồng</p>
              </div>
              <div className="cdv-sign-body">
                <div className="cdv-agree">
                  <label>
                    <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
                    <span>
                      Tôi xác nhận đã đọc đầy đủ hợp đồng,&nbsp;
                      <button type="button" className="cdv-link" onClick={() => setShowTerms(true)}>điều khoản ký kết</button>
                      &nbsp;và đồng ý. Phí trung gian: <strong>{c.commissionRate}%</strong>.
                    </span>
                  </label>
                </div>
              </div>
              <div className="cdv-sign-foot">
                <button className="cdv-btn-primary cdv-btn-full" disabled={!agreed || signing} onClick={handleSign}>
                  {signing ? "Đang xử lý..." : "Ký hợp đồng ngay"}
                </button>
                <p className="cdv-security"><FiShield size={12} /> Mã hóa SSL 256-bit · Xác thực qua tài khoản đăng nhập</p>
              </div>
            </div>
          )}

          {/* Đã ký, chờ bên kia */}
          {mySigned && !otherSigned && (
            <div className="cdv-badge cdv-badge-wait">
              <p><FiCheckCircle size={16} /> Bạn đã ký hợp đồng này</p>
              <span>Đang chờ {isFarmer ? "doanh nghiệp" : "nông dân"} ký kết...</span>
            </div>
          )}

          {/* Cả hai đã ký */}
          {c.signedByFarmer && c.signedByEnterprise && (
            <div className="cdv-badge cdv-badge-done">
              <p><FiCheckCircle size={18} /> Cả hai bên đã ký kết</p>
              <span>Hệ thống Escrow đã được kích hoạt</span>
              {!isFarmer && c.status === "approved" && onNavigateEscrow && (
                <button className="cdv-btn-primary cdv-btn-full" style={{ marginTop: 10 }} onClick={() => { onBack?.(); onNavigateEscrow(); }}>
                  Nạp ký quỹ ngay →
                </button>
              )}
            </div>
          )}

          {canCancel && (
            <button className="cdv-cancel-btn" onClick={() => setShowCancel(true)}>
              {isFarmer && c.status === "pending" && !c.signedByFarmer ? "Từ chối hợp đồng này" : "Hủy hợp đồng này"}
            </button>
          )}

          <div className="cdv-support">
            <h5><FiClock size={13} /> HỖ TRỢ KÝ KẾT</h5>
            <p>Cần tư vấn? Kết nối với chuyên viên pháp lý {COMPANY.NAME}.</p>
          </div>
        </div>
      </div>

      {/* Modal điều khoản */}
      {showTerms && (
        <div className="cdv-modal-overlay" onClick={() => setShowTerms(false)}>
          <div className="cdv-modal" role="dialog" aria-modal="true" aria-label="Điều khoản ký kết hợp đồng" onClick={e => e.stopPropagation()}>
            <div className="cdv-modal-head">
              <h3>Điều khoản Ký kết Hợp đồng</h3>
              <button onClick={() => setShowTerms(false)}>✕</button>
            </div>
            <div className="cdv-modal-body">
              <h4>1. Hiệu lực của chữ ký điện tử</h4>
              <p>Chữ ký điện tử của bạn trên nền tảng {COMPANY.NAME} có giá trị pháp lý tương đương chữ ký tay theo Luật Giao dịch Điện tử Việt Nam. Hành động ký được ghi nhận kèm thời gian và tài khoản thực hiện.</p>
              <h4>2. Trách nhiệm của các bên</h4>
              <p>Bằng việc ký, mỗi bên cam kết: (i) đã đọc và hiểu toàn bộ nội dung; (ii) có đủ thẩm quyền; (iii) thực hiện đầy đủ nghĩa vụ trong hợp đồng.</p>
              <h4>3. Hệ thống Escrow</h4>
              <p>Khi cả hai bên ký, hệ thống Escrow được kích hoạt. Doanh nghiệp cần nạp tiền ký quỹ trước khi giao hàng. Phí dịch vụ <strong>{c.commissionRate}%</strong> được khấu trừ tự động khi giải ngân.</p>
              <h4>4. Hủy hợp đồng</h4>
              <p>Sau khi ký, hợp đồng chỉ có thể hủy khi cả hai bên đồng ý hoặc có vi phạm nghiêm trọng được {COMPANY.NAME} xác nhận.</p>
            </div>
            <div className="cdv-modal-foot">
              <button className="cdv-btn-primary" onClick={() => { setAgreed(true); setShowTerms(false); }}>Tôi đã đọc và đồng ý</button>
              <button className="cdv-btn-outline" onClick={() => setShowTerms(false)}>Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal hủy/từ chối */}
      {showCancel && (
        <div className="cdv-modal-overlay" onClick={() => !actionLoading && setShowCancel(false)}>
          <div className="cdv-modal" role="dialog" aria-modal="true" aria-label="Hủy hoặc từ chối hợp đồng" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="cdv-modal-head">
              <h3>{isFarmer && c.status === "pending" && !c.signedByFarmer ? "Từ chối hợp đồng" : "Hủy hợp đồng"}</h3>
              <button onClick={() => setShowCancel(false)} disabled={actionLoading}>✕</button>
            </div>
            <div className="cdv-modal-body">
              <p style={{ marginBottom: 12 }}>Lý do cho hợp đồng <strong>{c.contractCode}</strong>:</p>
              <textarea className="cdv-textarea" placeholder="Nhập lý do..." value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={4} />
              <p className="cdv-modal-note">Hành động này không thể hoàn tác.</p>
            </div>
            <div className="cdv-modal-foot">
              <button className="cdv-btn-danger" onClick={handleCancel} disabled={!cancelReason.trim() || actionLoading}>
                {actionLoading ? "Đang xử lý..." : "Xác nhận"}
              </button>
              <button className="cdv-btn-outline" onClick={() => setShowCancel(false)} disabled={actionLoading}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
