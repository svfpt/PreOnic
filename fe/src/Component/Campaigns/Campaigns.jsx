import { useState, useEffect } from "react";
import { Container, Row, Col, Card, Button } from "react-bootstrap";
import { motion } from "framer-motion";
import { FiMapPin } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../constants";
import productService, { resolveImageUrl } from "../../services/product.service";
import "./Campaigns.css";

function Campaigns() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    productService.getAll({ limit: 3, sort: '-createdAt' })
      .then(res => {
        // API trả về { success, data: { products: [...] } } hoặc { success, products: [...] }
        const raw = res?.data?.products || res?.products || res?.data || [];
        const list = Array.isArray(raw) ? raw : [];
        setCampaigns(list.slice(0, 3).map(p => ({
          id: p._id || p.id,
          name: p.name,
          location: p.location || "Việt Nam",
          image: resolveImageUrl(p.image) || "/images/products/default.jpg",
          progress: typeof p.progress === 'number' ? p.progress : 0,
          harvest: p.expectedDate
            ? `Dự kiến thu hoạch: Tháng ${new Date(p.expectedDate).getMonth() + 1}/${new Date(p.expectedDate).getFullYear()}`
            : "Dự kiến thu hoạch: Quanh năm",
          tag: (p.certifications && p.certifications[0]) || p.badge || "Nông sản",
        })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2
      }
    }
  };

  const headerVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 40, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.5, ease: "easeOut" }
    }
  };

  return (
    <section className="campaigns-section">
      <Container>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          variants={containerVariants}
        >
          {/* HEADER */}
          <motion.div className="campaigns-header" variants={headerVariants}>
            <div className="header-left">
              <h2>Mùa vụ đang mở đăng ký</h2>
              <p>Cơ hội đầu tư và bao tiêu sản phẩm chất lượng cao</p>
            </div>
            <span className="view-all" onClick={() => navigate(ROUTES.PRODUCTS)} style={{ cursor: "pointer" }}>Xem tất cả →</span>
          </motion.div>

          {/* CAMPAIGNS CARDS */}
          <Row>
            {loading && (
              <Col className="text-center py-5">
                <div className="campaigns-loading">
                  <div className="campaigns-spinner" />
                  <p>Đang tải mùa vụ...</p>
                </div>
              </Col>
            )}
            {!loading && campaigns.length === 0 && (
              <Col className="text-center py-5">
                <div className="campaigns-empty">
                  <p>Hiện chưa có mùa vụ nào đang mở đăng ký.</p>
                  <button className="campaigns-empty-btn" onClick={() => navigate(ROUTES.PRODUCTS)}>
                    Xem tất cả sản phẩm
                  </button>
                </div>
              </Col>
            )}
            {campaigns.map((campaign) => (
              <Col md={4} key={campaign.id} className="mb-4">
                <motion.div
                  variants={cardVariants}
                  whileHover={{
                    y: -8,
                    boxShadow: "0 20px 40px rgba(21, 128, 61, 0.18)"
                  }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="campaign-card">
                    <div className="campaign-image-wrapper">
                      <Card.Img variant="top" src={campaign.image} alt={campaign.name} />
                      <span className="campaign-tag">{campaign.tag}</span>
                    </div>
                    <Card.Body>
                      <Card.Title className="campaign-name">{campaign.name}</Card.Title>
                      <p className="campaign-location"><FiMapPin size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />{campaign.location}</p>
                      
                      <div className="campaign-progress-section">
                        <div className="progress-header">
                          <span className="progress-label">TIẾN ĐỘ BAO TIÊU</span>
                          <span className="progress-percent">{parseFloat(campaign.progress.toFixed(2))}%</span>
                        </div>
                        <div className="progress-bar-custom">
                          <div 
                            className="progress-fill" 
                            style={{ width: `${campaign.progress}%` }}
                          ></div>
                        </div>
                      </div>

                      <p className="campaign-harvest">{campaign.harvest}</p>

                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Button
                          className="campaign-btn"
                          onClick={() => navigate(`${ROUTES.PRODUCTS}/${campaign.id}`)}
                        >
                          Đăng ký bao tiêu
                        </Button>
                      </motion.div>
                    </Card.Body>
                  </Card>
                </motion.div>
              </Col>
            ))}
          </Row>
        </motion.div>
      </Container>
    </section>
  );
}

export default Campaigns;
