import { useEffect, useState, useCallback } from "react";
import adminService from "../../../services/admin.service";
import { formatMoney } from "../../../hooks/useApiData";
import { useToast } from "../../../contexts/ToastContext";
import { getContractStatusMeta } from "../../../constants";

export default function QuanLyHopDong() {
  const toast = useToast();
  const [contracts, setContracts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedContract, setSelectedContract] = useState(null);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await adminService.getContracts(params);
      setContracts(res?.data || []);
      if (res?.pagination) setPagination(res.pagination);
    } catch {
      toast.error("Không thể tải danh sách hợp đồng");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, toast]);

  useEffect(() => { load(1); }, [load]);

  const openDetail = async (contractId) => {
    setSelectedContract({ _id: contractId, loading: true });
    try {
      const res = await adminService.getContractDetail(contractId);
      setSelectedContract({ ...res?.data?.contract, dispute: res?.data?.dispute });
    } catch {
      toast.error("Không thể tải chi tiết hợp đồng");
      setSelectedContract(null);
    }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("vi-VN") : "—";

  const STATUS_OPTIONS = [
    { val: "", label: "Tất cả trạng thái" },
    { val: "pending", label: "Chờ duyệt" },
    { val: "approved", label: "Đã phê duyệt" },
    { val: "active", label: "Đang chạy" },
    { val: "completed", label: "Hoàn thành" },
    { val: "cancelled", label: "Đã hủy" },
    { val: "disputed", label: "Tranh chấp" },
  ];

  return (
    <>
      <div className="adm-page-header">
        <div>
          <h1 className="adm-page-title">Quản lý Hợp đồng</h1>
          <p className="adm-page-subtitle">Tổng cộng {pagination.total} hợp đồng trên hệ thống</p>
        </div>
      </div>

      <div className="adm-card">
        <div className="adm-filters">
          <input
            className="adm-search"
            type="text"
            placeholder="Tìm mã hợp đồng, tên nông dân, doanh nghiệp..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === "Enter" && load(1)}
          />
          <select className="adm-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            {STATUS_OPTIONS.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
          </select>
          <button className="adm-btn adm-btn-primary" onClick={() => load(1)}>Tìm kiếm</button>
        </div>

        {loading ? (
          <div className="adm-loading">Đang tải...</div>
        ) : contracts.length === 0 ? (
          <div className="adm-empty"><p>Không tìm thấy hợp đồng nào</p></div>
        ) : (
          <>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Mã HĐ</th>
                    <th>Nông dân</th>
                    <th>Doanh nghiệp</th>
                    <th>Nông sản</th>
                    <th>Giá trị</th>
                    <th>Trạng thái</th>
                    <th>Ngày tạo</th>
                    <th>Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map(c => {
                    const meta = getContractStatusMeta(c.status);
                    return (
                      <tr key={c._id}>
                        <td><span style={{ fontWeight: 700, color: "#4f46e5", fontSize: 12 }}>{c.contractCode}</span></td>
                        <td style={{ color: "#334155" }}>{c.farmerName}</td>
                        <td style={{ color: "#334155" }}>{c.enterpriseName}</td>
                        <td style={{ color: "#64748b" }}>{c.productName}</td>
                        <td style={{ fontWeight: 600, color: "#1d4ed8" }}>{formatMoney(c.totalValue || 0)}</td>
                        <td>
                          <span className="adm-badge" style={{ background: meta.color + "22", color: meta.color }}>
                            {meta.label}
                          </span>
                        </td>
                        <td style={{ color: "#64748b", fontSize: 12 }}>{fmtDate(c.createdAt)}</td>
                        <td>
                          <button className="adm-btn adm-btn-outline" onClick={() => openDetail(c._id)}>Xem</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="adm-pagination">
              <span>Trang {pagination.page} / {pagination.totalPages} — {pagination.total} hợp đồng</span>
              <div className="adm-pagination-btns">
                <button className="adm-pagination-btn" disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)}>← Trước</button>
                <button className="adm-pagination-btn" disabled={pagination.page >= pagination.totalPages} onClick={() => load(pagination.page + 1)}>Tiếp →</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Contract Detail Modal */}
      {selectedContract && (
        <div className="adm-modal-overlay" onClick={() => setSelectedContract(null)}>
          <div className="adm-modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div className="adm-modal-hd">
              <h3>Chi tiết Hợp đồng</h3>
              <button className="adm-modal-close" onClick={() => setSelectedContract(null)}>×</button>
            </div>
            <div className="adm-modal-body" style={{ maxHeight: "70vh", overflowY: "auto" }}>
              {selectedContract.loading ? (
                <div className="adm-loading">Đang tải...</div>
              ) : (
                <>
                  <div style={{ background: "#f8fafc", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: "#4f46e5" }}>{selectedContract.contractCode}</div>
                    {(() => {
                      const m = getContractStatusMeta(selectedContract.status);
                      return <span className="adm-badge" style={{ background: m.color + "22", color: m.color, marginTop: 4, display: "inline-block" }}>{m.label}</span>;
                    })()}
                  </div>

                  <div className="adm-detail-row"><span className="adm-detail-label">Nông dân</span><span className="adm-detail-val">{selectedContract.farmerName || selectedContract.farmerId?.fullName}</span></div>
                  <div className="adm-detail-row"><span className="adm-detail-label">Doanh nghiệp</span><span className="adm-detail-val">{selectedContract.enterpriseName || selectedContract.enterpriseId?.fullName}</span></div>
                  <div className="adm-detail-row"><span className="adm-detail-label">Nông sản</span><span className="adm-detail-val">{selectedContract.productName}</span></div>
                  <div className="adm-detail-row"><span className="adm-detail-label">Số lượng</span><span className="adm-detail-val">{selectedContract.quantity} {selectedContract.unit}</span></div>
                  <div className="adm-detail-row"><span className="adm-detail-label">Đơn giá</span><span className="adm-detail-val">{formatMoney(selectedContract.pricePerUnit || 0)} / {selectedContract.unit}</span></div>
                  <div className="adm-detail-row"><span className="adm-detail-label">Tổng giá trị</span><span className="adm-detail-val" style={{ color: "#1d4ed8", fontSize: 15 }}>{formatMoney(selectedContract.totalValue || 0)}</span></div>
                  <div className="adm-detail-row"><span className="adm-detail-label">Ký quỹ</span><span className="adm-detail-val">{formatMoney(selectedContract.depositAmount || 0)}</span></div>
                  <div className="adm-detail-row"><span className="adm-detail-label">Ngày giao hàng dự kiến</span><span className="adm-detail-val">{fmtDate(selectedContract.deliveryDate)}</span></div>
                  <div className="adm-detail-row"><span className="adm-detail-label">Farmer đã ký</span><span className="adm-detail-val">{selectedContract.signedByFarmer ? "Đã ký" : "Chưa ký"}</span></div>
                  <div className="adm-detail-row"><span className="adm-detail-label">Enterprise đã ký</span><span className="adm-detail-val">{selectedContract.signedByEnterprise ? "Đã ký" : "Chưa ký"}</span></div>
                  <div className="adm-detail-row"><span className="adm-detail-label">Ngày tạo</span><span className="adm-detail-val">{fmtDate(selectedContract.createdAt)}</span></div>
                  {selectedContract.cancelReason && (
                    <div className="adm-detail-row"><span className="adm-detail-label">Lý do hủy</span><span className="adm-detail-val" style={{ color: "#dc2626" }}>{selectedContract.cancelReason}</span></div>
                  )}
                  {selectedContract.dispute && (
                    <div style={{ marginTop: 16, background: "#fef3c7", borderRadius: 10, padding: "12px 16px" }}>
                      <div style={{ fontWeight: 600, color: "#d97706", marginBottom: 6 }}>Khiếu nại liên quan</div>
                      <div style={{ fontSize: 12, color: "#92400e" }}>{selectedContract.dispute.reason}</div>
                      <span className="adm-badge adm-badge-yellow" style={{ marginTop: 4, display: "inline-block" }}>{selectedContract.dispute.status}</span>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="adm-modal-ft">
              <button className="adm-btn adm-btn-outline" onClick={() => setSelectedContract(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
