import { useState, useEffect } from "react";
import { Container, Row, Col, Card, Button, ProgressBar } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { FiMapPin } from "react-icons/fi";
import { motion } from "framer-motion";
import { ROUTES } from "../../constants";
import productService, { resolveImageUrl } from "../../services/product.service";
import "./Products.css";

function Products() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);

  useEffect(() => {
    productService.getAll({ limit: 3 })
      .then(res => {
        const list = res?.data?.products || res?.data || [];
        setProducts(list.slice(0, 3).map(p => ({
          id: p._id || p.id,
          name: p.name,
          location: p.location || "Việt Nam",
          progress: p.progress || 0,
          harvest: p.expectedDate ? `Tháng ${new Date(p.expectedDate).getMonth() + 1}/${new Date(p.expectedDate).getFullYear()}` : "Quanh năm",
          tag: (p.certifications && p.certifications[0]) || p.badge || "Nông sản",
          image: resolveImageUrl(p.image) || "/images/products/default.jpg",
        })));
      })
      .catch(() => {});
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
    <section className="products-section">
      <Container>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          variants={containerVariants}
        >
          {/* HEADER */}
          <motion.div className="products-header" variants={headerVariants}>
            <div>
              <h2>Mùa vụ đang mở đăng ký</h2>
              <p>Cơ hội đầu tư và bao tiêu sản phẩm chất lượng cao</p>
            </div>
            <motion.span 
              className="view-all" 
              onClick={() => navigate(ROUTES.PRODUCTS)}
              whileHover={{ x: 5, color: "#13ec37" }}
              transition={{ duration: 0.2 }}
            >
              Xem tất cả →
            </motion.span>
          </motion.div>

          {/* PRODUCTS */}
          <Row>
            {products.length === 0 && <Col className="text-center py-5" style={{ color: '#888' }}>Đang tải sản phẩm...</Col>}
            {products.map((product, index) => (
              <Col md={4} key={product.id} className="mb-4">
                <motion.div
                  variants={cardVariants}
                  whileHover={{ 
                    y: -12,
                    boxShadow: "0 25px 50px rgba(0, 0, 0, 0.15)"
                  }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="product-card">
                    {/* IMAGE */}
                    <motion.div 
                      className="product-img-wrapper"
                      whileHover={{ scale: 1.02 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Card.Img
                        src={product.image}
                        alt={product.name}
                        className="product-img"
                      />
                      <motion.span 
                        className="product-badge"
                        initial={{ scale: 0, rotate: -10 }}
                        whileInView={{ scale: 1, rotate: 0 }}
                        viewport={{ once: true }}
                        transition={{ 
                          type: "spring", 
                          stiffness: 200,
                          delay: 0.3 + index * 0.1
                        }}
                      >
                        {product.tag}
                      </motion.span>
                    </motion.div>

                    {/* CONTENT */}
                    <Card.Body>
                      <Card.Title>{product.name}</Card.Title>

                      <p className="product-location">
                        <FiMapPin size={13} style={{ marginRight: 3, verticalAlign: 'middle' }} />{product.location}
                      </p>

                      {/* PROGRESS */}
                      <div className="progress-label">
                        <span>TIẾN ĐỘ BAO TIÊU</span>
                        <motion.span
                          initial={{ opacity: 0 }}
                          whileInView={{ opacity: 1 }}
                          viewport={{ once: true }}
                          transition={{ delay: 0.5 }}
                        >
                          {product.progress}%
                        </motion.span>
                      </div>

                      <ProgressBar
                        now={product.progress}
                        className="custom-progress"
                      />

                      <small className="text-muted d-block mt-2">
                        Dự kiến thu hoạch: {product.harvest}
                      </small>

                      {/* BUTTON */}
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Button
                          className="w-100 mt-3 btn-register"
                          onClick={() => navigate(`${ROUTES.PRODUCTS}/${product.id}`)}
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

export default Products;
