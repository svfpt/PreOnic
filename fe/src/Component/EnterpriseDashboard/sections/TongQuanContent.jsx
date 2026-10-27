import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import enterpriseService from "../../../services/enterprise.service";
import { DATE_FORMATS, getContractStatusMeta } from "../../../constants";
import { formatMoney } from "../../../hooks/useApiData";

export default function TongQuanContent({ onNavigate }) {
  const [apiStats, setApiStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [recentContracts, setRecentContracts] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [dashRes, anaRes, ctrRes] = await Promise.all([
          enterpriseService.getDashboard().catch(() => null),
          enterpriseService.getAnalytics().catch(() => null),
          enterpriseService.getContracts().catch(() => null),
        ]);
        if (dashRes?.data) setApiStats(dashRes.data);
        if (anaRes?.data) setAnalytics(anaRes.data);
        if (ctrRes?.data?.contracts) setRecentContracts(ctrRes.data.contracts.slice(0, 5));
      } catch {
        /* silent */
      }
    };
    load();
  }, []);

  const stats = apiStats?.stats || {};
  const totalContracts = stats.totalContracts || 0;
  const activeContracts = stats.activeContracts || 0;
  const pendingContracts = stats.pendingContracts || 0;
  const completedContracts = stats.completedContracts || 0;
  const totalValue = stats.totalContractValue || 0;
  const reputationPct = stats.reputationScore ? Math.round(stats.reputationScore * 20) : 0;

  const monthlyData = (analytics?.monthlyData || []).map((m) => ({ name: m.month, value: m.value }));

  const C = 2 * Math.PI * 54;
  const total = totalContracts || 1;
  const pendingDash = C * (pendingContracts / total);
  const activeDash = C * (activeContracts / total);
  const completedDash = C * (completedContracts / total);
  const pendingAngle = -90;
  const activeAngle = pendingAngle + (pendingContracts / total) * 360;
  const completedAngle = activeAngle + (activeContracts / total) * 360;

  const repOffset = C - (C * reputationPct / 100);
  const repColor = reputationPct >= 80 ? "#16a34a" : reputationPct >= 50 ? "#f59e0b" : "#ef4444";

  const statusLabel = (status) => getContractStatusMeta(status).label;
  const statusColor = (status) => getContractStatusMeta(status).color;

  return (
    <>
      <div className="tq-page-header">
        <div>
          <h1 className="tq-title">Tổng quan Doanh nghiệp</h1>
          <p className="tq-subtitle">Theo dõi hoạt động thu mua và quản lý hợp đồng</p>
        </div>
        <span className="tq-date-badge">
          {new Date().toLocaleDateString("vi-VN", DATE_FORMATS.FULL_DATE)}
        </span>
      </div>

      <div className="tq-kpis">
        <div className="tq-kpi" style={{ "--kpi-color": "#1d4ed8" }}>
          <div className="tq-kpi-icon" style={{ background: "#dbeafe", color: "#1d4ed8" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
          </div>
          <div className="tq-kpi-body">
            <span className="tq-kpi-val">{totalContracts}</span>
            <span className="tq-kpi-label">Tổng hợp đồng</span>
            <span className="tq-kpi-sub">{completedContracts} đã hoàn thành</span>
          </div>
        </div>

        <div className="tq-kpi" style={{ "--kpi-color": "#16a34a" }}>
          <div className="tq-kpi-icon" style={{ background: "#dcfce7", color: "#16a34a" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div className="tq-kpi-body">
            <span className="tq-kpi-val">{activeContracts}</span>
            <span className="tq-kpi-label">Đang hoạt động</span>
            <span className="tq-kpi-sub tq-kpi-sub-green">Đang thực hiện</span>
          </div>
        </div>

        <div className="tq-kpi" style={{ "--kpi-color": "#d97706" }}>
          <div className="tq-kpi-icon" style={{ background: "#fef3c7", color: "#d97706" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div className="tq-kpi-body">
            <span className="tq-kpi-val">{pendingContracts}</span>
            <span className="tq-kpi-label">Chờ phê duyệt</span>
            {pendingContracts > 0
              ? <span className="tq-kpi-sub tq-kpi-sub-warn">Cần xem xét</span>
              : <span className="tq-kpi-sub">Không có</span>}
          </div>
        </div>

        <div className="tq-kpi" style={{ "--kpi-color": "#7c3aed" }}>
          <div className="tq-kpi-icon" style={{ background: "#ede9fe", color: "#7c3aed" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
          </div>
          <div className="tq-kpi-body">
            <span className="tq-kpi-val tq-kpi-money">{formatMoney(totalValue)}</span>
            <span className="tq-kpi-label">Tổng giá trị hợp đồng</span>
            <span className="tq-kpi-sub">Tích lũy toàn bộ</span>
          </div>
        </div>
      </div>

      <div className="tq-mid-grid">
        <div className="tq-card">
          <div className="tq-card-hd">
            <h3>Chi tiêu theo tháng</h3>
            <span className="tq-chip">{monthlyData.length > 0 ? `${monthlyData.length} tháng gần nhất` : "Chưa có dữ liệu"}</span>
          </div>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={210}>
              <LineChart data={monthlyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f1" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={v => v >= 1e9 ? `${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(0)}M` : String(v)}
                  tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={48}
                />
                <Tooltip formatter={v => [formatMoney(v), "Chi tiêu"]} contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }} />
                <Line type="monotone" dataKey="value" stroke="#1d4ed8" strokeWidth={2.5} dot={{ fill: "#1d4ed8", r: 3.5, strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="tq-empty-chart">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              <p>Dữ liệu sẽ xuất hiện khi có hợp đồng</p>
            </div>
          )}
        </div>

        <div className="tq-card tq-donut-card">
          <div className="tq-card-hd"><h3>Phân bổ hợp đồng</h3></div>
          <div className="tq-donut-wrap">
            <svg viewBox="0 0 128 128" width="148" height="148">
              <circle cx="64" cy="64" r="54" fill="none" stroke="#f3f4f6" strokeWidth="14" />
              {totalContracts > 0 && <>
                <circle cx="64" cy="64" r="54" fill="none" stroke="#f59e0b" strokeWidth="14"
                  strokeDasharray={`${pendingDash} ${C}`} strokeLinecap="butt"
                  transform={`rotate(${pendingAngle} 64 64)`} />
                <circle cx="64" cy="64" r="54" fill="none" stroke="#1d4ed8" strokeWidth="14"
                  strokeDasharray={`${activeDash} ${C}`} strokeLinecap="butt"
                  transform={`rotate(${activeAngle} 64 64)`} />
                <circle cx="64" cy="64" r="54" fill="none" stroke="#16a34a" strokeWidth="14"
                  strokeDasharray={`${completedDash} ${C}`} strokeLinecap="butt"
                  transform={`rotate(${completedAngle} 64 64)`} />
              </>}
            </svg>
            <div className="tq-donut-center">
              <span className="tq-donut-num">{totalContracts}</span>
              <span className="tq-donut-lbl">Hợp đồng</span>
            </div>
          </div>
          <div className="tq-legend">
            {[
              { color: "#f59e0b", label: "Chờ duyệt", val: pendingContracts },
              { color: "#1d4ed8", label: "Đang chạy", val: activeContracts },
              { color: "#16a34a", label: "Hoàn thành", val: completedContracts },
            ].map(item => (
              <div className="tq-legend-row" key={item.label}>
                <span className="tq-dot" style={{ background: item.color }} />
                <span className="tq-legend-label">{item.label}</span>
                <span className="tq-legend-val">{item.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="tq-bot-grid">
        <div className="tq-card">
          <div className="tq-card-hd">
            <h3>Hợp đồng gần đây</h3>
            {onNavigate && <button className="tq-link-btn" onClick={() => onNavigate("hopdong")}>Xem tất cả →</button>}
          </div>
          {recentContracts.length === 0 ? (
            <div className="tq-empty-state">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
              <p>Chưa có hợp đồng nào</p>
            </div>
          ) : (
            <div className="tq-ctr-list">
              {recentContracts.map((c, i) => (
                <div className="tq-ctr-row" key={i}>
                  <div className="tq-ctr-avatar">{(c.farmer?.fullName || c.farmerName || "ND").slice(0, 2).toUpperCase()}</div>
                  <div className="tq-ctr-info">
                    <span className="tq-ctr-name">{c.farmer?.fullName || c.farmerName || "Nông dân"}</span>
                    <span className="tq-ctr-product">{c.product?.name || c.productName || "Nông sản"}</span>
                  </div>
                  <div className="tq-ctr-right">
                    <span className="tq-ctr-val">{formatMoney(c.totalValue || c.value || 0)}</span>
                    <span className="tq-s-badge" style={{ background: statusColor(c.status) + "22", color: statusColor(c.status) }}>
                      {statusLabel(c.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="tq-card tq-rep-card">
          <div className="tq-card-hd"><h3>Điểm uy tín</h3></div>
          <div className="tq-rep-wrap">
            <svg viewBox="0 0 128 128" width="148" height="148">
              <circle cx="64" cy="64" r="54" fill="none" stroke="#f3f4f6" strokeWidth="10" />
              <circle cx="64" cy="64" r="54" fill="none" stroke={repColor} strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${C}`} strokeDashoffset={`${repOffset}`}
                transform="rotate(-90 64 64)" />
            </svg>
            <div className="tq-rep-center">
              <span className="tq-rep-pct" style={{ color: repColor }}>{reputationPct > 0 ? `${reputationPct}%` : "--"}</span>
              <span className="tq-rep-lbl">{reputationPct >= 80 ? "Xuất sắc" : reputationPct >= 50 ? "Khá tốt" : "Cần cải thiện"}</span>
            </div>
          </div>
          <div className="tq-rep-bars">
            <div className="tq-bar-row">
              <div className="tq-bar-labels">
                <span>Hoàn thành hợp đồng</span>
                <span>{totalContracts > 0 ? Math.round((completedContracts / totalContracts) * 100) : 0}%</span>
              </div>
              <div className="tq-bar-bg"><div className="tq-bar-fill" style={{ width: `${totalContracts > 0 ? (completedContracts / totalContracts) * 100 : 0}%`, background: "#16a34a" }} /></div>
            </div>
            <div className="tq-bar-row">
              <div className="tq-bar-labels">
                <span>Hợp đồng đang chạy</span>
                <span>{totalContracts > 0 ? Math.round((activeContracts / totalContracts) * 100) : 0}%</span>
              </div>
              <div className="tq-bar-bg"><div className="tq-bar-fill" style={{ width: `${totalContracts > 0 ? (activeContracts / totalContracts) * 100 : 0}%`, background: "#1d4ed8" }} /></div>
            </div>
          </div>
          <p className="tq-rep-note">Dựa trên lịch sử hợp đồng và đánh giá từ đối tác nông dân.</p>
        </div>
      </div>
    </>
  );
}
