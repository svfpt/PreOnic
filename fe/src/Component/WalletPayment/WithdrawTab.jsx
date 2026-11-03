// Rút tiền: giữ số dư -> admin duyệt -> payOS chuyển tiền và đối soát.
import { useState, useEffect, useCallback, useRef } from "react";
import { FiArrowUpRight, FiClock, FiCheckCircle, FiXCircle } from "react-icons/fi";
import { useToast } from "../../contexts/ToastContext";
import paymentService from "../../services/payment.service";
import { formatMoney } from "../../hooks/useApiData";

function BankSelect({ value, onChange, banks }) {
  return <select className="wd-input" value={value} onChange={event => onChange(event.target.value)} required>
    <option value="">Chọn ngân hàng nhận tiền</option>
    {banks.map(bank => <option key={bank.bin} value={bank.bin}>{bank.shortName} — {bank.name}</option>)}
  </select>;
}

const STATUS_META = {
  processing: { label: "Đang chuyển / đối soát", cls: "#1d4ed8", bg: "#dbeafe", icon: <FiClock size={13} /> },
  failed: { label: "Chuyển thất bại", cls: "#b91c1c", bg: "#fee2e2", icon: <FiXCircle size={13} /> },
  pending:   { label: "Chờ duyệt",   cls: "#b45309", bg: "#fef3c7", icon: <FiClock size={13} /> },
  completed: { label: "Đã chuyển",   cls: "#15803d", bg: "#dcfce7", icon: <FiCheckCircle size={13} /> },
  rejected:  { label: "Từ chối",     cls: "#b91c1c", bg: "#fee2e2", icon: <FiXCircle size={13} /> },
};

const fmtDate = (v) => v ? new Date(v).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

export default function WithdrawTab({ onChanged }) {
  const { success: toastSuccess, error: toastError } = useToast();
  const [data, setData] = useState(null);
  const [banks, setBanks] = useState([]);
  const [loadError, setLoadError] = useState("");
  const inFlight = useRef(false);
  const [form, setForm] = useState({ amount: "", bankBin: "", bankName: "", bankAccountNumber: "", bankAccountHolder: "", note: "" });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [res, bankRes] = await Promise.all([paymentService.getWithdrawals(), paymentService.getWithdrawalBanks()]);
      setBanks(bankRes.data?.data?.banks || []);
      setLoadError("");
      if (res.data?.data) setData(res.data.data);
    } catch { setLoadError("Không thể tải thông tin rút tiền. Vui lòng thử lại."); }
  }, []);

  useEffect(() => { load(); const timer = setInterval(load, 10000); return () => clearInterval(timer); }, [load]);

  const available = data?.available ?? 0;
  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (inFlight.current) return;
    const amount = parseInt(String(form.amount).replace(/[^0-9]/g, ""), 10) || 0;
    if (!Number.isSafeInteger(amount) || amount < 10000 || amount > 500000000) { toastError("Số tiền rút phải từ 10.000 đến 500.000.000 VND"); return; }
    if (amount > available) { toastError("Số tiền vượt quá số dư khả dụng"); return; }
    if (!form.bankName.trim() || !form.bankAccountNumber.trim() || !form.bankAccountHolder.trim()) {
      toastError("Vui lòng nhập đầy đủ thông tin ngân hàng"); return;
    }
    inFlight.current = true;
    setSubmitting(true);
    try {
      await paymentService.createWithdrawal({ ...form, amount });
      toastSuccess("Đã gửi yêu cầu rút tiền. Vui lòng chờ quản trị viên duyệt.");
      setForm({ amount: "", bankBin: "", bankName: "", bankAccountNumber: "", bankAccountHolder: "", note: "" });
      await load();
      onChanged?.();
    } catch (err) {
      toastError(err?.response?.data?.message || "Gửi yêu cầu rút tiền thất bại");
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="wlt-body">
      <div className="wd-grid">
        {loadError && <p role="alert">{loadError}</p>}
        {/* FORM */}
        <form className="wlt-card wd-form" onSubmit={handleSubmit}>
          <div className="wlt-card-head">
            <h3><FiArrowUpRight style={{ verticalAlign: "middle", marginRight: 6 }} />Tạo yêu cầu rút tiền</h3>
          </div>
          <div className="wd-balance-box">
            <span>Số dư khả dụng</span>
            <strong>{formatMoney(available)}</strong>
            {data?.pendingTotal > 0 && (
              <p className="wd-pending-note">Đang chờ duyệt: {formatMoney(data.pendingTotal)}</p>
            )}
          </div>

          <label className="wd-label">Số tiền muốn rút (VNĐ) <span>*</span></label>
          <input className="wd-input" inputMode="numeric" placeholder="VD: 500,000"
            value={form.amount}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9]/g, "");
              setField("amount", raw ? Number(raw).toLocaleString("vi-VN") : "");
            }} />

          <label className="wd-label">Ngân hàng <span>*</span></label>
          <BankSelect banks={banks} value={form.bankBin} onChange={bin => setForm(previous => ({ ...previous, bankBin: bin, bankName: banks.find(bank => bank.bin === bin)?.shortName || "" }))} />

          <label className="wd-label">Số tài khoản <span>*</span></label>
          <input className="wd-input" inputMode="numeric" placeholder="Số tài khoản nhận tiền" value={form.bankAccountNumber} onChange={(e) => setField("bankAccountNumber", e.target.value)} />

          <label className="wd-label">Chủ tài khoản <span>*</span></label>
          <input className="wd-input" placeholder="Tên chủ tài khoản (in hoa)" value={form.bankAccountHolder} onChange={(e) => setField("bankAccountHolder", e.target.value)} />

          <label className="wd-label">Ghi chú (không bắt buộc)</label>
          <textarea className="wd-input" rows={2} placeholder="Ghi chú thêm cho quản trị viên..." value={form.note} onChange={(e) => setField("note", e.target.value)} />

          <button className="wd-submit" type="submit" disabled={submitting || !data || !banks.length}>
            {submitting ? "Đang gửi..." : "Gửi yêu cầu rút tiền"}
          </button>
          <p className="wd-hint">Tiền được giữ ngay khi gửi yêu cầu. Sau khi admin duyệt, hệ thống chuyển tiền qua payOS. Nếu bị từ chối hoặc chuyển thất bại đã được xác nhận, tiền giữ được hoàn lại.</p>
        </form>

        {/* HISTORY */}
        <div className="wlt-card wd-history">
          <div className="wlt-card-head"><h3>Lịch sử rút tiền</h3></div>
          {!data ? (
            <p className="wd-empty">Đang tải...</p>
          ) : data.requests.length === 0 ? (
            <p className="wd-empty">Chưa có yêu cầu rút tiền nào.</p>
          ) : (
            <div className="wd-list">
              {data.requests.map((r) => {
                const meta = STATUS_META[r.status] || STATUS_META.pending;
                return (
                  <div key={r._id} className="wd-item">
                    <div className="wd-item-top">
                      <strong>{formatMoney(r.amount)}</strong>
                      <span className="wd-badge" style={{ color: meta.cls, background: meta.bg }}>{meta.icon} {meta.label}</span>
                    </div>
                    <p className="wd-item-bank">{r.bankName} · {r.bankAccountNumber} · {r.bankAccountHolder}</p>
                    <p className="wd-item-date">{fmtDate(r.createdAt)}</p>
                    {r.adminNote && <p className="wd-item-note">Ghi chú từ admin: {r.adminNote}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
