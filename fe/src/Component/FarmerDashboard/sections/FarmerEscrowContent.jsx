// Tách từ FarmerDashboard.jsx theo SRP: thanh toán trung gian (escrow) phía nông dân.
import { Fragment, useState, useEffect, useCallback } from "react";
import { FiShield } from "react-icons/fi";
import { useToast } from "../../../contexts/ToastContext";
import escrowService from "../../../services/escrow.service";
import { formatMoney, formatDate } from "../../../hooks/useApiData";

export default function FarmerEscrowContent() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedEscrow, setSelectedEscrow] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [disputeModal, setDisputeModal] = useState(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [apiEscrows, setApiEscrows] = useState(null);
  const [apiBalance, setApiBalance] = useState(null);
  const toast = useToast();

  // Normalise populated Mongoose fields from the API response
  const mapEscrow = (e) => ({
    ...e,
    id: e._id || e.id,
    productName:    e.contractId?.productName    || e.productName    || 'Nông sản',
    contractCode:   e.contractId?.contractCode   || e.contractCode   || '—',
    enterpriseName: e.enterpriseId?.fullName     || e.enterpriseName || 'Doanh nghiệp',
    farmerName:     e.farmerId?.fullName          || e.farmerName     || 'Nông dân',
    createdAt:      formatDate(e.createdAt),
  });

  const loadEscrowList = useCallback(async () => {
    const escRes = await escrowService.list().catch(() => null);
    if (escRes?.data?.escrows) {
      setApiEscrows(escRes.data.escrows.map(mapEscrow));
      return;
    }
    setApiEscrows([]);
  }, []);

  const loadEscrowData = useCallback(async () => {
    try {
      const [balRes] = await Promise.all([
        escrowService.getBalance().catch(() => null),
        loadEscrowList(),
      ]);
      if (balRes?.data?.balance != null) {
        setApiBalance(balRes.data.balance);
      }
    } catch {
      setApiEscrows([]);
    }
  }, [loadEscrowList]);

  useEffect(() => {
    loadEscrowData();
  }, [loadEscrowData]);

  const balance = apiBalance ?? 0;

  const escrows = apiEscrows || [];

  const fmtMoney = (v) => formatMoney(v || 0);

  const statusLabels = {
    awaiting_deposit: "Chờ ký quỹ",
    funded: "Đã ký quỹ",
    partially_released: "Đang giải ngân",
    fully_released: "Hoàn tất",
    refunded: "Đã hoàn trả",
    disputed: "Tranh chấp",
  };

  const milestoneStatusLabels = {
    pending: "Chờ xử lý",
    in_progress: "Đang thực hiện",
    completed: "Hoàn thành",
    disputed: "Tranh chấp",
  };

  const totalReceived = escrows.reduce((s, e) => s + e.releasedAmount, 0);
  const totalPending = escrows.reduce((s, e) => s + (e.depositedAmount - e.releasedAmount), 0);
  const activeCount = escrows.filter(e => !["fully_released", "refunded"].includes(e.status)).length;

  const tabs = [
    { key: "overview", label: "Tổng quan" },
    { key: "active", label: "Đang hoạt động", count: activeCount },
    { key: "completed", label: "Hoàn tất", count: escrows.filter(e => e.status === "fully_released").length },
    { key: "all", label: "Tất cả", count: escrows.length },
  ];

  const filteredEscrows = activeTab === "active"
    ? escrows.filter(e => !["fully_released", "refunded"].includes(e.status))
    : activeTab === "completed"
    ? escrows.filter(e => e.status === "fully_released")
    : activeTab === "all"
    ? escrows
    : [];

  return (
    <>
      <div className="fd-pg-header">
        <div>
          <div className="fd-breadcrumb"><span>Trang chủ</span><span className="fd-bc-arrow">›</span><span>Thanh toán trung gian</span></div>
          <h2>Thanh toán trung gian</h2>
          <p className="fd-pg-subtitle">Theo dõi toàn bộ giao dịch ký quỹ và các mốc giải ngân</p>
        </div>
      </div>

      {/* Balance */}
      <div className="fd-escrow-bal">
        <div className="fd-escrow-bal-left">
          <span className="bal-label">Số dư nhận được từ Escrow</span>
          <span className="bal-amount">{fmtMoney(balance)}</span>
          <span className="bal-note">Tiền giải ngân tự động khi doanh nghiệp xác nhận đạt chuẩn</span>
        </div>
        <div className="fd-escrow-bal-ico">
          <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
      </div>

      {/* Stats */}
      <div className="fd-stat-row">
        <div className="fd-stat-box">
          <div className="fd-stat-ico green">
            <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>
          </div>
          <div className="fd-stat-txt">
            <span>Đã nhận</span>
            <strong>{fmtMoney(totalReceived)}</strong>
            <small className="ok">Tổng giải ngân</small>
          </div>
        </div>
        <div className="fd-stat-box">
          <div className="fd-stat-ico amber">
            <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div className="fd-stat-txt">
            <span>Chờ giải ngân</span>
            <strong>{fmtMoney(totalPending)}</strong>
            <small>Đang giữ trong escrow</small>
          </div>
        </div>
        <div className="fd-stat-box">
          <div className="fd-stat-ico blue">
            <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <div className="fd-stat-txt">
            <span>Escrow hoạt động</span>
            <strong>{activeCount}</strong>
            <small>giao dịch</small>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="fd-pg-tabs">
        {tabs.map(t => (
          <button key={t.key} className={`fd-pg-tab ${activeTab === t.key ? "active" : ""}`} onClick={() => { setActiveTab(t.key); setSelectedEscrow(null); }}>
            {t.label}{t.count !== undefined && t.count > 0 && <span className="fd-pg-tab-badge">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === "overview" && (
        <div className="escrow-overview">
          <div className="escrow-flow-diagram">
            <h3>Quy trình nhận thanh toán</h3>
            <div className="flow-steps">
              <div className="flow-step"><div className="flow-step-num done">1</div><span>Ký hợp đồng</span><p>Xác nhận điều khoản bao tiêu với doanh nghiệp</p></div>
              <div className="flow-connector" />
              <div className="flow-step"><div className="flow-step-num done">2</div><span>DN ký quỹ</span><p>Doanh nghiệp nạp tiền ký quỹ vào PreOnic</p></div>
              <div className="flow-connector" />
              <div className="flow-step"><div className="flow-step-num">3</div><span>Giao hàng</span><p>Bạn xác nhận đã giao hàng theo đúng thỏa thuận</p></div>
              <div className="flow-connector" />
              <div className="flow-step"><div className="flow-step-num">4</div><span>DN kiểm tra</span><p>Doanh nghiệp kiểm tra chất lượng, xác nhận đạt</p></div>
              <div className="flow-connector" />
              <div className="flow-step"><div className="flow-step-num">5</div><span>Nhận tiền</span><p>Tiền tự động chuyển vào tài khoản của bạn</p></div>
            </div>
          </div>

          <div className="escrow-safety">
            <div className="safety-icon"><span className="shield-escrow-icon" /></div>
            <div className="safety-info">
              <h3>Bảo vệ quyền lợi nông dân</h3>
              <ul>
                <li>Tiền đã được doanh nghiệp ký quỹ trước — đảm bảo thanh toán</li>
                <li>Giao hàng đúng cam kết = tự động nhận tiền theo mốc</li>
                <li>Doanh nghiệp không thể tự rút tiền đã ký quỹ</li>
                <li>Có tranh chấp? Admin PreOnic phân xử công bằng</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Escrow List */}
      {activeTab !== "overview" && (
        <div className="fd-list-area">
          {filteredEscrows.length === 0 ? (
            <div className="fd-empty"><FiShield size={40} color="#d1d5db" /><h4>Không có escrow nào</h4><p>Chưa có giao dịch nào trong mục này.</p></div>
          ) : selectedEscrow ? (
            <div className="escrow-detail">
              <button className="escrow-back-btn" onClick={() => setSelectedEscrow(null)}>Quay lại danh sách</button>

              <div className="escrow-detail-header">
                <div>
                  <h3>{selectedEscrow.productName}</h3>
                  <p className="escrow-contract-code">Hợp đồng: {selectedEscrow.contractCode} — {selectedEscrow.enterpriseName}</p>
                </div>
                <span className={`escrow-status-badge ${selectedEscrow.status}`}>{statusLabels[selectedEscrow.status]}</span>
              </div>

              <div className="escrow-detail-stats">
                <div className="eds-item"><span>Tổng giá trị</span><strong>{fmtMoney(selectedEscrow.totalAmount)}</strong></div>
                <div className="eds-item released"><span>Đã nhận</span><strong>{fmtMoney(selectedEscrow.releasedAmount)}</strong></div>
                <div className="eds-item held"><span>Chờ giải ngân</span><strong>{fmtMoney(selectedEscrow.depositedAmount - selectedEscrow.releasedAmount)}</strong></div>
              </div>

              {/* Progress */}
              <div className="escrow-progress-section">
                <h4>Tiến độ nhận thanh toán</h4>
                <div className="escrow-progress-bar">
                  <div className="epb-fill" style={{ width: selectedEscrow.depositedAmount > 0 ? `${(selectedEscrow.releasedAmount / selectedEscrow.depositedAmount) * 100}%` : "0%" }} />
                </div>
                <div className="epb-labels">
                  <span>0%</span>
                  <span>{selectedEscrow.depositedAmount > 0 ? Math.round((selectedEscrow.releasedAmount / selectedEscrow.depositedAmount) * 100) : 0}% đã nhận</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Milestones */}
              <div className="escrow-milestones">
                <h4>Các mốc thanh toán</h4>
                {selectedEscrow.milestones.map(m => (
                  <div key={m.step} className={`escrow-milestone ${m.status}`}>
                    <div className="em-step-marker">
                      {m.status === "completed" ? <span className="em-check" /> : m.step}
                    </div>
                    <div className="em-info">
                      <div className="em-header">
                        <strong>{m.name}</strong>
                        <span className={`em-status ${m.status}`}>{milestoneStatusLabels[m.status]}</span>
                      </div>
                      {m.releaseAmount > 0 && <p className="em-amount">Giải ngân: {fmtMoney(m.releaseAmount)} ({m.releasePercentage}%)</p>}
                      <div className="em-confirmations">
                        <span className={m.farmerConfirmed ? "confirmed" : "pending"}>
                          {m.farmerConfirmed ? "Bạn đã xác nhận" : "Chờ bạn xác nhận"}
                        </span>
                        <span className={m.enterpriseConfirmed ? "confirmed" : "pending"}>
                          {m.enterpriseConfirmed ? "DN đã xác nhận" : "Chờ DN xác nhận"}
                        </span>
                      </div>
                      {/* Farmer action: confirm shipment / preparation */}
                      {m.status === "in_progress" && !m.farmerConfirmed && (
                        <div className="em-actions">
                          <button className="em-btn-confirm" onClick={() => setConfirmModal({ escrow: selectedEscrow, milestone: m })}>
                            {m.step === 2 ? "Xác nhận đã chuẩn bị xong" : m.step === 3 ? "Xác nhận đã giao hàng" : "Xác nhận hoàn tất"}
                          </button>
                          <button className="em-btn-dispute" onClick={() => setDisputeModal({ escrow: selectedEscrow, milestone: m })}>
                            Báo cáo vấn đề
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            filteredEscrows.length === 0
            ? <div className="fd-list-area"><div className="fd-empty"><FiShield size={40} color="#d1d5db" /><h4>Không có giao dịch escrow nào</h4><p>Tạo hợp đồng để bắt đầu gói ký quỹ!</p></div></div>
            : filteredEscrows.map(e => {
              const statusCls = { awaiting_deposit: 'ec-awaiting', disputed: 'ec-disputed', fully_released: 'ec-complete', refunded: 'ec-complete' }[e.status] || '';
              const statusBdgCls = { awaiting_deposit: 'fds-amber', funded: 'fds-blue', partially_released: 'fds-green', fully_released: 'fds-gray', refunded: 'fds-gray', disputed: 'fds-red' }[e.status] || 'fds-gray';
              const pct = e.depositedAmount > 0 ? Math.round((e.releasedAmount / e.depositedAmount) * 100) : 0;
              return (
                <div key={e.id} className={`fd-escrow-card ${statusCls}`} onClick={() => setSelectedEscrow(e)}>
                  <div className="fd-escrow-card-top">
                    <div>
                      <div className="fd-escrow-card-title">{e.productName}</div>
                      <div className="fd-escrow-card-meta">{e.contractCode} • {e.enterpriseName}</div>
                    </div>
                    <span className={`fds ${statusBdgCls}`}>{statusLabels[e.status]}</span>
                  </div>
                  <div className="fd-escrow-amounts">
                    <div className="fd-ea"><span>Tổng giá trị</span><strong>{fmtMoney(e.totalAmount)}</strong></div>
                    <div className="fd-ea ea-received"><span>Đã nhận</span><strong>{fmtMoney(e.releasedAmount)}</strong></div>
                    <div className="fd-ea ea-pending"><span>Chờ giải ngân</span><strong>{fmtMoney(e.depositedAmount - e.releasedAmount)}</strong></div>
                  </div>
                  <div className="fd-escrow-ms-row">
                    {e.milestones.map((m, idx) => (
                      <Fragment key={`${e.id || e._id}-ms-${m.step}`}>
                        {idx > 0 && <div className={`fd-ms-pip-line ${m.status === 'completed' || (idx > 0 && e.milestones[idx - 1].status === 'completed') ? 'done' : ''}`} />}
                        <div className={`fd-ms-pip ${m.status === 'completed' ? 'done' : m.status === 'in_progress' ? 'active' : ''}`}>{m.status === 'completed' ? '✓' : m.step}</div>
                      </Fragment>
                    ))}
                  </div>
                  <div className="fd-escrow-prog">
                    <div className="fd-escrow-prog-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="fd-escrow-card-foot">
                    <span className="fd-escrow-date">Tạo: {e.createdAt} • {pct}% đã giải ngân</span>
                    <button className="fd-btn fd-btn-white fd-btn-sm" onClick={ev => { ev.stopPropagation(); setSelectedEscrow(e); }}>Xem chi tiết</button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Confirm Modal */}
      {confirmModal && (
        <div className="escrow-modal-overlay" onClick={() => setConfirmModal(null)}>
          <div className="escrow-modal" onClick={e => e.stopPropagation()}>
            <div className="escrow-modal-header">
              <h3>Xác nhận mốc thanh toán</h3>
              <button className="modal-close" onClick={() => setConfirmModal(null)}>X</button>
            </div>
            <div className="escrow-modal-body">
              <p><strong>Hợp đồng:</strong> {confirmModal.escrow.contractCode}</p>
              <p><strong>Sản phẩm:</strong> {confirmModal.escrow.productName}</p>
              <p><strong>Mốc:</strong> {confirmModal.milestone.name}</p>
              {confirmModal.milestone.releaseAmount > 0 && (
                <p><strong>Số tiền sẽ nhận khi DN xác nhận:</strong> {fmtMoney(confirmModal.milestone.releaseAmount)}</p>
              )}
              <p className="escrow-modal-warning">Hành động này xác nhận bạn đã hoàn thành nghĩa vụ cho mốc này. Tiếp tục?</p>
            </div>
            <div className="escrow-modal-footer">
              <button className="em-btn-cancel" onClick={() => setConfirmModal(null)}>Hủy</button>
              <button className="em-btn-confirm" onClick={async () => {
                try {
                  const escrowId = confirmModal.escrow._id || confirmModal.escrow.id;
                  await escrowService.farmerConfirm(escrowId, confirmModal.milestone.step);
                  toast.success("Xác nhận mốc thanh toán thành công!");
                  await loadEscrowList();
                } catch {
                  toast.error("Xác nhận thất bại. Vui lòng thử lại.");
                }
                setConfirmModal(null);
              }}>Xác nhận</button>
            </div>
          </div>
        </div>
      )}

      {/* Dispute Modal */}
      {disputeModal && (
        <div className="escrow-modal-overlay" onClick={() => { setDisputeModal(null); setDisputeReason(""); }}>
          <div className="escrow-modal" onClick={e => e.stopPropagation()}>
            <div className="escrow-modal-header">
              <h3>Báo cáo vấn đề</h3>
              <button className="modal-close" onClick={() => { setDisputeModal(null); setDisputeReason(""); }}>X</button>
            </div>
            <div className="escrow-modal-body">
              <p><strong>Hợp đồng:</strong> {disputeModal.escrow.contractCode}</p>
              <p><strong>Sản phẩm:</strong> {disputeModal.escrow.productName}</p>
              <p><strong>Mốc:</strong> {disputeModal.milestone.name}</p>
              <div className="form-group" style={{ marginTop: 12 }}>
                <label>Lý do tranh chấp:</label>
                <textarea
                  className="dispute-textarea"
                  rows={4}
                  value={disputeReason}
                  onChange={e => setDisputeReason(e.target.value)}
                  placeholder="Mô tả chi tiết vấn đề bạn gặp phải..."
                />
              </div>
            </div>
            <div className="escrow-modal-footer">
              <button className="em-btn-cancel" onClick={() => { setDisputeModal(null); setDisputeReason(""); }}>Hủy</button>
              <button className="em-btn-dispute" disabled={!disputeReason.trim()} onClick={async () => {
                try {
                  const escrowId = disputeModal.escrow._id || disputeModal.escrow.id;
                  await escrowService.raiseDispute(escrowId, disputeModal.milestone.step, disputeReason.trim());
                  toast.success("Đã gửi báo cáo tranh chấp!");
                  await loadEscrowList();
                } catch {
                  toast.error("Gửi tranh chấp thất bại. Vui lòng thử lại.");
                }
                setDisputeModal(null);
                setDisputeReason("");
              }}>Gửi báo cáo</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
