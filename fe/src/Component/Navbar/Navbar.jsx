import { useState, useEffect } from "react";
import { Navbar, Nav, Container, Button } from "react-bootstrap";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { FiArrowRight } from "react-icons/fi";
import { LuLeaf } from "react-icons/lu";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { NAV_ITEMS, ROUTES, TOAST_DURATION } from "../../constants";
import BrandLogo from "../BrandLogo/BrandLogo";
import "./Navbar.css";

const NavbarComponent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isLoggedIn } = useAuth();
  const toast = useToast();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      toast.info("Bạn đã đăng xuất thành công. Hẹn gặp lại!", TOAST_DURATION.SHORT);
      navigate(ROUTES.HOME);
    } catch {
      toast.error("Có lỗi khi đăng xuất. Vui lòng thử lại!");
    }
  };

  const logoVariants = {
    hover: {
      scale: 1.05,
      transition: { duration: 0.2 }
    }
  };

  const navLinkVariants = {
    hover: {
      y: -2,
      color: "#13ec37",
      transition: { duration: 0.2 }
    }
  };

  const isHome = location.pathname === ROUTES.HOME;

  return (
    <motion.div
      className={`navbar-wrapper ${scrolled ? "scrolled" : ""} ${isHome ? "on-home" : "on-page"}`}
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <Navbar expand="lg" className="navbar-custom">
        <Container>
          <motion.div
            variants={logoVariants}
            whileHover="hover"
          >
            <Navbar.Brand 
              className="navbar-logo" 
              onClick={() => navigate(ROUTES.HOME)} 
              style={{ cursor: "pointer" }}
            >
              <BrandLogo size="sm" />
            </Navbar.Brand>
          </motion.div>

          <Navbar.Toggle />
          <Navbar.Collapse>
            <Nav className="mx-auto">
              {NAV_ITEMS.map((item, index) => (
                <motion.div
                  key={index}
                  variants={navLinkVariants}
                  whileHover="hover"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                  className="nav-item-wrapper"
                >
                  <Nav.Link 
                    onClick={() => navigate(item.path)}
                    className={location.pathname === item.path ? "active" : ""}
                  >
                    {item.label}
                    {location.pathname === item.path && (
                      <motion.div 
                        className="active-indicator"
                        layoutId="activeIndicator"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                  </Nav.Link>
                </motion.div>
              ))}
            </Nav>

            <div className="navbar-actions">
              {isLoggedIn ? (
                <>
                  {user?.role === "farmer" && (
                    <Button
                      className="navbar-dashboard-btn farmer-dash-btn"
                      onClick={() => navigate(ROUTES.FARMER)}
                    >
                      Trang Nông dân <LuLeaf className="dash-btn-icon" />
                    </Button>
                  )}
                  {user?.role === "enterprise" && (
                    <Button
                      className="navbar-dashboard-btn enterprise-dash-btn"
                      onClick={() => navigate(ROUTES.ENTERPRISE)}
                    >
                      Trang Doanh nghiệp <FiArrowRight className="dash-btn-icon" />
                    </Button>
                  )}
                  <span className="navbar-user-name">
                    {user?.fullName || user?.email}
                  </span>
                  <Button className="navbar-logout-btn" onClick={handleLogout}>
                    Đăng xuất <FiArrowRight className="logout-arrow" />
                  </Button>
                </>
              ) : (
                <>
                  <Button className="navbar-login-btn" onClick={() => navigate(ROUTES.AUTH)}>
                    Đăng nhập
                  </Button>
                  <Button className="navbar-register-btn" onClick={() => navigate(ROUTES.REGISTER)}>
                    Đăng ký
                  </Button>
                </>
              )}
            </div>
          </Navbar.Collapse>
        </Container>
      </Navbar>
    </motion.div>
  );
};

export default NavbarComponent;

