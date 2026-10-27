import { useState, useEffect, useCallback } from "react";
import { FiDollarSign, FiTrendingUp, FiClock, FiCheckCircle, FiRefreshCw } from "react-icons/fi";
import farmerService from "../../../services/farmer.service";
import { formatMoney, formatDate } from "../../../hooks/useApiData";

export default function FarmerFinanceContent() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await farmerService.getFinances();
      setData(res.data);
    } catch {
      setError("Không thể tải dữ liệu tài chính");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="fd-finance-loading">
      <FiRefreshCw className="spin" size={24} />
      <span>Đang tải dữ liệu tài chính...</span>
    </div>
  );

  if (error) return (
    <div className="fd-finance-error">
      <p>{error}</p>
      <button onClick={load} className="fd-finance-retry-btn">Thử lại</button>
    </div>
  );

  const { balance = 0, stats = {}, transactions = [] } = data || {};
  const { totalIncome = 0, completedContractValue = 0, pendingAmount = 0, totalTransactions = 0 } = stats;

  return (
    <div className="fd-finance-wrap">
      <div className="fd-finance-header">
        <h2>Tài chính</h2>
        <button className="fd-finance-refresh-btn" onClick={load} title="Làm mới">
          <FiRefreshCw size={16} />
        </button>
      </div>

      {/* Stats row */}
      <div className="fd-finance-stats">
        <div className="fd-finance-stat-card balance">
          <div className="fd-finance-stat-icon"><FiDollarSign size={22} /></div>
          <div className="fd-finance-stat-body">
            <span className="fd-finance-stat-label">Số dư ví</span>
            <strong className="fd-finance-stat-val">{formatMoney(balance)}</strong>
          </div>
        </div>
        <div className="fd-finance-stat-card income">
          <div className="fd-finance-stat-icon"><FiTrendingUp size={22} /></div>
          <div className="fd-finance-stat-body">
            <span className="fd-finance-stat-label">Tổng thu nhập</span>
            <strong className="fd-finance-stat-val">{formatMoney(totalIncome)}</strong>
          </div>
        </div>
        <div className="fd-finance-stat-card completed">
          <div className="fd-finance-stat-icon"><FiCheckCircle size={22} /></div>
          <div className="fd-finance-stat-body">
            <span className="fd-finance-stat-label">Hợp đồng đã hoàn thành</span>
            <strong className="fd-finance-stat-val">{formatMoney(completedContractValue)}</strong>
          </div>
        </div>
        <div className="fd-finance-stat-card pending">
          <div className="fd-finance-stat-icon"><FiClock size={22} /></div>
          <div className="fd-finance-stat-body">
            <span className="fd-finance-stat-label">Đang chờ giải ngân</span>
            <strong className="fd-finance-stat-val">{formatMoney(pendingAmount)}</strong>
          </div>
        </div>
      </div>

      {/* Transaction history */}
      <div className="fd-finance-section">
        <div className="fd-finance-section-head">
          <h3>Lịch sử giải ngân</h3>
          <span className="fd-finance-tx-count">{totalTransactions} giao dịch</span>
        </div>

        {transactions.length === 0 ? (
          <div className="fd-finance-empty">
            <FiDollarSign size={32} />
            <p>Chưa có giao dịch nào</p>
          </div>
        ) : (
          <div className="fd-finance-tx-list">
            {transactions.map((tx) => (
              <div key={tx.id} className="fd-finance-tx-row">
                <div className="fd-finance-tx-icon income-icon">
                  <FiTrendingUp size={16} />
                </div>
                <div className="fd-finance-tx-info">
                  <span className="fd-finance-tx-desc">{tx.description}</span>
                  <span className="fd-finance-tx-date">{formatDate(tx.date)}</span>
                </div>
                <div className="fd-finance-tx-right">
                  <span className="fd-finance-tx-amount income">+{formatMoney(tx.amount)}</span>
                  <span className="fd-finance-tx-status completed">Hoàn tất</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
