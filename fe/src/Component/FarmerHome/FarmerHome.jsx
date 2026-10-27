import { useState, useEffect } from "react";
import { Container, Row, Col, Card } from "react-bootstrap";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { ROUTES, COMPANY } from "../../constants";
import farmerService from "../../services/farmer.service";
import Navbar from "../Navbar/Navbar";
import Footer from "../Footer/Footer";
import "./FarmerHome.css";

/* ── Vietnamese text with diacritics (actual render) ── */
const TEXTS = {
  guides: [
    { title: "Kỹ thuật canh tác hữu cơ", desc: "Hướng dẫn chuyển đổi sang canh tác hữu cơ từ A-Z, tiêu chuẩn VietGAP/GlobalGAP.", tag: "Phổ biến" },
    { title: "AI Dự báo sâu bệnh", desc: "Trí tuệ nhân tạo phân tích hình ảnh cây trồng, phát hiện sâu bệnh sớm.", tag: "AI" },
    { title: "Tưới tiêu thông minh", desc: "Hệ thống tưới nhỏ giọt tự động dựa trên dữ liệu cảm biến IoT.", tag: "IoT" },
    { title: "Phân tích đất", desc: "Đo lường độ pH, dinh dưỡng, đề xuất bón phân phù hợp theo mùa vụ.", tag: "Dữ liệu" },
    { title: "Xử lý sau thu hoạch", desc: "Phương pháp bảo quản, sơ chế, đóng gói đạt chuẩn xuất khẩu.", tag: "Thực hành" },
    { title: "Chứng nhận nông sản", desc: "Quy trình xin cấp VietGAP, GlobalGAP, Organic cho trang trại.", tag: "Chứng nhận" },
  ],
  reviews: [
    { name: "Healthy Harvest Co.", avatar: "HH", rating: 4.8, contracts: 45, review: "Thanh toán đúng hạn, hỗ trợ vận chuyển tốt. Rất tin tưởng khi hợp tác lâu dài.", location: "TP. HCM" },
    { name: "Global Grains", avatar: "GG", rating: 4.7, contracts: 32, review: "Thu mua số lượng lớn, giá ổn định theo hợp đồng. Đáng tin cậy.", location: "Hà Nội" },
    { name: "FreshMart VN", avatar: "FM", rating: 4.5, contracts: 58, review: "Mua hàng đều đặn mỗi tháng, quy trình nghiệm thu rõ ràng.", location: "Đà Nẵng" },
    { name: "AgriFoods International", avatar: "AF", rating: 4.9, contracts: 23, review: "Đối tác quốc tế uy tín, hỗ trợ kỹ thuật bảo quản chuyên nghiệp.", location: "Bình Dương" },
  ],
  health: [
    { title: "Phát hiện bệnh lá sớm", desc: "Chụp ảnh lá cây và để AI phân tích trong 10 giây" },
    { title: "Theo dõi thời tiết", desc: "Dự báo thời tiết 7 ngày chi tiết cho vùng canh tác" },
    { title: "Đề xuất phân bón", desc: "Lịch bón phân tối ưu theo giai đoạn sinh trưởng" },
    { title: "Cảnh báo sâu bệnh", desc: "Nhận thông báo khi vùng lân cận có dịch bệnh" },
  ],
};

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

const formatValue = (v) => {
  if (v >= 1e9) return (v / 1e9).toFixed(1) + " Tỷ";
  if (v >= 1e6) return (v / 1e6).toFixed(0) + "tr";
  return v.toLocaleString("vi-VN");
};

/* ── Main component ── */
function FarmerHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeGuide, setActiveGuide] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    farmerService.getDashboard()
      .then(res => { if (res?.data?.stats) setStats(res.data.stats); })
      .catch(() => {});
  }, []);

  const guideIcons = ["organic", "ai", "irrigation", "soil", "harvest", "cert"];
  const healthIcons = ["microscope", "weather", "fertilizer", "alert"];

  return (
    <>
      <Navbar />
      <div className="farmer-home">
        {/* ── HERO BANNER ── */}
        <section className="fh-banner">
          <Container>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <span className="fh-badge"><span className="fh-badge-icon" /> Trang chủ Nông dân</span>
              <h1>Chào mừng, <span className="user-highlight">{user?.fullName || "Nông dân"}</span></h1>
              <p>Quản lý mùa vụ, kết nối doanh nghiệp và nâng cao hiệu quả canh tác với {COMPANY.NAME}</p>
              
              <div className="fh-quick-stats">
                {[
                  { label: "Hợp đồng", value: stats ? String(stats.totalContracts || 0) : "--", cls: "contracts" },
                  { label: "Sản lượng", value: stats ? (stats.totalQuantity ? stats.totalQuantity + " Tấn" : "0 Tấn") : "--", cls: "yield" },
                  { label: "Doanh thu", value: stats ? formatValue(stats.totalContractValue || 0) : "--", cls: "revenue" },
                  { label: "Đánh giá", value: stats ? ((stats.reputationScore || 0).toFixed(1) + "/5") : "--", cls: "rating" },
                ].map((s, i) => (
                  <div key={i} className={`fh-qs-item ${s.cls}`}>
                    <span className="fh-qs-val">{s.value}</span>
                    <span className="fh-qs-label">{s.label}</span>
                  </div>
                ))}
              </div>

              <div className="fh-banner-actions">
                <button className="btn-primary-farmer" onClick={() => navigate(ROUTES.FARMER)}>
                  <span className="btn-icon dashboard-icon" /> Vào Dashboard
                </button>
                <button className="btn-outline-farmer" onClick={() => navigate(ROUTES.PRODUCTS)}>
                  <span className="btn-icon products-icon" /> Xem sản phẩm
                </button>
                <button className="btn-outline-farmer" onClick={() => navigate(ROUTES.MESSAGING)}>
                  <span className="btn-icon msg-icon" /> Tin nhắn
                </button>
              </div>
            </motion.div>
          </Container>
        </section>

        {/* ── CẨM NANG & AI ── */}
        <section className="fh-section">
          <Container>
            <div className="section-header-left">
              <span className="section-badge green"><span className="badge-icon tech-icon" /> Cẩm nang &amp; AI</span>
              <h2>Công Nghệ Hỗ Trợ Canh Tác</h2>
              <p>Kiến thức nông nghiệp kết hợp trí tuệ nhân tạo — nâng cao năng suất, giảm rủi ro</p>
            </div>
            <Row className="g-4">
              {TEXTS.guides.map((g, i) => (
                <Col key={i} md={6} lg={4}>
                  <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
                    <Card className="guide-card" onClick={() => setActiveGuide(activeGuide === i ? null : i)}>
                      <Card.Body>
                        <div className="guide-header">
                          <span className={`guide-icon-box ${guideIcons[i]}`}><span className={`g-icon ${guideIcons[i]}-icon`} /></span>
                          <span className="guide-tag">{g.tag}</span>
                        </div>
                        <h4>{g.title}</h4>
                        <p>{g.desc}</p>
                        <div className={`guide-expand ${activeGuide === i ? "open" : ""}`}>
                          <div className="guide-expand-inner">
                            <p className="guide-detail">Tính năng này đang được phát triển. Chúng tôi sẽ thông báo khi sẵn sàng.</p>
                          </div>
                        </div>
                        <button className="guide-link">{activeGuide === i ? "Thu gọn" : "Tìm hiểu thêm"} <span className="arrow-icon" /></button>
                      </Card.Body>
                    </Card>
                  </motion.div>
                </Col>
              ))}
            </Row>
          </Container>
        </section>

        {/* ── ĐÁNH GIÁ DOANH NGHIỆP ── */}
        <section className="fh-section bg-light">
          <Container>
            <div className="section-header-left">
              <span className="section-badge green"><span className="badge-icon star-badge-icon" /> Đánh giá Doanh nghiệp</span>
              <h2>Doanh Nghiệp Uy Tín Trên Nền Tảng</h2>
              <p>Đánh giá từ cộng đồng nông dân giúp bạn chọn đối tác phù hợp</p>
            </div>
            <Row className="g-4">
              {TEXTS.reviews.map((r, i) => (
                <Col key={i} md={6} lg={3}>
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
                    <Card className="review-card">
                      <Card.Body>
                        <div className="review-header">
                          <div className="review-avatar">{r.avatar}</div>
                          <div>
                            <h4>{r.name}</h4>
                            <p className="review-location"><span className="loc-icon" /> {r.location}</p>
                          </div>
                        </div>
                        <div className="review-rating-row">
                          <StarRating rating={r.rating} />
                          <span className="review-contracts">{r.contracts} hợp đồng</span>
                        </div>
                        <p className="review-text">"{r.review}"</p>
                        <div className="review-actions">
                          <button className="btn-outline-sm" onClick={() => navigate(ROUTES.MESSAGING)}>Liên hệ</button>
                          <button className="btn-green-sm">Xem hồ sơ</button>
                        </div>
                      </Card.Body>
                    </Card>
                  </motion.div>
                </Col>
              ))}
            </Row>
          </Container>
        </section>

        {/* ── SỨC KHỎE CÂY TRỒNG ── */}
        <section className="fh-section">
          <Container>
            <div className="section-header-left">
              <span className="section-badge green"><span className="badge-icon leaf-badge-icon" /> Sức khỏe cây trồng</span>
              <h2>Chăm Sóc Cây Trồng Thông Minh</h2>
              <p>Công cụ theo dõi và chẩn đoán sức khỏe cây trồng theo thời gian thực</p>
            </div>
            <Row className="g-4">
              {TEXTS.health.map((tip, i) => (
                <Col key={i} sm={6} lg={3}>
                  <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                    <div className="health-card">
                      <div className={`health-icon-box ${healthIcons[i]}`}><span className={`h-icon ${healthIcons[i]}-icon`} /></div>
                      <h4>{tip.title}</h4>
                      <p>{tip.desc}</p>
                      <button className="health-card-btn">Sử dụng ngay</button>
                    </div>
                  </motion.div>
                </Col>
              ))}
            </Row>
            <div className="text-center mt-5">
              <button className="btn-primary-farmer lg" onClick={() => navigate(ROUTES.CROP_HEALTH)}>
                <span className="btn-icon health-btn-icon" /> Kiểm tra sức khỏe cây trồng
              </button>
            </div>
          </Container>
        </section>

        {/* ── CTA ── */}
        <section className="fh-cta">
          <Container className="text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <h2>Bắt đầu kết nối với doanh nghiệp uy tín</h2>
              <p>Hàng trăm doanh nghiệp đang tìm kiếm nguồn nông sản chất lượng cao từ bạn</p>
              <div className="fh-cta-actions">
                <button className="btn-primary-farmer lg" onClick={() => navigate(ROUTES.FARMER)}>Đăng bán nông sản</button>
                <button className="btn-outline-farmer" onClick={() => navigate(ROUTES.CONTRACT_FLOW)}>Tạo hợp đồng mới</button>
              </div>
            </motion.div>
          </Container>
        </section>
      </div>
      <Footer />
    </>
  );
}

export default FarmerHome;
