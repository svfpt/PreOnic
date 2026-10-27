import { Container, Row, Col } from "react-bootstrap";
import { motion } from "framer-motion";
import {
  FiUser, FiMap, FiDollarSign, FiUsers, FiClipboard, FiShield, FiBarChart2
} from "react-icons/fi";
import { LuBuilding2 } from "react-icons/lu";
import { COMPANY } from "../../constants";
import "./CompanyIntro.css";

const STAT_ICONS = {
  farmer: <FiUser size={22} />,
  building: <LuBuilding2 size={22} />,
  map: <FiMap size={22} />,
  money: <FiDollarSign size={22} />,
};
const FEATURE_ICONS = {
  handshake: <FiUsers size={24} />,
  contract: <FiClipboard size={24} />,
  shield: <FiShield size={24} />,
  analytics: <FiBarChart2 size={24} />,
};

const stats = [
  { value: "10,000+", label: "Nông hộ", icon: "farmer" },
  { value: "500+", label: "Doanh nghiệp", icon: "building" },
  { value: "50+", label: "Tỉnh thành", icon: "map" },
  { value: "₫120B+", label: "Giá trị giao dịch", icon: "money" },
];

const features = [
  {
    icon: "handshake",
    title: "Kết Nối Trực Tiếp",
    desc: "Nông dân gặp doanh nghiệp không qua trung gian thương lái, minh bạch giá cả.",
  },
  {
    icon: "contract",
    title: "Hợp Đồng Bao Tiêu",
    desc: "Ký cam kết trước mùa vụ, đảm bảo đầu ra ổn định cho người sản xuất.",
  },
  {
    icon: "shield",
    title: "PreOnic Bảo Vệ",
    desc: `Trung gian đáng tin cậy — bảo vệ quyền lợi hai bên, chỉ ${COMPANY.COMMISSION_RATE}% phí dịch vụ.`,
  },
  {
    icon: "analytics",
    title: "Dữ Liệu & AI",
    desc: "Phân tích thị trường, dự báo giá, tư vấn canh tác thông minh cho nông dân.",
  },
];

function CompanyIntro() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.15 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  return (
    <section className="company-intro-section">
      <Container>
        <Row className="align-items-center g-5">
          {/* Left — About */}
          <Col lg={6}>
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <span className="intro-badge">Về {COMPANY.NAME}</span>
              <h2 className="intro-title">
                Nền Tảng Nông Nghiệp Số
                <br />
                <span className="text-gradient">Hàng Đầu Việt Nam</span>
              </h2>
              <p className="intro-desc">
                {COMPANY.NAME} xây dựng hệ sinh thái kết nối nông dân và doanh nghiệp, 
                loại bỏ trung gian thương lái, mang lại thu nhập công bằng cho người sản xuất 
                và nguồn cung ổn định cho doanh nghiệp. Chúng tôi tin rằng nông nghiệp bền vững 
                bắt đầu từ mối quan hệ minh bạch.
              </p>

              {/* Stats */}
              <div className="intro-stats">
                {stats.map((stat, i) => (
                  <motion.div
                    key={i}
                    className="intro-stat"
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <span className="stat-icon">{STAT_ICONS[stat.icon]}</span>
                    <strong className="stat-value">{stat.value}</strong>
                    <span className="stat-label">{stat.label}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </Col>

          {/* Right — Features */}
          <Col lg={6}>
            <motion.div
              className="intro-features"
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              {features.map((f, i) => (
                <motion.div key={i} className="intro-feature-card" variants={itemVariants}>
                  <span className="feature-icon">{FEATURE_ICONS[f.icon]}</span>
                  <div>
                    <h4 className="feature-title">{f.title}</h4>
                    <p className="feature-desc">{f.desc}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </Col>
        </Row>
      </Container>
    </section>
  );
}

export default CompanyIntro;
