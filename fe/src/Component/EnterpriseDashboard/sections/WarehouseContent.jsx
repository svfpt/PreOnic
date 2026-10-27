import { useState, useEffect, useCallback } from "react";
import { FiPackage, FiRefreshCw, FiFileText } from "react-icons/fi";
import enterpriseService from "../../../services/enterprise.service";
import { formatMoney } from "../../../hooks/useApiData";

export default function WarehouseContent() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await enterpriseService.getWarehouse();
      setItems(res.data?.items || []);
      setTotal(res.data?.total || 0);
    } catch {
      setError("Không thể tải dữ liệu kho hàng");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalValue = items.reduce((sum, i) => sum + i.totalValue, 0);
  const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);

  if (loading) return (
    <div className="ed-wh-state">
      <FiRefreshCw className="spin" size={24} />
      <span>Đang tải dữ liệu kho hàng...</span>
    </div>
  );

  if (error) return (
    <div className="ed-wh-state error">
      <p>{error}</p>
      <button onClick={load} className="ed-wh-retry">Thử lại</button>
    </div>
  );

  return (
    <div className="ed-wh-wrap">
      <div className="ed-wh-header">
        <div>
          <h2>Kho hàng</h2>
          <p className="ed-wh-subtitle">Tổng hợp từ hợp đồng đã hoàn thành</p>
        </div>
        <button className="ed-wh-refresh" onClick={load} title="Làm mới">
          <FiRefreshCw size={15} />
        </button>
      </div>

      {/* Summary */}
      <div className="ed-wh-summary">
        <div className="ed-wh-sum-card">
          <span className="ed-wh-sum-label">Loại nông sản</span>
          <strong className="ed-wh-sum-val">{total}</strong>
        </div>
        <div className="ed-wh-sum-card">
          <span className="ed-wh-sum-label">Tổng số lượng</span>
          <strong className="ed-wh-sum-val">{totalQty.toLocaleString("vi-VN")} kg</strong>
        </div>
        <div className="ed-wh-sum-card highlight">
          <span className="ed-wh-sum-label">Tổng giá trị nhập</span>
          <strong className="ed-wh-sum-val">{formatMoney(totalValue)}</strong>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="ed-wh-empty">
          <FiPackage size={36} />
          <p>Chưa có dữ liệu kho hàng</p>
          <small>Dữ liệu sẽ xuất hiện sau khi hợp đồng hoàn thành</small>
        </div>
      ) : (
        <div className="ed-wh-table-wrap">
          <table className="ed-wh-table">
            <thead>
              <tr>
                <th>Nông sản</th>
                <th>Số lượng</th>
                <th>Đơn vị</th>
                <th>Số hợp đồng</th>
                <th>Tổng giá trị</th>
                <th>Giá TB / đơn vị</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i}>
                  <td>
                    <div className="ed-wh-product-cell">
                      <div className="ed-wh-product-icon"><FiPackage size={14} /></div>
                      <span className="ed-wh-product-name">{item.productName}</span>
                    </div>
                  </td>
                  <td className="ed-wh-num">{item.quantity.toLocaleString("vi-VN")}</td>
                  <td className="ed-wh-unit">{item.unit || "kg"}</td>
                  <td className="ed-wh-num">
                    <FiFileText size={12} style={{ marginRight: 4, color: "#9ca3af" }} />
                    {item.contractCount}
                  </td>
                  <td className="ed-wh-money">{formatMoney(item.totalValue)}</td>
                  <td className="ed-wh-avg">
                    {item.quantity > 0 ? formatMoney(Math.round(item.totalValue / item.quantity)) : "—"}
                    <span className="ed-wh-per-unit">/{item.unit || "kg"}</span>
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
