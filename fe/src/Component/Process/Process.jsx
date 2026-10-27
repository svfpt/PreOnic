import { Container, Row, Col, Card } from "react-bootstrap";
import { motion } from "framer-motion";
import "./Process.css";

const Process = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.2
      }
    }
  };

  const titleVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { 
        duration: 0.6, 
        ease: "easeOut"
      }
    }
  };

  const iconVariants = {
    hidden: { scale: 0, rotate: -180 },
    visible: {
      scale: 1,
      rotate: 0,
      transition: { 
        type: "spring",
        stiffness: 200,
        damping: 15,
        delay: 0.2
      }
    }
  };

  return (
    <section className="process-section">
      <Container>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={containerVariants}
        >
          <motion.h2 
            className="process-title text-center"
            variants={titleVariants}
          >
            Quy trình bao tiêu minh bạch
          </motion.h2>
          <motion.p 
            className="process-subtitle text-center"
            variants={titleVariants}
          >
            Kết nối nông dân – doanh nghiệp – người tiêu dùng qua nền tảng số
          </motion.p>

          <Row className="mt-4">
            {[
              {
                icon: "icon-plant",
                title: "Đăng ký sản xuất",
                text: "Nông dân đăng ký mùa vụ, sản lượng và tiêu chuẩn chất lượng."
              },
              {
                icon: "icon-handshake",
                title: "Ký cam kết bao tiêu",
                text: "Doanh nghiệp ký hợp đồng trước mùa vụ, giá cả minh bạch."
              },
              {
                icon: "icon-truck",
                title: "Thu hoạch & phân phối",
                text: "Thu hoạch đúng chuẩn, giao hàng và thanh toán an toàn."
              }
            ].map((item, index) => (
              <Col md={4} key={index}>
                <motion.div
                  variants={cardVariants}
                  whileHover={{ 
                    y: -10,
                    boxShadow: "0 20px 40px rgba(19, 236, 55, 0.15)"
                  }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="process-card">
                    <motion.div 
                      className={`process-icon ${item.icon}`}
                      variants={iconVariants}
                      whileHover={{ 
                        scale: 1.1,
                        rotate: 10
                      }}
                    />
                    <Card.Body>
                      <Card.Title>{item.title}</Card.Title>
                      <Card.Text>{item.text}</Card.Text>
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
};

export default Process;
