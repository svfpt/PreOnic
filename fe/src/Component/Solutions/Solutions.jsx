import { Container, Row, Col } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  FiCheck,
  FiTrendingUp,
  FiShield,
  FiActivity,
  FiUser,
  FiBriefcase,
  FiMonitor,
  FiArrowRight,
  FiMessageCircle,
  FiHeart,
  FiLock,
} from "react-icons/fi";
import Navbar from "../Navbar/Navbar";
import Footer from "../Footer/Footer";
import { ROUTES } from "../../constants";
import "./Solutions.css";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1920&q=80&auto=format&fit=crop";
const CTA_IMAGE =
  "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=80&auto=format&fit=crop";

const trustBadges = [
  { icon: <FiTrendingUp />, title: "Hiệu quả vượt trội", desc: "Tối ưu quy trình" },
  { icon: <FiShield />, title: "An toàn & minh bạch", desc: "Truy xuất nguồn gốc" },
  { icon: <FiActivity />, title: "Phát triển bền vững", desc: "Gia tăng giá trị" },
];

const solutions = [
  {
    id: 1,
    title: "Giải pháp cho Nông dân",
    subtitle: "Cam kết hỗ trợ tối đa nông dân",
    icon: <FiUser />,
    accent: "#16a34a",
    bg: "rgba(22, 163, 74, 0.12)",
    features: [
      "Ký hợp đồng bao tiêu trước mùa vụ",
      "Giá cả cam kết công khai minh bạch",
      "Hỗ trợ kỹ thuật canh tác",
      "Thanh toán nhanh chóng, an toàn",
    ],
  },
  {
    id: 2,
    title: "Giải pháp cho Doanh nghiệp",
    subtitle: "Nguồn cung ổn định, chất lượng đảm bảo",
    icon: <FiBriefcase />,
    accent: "#2563eb",
    bg: "rgba(37, 99, 235, 0.12)",
    features: [
      "Nguồn cung ổn định theo yêu cầu",
      "Truy xuất nguồn gốc 100%",
      "Quản lý hợp đồng số hóa",
      "Phân tích dữ liệu thị trường",
    ],
  },
  {
    id: 3,
    title: "Nền tảng Công nghệ",
    subtitle: "Số hóa toàn diện chuỗi cung ứng",
    icon: <FiMonitor />,
    accent: "#8b5cf6",
    bg: "rgba(139, 92, 246, 0.12)",
    features: [
      "Blockchain cho truy xuất nguồn gốc",
      "IoT giám sát chất lượng",
      "AI dự báo giá và sản lượng",
      "Dashboard quản lý thời gian thực",
    ],
  },
];

const ctaMicro = [
  { icon: <FiMessageCircle />, label: "Tư vấn miễn phí" },
  { icon: <FiHeart />, label: "Hỗ trợ tận tâm" },
  { icon: <FiLock />, label: "Bảo mật thông tin" },
];

const Solutions = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");

  const handleCtaSubmit = (e) => {
    e.preventDefault();
    navigate(ROUTES.CONTACT);
  };

  return (
    <div className="solutions-page-v2">
      <Navbar />

      {/* HERO */}
      <section
        className="solv2-hero"
        style={{ backgroundImage: `url(${HERO_IMAGE})` }}
      >
        <div className="solv2-hero-overlay" />
        <Container className="solv2-hero-inner">
          <motion.div
            className="solv2-hero-content"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="solv2-badge">
              <span className="solv2-badge-dot" />
              GIẢI PHÁP TOÀN DIỆN
            </span>
            <h1 className="solv2-hero-title">
              Kết nối <span>Nông dân</span> –<br />
              Phát triển <span className="solv2-hero-accent">Doanh nghiệp</span>
            </h1>
            <p className="solv2-hero-desc">
              Nền tảng số hóa chuỗi cung ứng nông sản với công nghệ tiên tiến,
              <br />
              mang lại lợi ích cho tất cả các bên tham gia.
            </p>

            <div className="solv2-trust-row">
              {trustBadges.map((b, idx) => (
                <motion.div
                  className="solv2-trust"
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 + idx * 0.1 }}
                >
                  <span className="solv2-trust-icon">{b.icon}</span>
                  <div>
                    <div className="solv2-trust-title">{b.title}</div>
                    <div className="solv2-trust-desc">{b.desc}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </Container>
        <svg className="solv2-wave" viewBox="0 0 1440 90" preserveAspectRatio="none">
          <path
            d="M0,60 C360,90 1080,0 1440,60 L1440,90 L0,90 Z"
            fill="#f7faf8"
          />
        </svg>
      </section>

      {/* CARDS */}
      <section className="solv2-cards-section">
        <Container>
          <Row className="g-4">
            {solutions.map((sol, index) => (
              <Col lg={4} md={6} key={sol.id}>
                <motion.div
                  className="solv2-card"
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -8 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.5, delay: index * 0.12 }}
                >
                  <div
                    className="solv2-card-icon"
                    style={{ background: sol.bg, color: sol.accent }}
                  >
                    {sol.icon}
                  </div>
                  <h3 className="solv2-card-title">{sol.title}</h3>
                  <p className="solv2-card-subtitle">{sol.subtitle}</p>
                  <ul className="solv2-feature-list">
                    {sol.features.map((f, i) => (
                      <li key={i}>
                        <span
                          className="solv2-feature-check"
                          style={{ color: sol.accent }}
                        >
                          <FiCheck />
                        </span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <svg
                    className="solv2-card-leaf"
                    viewBox="0 0 100 100"
                    aria-hidden="true"
                  >
                    <path
                      d="M85,15 C60,15 25,40 15,85 C55,85 90,55 85,15 Z"
                      fill={sol.accent}
                      opacity="0.08"
                    />
                    <path
                      d="M85,15 Q50,50 15,85"
                      stroke={sol.accent}
                      strokeOpacity="0.15"
                      strokeWidth="1.5"
                      fill="none"
                    />
                  </svg>
                </motion.div>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      {/* CTA */}
      <section className="solv2-cta-section">
        <Container>
          <motion.div
            className="solv2-cta-box"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div
              className="solv2-cta-image"
              style={{ backgroundImage: `url(${CTA_IMAGE})` }}
            >
              <div className="solv2-cta-image-overlay" />
            </div>

            <div className="solv2-cta-content">
              <div className="solv2-cta-top">
                <div>
                  <h2 className="solv2-cta-title">Sẵn sàng bắt đầu?</h2>
                  <p className="solv2-cta-desc">
                    Tham gia cùng hàng nghìn nông dân và doanh nghiệp
                    <br />
                    đã tin dùng PreOnic
                  </p>
                </div>
                <form className="solv2-cta-form" onSubmit={handleCtaSubmit}>
                  <input
                    type="tel"
                    placeholder="Nhập số điện thoại của bạn"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="solv2-cta-input"
                  />
                  <button type="submit" className="solv2-cta-btn">
                    Liên hệ tư vấn <FiArrowRight />
                  </button>
                </form>
              </div>

              <div className="solv2-cta-micros">
                {ctaMicro.map((m, idx) => (
                  <div className="solv2-cta-micro" key={idx}>
                    <span className="solv2-cta-micro-icon">{m.icon}</span>
                    {m.label}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </Container>
      </section>

      {/* Wave transition into footer */}
      <div className="solv2-footer-wave">
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none">
          <path
            d="M0,20 C360,80 1080,0 1440,40 L1440,80 L0,80 Z"
            fill="#f6fbef"
          />
        </svg>
      </div>

      <Footer />
    </div>
  );
};

export default Solutions;
