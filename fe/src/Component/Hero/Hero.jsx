import { Container, Row, Col } from "react-bootstrap";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  FiArrowRight,
  FiTrendingUp,
  FiShoppingCart,
} from "react-icons/fi";
import { LuLeaf, LuSprout } from "react-icons/lu";
import { ROUTES } from "../../constants";
import "./Hero.css";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=2000&q=85&auto=format&fit=crop";

const stats = [
  {
    icon: <LuSprout />,
    value: "5000+",
    label: "Nông dân tin tưởng",
  },
  {
    icon: <FiShoppingCart />,
    value: "1200+",
    label: "Đối tác thu mua",
  },
  {
    icon: <FiTrendingUp />,
    value: "98%",
    label: "Sản lượng đạt chuẩn",
  },
];

function Hero() {
  const navigate = useNavigate();
  const heroStyle = {
    backgroundImage: `url(${HERO_IMAGE})`,
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.25 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" },
    },
  };

  return (
    <section className="hero-v2" style={heroStyle}>
      <div className="hero-v2-overlay" />
      <Container className="hero-v2-container">
        <Row className="align-items-center g-5">
          <Col lg={7}>
            <motion.div
              className="hero-v2-content"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <motion.span className="hero-v2-badge" variants={itemVariants}>
                <LuLeaf className="hero-v2-badge-icon" />
                NÔNG NGHIỆP BỀN VỮNG 4.0
              </motion.span>

              <motion.h1 className="hero-v2-title" variants={itemVariants}>
                Đảm Bảo Vụ Mùa,
                <br />
                <span className="hero-v2-title-accent">
                  Kết Nối Tương Lai
                </span>
              </motion.h1>

              <motion.p className="hero-v2-desc" variants={itemVariants}>
                Tham gia cuộc cách mạng nông nghiệp số. Cam kết bao tiêu nông
                sản chất lượng cao và hỗ trợ canh tác bền vững.
              </motion.p>

              <motion.div className="hero-v2-actions" variants={itemVariants}>
                <button
                  className="hero-v2-btn-primary"
                  onClick={() => navigate(ROUTES.PRODUCTS)}
                >
                  Khám phá ngay <FiArrowRight />
                </button>
                <button
                  className="hero-v2-btn-secondary"
                  onClick={() => navigate(ROUTES.REGISTER)}
                >
                  <LuLeaf /> Đăng ký bán nông sản
                </button>
              </motion.div>

            </motion.div>
          </Col>

          <Col lg={5}>
            <motion.div
              className="hero-v2-stats"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              {stats.map((s, i) => (
                <motion.div
                  className="hero-v2-stat-card"
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.7 + i * 0.12 }}
                  whileHover={{ y: -6 }}
                >
                  <span className="hero-v2-stat-icon">{s.icon}</span>
                  <div className="hero-v2-stat-value">{s.value}</div>
                  <div className="hero-v2-stat-label">{s.label}</div>
                  <span className="hero-v2-stat-arrow">
                    <FiArrowRight />
                  </span>
                </motion.div>
              ))}
            </motion.div>
          </Col>
        </Row>
      </Container>
    </section>
  );
}

export default Hero;
