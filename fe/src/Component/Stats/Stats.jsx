import { Container, Row, Col } from "react-bootstrap";
import { motion, useInView } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import "./Stats.css";

// Animated counter component
const AnimatedNumber = ({ value, suffix = "", duration = 2000 }) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  
  useEffect(() => {
    if (!isInView) return;
    
    const numericValue = parseFloat(value.replace(/[^0-9.]/g, ''));
    const increment = numericValue / (duration / 16);
    let current = 0;
    
    const timer = setInterval(() => {
      current += increment;
      if (current >= numericValue) {
        setCount(numericValue);
        clearInterval(timer);
      } else {
        setCount(current);
      }
    }, 16);
    
    return () => clearInterval(timer);
  }, [isInView, value, duration]);

  const formatValue = () => {
    if (value.includes('k')) {
      return count.toFixed(1) + 'k';
    } else if (value.includes('M')) {
      return '$' + count.toFixed(0) + 'M';
    } else if (value.includes('%')) {
      return count.toFixed(0) + '%';
    }
    return count.toFixed(1);
  };

  return <span ref={ref}>{formatValue()}{suffix}</span>;
};

function Stats() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const leftVariants = {
    hidden: { opacity: 0, x: -50 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.6, ease: "easeOut" }
    }
  };

  const rightVariants = {
    hidden: { opacity: 0, x: 50 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.6, ease: "easeOut" }
    }
  };

  const statItemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4 }
    }
  };

  const statsData = [
    { value: "12.5k", label: "Tấn sản lượng", suffix: "+" },
    { value: "4.2k", label: "Nông dân tham gia", suffix: "" },
    { value: "45M", label: "Giá trị giao dịch", suffix: "" },
    { value: "100%", label: "Truy xuất nguồn gốc", suffix: "" }
  ];

  return (
    <section className="stats-section">
      <Container>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={containerVariants}
        >
          <Row className="stats-wrapper align-items-center">
            {/* LEFT */}
            <Col md={6} className="stats-left">
              <motion.div variants={leftVariants}>
                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                >
                  Số liệu ấn tượng của <br />
                  <motion.span
                    initial={{ backgroundSize: "0% 100%" }}
                    whileInView={{ backgroundSize: "100% 100%" }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                  >
                    Nền tảng PreOnic
                  </motion.span>
                </motion.h2>

                <motion.p
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  PreOnic sử dụng phân tích dữ liệu tiên tiến và các hợp đồng
                  cam kết trực tiếp để ổn định chuỗi cung ứng thực phẩm,
                  đảm bảo thu nhập công bằng cho mọi thành phần tham gia.
                </motion.p>

                <Row className="stats-numbers">
                  {statsData.map((stat, index) => (
                    <Col xs={6} key={index}>
                      <motion.div
                        variants={statItemVariants}
                        whileHover={{ scale: 1.05 }}
                        transition={{ duration: 0.2 }}
                      >
                        <h3>
                          <AnimatedNumber value={stat.value} suffix={stat.suffix} />
                        </h3>
                        <span>{stat.label}</span>
                      </motion.div>
                    </Col>
                  ))}
                </Row>
              </motion.div>
            </Col>

            {/* RIGHT */}
            <Col md={6} className="stats-right">
              <motion.div 
                className="dashboard-card"
                variants={rightVariants}
              >
                <motion.img
                  src="/BD.png"
                  alt="Dashboard"
                  className="dashboard-img"
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.3 }}
                />

                <motion.div 
                  className="floating-card"
                  initial={{ opacity: 0, y: 30, scale: 0.9 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ 
                    duration: 0.5, 
                    delay: 0.5,
                    type: "spring",
                    stiffness: 150
                  }}
                  animate={{
                    y: [0, -8, 0],
                  }}
                  // @ts-ignore
                  whileHover={{ scale: 1.05 }}
                >
                  <div className="floating-icon"></div>
                  <div className="floating-text">
                    <strong>Phân tích thị trường</strong>
                    <span>Thời gian thực cho giá tốt nhất</span>
                  </div>
                </motion.div>
              </motion.div>
            </Col>
          </Row>
        </motion.div>
      </Container>
    </section>
  );
}

export default Stats;
