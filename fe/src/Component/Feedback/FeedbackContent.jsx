import { useState, useEffect, useCallback } from "react";
import feedbackService from "../../services/feedback.service";
import { useToast } from "../../contexts/ToastContext";
import "./FeedbackContent.css";

const CATEGORY_OPTIONS = [
  { value: "bug", label: "Báo lỗi" },
  { value: "feature", label: "Đề xuất tính năng" },
  { value: "ux", label: "Trải nghiệm / Giao diện" },
  { value: "payment", label: "Thanh toán / Ví" },
  { value: "other", label: "Khác" },
];

const CATEGORY_LABELS = CATEGORY_OPTIONS.reduce((acc, c) => {
  acc[c.value] = c.label;
  return acc;
}, {});

const STATUS_META = {
  new: { label: "Mới gửi", cls: "fb-badge-new" },
  read: { label: "Đã xem", cls: "fb-badge-read" },
  resolved: { label: "Đã xử lý", cls: "fb-badge-resolved" },
};

const SUBJECT_MAX = 200;
const MESSAGE_MAX = 3000;

// Phản hồi hệ thống — dùng chung cho dashboard Nông dân & Doanh nghiệp.
export default function FeedbackContent() {
  const toast = useToast();
  const [category, setCategory] = useState("other");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [list, setList] = useState([]);
  const [loadingList, setLoadingList] = useState(true);

  const loadMine = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await feedbackService.getMine();
      setList(res?.data?.feedbacks || []);
    } catch {
      // Không chặn form gửi nếu lịch sử lỗi.
      setList([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => { loadMine(); }, [loadMine]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim()) { toast.error("Vui lòng nhập tiêu đề phản hồi"); return; }
    if (!message.trim()) { toast.error("Vui lòng nhập nội dung phản hồi"); return; }

    setSubmitting(true);
    try {
      await feedbackService.submit({ category, subject: subject.trim(), message: message.trim() });
      toast.success("Đã gửi phản hồi đến quản trị viên. Cảm ơn bạn!");
      setSubject("");
      setMessage("");
      setCategory("other");
      loadMine();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Gửi phản hồi thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleString("vi-VN") : "—";

  return (
    <div className="fb-wrap">
      <div className="fb-head">
        <h1 className="fb-title">Phản hồi hệ thống</h1>
        <p className="fb-subtitle">Góp ý, báo lỗi hoặc đề xuất tính năng — phản hồi của bạn sẽ được gửi thẳng đến quản trị viên.</p>
      </div>

      <div className="fb-grid">
        {/* FORM */}
        <form className="fb-card fb-form" onSubmit={handleSubmit}>
          <h2 className="fb-card-title">Gửi phản hồi mới</h2>

          <label className="fb-field">
            <span className="fb-label">Loại phản hồi</span>
            <select className="fb-select" value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          <label className="fb-field">
            <span className="fb-label">Tiêu đề</span>
            <input
              className="fb-input"
              type="text"
              maxLength={SUBJECT_MAX}
              placeholder="Tóm tắt ngắn gọn vấn đề / đề xuất"
              value={subject}
              onChange={e => setSubject(e.target.value)}
            />
            <span className="fb-counter">{subject.length}/{SUBJECT_MAX}</span>
          </label>

          <label className="fb-field">
            <span className="fb-label">Nội dung chi tiết</span>
            <textarea
              className="fb-textarea"
              rows={6}
              maxLength={MESSAGE_MAX}
              placeholder="Mô tả chi tiết: bạn gặp gì, ở màn hình nào, mong muốn ra sao..."
              value={message}
              onChange={e => setMessage(e.target.value)}
            />
            <span className="fb-counter">{message.length}/{MESSAGE_MAX}</span>
          </label>

          <button className="fb-submit" type="submit" disabled={submitting}>
            {submitting ? "Đang gửi..." : "Gửi phản hồi"}
          </button>
        </form>

        {/* MY FEEDBACKS */}
        <div className="fb-card fb-history">
          <h2 className="fb-card-title">Phản hồi đã gửi {list.length > 0 && <span className="fb-count">({list.length})</span>}</h2>

          {loadingList ? (
            <div className="fb-empty">Đang tải...</div>
          ) : list.length === 0 ? (
            <div className="fb-empty">Bạn chưa gửi phản hồi nào.</div>
          ) : (
            <ul className="fb-list">
              {list.map(item => {
                const meta = STATUS_META[item.status] || STATUS_META.new;
                return (
                  <li key={item._id} className="fb-item">
                    <div className="fb-item-top">
                      <span className="fb-item-cat">{CATEGORY_LABELS[item.category] || "Khác"}</span>
                      <span className={`fb-badge ${meta.cls}`}>{meta.label}</span>
                    </div>
                    <div className="fb-item-subject">{item.subject}</div>
                    <div className="fb-item-msg">{item.message}</div>
                    {item.adminNote && (
                      <div className="fb-item-note"><strong>Phản hồi từ Admin:</strong> {item.adminNote}</div>
                    )}
                    <div className="fb-item-date">{fmtDate(item.createdAt)}</div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
