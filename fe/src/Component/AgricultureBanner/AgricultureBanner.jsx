import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ROUTES } from "../../constants";
import "./AgricultureBanner.css";

const STATS = [
  { value: "12.5k+", label: "Nông sản đăng bán", sub: "Cập nhật hàng ngày", color: "#4ade80" },
  { value: "4.2k+",  label: "Nông dân đối tác",  sub: "Trên toàn quốc",    color: "#86efac" },
  { value: "375 tỷ", label: "Giá trị giao dịch", sub: "VNĐ bảo lãnh escrow", color: "#a7f3d0" },
  { value: "100%",   label: "Hợp đồng minh bạch", sub: "Chữ ký điện tử",   color: "#6ee7b7" },
];

const BAR_HEIGHTS = [28, 38, 32, 50, 62, 55, 44, 66, 75, 70, 84, 91];

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, delay: i * 0.1, ease: "easeOut" } }),
};

export default function AgricultureBanner() {
  const navigate = useNavigate();

  return (
    <section className="ab-section">
      {/* Background decorative blobs */}
      <div className="ab-blob ab-blob-1" />
      <div className="ab-blob ab-blob-2" />

      <div className="ab-inner">
        {/* ── LEFT ── */}
        <motion.div
          className="ab-left"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.25 }}
        >
          <motion.div className="ab-badge" variants={fadeUp} custom={0}>
            <span className="ab-badge-dot" />
            Nền tảng bao tiêu nông sản số 1 Việt Nam
          </motion.div>

          <motion.h2 className="ab-title" variants={fadeUp} custom={1}>
            Thúc đẩy minh bạch trong{" "}
            <span className="ab-title-highlight">Nông nghiệp hiện đại</span>
          </motion.h2>

          <motion.p className="ab-desc" variants={fadeUp} custom={2}>
            PreOnic kết nối trực tiếp nông dân với doanh nghiệp thu mua — hợp đồng điện tử,
            ký quỹ an toàn, giải ngân minh bạch. Không qua trung gian, không rủi ro mất tiền.
          </motion.p>

          {/* Stats grid */}
          <motion.div className="ab-stats" variants={fadeUp} custom={3}>
            {STATS.map((s) => (
              <div key={s.label} className="ab-stat">
                <span className="ab-stat-val" style={{ color: s.color }}>{s.value}</span>
                <span className="ab-stat-label">{s.label}</span>
                <span className="ab-stat-sub">{s.sub}</span>
              </div>
            ))}
          </motion.div>

          <motion.div className="ab-cta-row" variants={fadeUp} custom={4}>
            <button className="ab-btn-primary" onClick={() => navigate(ROUTES.AUTH)}>
              Bắt đầu miễn phí →
            </button>
            <button className="ab-btn-outline" onClick={() => navigate(ROUTES.PRODUCTS)}>
              Xem sản phẩm
            </button>
          </motion.div>
        </motion.div>

        {/* ── RIGHT: Chart card ── */}
        <motion.div
          className="ab-right"
          initial={{ opacity: 0, x: 40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.65, ease: "easeOut", delay: 0.15 }}
        >
          <div className="ab-chart-card">
            <div className="ab-chart-card-header">
              <div className="ab-chart-card-title">
                <span className="ab-chart-card-dot" />
                Giá trị giao dịch qua PreOnic
              </div>
              <span className="ab-chart-card-tag">+28% so với tháng trước</span>
            </div>

            <div className="ab-chart-bars">
              {BAR_HEIGHTS.map((h, i) => (
                <div key={i} className="ab-bar-wrap">
                  <motion.div
                    className="ab-bar"
                    initial={{ height: 0 }}
                    whileInView={{ height: `${h}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7, delay: i * 0.06, ease: "easeOut" }}
                    style={{ opacity: i >= BAR_HEIGHTS.length - 3 ? 1 : 0.65 + i * 0.03 }}
                  />
                </div>
              ))}
            </div>

            <div className="ab-chart-labels">
              {["T1","T2","T3","T4","T5","T6","T7","T8","T9","T10","T11","T12"].map(m => (
                <span key={m}>{m}</span>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
