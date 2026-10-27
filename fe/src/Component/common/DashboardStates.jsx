// Component trạng thái dùng chung cho dashboard: rỗng & đang tải.
// Mục tiêu: thống nhất empty/loading giữa các section thay vì mỗi nơi tự vẽ.
import { FiInbox } from "react-icons/fi";
import "./DashboardStates.css";

export function LoadingState({ label = "Đang tải..." }) {
  return (
    <div className="ds-loading" role="status" aria-live="polite">
      <span className="ds-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

// Skeleton dạng danh sách (n dòng) cho cảm giác tải mượt hơn.
export function ListSkeleton({ rows = 4 }) {
  return (
    <div className="ds-skeleton" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="ds-skel-row">
          <div className="ds-skel-avatar" />
          <div className="ds-skel-lines">
            <div className="ds-skel-line w70" />
            <div className="ds-skel-line w40" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, message, action }) {
  return (
    <div className="ds-empty">
      <span className="ds-empty-icon" aria-hidden="true">{icon || <FiInbox size={40} />}</span>
      {title && <h4 className="ds-empty-title">{title}</h4>}
      {message && <p className="ds-empty-msg">{message}</p>}
      {action}
    </div>
  );
}
