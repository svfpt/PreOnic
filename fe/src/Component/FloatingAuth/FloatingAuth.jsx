import "./FloatingAuth.css";
import { FaBuilding, FaSeedling } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ROUTES } from "../../constants";

const containerVariants = {
  initial: { opacity: 0, x: 50 },
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.5,
      staggerChildren: 0.15
    }
  }
};

const buttonVariants = {
  initial: { opacity: 0, scale: 0 },
  animate: { 
    opacity: 1, 
    scale: 1,
    transition: { type: "spring", stiffness: 400, damping: 15 }
  },
  hover: {
    scale: 1.15,
    y: -5,
    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.2)"
  },
  tap: { scale: 0.9 }
};

const FloatingAuth = () => {
  const navigate = useNavigate();

  return (
    <motion.div 
      className="floating-auth"
      variants={containerVariants}
      initial="initial"
      animate="animate"
    >
      {/* DOANH NGHIỆP */}
      <motion.button
        className="auth-btn auth-enterprise"
        title="Doanh nghiệp"
        onClick={() => navigate(ROUTES.ENTERPRISE)}
        variants={buttonVariants}
        whileHover="hover"
        whileTap="tap"
      >
        <FaBuilding />
      </motion.button>

      {/* NÔNG DÂN */}
      <motion.button
        className="auth-btn auth-farmer"
        title="Nông dân"
        onClick={() => navigate(ROUTES.FARMER)}
        variants={buttonVariants}
        whileHover="hover"
        whileTap="tap"
      >
        <FaSeedling />
      </motion.button>
    </motion.div>
  );
};

export default FloatingAuth;
