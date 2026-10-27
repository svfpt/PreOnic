// Tách từ EnterpriseDashboard.jsx theo SRP.
// Dùng chung giao diện chi tiết hợp đồng với Nông dân qua <ContractDetailView />.
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES, COMPANY } from "../../../constants";
import enterpriseService from "../../../services/enterprise.service";
import contractService from "../../../services/contract.service";
import { formatMoney, formatDate } from "../../../hooks/useApiData";
import ContractDetailView from "../../ContractDetailView/ContractDetailView";
import { LoadingState, EmptyState } from "../../common/DashboardStates";

const CONTRACT_STATUS_VI_ENT = {
  pending:   'Chờ ký',
  approved:  'Chờ ký quỹ',
  active:    'Đang thực hiện',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
  disputed:  'Đang tranh chấp',
};

export default function HopDongContent({ searchQuery = "", onNavigate }) {
  const navigate = useNavigate();
  const [activeContractTab, setActiveContractTab] = useState("pending");
  const [apiContracts, setApiContracts] = useState(null);
  const [selectedContract, setSelectedContract] = useState(null);

  const loadContracts = useCallback(async () => {
    try {
      const res = await enterpriseService.getContracts();
      setApiContracts(res?.data?.contracts || []);
    } catch { setApiContracts([]); }
  }, []);

  useEffect(() => { loadContracts(); }, [loadContracts]);

  const mapContract = (c) => ({
    ...c,
    id: c.contractCode || c._id,
    supplier: c.farmerName || "Nông dân",
    product: c.productName || "Nông sản",
    quantityLabel: `${c.quantity} ${c.unit || ""}`.trim(),
    valueLabel: formatMoney(c.totalValue || 0),
    dateLabel: formatDate(c.createdAt),
    deliveryDateLabel: formatDate(c.deliveryDate),
  });

  const contracts = (apiContracts || []).map(mapContract);

  const tabs = [
    { key: "pending",   label: "Chờ phê duyệt",   count: contracts.filter(c => c.status === 'pending' || c.status === 'approved').length },
    { key: "active",    label: "Đang hoạt động",   count: contracts.filter(c => c.status === 'active').length },
    { key: "completed", label: "Hoàn thành",        count: contracts.filter(c => c.status === 'completed').length },
    { key: "cancelled", label: "Đã hủy",            count: contracts.filter(c => c.status === 'cancelled').length },
  ];

  const filteredContracts = contracts.filter(c => {
    const q = (searchQuery || "").toLowerCase();
    const matchSearch = !q || c.product?.toLowerCase().includes(q) || c.id?.toLowerCase().includes(q) || c.supplier?.toLowerCase().includes(q);
    if (!matchSearch) return false;
    if (activeContractTab === "pending")   return c.status === 'pending' || c.status === 'approved';
    if (activeContractTab === "active")    return c.status === 'active';
    if (activeContractTab === "completed") return c.status === 'completed';
    if (activeContractTab === "cancelled") return c.status === 'cancelled';
    return false;
  });

  const openContract = async (contract) => {
    setSelectedContract(contract);
    try {
      const res = await contractService.getById(contract._id);
      if (res?.data?.contract) setSelectedContract(res.data.contract);
    } catch { /* dùng dữ liệu danh sách */ }
  };

  // ===== CHI TIẾT (dùng chung với Farmer) =====
  if (selectedContract) {
    return (
      <ContractDetailView
        contract={selectedContract}
        role="enterprise"
        onBack={() => setSelectedContract(null)}
        onChanged={loadContracts}
        onNavigateEscrow={onNavigate ? () => onNavigate("escrow") : undefined}
      />
    );
  }

  return (
    <>
      <div className="breadcrumb">
        <span>Trang chủ</span>
        <span className="arrow">›</span>
        <span>Hợp đồng</span>
      </div>

      <div className="page-header">
        <div>
          <h1 className="page-title">Quản lý Hợp đồng Thu mua</h1>
          <p className="page-subtitle">Tổng: <strong>{contracts.length} hợp đồng</strong> — Phí dịch vụ {COMPANY.NAME}: <strong>{COMPANY.COMMISSION_RATE}%</strong></p>
        </div>
        <button className="cf-btn primary" onClick={() => navigate(ROUTES.CONTRACT_FLOW)}>
          + Tạo hợp đồng mới
        </button>
      </div>

      <div className="contract-tabs">
        {tabs.map(tab => (
          <button key={tab.key} className={`contract-tab ${activeContractTab === tab.key ? "active" : ""}`} onClick={() => setActiveContractTab(tab.key)}>
            {tab.label} {tab.count > 0 && <span className="tab-badge">{tab.count}</span>}
          </button>
        ))}
      </div>

      <div className="contracts-list">
        {apiContracts === null && <LoadingState label="Đang tải hợp đồng..." />}
        {apiContracts !== null && filteredContracts.length === 0 && (
          <EmptyState
            title="Chưa có hợp đồng"
            message={activeContractTab === "pending" ? "Chưa có hợp đồng nào đang chờ phê duyệt." : "Không có hợp đồng nào trong mục này."}
          />
        )}
        {filteredContracts.map(contract => {
          const cci = contract.status === 'active' ? 'cci-active' : contract.status === 'completed' ? 'cci-completed' : contract.status === 'cancelled' ? 'cci-cancelled' : 'cci-pending';
          return (
            <div key={contract.id} className={`contract-card-item ${cci}`}>
              <div className="contract-main">
                <div className="contract-left">
                  <h4>{contract.supplier}</h4>
                  <p className="contract-meta">{contract.product} · {contract.quantityLabel}</p>
                  <p className="cci-code" style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{contract.id}</p>
                </div>
                <div className="contract-right">
                  <span className="contract-value">{contract.valueLabel}</span>
                  <span className={`status-badge ${contract.status}`}>{CONTRACT_STATUS_VI_ENT[contract.status] || contract.status}</span>
                </div>
              </div>
              <div className="contract-actions-row">
                <span className="contract-date cci-date">Tạo: {contract.dateLabel}</span>
                {contract.status === 'pending' && !contract.signedByEnterprise && (
                  <>
                    <button className="approve-btn" onClick={() => openContract(contract)}>Ký hợp đồng</button>
                    <button className="review-btn" onClick={() => openContract(contract)}>Xem chi tiết</button>
                  </>
                )}
                {contract.status === 'pending' && contract.signedByEnterprise && !contract.signedByFarmer && (
                  <>
                    <span style={{ fontSize: 12, color: '#9ca3af' }}>Chờ nông dân ký</span>
                    <button className="review-btn" onClick={() => openContract(contract)}>Xem chi tiết</button>
                  </>
                )}
                {contract.status === 'approved' && (
                  <>
                    <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>✓ Cả hai đã ký — Chờ ký quỹ</span>
                    {onNavigate && (
                      <button className="approve-btn" onClick={() => onNavigate("escrow")}>
                        Nạp ký quỹ ngay →
                      </button>
                    )}
                    <button className="review-btn" onClick={() => openContract(contract)}>Xem chi tiết</button>
                  </>
                )}
                {contract.status === 'active' && (
                  <button className="review-btn" onClick={() => openContract(contract)}>Xem tiến độ</button>
                )}
                {contract.status === 'completed' && (
                  <button className="review-btn" onClick={() => openContract(contract)}>Xem báo cáo</button>
                )}
                {contract.status === 'cancelled' && (
                  <button className="review-btn" onClick={() => openContract(contract)}>Xem chi tiết</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Activity log — derived from real data */}
      <div className="activity-log">
        <div className="activity-header">
          <h4>Lịch sử giao dịch</h4>
          <span className="update-time">Cập nhật mới nhất</span>
        </div>
        <div className="activity-list">
          {contracts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af', fontSize: 13 }}>Chưa có hoạt động nào</div>
          ) : contracts.slice(0, 5).map((c, i) => (
            <div key={i} className="activity-item">
              <div className={`activity-icon ${c.status === 'active' || c.status === 'completed' ? 'success' : 'pending'}`}>
                <span className={`ai-dot ${c.status === 'active' || c.status === 'completed' ? 'success' : 'pending'}`} />
              </div>
              <div className="activity-details">
                <p className="activity-title">{CONTRACT_STATUS_VI_ENT[c.status] || c.status}: {c.supplier}</p>
                <p className="activity-desc">{c.product} · {c.quantityLabel}</p>
              </div>
              <span className="activity-time">{c.dateLabel}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
