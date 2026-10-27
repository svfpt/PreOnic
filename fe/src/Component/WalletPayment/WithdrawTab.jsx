// Tab "Rút tiền" trong ví: user làm đơn xin rút -> Admin duyệt -> hệ thống trừ số dư.
import { useState, useEffect, useCallback, useRef } from "react";
import { FiArrowUpRight, FiClock, FiCheckCircle, FiXCircle, FiSearch, FiChevronDown, FiX } from "react-icons/fi";
import { useToast } from "../../contexts/ToastContext";
import paymentService from "../../services/payment.service";
import { formatMoney } from "../../hooks/useApiData";

const VN_BANKS = [
  "Vietcombank (VCB)",
  "VietinBank (CTG)",
  "BIDV",
  "Agribank",
  "Techcombank",
  "MB Bank",
  "ACB",
  "VPBank",
  "Sacombank",
  "HDBank",
  "TPBank",
  "OCB",
  "VIB",
  "SHB",
  "SeABank",
  "Eximbank",
  "LienVietPostBank",
  "MSB (Maritime Bank)",
  "Nam A Bank",
  "BaoViet Bank",
  "Bac A Bank",
  "PVcomBank",
  "SCB (Saigon Commercial Bank)",
  "Kiên Long Bank",
  "VietBank",
  "NCB (National Citizen Bank)",
  "ABBank",
  "Saigon Bank",
  "VietABank",
  "PG Bank",
  "Dong A Bank",
  "CBBank",
  "GPBank",
  "OceanBank",
  "HSBC Việt Nam",
  "Standard Chartered Việt Nam",
  "Shinhan Bank Việt Nam",
  "UOB Việt Nam",
  "Woori Bank Việt Nam",
  "Cake by VPBank",
  "Timo",
];

function BankSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef(null);
  const searchRef = useRef(null);

  const filtered = VN_BANKS.filter((b) =>
    b.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    if (open) {
      document.addEventListener("mousedown", onDown);
      setTimeout(() => searchRef.current?.focus(), 60);
    }
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const select = (bank) => {
    onChange(bank);
    setOpen(false);
    setSearch("");
  };

  const clear = (e) => {
    e.stopPropagation();
    onChange("");
    setSearch("");
  };

  return (
    <div className="wd-bank-select" ref={rootRef}>
      <div
        className={`wd-bank-trigger ${open ? "open" : ""}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={`wd-bank-trigger-text ${!value ? "placeholder" : ""}`}>
          {value || "Chọn hoặc nhập tên ngân hàng"}
        </span>
        <span className="wd-bank-trigger-icons">
          {value && (
            <button type="button" className="wd-bank-clear" onClick={clear} title="Xoá">
              <FiX size={13} />
            </button>
          )}
          <FiChevronDown size={15} className={`wd-bank-chevron ${open ? "rotated" : ""}`} />
        </span>
      </div>

      {open && (
        <div className="wd-bank-dropdown">
          <div className="wd-bank-search-wrap">
            <FiSearch size={14} className="wd-bank-search-icon" />
            <input
              ref={searchRef}
              className="wd-bank-search"
              placeholder="Tìm ngân hàng..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="wd-bank-list">
            {filtered.length === 0 ? (
              <div className="wd-bank-none">Không tìm thấy ngân hàng</div>
            ) : (
              filtered.map((bank) => (
                <button
                  key={bank}
                  type="button"
                  className={`wd-bank-item ${value === bank ? "selected" : ""}`}
                  onClick={() => select(bank)}
                >
                  {bank}
                  {value === bank && <FiCheckCircle size={13} className="wd-bank-item-check" />}
                </button>
              ))
            )}
          </div>

          <div className="wd-bank-manual">
            <span>Không có trong danh sách?</span>
            <input
              className="wd-bank-manual-input"
              placeholder="Nhập tên ngân hàng..."
              value={VN_BANKS.includes(value) ? "" : value}
              onChange={(e) => onChange(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}

const STATUS_META = {
  pending:   { label: "Chờ duyệt",   cls: "#b45309", bg: "#fef3c7", icon: <FiClock size={13} /> },
  completed: { label: "Đã chuyển",   cls: "#15803d", bg: "#dcfce7", icon: <FiCheckCircle size={13} /> },
  rejected:  { label: "Từ chối",     cls: "#b91c1c", bg: "#fee2e2", icon: <FiXCircle size={13} /> },
};

const fmtDate = (v) => v ? new Date(v).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

export default function WithdrawTab({ onChanged }) {
  const { success: toastSuccess, error: toastError } = useToast();
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ amount: "", bankName: "", bankAccountNumber: "", bankAccountHolder: "", note: "" });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await paymentService.getWithdrawals();
      if (res.data?.data) setData(res.data.data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const available = data?.available ?? 0;
  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    const amount = parseInt(String(form.amount).replace(/[^0-9]/g, ""), 10) || 0;
    if (amount <= 0) { toastError("Vui lòng nhập số tiền muốn rút"); return; }
    if (amount > available) { toastError("Số tiền vượt quá số dư khả dụng"); return; }
    if (!form.bankName.trim() || !form.bankAccountNumber.trim() || !form.bankAccountHolder.trim()) {
      toastError("Vui lòng nhập đầy đủ thông tin ngân hàng"); return;
    }
    setSubmitting(true);
    try {
      await paymentService.createWithdrawal({ ...form, amount });
      toastSuccess("Đã gửi yêu cầu rút tiền. Vui lòng chờ quản trị viên duyệt.");
      setForm({ amount: "", bankName: "", bankAccountNumber: "", bankAccountHolder: "", note: "" });
      await load();
      onChanged?.();
    } catch (err) {
      toastError(err?.response?.data?.message || "Gửi yêu cầu rút tiền thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="wlt-body">
      <div className="wd-grid">
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
          <BankSelect value={form.bankName} onChange={(v) => setField("bankName", v)} />

          <label className="wd-label">Số tài khoản <span>*</span></label>
          <input className="wd-input" inputMode="numeric" placeholder="Số tài khoản nhận tiền" value={form.bankAccountNumber} onChange={(e) => setField("bankAccountNumber", e.target.value)} />

          <label className="wd-label">Chủ tài khoản <span>*</span></label>
          <input className="wd-input" placeholder="Tên chủ tài khoản (in hoa)" value={form.bankAccountHolder} onChange={(e) => setField("bankAccountHolder", e.target.value)} />

          <label className="wd-label">Ghi chú (không bắt buộc)</label>
          <textarea className="wd-input" rows={2} placeholder="Ghi chú thêm cho quản trị viên..." value={form.note} onChange={(e) => setField("note", e.target.value)} />

          <button className="wd-submit" type="submit" disabled={submitting}>
            {submitting ? "Đang gửi..." : "Gửi yêu cầu rút tiền"}
          </button>
          <p className="wd-hint">Quản trị viên sẽ kiểm tra và chuyển khoản thủ công. Số dư chỉ bị trừ khi yêu cầu được hoàn tất.</p>
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
