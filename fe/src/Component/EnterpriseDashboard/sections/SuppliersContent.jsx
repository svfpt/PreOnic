import { useState, useEffect, useCallback } from "react";
import { FiUsers, FiRefreshCw, FiFileText } from "react-icons/fi";
import enterpriseService from "../../../services/enterprise.service";
import { formatMoney } from "../../../hooks/useApiData";

function StarBar({ score }) {
  const pct = Math.round((score / 5) * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ flex: 1, height: 6, background: "#e5e7eb", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: score >= 4 ? "#16a34a" : score >= 2.5 ? "#f59e0b" : "#ef4444", borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 12, color: "#6b7280", minWidth: 28 }}>{score?.toFixed(1) ?? "—"}</span>
    </div>
  );
}

export default function SuppliersContent() {
  const [suppliers, setSuppliers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await enterpriseService.getSuppliers();
      setSuppliers(res.data?.suppliers || []);
      setTotal(res.data?.total || 0);
    } catch {
      setError("Không thể tải danh sách nhà cung cấp");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = suppliers.filter(s =>
    !search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="ed-sup-state">
      <FiRefreshCw className="spin" size={24} />
      <span>Đang tải danh sách nhà cung cấp...</span>
    </div>
  );

  if (error) return (
    <div className="ed-sup-state error">
      <p>{error}</p>
      <button onClick={load} className="ed-sup-retry">Thử lại</button>
    </div>
  );

  return (
    <div className="ed-sup-wrap">
      <div className="ed-sup-header">
        <div>
          <h2>Nhà cung cấp</h2>
          <p className="ed-sup-subtitle">{total} nông dân đã hợp tác</p>
        </div>
        <button className="ed-sup-refresh" onClick={load} title="Làm mới">
          <FiRefreshCw size={15} />
        </button>
      </div>

      <div className="ed-sup-search">
        <input
          type="text"
          placeholder="Tìm theo tên hoặc email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="ed-sup-search-input"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="ed-sup-empty">
          <FiUsers size={36} />
          <p>{search ? "Không tìm thấy nhà cung cấp phù hợp" : "Chưa có nhà cung cấp nào"}</p>
        </div>
      ) : (
        <div className="ed-sup-table-wrap">
          <table className="ed-sup-table">
            <thead>
              <tr>
                <th>Nông dân</th>
                <th>Liên hệ</th>
                <th>Uy tín</th>
                <th>Hợp đồng</th>
                <th>Tổng giá trị</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id}>
                  <td>
                    <div className="ed-sup-name-cell">
                      <div className="ed-sup-avatar">{(s.name || "?").slice(0, 2).toUpperCase()}</div>
                      <span className="ed-sup-name">{s.name || "—"}</span>
                    </div>
                  </td>
                  <td>
                    <div className="ed-sup-contact">
                      <span>{s.email || "—"}</span>
                      {s.phone && <span className="ed-sup-phone">{s.phone}</span>}
                    </div>
                  </td>
                  <td style={{ minWidth: 120 }}>
                    <StarBar score={s.reputationScore || 0} />
                  </td>
                  <td className="ed-sup-num">
                    <FiFileText size={13} style={{ marginRight: 4, color: "#6b7280" }} />
                    {s.contractCount}
                  </td>
                  <td className="ed-sup-money">{formatMoney(s.totalValue)}</td>
                  <td>
                    <span className={`ed-sup-badge ${s.isActive ? "active" : "inactive"}`}>
                      {s.isActive ? "Hoạt động" : "Ngừng"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
