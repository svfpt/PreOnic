import { useCallback, useEffect, useState } from "react";
import { FiAlertTriangle, FiPackage, FiTrash2 } from "react-icons/fi";
import { useToast } from "../../../contexts/ToastContext";
import farmerService from "../../../services/farmer.service";
import productService from "../../../services/product.service";
import { formatDate, formatMoney } from "../../../hooks/useApiData";

export default function MuaVuContent({ user, onNavigate }) {
  const { showToast } = useToast();
  const [dashboardStats, setDashboardStats] = useState(null);
  const [crops, setCrops] = useState([]);
  const [recentContracts, setRecentContracts] = useState([]);
  const [myProducts, setMyProducts] = useState(null);
  const [removeModal, setRemoveModal] = useState(null);
  const [removing, setRemoving] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      const [dashRes, cropsRes] = await Promise.all([
        farmerService.getDashboard().catch(() => null),
        farmerService.getCrops().catch(() => null),
      ]);
      if (dashRes?.data) {
        setDashboardStats(dashRes.data.stats);
        setRecentContracts(dashRes.data.recentContracts || []);
      }
      if (cropsRes?.data?.crops) setCrops(cropsRes.data.crops);
    } catch {
      /* silent */
    }
  }, []);

  const loadMyProducts = useCallback(async () => {
    try {
      const res = await productService.getMyProducts().catch(() => null);
      setMyProducts(res?.data?.products || res?.data || []);
    } catch {
      setMyProducts([]);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    loadMyProducts();
  }, [loadDashboard, loadMyProducts]);

  const handleRemoveProduct = async () => {
    if (!removeModal || removing) return;
    setRemoving(true);
    try {
      await productService.delete(removeModal._id);
      showToast(`Đã gỡ sản phẩm "${removeModal.name}" thành công.`, "success");
      setRemoveModal(null);
      await loadMyProducts();
      await loadDashboard();
    } catch (err) {
      showToast(err?.message || "Gỡ sản phẩm thất bại.", "error");
    } finally {
      setRemoving(false);
    }
  };

  // Kẹp % về [0,100] để thanh tiến độ / vòng tròn không bị vỡ layout khi dữ liệu bất thường.
  const clampPct = (v) => Math.min(100, Math.max(0, Number(v) || 0));

  const displayCrops = crops.map((c) => ({
    title: `${c.name} - ${c.location}`,
    target: c.expectedDate ? `Thu hoạch: ${formatDate(c.expectedDate)}` : "Quanh năm",
    pct: clampPct(c.progress),
    cls: "corn",
  }));

  const contractValue = dashboardStats?.totalContractValue || 0;
  const totalContracts = dashboardStats?.totalContracts || 0;
  const balance = dashboardStats?.balance || 0;

  return (
    <>
      <div className="muavu-welcome">
        <h1>Chào mừng trở lại, {user?.fullName || "Nông dân"}!</h1>
        <p>Dưới đây là tổng kết các cánh đồng và cam kết hôm nay.</p>
      </div>

      <div className="fd-stat-row">
        <div className="fd-stat-box">
          <div className="fd-stat-ico green">
            <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          </div>
          <div className="fd-stat-txt">
            <span>Giá trị hợp đồng</span>
            <strong>{contractValue > 0 ? formatMoney(contractValue) : "0 VNĐ"}</strong>
            <small className="ok">{totalContracts} hợp đồng</small>
          </div>
        </div>
        <div className="fd-stat-box">
          <div className="fd-stat-ico blue">
            <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          </div>
          <div className="fd-stat-txt">
            <span>Số dư ví</span>
            <strong>{formatMoney(balance)}</strong>
            <small>Ví PreOnic</small>
          </div>
        </div>
        <div className="fd-stat-box">
          <div className="fd-stat-ico amber">
            <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </div>
          <div className="fd-stat-txt">
            <span>Điểm uy tín</span>
            <strong>{dashboardStats?.reputationScore ?? 5}/5</strong>
            <small className={
              (dashboardStats?.reputationScore ?? 5) >= 4 ? "ok" :
              (dashboardStats?.reputationScore ?? 5) >= 2.5 ? "warn" : "bad"
            }>
              {(dashboardStats?.reputationScore ?? 5) >= 4 ? "Điều kiện tốt" :
               (dashboardStats?.reputationScore ?? 5) >= 2.5 ? "Cần cải thiện" : "Điều kiện xấu"}
            </small>
          </div>
        </div>
      </div>

      <div className="fd-pg-content">
        <div className="fd-sec-card">
          <div className="fd-sec-head">
            <h3>Tổng quan mùa vụ</h3>
            <span style={{ fontSize: 13, color: '#16a34a', cursor: 'pointer', fontWeight: 600 }} onClick={() => onNavigate?.("sanpham")}>Xem tất cả</span>
          </div>
          <div className="fd-sec-body">
            {displayCrops.length === 0 ? (
              <p style={{ color: '#9ca3af', fontSize: 13, padding: '12px 0', textAlign: 'center' }}>Chưa có dữ liệu mùa vụ nào</p>
            ) : (
              <div className="fd-season">
                {displayCrops.map((s, i) => (
                  <div key={i} className="season-item">
                    <div className="season-header">
                      <div className={`crop-badge ${s.cls}`}></div>
                      <div><strong className="season-title">{s.title}</strong><p className="season-target">Mục tiêu {s.target}</p></div>
                    </div>
                    <div className="progress-bar"><div className="progress-fill" style={{ width: `${s.pct}%` }}><span className="progress-label">{s.pct}%</span></div></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="fd-sec-card">
          <div className="fd-sec-head"><h3>Cam kết đang hoạt động</h3></div>
          <div style={{ overflowX: 'auto' }}>
            <table className="fd-table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  {["Đối tác","Nông sản","Giá trị","Ngày giao","Trạng thái"].map(h => (
                    <th key={h} style={{ padding: '11px 18px', fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', background: '#f9fbf9', borderBottom: '1px solid #f0f4f1' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentContracts.length > 0 ? recentContracts.map(c => (
                  <tr key={c._id} onMouseEnter={e => e.currentTarget.style.background='#f9fbf9'} onMouseLeave={e => e.currentTarget.style.background=''}>
                    <td style={{ padding: '12px 18px', fontSize: 13 }}>{c.enterpriseId?.fullName || c.enterpriseId?.companyName || "Doanh nghiệp"}</td>
                    <td style={{ padding: '12px 18px', fontSize: 13, fontWeight: 600 }}>{c.productName}</td>
                    <td style={{ padding: '12px 18px', fontSize: 13, fontWeight: 700, color: '#111812' }}>{formatMoney(c.totalValue)}</td>
                    <td style={{ padding: '12px 18px', fontSize: 13, color: '#6b7280' }}>{formatDate(c.deliveryDate)}</td>
                    <td style={{ padding: '12px 18px' }}><span className={`fds ${c.status === "active" ? "fds-green" : "fds-amber"}`}>{c.status === "active" ? "Đang hoạt động" : c.status}</span></td>
                  </tr>
                )) : (
                  <tr><td colSpan="5" style={{ textAlign: "center", color: "#9ca3af", padding: "28px", fontSize: 13 }}>Chưa có hợp đồng nào</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="fd-sec-card" style={{ marginTop: 0 }}>
          <div className="fd-sec-head">
            <h3>Sản phẩm đang bán ({myProducts === null ? "…" : myProducts.length})</h3>
          </div>
          <div className="fd-sec-body" style={{ padding: 0 }}>
            {myProducts === null ? (
              <p style={{ color: '#9ca3af', fontSize: 13, padding: '20px', textAlign: 'center' }}>Đang tải...</p>
            ) : myProducts.length === 0 ? (
              <p style={{ color: '#9ca3af', fontSize: 13, padding: '20px', textAlign: 'center' }}>Chưa có sản phẩm nào đang bán</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {myProducts.map((p, i) => (
                  <div key={p._id || i} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '12px 18px',
                    borderBottom: i < myProducts.length - 1 ? '1px solid #f0f4f1' : 'none',
                  }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 10, background: '#f0fdf4',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, overflow: 'hidden',
                    }}>
                      {p.image
                        ? <img src={p.image} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                        : <FiPackage size={20} color="#16a34a" />
                      }
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#111812', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</p>
                      <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
                        {p.location} · {p.priceMin?.toLocaleString('vi-VN')}đ–{p.priceMax?.toLocaleString('vi-VN')}đ/{p.unit}
                        {p.expectedDate && p.expectedDate !== 'Quanh năm' ? ` · Thu hoạch: ${p.expectedDate}` : ''}
                      </p>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: 'center', minWidth: 60 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: '50%',
                        background: `conic-gradient(#16a34a ${clampPct(p.progress) * 3.6}deg, #e5e7eb 0deg)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a' }}>{clampPct(p.progress)}%</span>
                        </div>
                      </div>
                      <p style={{ margin: '3px 0 0', fontSize: 10, color: '#9ca3af' }}>cam kết</p>
                    </div>
                    <button
                      onClick={() => setRemoveModal(p)}
                      style={{
                        flexShrink: 0, padding: '6px 14px', borderRadius: 8,
                        border: '1.5px solid #fecaca', background: '#fff5f5',
                        color: '#dc2626', fontWeight: 600, fontSize: 12,
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#fee2e2'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#fff5f5'; }}
                    >
                      <FiTrash2 size={12} /> Gỡ
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {removeModal && (
        <div
          onClick={() => !removing && setRemoveModal(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(15,23,42,0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 420,
              background: '#fff', borderRadius: 16,
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
              overflow: 'hidden',
            }}
          >
            <div style={{
              background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
              padding: '16px 22px',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem',
              }}><FiTrash2 size={17} color="#fff" /></div>
              <div>
                <h3 style={{ margin: 0, color: '#fff', fontSize: '1rem', fontWeight: 700 }}>Gỡ sản phẩm</h3>
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.75)', fontSize: '0.78rem' }}>Hành động này không thể hoàn tác</p>
              </div>
              <button
                onClick={() => !removing && setRemoveModal(null)}
                style={{
                  marginLeft: 'auto', background: 'rgba(255,255,255,0.15)',
                  border: 'none', cursor: 'pointer', width: 30, height: 30,
                  borderRadius: '50%', color: '#fff', fontSize: '0.95rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >✕</button>
            </div>
            <div style={{ padding: '20px 22px' }}>
              <div style={{
                background: '#fef3c7', border: '1px solid #fde68a',
                borderRadius: 10, padding: '12px 16px', marginBottom: 16,
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <FiAlertTriangle size={15} color="#92400e" style={{ flexShrink: 0, marginTop: 2 }} />
                <p style={{ margin: 0, fontSize: '0.83rem', color: '#92400e', lineHeight: 1.6 }}>
                  Sản phẩm sẽ bị ẩn khỏi danh sách và doanh nghiệp sẽ không thể xem hoặc đặt hợp đồng mới. Các hợp đồng hiện có <strong>không bị ảnh hưởng</strong>.
                </p>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: '#f9fafb', borderRadius: 10, padding: '12px 14px',
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 8, overflow: 'hidden',
                  background: '#f0fdf4', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {removeModal.image
                    ? <img src={removeModal.image} alt={removeModal.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <FiPackage size={20} color="#16a34a" />
                  }
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#111812' }}>{removeModal.name}</p>
                  <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{removeModal.location}</p>
                </div>
              </div>
            </div>
            <div style={{
              padding: '14px 22px', borderTop: '1px solid #f3f4f6',
              background: '#fafafa', display: 'flex', gap: 10, justifyContent: 'flex-end',
            }}>
              <button
                onClick={() => !removing && setRemoveModal(null)}
                disabled={removing}
                style={{
                  padding: '9px 20px', borderRadius: 9,
                  border: '1.5px solid #d1d5db', background: '#fff',
                  color: '#374151', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer',
                }}
              >Hủy</button>
              <button
                onClick={handleRemoveProduct}
                disabled={removing}
                style={{
                  padding: '9px 22px', borderRadius: 9, border: 'none',
                  background: removing ? '#d1d5db' : 'linear-gradient(135deg,#dc2626,#b91c1c)',
                  color: '#fff', fontWeight: 700, fontSize: '0.88rem',
                  cursor: removing ? 'not-allowed' : 'pointer',
                  boxShadow: removing ? 'none' : '0 4px 12px rgba(220,38,38,0.35)',
                }}
              >
                {removing ? 'Đang xử lý...' : 'Xác nhận gỡ sản phẩm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
