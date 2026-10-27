import { useState, useEffect } from "react";
import { Container, Row, Col, Card } from "react-bootstrap";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { ROUTES, COMPANY } from "../../constants";
import enterpriseService from "../../services/enterprise.service";
import Navbar from "../Navbar/Navbar";
import Footer from "../Footer/Footer";
import "./EnterpriseHome.css";

/* ── Star renderer ── */
function StarRating({ rating }) {
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.5;
  return (
    <span className="star-rating">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`star ${i < full ? "filled" : i === full && hasHalf ? "half" : ""}`} />
      ))}
      <span className="rating-num">{rating}</span>
    </span>
  );
}

const platformFeatures = [
  { cls: "search", title: "Tìm kiếm Nguồn cung", desc: "Lọc và tìm kiếm nông sản theo vùng miền, chứng nhận, giá cả phù hợp nhu cầu." },
  { cls: "contract", title: "Hợp đồng Điện tử", desc: "Ký kết hợp đồng trực tuyến, bảo mật blockchain, có giá trị pháp lý." },
  { cls: "shield", title: "Bảo vệ Giao dịch", desc: `${COMPANY.NAME} Escrow bảo vệ tiền đặt cọc, chỉ giải ngân khi nghiệm thu.` },
  { cls: "analytics", title: "Phân tích Thị trường", desc: "Dữ liệu giá cả, xu hướng, dự báo giúp ra quyết định thu mua chính xác." },
  { cls: "logistics", title: "Logistics Tích hợp", desc: "Quản lý vận chuyển, kho bãi, theo dõi đơn hàng từ trang trại đến nhà máy." },
  { cls: "messaging", title: "Nhắn tin Trực tiếp", desc: "Liên hệ nhà cung cấp ngay trên nền tảng, đàm phán nhanh chóng." },
];

const formatValue = (v) => {
  if (v >= 1e9) return (v / 1e9).toFixed(1) + " Tỷ";
  if (v >= 1e6) return (v / 1e6).toFixed(0) + "tr";
  return v.toLocaleString("vi-VN");
};

function EnterpriseHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [suppliers, setSuppliers] = useState([]);

  useEffect(() => {
    Promise.all([
      enterpriseService.getDashboard().catch(() => null),
      enterpriseService.getSuppliers().catch(() => null),
    ]).then(([dashRes, suppRes]) => {
      if (dashRes?.data?.stats) setStats(dashRes.data.stats);
      if (suppRes?.data?.suppliers) setSuppliers(suppRes.data.suppliers);
    });
  }, []);

  return (
    <>
      <Navbar />
      <div className="enterprise-home">
        {/* ── HERO BANNER ── */}
        <section className="eh-banner">
          <Container>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <span className="eh-badge"><span className="eh-badge-dot" /> Cổng Doanh nghiệp</span>
              <h1>Xin chào, <span className="user-highlight">{user?.fullName || "Doanh nghiệp"}</span></h1>
              <p>Tìm nguồn cung nông sản chất lượng cao, quản lý hợp đồng bao tiêu và theo dõi thị trường với {COMPANY.NAME}</p>

              <div className="eh-quick-stats">
                {[
                  { label: "Hợp đồng", value: stats ? String(stats.totalContracts || 0) : "--", cls: "contracts" },
                  { label: "Nhà cung cấp", value: stats ? String(stats.totalSuppliers || 0) : "--", cls: "suppliers" },
                  { label: "Giá trị HĐ", value: stats ? formatValue(stats.totalContractValue || 0) : "--", cls: "value" },
                  { label: "Ổn định CC", value: stats ? Math.round((stats.reputationScore || 0) * 20) + "%" : "--", cls: "stability" },
                ].map((s, i) => (
                  <div key={i} className={`eh-qs-item ${s.cls}`}>
                    <span className="eh-qs-val">{s.value}</span>
                    <span className="eh-qs-label">{s.label}</span>
                  </div>
                ))}
              </div>

              <div className="eh-banner-actions">
                <button className="btn-primary-ent" onClick={() => navigate(ROUTES.ENTERPRISE)}>
                  <span className="btn-ico dashboard-ico" /> Vào Dashboard
                </button>
                <button className="btn-outline-ent" onClick={() => navigate(ROUTES.PRODUCTS)}>
                  <span className="btn-ico search-ico" /> Tìm nguồn cung
                </button>
                <button className="btn-outline-ent" onClick={() => navigate(ROUTES.CONTRACT_FLOW)}>
                  <span className="btn-ico contract-ico" /> Tạo hợp đồng
                </button>
              </div>
            </motion.div>
          </Container>
        </section>

        {/* ── PLATFORM FEATURES ── */}
        <section className="eh-section">
          <Container>
            <div className="section-header-center">
              <span className="section-badge blue"><span className="s-badge-icon" /> Giải pháp cho Doanh nghiệp</span>
              <h2>Tối Ưu Hóa Chuỗi Cung Ứng Nông Sản</h2>
              <p>Bộ công cụ toàn diện giúp doanh nghiệp kết nối, quản lý và phát triển bền vững</p>
            </div>
            <Row className="g-4">
              {platformFeatures.map((f, i) => (
                <Col key={i} md={6} lg={4}>
                  <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
                    <div className="feature-card">
                      <div className={`feature-icon-box ${f.cls}`}><span className={`f-icon ${f.cls}-icon`} /></div>
                      <h4>{f.title}</h4>
                      <p>{f.desc}</p>
                    </div>
                  </motion.div>
                </Col>
              ))}
            </Row>
          </Container>
        </section>

        {/* ── PRODUCER REVIEWS ── */}
        <section className="eh-section bg-light">
          <Container>
            <div className="section-header-center">
              <span className="section-badge blue"><span className="s-badge-icon" /> Đánh giá Nhà sản xuất</span>
              <h2>Nhà Cung Cấp Hàng Đầu</h2>
              <p>Được đánh giá bởi cộng đồng doanh nghiệp trên nền tảng {COMPANY.NAME}</p>
            </div>
            <Row className="g-4">
              {suppliers.length === 0 && <Col className="text-center py-4" style={{ color: '#888' }}>Chưa có nhà cung cấp nào</Col>}
              {suppliers.slice(0, 6).map((r, i) => (
                <Col key={i} md={6} lg={4}>
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
                    <Card className="producer-review-card">
                      <Card.Body>
                        <div className="pr-header">
                          <div className="pr-avatar">{(r.fullName || "NN").slice(0, 2).toUpperCase()}</div>
                          <div>
                            <h4>{r.fullName || "Nhà cung cấp"}</h4>
                            <p className="pr-meta"><span className="loc-dot" /> {r.email}</p>
                          </div>
                        </div>
                        <div className="pr-rating-row">
                          <StarRating rating={r.reputationScore || 0} />
                          <span className="pr-contracts">{r.contractCount || 0} hợp đồng</span>
                        </div>
                        <p className="pr-text">Tổng giá trị: {formatValue(r.totalValue || 0)} VND</p>
                        <div className="pr-actions">
                          <button className="btn-outline-blue">Xem hồ sơ</button>
                          <button className="btn-solid-green" onClick={() => navigate(ROUTES.MESSAGING)}>Liên hệ</button>
                        </div>
                      </Card.Body>
                    </Card>
                  </motion.div>
                </Col>
              ))}
            </Row>
          </Container>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section className="eh-section">
          <Container>
            <div className="section-header-center">
              <span className="section-badge blue"><span className="s-badge-icon" /> Quy trình</span>
              <h2>Thu Mua Nông Sản Chỉ Với 4 Bước</h2>
              <p>Quy trình đơn giản, an toàn với {COMPANY.NAME} làm trung gian bảo vệ</p>
            </div>
            <div className="how-it-works">
              {[
                { step: "01", title: "Tìm kiếm", desc: "Duyệt sản phẩm, lọc theo vùng miền và chứng nhận chất lượng" },
                { step: "02", title: "Đàm phán", desc: "Liên hệ nhà cung cấp, thỏa thuận giá cả và điều khoản" },
                { step: "03", title: "Ký hợp đồng", desc: `Ký kết qua ${COMPANY.NAME} với phí dịch vụ ${COMPANY.COMMISSION_RATE}% — được bảo vệ giao dịch` },
                { step: "04", title: "Nhận hàng", desc: "Theo dõi vận chuyển, nghiệm thu chất lượng, thanh toán an toàn" },
              ].map((s, i) => (
                <motion.div key={i} className="hiw-step" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }}>
                  <div className="hiw-number">{s.step}</div>
                  <h4>{s.title}</h4>
                  <p>{s.desc}</p>
                  {i < 3 && <div className="hiw-connector" />}
                </motion.div>
              ))}
            </div>
          </Container>
        </section>

        {/* ── CTA ── */}
        <section className="eh-cta">
          <Container className="text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <h2>Sẵn sàng tìm nguồn cung chất lượng?</h2>
              <p>Hàng nghìn nhà sản xuất uy tín đang chờ kết nối với bạn trên {COMPANY.NAME}</p>
              <div className="eh-cta-actions">
                <button className="btn-primary-ent" onClick={() => navigate(ROUTES.ENTERPRISE)}>Bắt đầu thu mua</button>
                <button className="btn-outline-ent" onClick={() => navigate(ROUTES.PRODUCTS)}>Xem sản phẩm</button>
              </div>
            </motion.div>
          </Container>
        </section>
      </div>
      <Footer />
    </>
  );
}

export default EnterpriseHome;
