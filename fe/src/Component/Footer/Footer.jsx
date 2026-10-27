import { Container, Row, Col } from "react-bootstrap";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ROUTES, COMPANY } from "../../constants";
import "./Footer.css";

const Footer = () => {
  const navigate = useNavigate();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  const linkVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    hover: { x: 4, color: "#16a34a", transition: { duration: 0.2 } },
  };

  const aboutLinks = [
    { label: "Về PreOnic", path: "/info/ve-preonic" },
    { label: "Kênh người bán", path: ROUTES.FARMER },
    { label: "Điều khoản sử dụng", path: "/info/dieu-khoan" },
    { label: "Chính sách bảo mật", path: "/info/bao-mat" },
    { label: "Quy chế hoạt động", path: "/info/quy-che" },
    { label: "Cơ chế giải quyết tranh chấp", path: "/info/tranh-chap" },
  ];

  const supportLinks = [
    { label: "Trung tâm trợ giúp", path: "/info/tro-giup" },
    { label: "Hướng dẫn mua hàng", path: "/info/huong-dan-mua" },
    { label: "Hướng dẫn bán hàng", path: "/info/huong-dan-ban" },
    { label: "Giao hàng và nhận hàng", path: "/info/giao-nhan" },
    { label: "Trả hàng / Hoàn tiền", path: "/info/hoan-tien" },
    { label: "Cổng tiếp nhận & danh sách phản ánh", path: "/info/phan-anh" },
  ];

  return (
    <motion.footer
      className="footer-v3"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.1 }}
      variants={containerVariants}
    >
      <Container className="footer-v3-inner">
        <Row className="footer-v3-top g-4">
          {/* BRAND + CERT */}
          <Col lg={4} md={12}>
            <motion.div variants={itemVariants} className="footer-v3-brand">
              <div
                className="footer-v3-logo"
                onClick={() => navigate(ROUTES.HOME)}
              >
                <span className="footer-v3-logo-icon" />
                <span className="footer-v3-logo-text">PreOnic</span>
              </div>
              <p className="footer-v3-tagline">Sàn kết nối nông sản giá sỉ</p>
              <p className="footer-v3-desc">
                Được phát triển nhằm kết nối trực tiếp những nhà cung cấp nông
                sản địa phương với nhà hàng, quán ăn, quán cafe và doanh
                nghiệp — mang đến hơn 10.000+ mặt hàng đúng tiêu chuẩn và đảm
                bảo 100% hóa đơn VAT.
              </p>

              <div className="footer-v3-cert">
                <span className="footer-v3-cert-label">Chứng nhận đăng ký</span>
                <img
                  src={`${process.env.PUBLIC_URL}/images/products/cert.png`}
                  alt="Đã đăng ký Bộ Công Thương"
                  className="footer-v3-cert-img"
                />
              </div>
            </motion.div>
          </Col>

          {/* ABOUT */}
          <Col lg={3} md={4} sm={6}>
            <motion.div variants={itemVariants}>
              <h6 className="footer-v3-heading">Về chúng tôi</h6>
              <ul className="footer-v3-list">
                {aboutLinks.map((l, i) => (
                  <motion.li
                    key={i}
                    variants={linkVariants}
                    whileHover="hover"
                    onClick={() => navigate(l.path)}
                  >
                    {l.label}
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          </Col>

          {/* SUPPORT */}
          <Col lg={3} md={4} sm={6}>
            <motion.div variants={itemVariants}>
              <h6 className="footer-v3-heading">Hỗ trợ</h6>
              <ul className="footer-v3-list">
                {supportLinks.map((l, i) => (
                  <motion.li
                    key={i}
                    variants={linkVariants}
                    whileHover="hover"
                    onClick={() => navigate(l.path)}
                  >
                    {l.label}
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          </Col>

          {/* CONTACT */}
          <Col lg={2} md={4} sm={12}>
            <motion.div variants={itemVariants}>
              <h6 className="footer-v3-heading">Thông tin liên hệ</h6>
              <ul className="footer-v3-list footer-v3-contact-list">
                <li>
                  <span className="footer-v3-contact-label">Hotline:</span>{" "}
                  <a href={`tel:${COMPANY.HOTLINE.replace(/\s/g, "")}`} className="footer-v3-contact-link"><strong>{COMPANY.HOTLINE}</strong></a>
                </li>
                <li>
                  <span className="footer-v3-contact-label">Email:</span>{" "}
                  <a href={`mailto:${COMPANY.EMAIL}`} className="footer-v3-contact-link"><strong>{COMPANY.EMAIL}</strong></a>
                </li>
                <li>
                  <span className="footer-v3-contact-label">Địa chỉ:</span>{" "}
                  <strong>Đà Lạt, Lâm Đồng, Việt Nam</strong>
                </li>
              </ul>
            </motion.div>
          </Col>
        </Row>

        {/* LANDSCAPE ILLUSTRATION */}
        <div className="footer-v3-landscape">
          <svg
            viewBox="0 0 1440 180"
            preserveAspectRatio="xMidYMax meet"
            aria-hidden="true"
          >
            {/* Sun */}
            <circle cx="1200" cy="40" r="22" fill="#fef3c7" opacity="0.75" />
            <circle cx="1200" cy="40" r="16" fill="#fde68a" opacity="0.9" />

            {/* Birds */}
            <g fill="none" stroke="#5b8a72" strokeWidth="2" strokeLinecap="round">
              <path d="M 240 50 q 9 -9 18 0 q 9 -9 18 0" />
              <path d="M 320 72 q 7 -7 14 0 q 7 -7 14 0" />
              <path d="M 200 92 q 6 -6 12 0 q 6 -6 12 0" />
              <path d="M 1060 70 q 9 -9 18 0 q 9 -9 18 0" />
              <path d="M 1000 95 q 7 -7 14 0 q 7 -7 14 0" />
            </g>

            {/* Far hills */}
            <path
              d="M0,90 C200,65 400,100 600,80 C800,60 1000,95 1200,75 C1300,65 1440,85 1440,85 L1440,180 L0,180 Z"
              fill="#cdebbf"
              opacity="0.85"
            />

            {/* Mid hills */}
            <path
              d="M0,115 C180,95 380,125 600,105 C800,85 1000,120 1200,100 C1320,90 1440,110 1440,110 L1440,180 L0,180 Z"
              fill="#a4d989"
              opacity="0.9"
            />

            {/* Front hills */}
            <path
              d="M0,140 C200,118 400,148 700,125 C900,108 1100,148 1440,125 L1440,180 L0,180 Z"
              fill="#7cc265"
            />

            {/* Tree clusters */}
            <g>
              <ellipse cx="120" cy="138" rx="14" ry="11" fill="#3f8d3a" />
              <ellipse cx="134" cy="133" rx="11" ry="9" fill="#4ea24a" />
              <rect x="126" y="138" width="3" height="9" fill="#5b3a1f" />
            </g>
            <g>
              <ellipse cx="880" cy="143" rx="13" ry="10" fill="#3f8d3a" />
              <ellipse cx="894" cy="138" rx="10" ry="8" fill="#4ea24a" />
              <rect x="886" y="143" width="3" height="9" fill="#5b3a1f" />
            </g>

            {/* Farmer figure with watering can */}
            <g transform="translate(1310, 126)">
              <ellipse cx="0" cy="-1" rx="10" ry="3" fill="#d97706" />
              <path d="M -5 -2 Q 0 -8 5 -2 Z" fill="#d97706" />
              <rect x="-3" y="1" width="6" height="12" fill="#dbeafe" />
              <rect x="-3" y="13" width="2.5" height="9" fill="#1f3a2e" />
              <rect x="0.5" y="13" width="2.5" height="9" fill="#1f3a2e" />
              <rect x="3" y="4" width="10" height="2" fill="#dbeafe" />
              <path d="M 13 3 L 19 3 L 20.5 9 L 11.5 9 Z" fill="#16a34a" />
              <path d="M 20.5 4.5 L 23 3 L 23 6 Z" fill="#16a34a" />
              <circle cx="22" cy="10" r="0.9" fill="#3b82f6" opacity="0.7" />
              <circle cx="24" cy="13" r="0.9" fill="#3b82f6" opacity="0.7" />
            </g>

            {/* Rice rows */}
            <g stroke="#5fa450" strokeWidth="1" opacity="0.5">
              <line x1="50" y1="162" x2="350" y2="162" />
              <line x1="100" y1="170" x2="450" y2="170" />
              <line x1="700" y1="164" x2="1100" y2="164" />
              <line x1="800" y1="172" x2="1200" y2="172" />
            </g>
          </svg>
        </div>

      </Container>
    </motion.footer>
  );
};

export default Footer;
