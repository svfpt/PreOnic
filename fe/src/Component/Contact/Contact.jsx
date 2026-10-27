import { Container, Row, Col, Form } from "react-bootstrap";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  FiHeadphones,
  FiShield,
  FiHeart,
  FiMapPin,
  FiPhone,
  FiMail,
  FiClock,
  FiFacebook,
  FiLinkedin,
  FiYoutube,
  FiSend,
  FiMessageCircle,
} from "react-icons/fi";
import Navbar from "../Navbar/Navbar";
import Footer from "../Footer/Footer";
import { useToast } from "../../contexts/ToastContext";
import { TOAST_DURATION, COMPANY } from "../../constants";
import "./Contact.css";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1564507592333-c60657eea523?w=1920&q=80&auto=format&fit=crop";

const trustBadges = [
  {
    icon: <FiHeadphones />,
    title: "Hỗ trợ nhanh chóng",
    desc: "Phản hồi trong vòng 24h",
  },
  {
    icon: <FiShield />,
    title: "Bảo mật thông tin",
    desc: "Cam kết bảo mật tuyệt đối",
  },
  {
    icon: <FiHeart />,
    title: "Tận tâm hỗ trợ",
    desc: "Đồng hành cùng nhà nông",
  },
];

const Contact = () => {
  const toast = useToast();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    message: "",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    toast.success(
      "Cảm ơn bạn đã liên hệ! Chúng tôi sẽ phản hồi trong thời gian sớm nhất.",
      TOAST_DURATION.LONG
    );
    setFormData({ name: "", email: "", phone: "", company: "", message: "" });
  };

  const infoItems = [
    {
      icon: <FiMapPin />,
      title: "Địa chỉ",
      lines: ["Số 123, Đường ABC, Quận Cầu Giấy", "Hà Nội, Việt Nam"],
    },
    {
      icon: <FiPhone />,
      title: "Hotline",
      lines: [COMPANY.HOTLINE, "024.xxxx.xxxx"],
    },
    {
      icon: <FiMail />,
      title: "Email",
      lines: [COMPANY.EMAIL, COMPANY.SUPPORT_EMAIL],
    },
    {
      icon: <FiClock />,
      title: "Giờ làm việc",
      lines: ["Thứ 2 - Thứ 6: 8:00 - 17:30", "Thứ 7: 8:00 - 12:00"],
    },
  ];

  const socials = [
    { key: "facebook", icon: <FiFacebook /> },
    { key: "zalo", icon: <FiMessageCircle /> },
    { key: "linkedin", icon: <FiLinkedin /> },
    { key: "youtube", icon: <FiYoutube /> },
  ];

  return (
    <div className="contact-page-v2">
      <Navbar />

      {/* HERO */}
      <section
        className="ctv2-hero"
        style={{ backgroundImage: `url(${HERO_IMAGE})` }}
      >
        <div className="ctv2-hero-overlay" />
        <Container className="ctv2-hero-inner">
          <motion.div
            className="ctv2-hero-content"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="ctv2-hero-title">Liên hệ với chúng tôi</h1>
            <p className="ctv2-hero-desc">
              Đội ngũ PreOnic luôn sẵn sàng hỗ trợ bạn.
              <br />
              Hãy để lại thông tin, chúng tôi sẽ liên hệ ngay!
            </p>

            <div className="ctv2-trust-row">
              {trustBadges.map((b, idx) => (
                <motion.div
                  className="ctv2-trust"
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 + idx * 0.1 }}
                >
                  <span className="ctv2-trust-icon">{b.icon}</span>
                  <div>
                    <div className="ctv2-trust-title">{b.title}</div>
                    <div className="ctv2-trust-desc">{b.desc}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </Container>
        <svg className="ctv2-wave" viewBox="0 0 1440 90" preserveAspectRatio="none">
          <path
            d="M0,60 C360,90 1080,0 1440,60 L1440,90 L0,90 Z"
            fill="#f7faf8"
          />
        </svg>
      </section>

      {/* CONTENT */}
      <section className="ctv2-content">
        <Container>
          <Row className="g-4">
            {/* FORM */}
            <Col lg={7}>
              <motion.div
                className="ctv2-form-card"
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <svg
                  className="ctv2-deco-leaf ctv2-deco-leaf-1"
                  viewBox="0 0 100 100"
                  aria-hidden
                >
                  <path
                    d="M85,15 C60,15 25,40 15,85 C55,85 90,55 85,15 Z"
                    fill="#16a34a"
                    opacity="0.05"
                  />
                </svg>
                <svg
                  className="ctv2-deco-leaf ctv2-deco-leaf-2"
                  viewBox="0 0 100 100"
                  aria-hidden
                >
                  <path
                    d="M85,15 C60,15 25,40 15,85 C55,85 90,55 85,15 Z"
                    fill="#16a34a"
                    opacity="0.04"
                  />
                </svg>

                <h2 className="ctv2-form-title">
                  Gửi tin nhắn
                  <span className="ctv2-title-underline" />
                </h2>
                <p className="ctv2-form-sub">
                  Điền thông tin bên dưới để chúng tôi có thể hỗ trợ bạn tốt nhất
                </p>

                <Form onSubmit={handleSubmit} className="ctv2-form">
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Họ và tên *</Form.Label>
                        <Form.Control
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          placeholder="Nhập họ và tên"
                          required
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Email *</Form.Label>
                        <Form.Control
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          placeholder="Nhập email của bạn"
                          required
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Số điện thoại *</Form.Label>
                        <Form.Control
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleChange}
                          placeholder="Nhập số điện thoại"
                          required
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Công ty / Tổ chức</Form.Label>
                        <Form.Control
                          type="text"
                          name="company"
                          value={formData.company}
                          onChange={handleChange}
                          placeholder="Nhập tên công ty (nếu có)"
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  <Form.Group className="mb-4">
                    <Form.Label>Nội dung tin nhắn *</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={5}
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      placeholder="Nhập nội dung bạn muốn trao đổi..."
                      required
                    />
                  </Form.Group>

                  <button type="submit" className="ctv2-submit-btn">
                    <FiSend /> Gửi tin nhắn
                  </button>
                </Form>
              </motion.div>
            </Col>

            {/* INFO */}
            <Col lg={5}>
              <motion.div
                className="ctv2-info-card"
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.15 }}
              >
                <h3 className="ctv2-info-title">
                  Thông tin liên hệ
                  <span className="ctv2-title-underline" />
                </h3>

                {infoItems.map((item, idx) => (
                  <motion.div
                    className="ctv2-info-item"
                    key={idx}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + idx * 0.08 }}
                  >
                    <span className="ctv2-info-icon">{item.icon}</span>
                    <div>
                      <h4>{item.title}</h4>
                      {item.lines.map((line, i) => (
                        <p key={i}>{line}</p>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </motion.div>

              <motion.div
                className="ctv2-social-card"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
              >
                <h4 className="ctv2-social-title">Kết nối với chúng tôi</h4>
                <div className="ctv2-social-icons">
                  {socials.map((s) => (
                    <motion.span
                      key={s.key}
                      className={`ctv2-social-icon ctv2-social-${s.key}`}
                      whileHover={{ y: -4, scale: 1.05 }}
                    >
                      {s.icon}
                    </motion.span>
                  ))}
                </div>
              </motion.div>
            </Col>
          </Row>
        </Container>
      </section>

      {/* Wave transition into footer */}
      <div className="ctv2-footer-wave">
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

export default Contact;
