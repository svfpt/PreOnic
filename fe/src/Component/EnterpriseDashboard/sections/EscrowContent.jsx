// Tách từ EnterpriseDashboard.jsx theo SRP.
import { useState, useEffect, useCallback } from "react";
import { useToast } from "../../../contexts/ToastContext";
import enterpriseService from "../../../services/enterprise.service";
import escrowService from "../../../services/escrow.service";
import { formatDate } from "../../../hooks/useApiData";

export default function EscrowContent() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedEscrow, setSelectedEscrow] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [disputeModal, setDisputeModal] = useState(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [apiEscrows, setApiEscrows] = useState(null);
  const [apiBalance, setApiBalance] = useState(null);
  const [pendingContracts, setPendingContracts] = useState([]);
  const [fundingLoading, setFundingLoading] = useState(false);
  const toast = useToast();

  // Normalise populated Mongoose fields from the API response
  const mapEscrow = (e) => ({
    ...e,
    id: e._id || e.id,
    productName:    e.contractId?.productName    || e.productName    || 'Nông sản',
    contractCode:   e.contractId?.contractCode   || e.contractCode   || '—',
    farmerName:     e.farmerId?.fullName          || e.farmerName     || 'Nông dân',
    enterpriseName: e.enterpriseId?.fullName     || e.enterpriseName || 'Doanh nghiệp',
    createdAt:      formatDate(e.createdAt),
  });

  const loadAll = useCallback(async () => {
    try {
      const [balRes, escRes, contractsRes] = await Promise.all([
        escrowService.getBalance().catch(() => null),
        escrowService.list().catch(() => null),
        enterpriseService.getContracts().catch(() => null),
      ]);
      if (balRes?.data?.balance != null) setApiBalance(balRes.data.balance);
      const rawEscrows = escRes?.data?.escrows || [];
      const mappedEscrows = rawEscrows.map(mapEscrow);
      setApiEscrows(mappedEscrows);
      const escrowedContractIds = new Set(
        rawEscrows.map(e => {
          const cid = e.contractId?._id || e.contractId;
          return cid?.toString() || '';
        }).filter(Boolean)
      );
      const approved = (contractsRes?.data?.contracts || [])
        .filter(c => c.status === 'approved' && !escrowedContractIds.has(c._id?.toString()));
      setPendingContracts(approved);
    } catch { /* fallback */ }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const balance = apiBalance ?? 0;
  const escrows = apiEscrows || [];
  const fmtMoney = (v) => v.toLocaleString("vi-VN") + " VND";

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

  const totalDeposited = escrows.reduce((s, e) => s + e.depositedAmount, 0);
  const totalReleased = escrows.reduce((s, e) => s + e.releasedAmount, 0);
  const totalHeld = totalDeposited - totalReleased;
  const activeCount = escrows.filter(e => !["fully_released", "refunded"].includes(e.status)).length;
  const awaitingDepositCount = escrows.filter(e => e.status === "awaiting_deposit").length;

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

  const handleConfirmMilestone = (escrow, milestone) => {
    setConfirmModal({ escrow, milestone });
  };

  const handleRaiseDispute = (escrow, milestone) => {
    setDisputeModal({ escrow, milestone });
    setDisputeReason("");
  };

  const handleFundContract = async (contract) => {
    setFundingLoading(true);
    try {
      let escrow;
      try {
        const res = await escrowService.getByContract(contract._id);
        escrow = res?.data?.escrow;
      } catch {
        const createRes = await escrowService.create(contract._id);
        escrow = createRes?.data?.escrow;
      }
      if (!escrow) { toast.error('Không tìm thấy dữ liệu ký quỹ.'); return; }
      const milestone1 = escrow.milestones?.find(m => m.step === 1);
      if (!milestone1) { toast.error('Không tìm thấy mốc ký quỹ.'); return; }
      setConfirmModal({
        escrow: {
          ...mapEscrow(escrow),
          totalAmount: escrow.totalAmount,
          contractCode: escrow.contractId?.contractCode || contract.contractCode || '—',
          productName:  escrow.contractId?.productName  || contract.productName  || 'Nông sản',
        },
        milestone: milestone1,
      });
    } catch (err) {
      toast.error(err?.message || 'Không thể tạo ký quỹ. Vui lòng thử lại.');
    } finally {
      setFundingLoading(false);
    }
  };

  return (
    <>
      <div className="breadcrumb"><span>Trang chủ</span><span className="arrow">&gt;</span><span>Thanh toán trung gian</span></div>
      <h1 className="page-title">Thanh toán trung gian (Escrow)</h1>

      {/* Balance Card */}
      <div className="escrow-balance-card">
        <div className="ebc-info">
          <span className="ebc-label">Số dư tài khoản ảo</span>
          <h2 className="ebc-amount">{fmtMoney(balance)}</h2>
          <span className="ebc-note">Số dư dùng cho ký quỹ các hợp đồng bao tiêu</span>
        </div>
        <div className="ebc-icon"><span className="wallet-icon" /></div>
      </div>

      {/* Stats */}
      <div className="escrow-stats">
        <div className="es-card">
          <div className="es-icon total-escrow-icon" />
          <div className="es-content"><span className="es-label">Tổng ký quỹ</span><p className="es-value">{fmtMoney(totalDeposited)}</p></div>
        </div>
        <div className="es-card">
          <div className="es-icon released-icon" />
          <div className="es-content"><span className="es-label">Đã giải ngân</span><p className="es-value">{fmtMoney(totalReleased)}</p></div>
        </div>
        <div className="es-card">
          <div className="es-icon held-icon" />
          <div className="es-content"><span className="es-label">Đang giữ</span><p className="es-value">{fmtMoney(totalHeld)}</p></div>
        </div>
        <div className="es-card">
          <div className="es-icon active-escrow-icon" />
          <div className="es-content"><span className="es-label">Escrow hoạt động</span><p className="es-value">{activeCount}</p></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="escrow-tabs">
        {tabs.map(t => (
          <button key={t.key} className={`escrow-tab ${activeTab === t.key ? "active" : ""}`} onClick={() => { setActiveTab(t.key); setSelectedEscrow(null); }}>
            {t.label}{t.count !== undefined && <span className="tab-count">({t.count})</span>}
          </button>
        ))}
      </div>

      {/* Alert: approved contracts awaiting escrow deposit */}
      {pendingContracts.length > 0 && (
        <div className="escrow-alert-banner" style={{ background: 'linear-gradient(135deg,#fffbeb,#fef3c7)', borderLeft: '4px solid #f59e0b' }}>
          <span className="eab-icon" style={{ background: '#fef9c3' }} />
          <div className="eab-text" style={{ flex: 1 }}>
            <strong>{pendingContracts.length} hợp đồng đã ký — chưa nạp ký quỹ</strong>
            <p>Cả hai bên đã ký. Hợp đồng bắt đầu thực hiện sau khi tiền ký quỹ được nạp. Nạp ngay bên dưới!</p>
          </div>
        </div>
      )}

      {/* Alert for existing escrows awaiting deposits */}
      {awaitingDepositCount > 0 && activeTab !== "overview" && (
        <div className="escrow-alert-banner">
          <span className="eab-icon" />
          <div className="eab-text">
            <strong>{awaitingDepositCount} escrow chưa được nạp tiền ký quỹ</strong>
            <p>Hợp đồng chỉ bắt đầu thực hiện sau khi tiền ký quỹ đã được nạp đầy đủ. Nhấn "Nạp ký quỹ ngay" trên từng mục.</p>
          </div>
        </div>
      )}

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="escrow-overview">

          {pendingContracts.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <h3 style={{ color: '#d97706', marginBottom: 14, fontSize: 16, fontWeight: 700 }}>
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 16, height: 16, marginRight: 6, verticalAlign: 'middle' }}><path d="M10 2L2 16h16L10 2z" strokeLinejoin="round"/><path d="M10 8v4M10 14h.01" strokeLinecap="round"/></svg>
                Cần nạp ký quỹ ({pendingContracts.length})
              </h3>
              {pendingContracts.map(c => (
                <div key={c._id} className="escrow-card" style={{ borderLeft: '4px solid #f59e0b', marginBottom: 12 }}>
                  <div className="ec-header">
                    <div className="ec-header-left">
                      <h4>{c.farmerName}</h4>
                      <span className="ec-contract">{c.contractCode} — {c.productName}</span>
                    </div>
                    <span className="escrow-status-badge" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #f59e0b' }}>Chờ ký quỹ</span>
                  </div>
                  <div className="ec-body">
                    <div className="ec-stat"><span>Giá trị hợp đồng</span><strong>{fmtMoney(c.totalValue || 0)}</strong></div>
                    <div className="ec-stat"><span>Cần ký quỹ (100%)</span><strong className="released">{fmtMoney(c.totalValue || 0)}</strong></div>
                    <div className="ec-stat"><span>Số dư hiện tại</span><strong style={{ color: balance >= (c.totalValue || 0) ? '#16a34a' : '#ef4444' }}>{fmtMoney(balance)}</strong></div>
                  </div>
                  <div className="ec-footer">
                    <span className="ec-date">{formatDate(c.createdAt)}</span>
                    <button
                      className="ec-deposit-btn"
                      disabled={fundingLoading}
                      onClick={() => handleFundContract(c)}
                    >
                      {fundingLoading ? 'Đang xử lý...' : `Nạp ký quỹ — ${fmtMoney(c.totalValue || 0)}`}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="escrow-flow-diagram">
            <h3>Quy trình Escrow trên PreOnic</h3>
            <div className="flow-steps">
              <div className="flow-step"><div className="flow-step-num done">1</div><span>Tạo hợp đồng</span><p>Hai bên thỏa thuận điều khoản, xác định giá trị ký quỹ</p></div>
              <div className="flow-connector" />
              <div className="flow-step"><div className="flow-step-num done">2</div><span>Ký quỹ</span><p>Doanh nghiệp nạp tiền ký quỹ vào hệ thống PreOnic</p></div>
              <div className="flow-connector" />
              <div className="flow-step"><div className="flow-step-num">3</div><span>Giao hàng</span><p>Nông dân giao hàng, xác nhận vận chuyển thành công</p></div>
              <div className="flow-connector" />
              <div className="flow-step"><div className="flow-step-num">4</div><span>Kiểm tra</span><p>Doanh nghiệp kiểm tra chất lượng và xác nhận đạt chuẩn</p></div>
              <div className="flow-connector" />
              <div className="flow-step"><div className="flow-step-num">5</div><span>Giải ngân</span><p>Tiền tự động giải ngân cho nông dân theo từng mốc</p></div>
            </div>
          </div>

          <div className="escrow-safety">
            <div className="safety-icon"><span className="shield-escrow-icon" /></div>
            <div className="safety-info">
              <h3>Bảo vệ giao dịch an toàn</h3>
              <ul>
                <li>Tiền ký quỹ được PreOnic giữ — không bên nào tự rút được</li>
                <li>Giải ngân theo mốc: chỉ giải ngân khi cả hai bên xác nhận</li>
                <li>Nông dân giao hàng + doanh nghiệp kiểm tra = tự động giải ngân</li>
                <li>Tranh chấp? Admin PreOnic phân xử dựa trên bằng chứng</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Escrow List */}
      {activeTab !== "overview" && (
        <div className="escrow-list">
          {filteredEscrows.length === 0 ? (
            <div className="empty-orders"><div className="empty-icon" /><h3>Không có escrow nào</h3><p>Tạo hợp đồng mới để bắt đầu sử dụng escrow</p></div>
          ) : selectedEscrow ? (
            <div className="escrow-detail">
              <button className="escrow-back-btn" onClick={() => setSelectedEscrow(null)}>Quay lại danh sách</button>

              <div className="escrow-detail-header">
                <div>
                  <h3>{selectedEscrow.productName}</h3>
                  <p className="escrow-contract-code">Hợp đồng: {selectedEscrow.contractCode} — {selectedEscrow.farmerName}</p>
                </div>
                <span className={`escrow-status-badge ${selectedEscrow.status}`}>{statusLabels[selectedEscrow.status]}</span>
              </div>

              <div className="escrow-detail-stats">
                <div className="eds-item"><span>Tổng ký quỹ</span><strong>{fmtMoney(selectedEscrow.totalAmount)}</strong></div>
                <div className="eds-item"><span>Đã nạp</span><strong>{fmtMoney(selectedEscrow.depositedAmount)}</strong></div>
                <div className="eds-item released"><span>Đã giải ngân</span><strong>{fmtMoney(selectedEscrow.releasedAmount)}</strong></div>
                <div className="eds-item held"><span>Còn giữ</span><strong>{fmtMoney(selectedEscrow.depositedAmount - selectedEscrow.releasedAmount)}</strong></div>
              </div>

              <div className="escrow-progress-section">
                <h4>Tiến độ giải ngân</h4>
                <div className="escrow-progress-bar">
                  <div className="epb-fill" style={{ width: selectedEscrow.depositedAmount > 0 ? `${(selectedEscrow.releasedAmount / selectedEscrow.depositedAmount) * 100}%` : "0%" }}/>
                </div>
                <div className="epb-labels">
                  <span>0%</span>
                  <span>{selectedEscrow.depositedAmount > 0 ? Math.round((selectedEscrow.releasedAmount / selectedEscrow.depositedAmount) * 100) : 0}% đã giải ngân</span>
                  <span>100%</span>
                </div>
              </div>

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
                          {m.farmerConfirmed ? "Nông dân đã xác nhận" : "Chờ nông dân xác nhận"}
                        </span>
                        <span className={m.enterpriseConfirmed ? "confirmed" : "pending"}>
                          {m.enterpriseConfirmed ? "Doanh nghiệp đã xác nhận" : "Chờ doanh nghiệp xác nhận"}
                        </span>
                      </div>
                      {m.status === "in_progress" && !m.enterpriseConfirmed && m.farmerConfirmed && (
                        <div className="em-actions">
                          <button className="em-btn-confirm" onClick={() => handleConfirmMilestone(selectedEscrow, m)}>
                            Xác nhận đạt chuẩn
                          </button>
                          <button className="em-btn-dispute" onClick={() => handleRaiseDispute(selectedEscrow, m)}>
                            Báo cáo vấn đề
                          </button>
                        </div>
                      )}
                      {selectedEscrow.status === "awaiting_deposit" && m.step === 1 && (
                        <div className="em-actions">
                          <button className="em-btn-deposit" onClick={() => handleConfirmMilestone(selectedEscrow, m)}>
                            Đặt cọc ký quỹ — {fmtMoney(selectedEscrow.totalAmount)}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            filteredEscrows.map(e => (
              <div key={e.id} className="escrow-card" onClick={() => setSelectedEscrow(e)}>
                <div className="ec-header">
                  <div className="ec-header-left">
                    <h4>{e.productName}</h4>
                    <span className="ec-contract">{e.contractCode} — {e.farmerName}</span>
                  </div>
                  <span className={`escrow-status-badge ${e.status}`}>{statusLabels[e.status]}</span>
                </div>
                <div className="ec-body">
                  <div className="ec-stat"><span>Ký quỹ</span><strong>{fmtMoney(e.totalAmount)}</strong></div>
                  <div className="ec-stat"><span>Đã giải ngân</span><strong className="released">{fmtMoney(e.releasedAmount)}</strong></div>
                  <div className="ec-stat"><span>Còn giữ</span><strong>{fmtMoney(e.depositedAmount - e.releasedAmount)}</strong></div>
                </div>
                <div className="ec-milestones-mini">
                  {e.milestones.map(m => (
                    <div key={m.step} className={`ec-ms ${m.status}`} title={m.name}>{m.status === "completed" ? <span className="em-check-mini" /> : m.step}</div>
                  ))}
                </div>
                <div className="ec-footer">
                  <span className="ec-date">Tạo: {e.createdAt}</span>
                  <div className="ec-footer-actions">
                    {e.status === "awaiting_deposit" && (
                      <button className="ec-deposit-btn" onClick={ev => { ev.stopPropagation(); if (e.milestones?.[0]) handleConfirmMilestone(e, e.milestones[0]); }}>
                        Nạp ký quỹ — {fmtMoney(e.totalAmount)}
                      </button>
                    )}
                    <button className="ec-view-btn">Xem chi tiết</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Confirm Modal */}
      {confirmModal && (
        <div className="escrow-modal-overlay" onClick={() => setConfirmModal(null)}>
          <div className="escrow-modal" onClick={e => e.stopPropagation()}>
            <div className="escrow-modal-header">
              <h3>{confirmModal.milestone.step === 1 ? "Xác nhận đặt cọc ký quỹ" : "Xác nhận mốc thanh toán"}</h3>
              <button className="modal-close" onClick={() => setConfirmModal(null)}>X</button>
            </div>
            <div className="escrow-modal-body">
              <p><strong>Hợp đồng:</strong> {confirmModal.escrow.contractCode}</p>
              <p><strong>Sản phẩm:</strong> {confirmModal.escrow.productName}</p>
              <p><strong>Mốc:</strong> {confirmModal.milestone.name}</p>
              {confirmModal.milestone.releaseAmount > 0 && (
                <p><strong>Số tiền giải ngân:</strong> {fmtMoney(confirmModal.milestone.releaseAmount)}</p>
              )}
              {confirmModal.milestone.step === 1 && (
                <div className="escrow-deposit-info">
                  <p>Số tiền sẽ trừ từ số dư tài khoản ảo:</p>
                  <h3>{fmtMoney(confirmModal.escrow.totalAmount)}</h3>
                  <p className="balance-after">Số dư sau khi đặt cọc: {fmtMoney(balance - confirmModal.escrow.totalAmount)}</p>
                </div>
              )}
              <p className="escrow-modal-warning">Hành động này không thể hoàn tác. Xác nhận?</p>
            </div>
            <div className="escrow-modal-footer">
              <button className="em-btn-cancel" onClick={() => setConfirmModal(null)}>Hủy</button>
              <button className="em-btn-confirm" onClick={async () => {
                try {
                  const escRowId = confirmModal.escrow._id || confirmModal.escrow.id;
                  if (confirmModal.milestone.step === 1) {
                    await escrowService.deposit(escRowId, confirmModal.escrow.totalAmount);
                    toast.success("Đặt cọc ký quỹ thành công! Hợp đồng đã được kích hoạt.");
                  } else {
                    await escrowService.enterpriseConfirm(escRowId, confirmModal.milestone.step);
                    toast.success("Xác nhận mốc thanh toán thành công!");
                  }
                  await loadAll();
                } catch {
                  toast.error("Thao tác thất bại. Vui lòng thử lại.");
                }
                setConfirmModal(null);
              }}>
                {confirmModal.milestone.step === 1 ? "Đặt cọc ngay" : "Xác nhận đạt chuẩn"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispute Modal */}
      {disputeModal && (
        <div className="escrow-modal-overlay" onClick={() => setDisputeModal(null)}>
          <div className="escrow-modal" onClick={e => e.stopPropagation()}>
            <div className="escrow-modal-header">
              <h3>Báo cáo vấn đề chất lượng</h3>
              <button className="modal-close" onClick={() => setDisputeModal(null)}>X</button>
            </div>
            <div className="escrow-modal-body">
              <p><strong>Hợp đồng:</strong> {disputeModal.escrow.contractCode}</p>
              <p><strong>Mốc:</strong> {disputeModal.milestone.name}</p>
              <div className="dispute-form">
                <label>Mô tả vấn đề (tối thiểu 10 ký tự)</label>
                <textarea value={disputeReason} onChange={e => setDisputeReason(e.target.value)} rows={4} placeholder="Hàng không đạt tiêu chuẩn chất lượng đã cam kết trong hợp đồng. Cụ thể..." />
              </div>
              <div className="dispute-note">
                <p>Khiếu nại sẽ được gửi lên Admin PreOnic để xem xét. Vui lòng cung cấp đầy đủ bằng chứng (hình ảnh, báo cáo kiểm tra...).</p>
              </div>
            </div>
            <div className="escrow-modal-footer">
              <button className="em-btn-cancel" onClick={() => setDisputeModal(null)}>Hủy</button>
              <button className="em-btn-dispute" onClick={async () => {
                try {
                  const escRowId = disputeModal.escrow._id || disputeModal.escrow.id;
                  await escrowService.raiseDispute(escRowId, disputeModal.milestone.step, disputeReason);
                  toast.success("Khiếu nại đã được gửi thành công!");
                  await loadAll();
                } catch {
                  toast.error("Gửi khiếu nại thất bại. Vui lòng thử lại.");
                }
                setDisputeModal(null);
              }} disabled={disputeReason.length < 10}>Gửi khiếu nại</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
