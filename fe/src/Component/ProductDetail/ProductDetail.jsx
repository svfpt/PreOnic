import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FiMapPin, FiStar, FiClock, FiShield, FiCheckCircle, FiAward,
  FiMessageSquare, FiUsers, FiFileText
} from "react-icons/fi";
import Navbar from "../Navbar/Navbar";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";
import { ROUTES, TOAST_DURATION, REGIONS } from "../../constants";
import { formatPrice, formatPriceRange } from "../../data/products";
import productService, { resolveImageUrl } from "../../services/product.service";
import "./ProductDetail.css";

// Role guard helper
const ROLE = { GUEST: "guest", FARMER: "farmer", ENTERPRISE: "enterprise" };

// Fill defaults for fields that API products may not have
const toUiProductDetail = (p) => ({
  id: p._id || p.id,
  name: p.name,
  location: p.location || "Việt Nam",
  farm: p.farm || "-",
  category: p.category || "other",
  region: (p.region || "south").toLowerCase(),
  priceMin: p.priceMin || 0,
  priceMax: p.priceMax || p.priceMin || 0,
  unit: p.unit || "kg",
  progress: p.progress || 0,
  remaining: p.remaining ?? p.totalQuantity ?? 0,
  totalQuantity: p.totalQuantity || 0,
  rating: p.rating || 4.5,
  reviewCount: p.reviewCount || 0,
  image: resolveImageUrl(p.image) || "/images/products/default.jpg",
  badge: p.badge || null,
  expectedDate: p.expectedDate || "Quanh năm",
  certifications: p.certifications || [],
  description: p.description || "Sản phẩm nông sản chất lượng cao từ nông dân Việt Nam.",
  nutritionInfo: p.nutritionInfo || "Thông tin dinh dưỡng đang được cập nhật.",
  commitments: p.commitments || ["Đảm bảo chất lượng đã cam kết", "Giao hàng đúng hạn", "Hỗ trợ sau bán hàng"],
  seller: p.seller || {
    name: p.farmerId?.fullName || p.farmerName || "Nông dân",
    rating: 4.5,
    totalContracts: 0,
    avatar: "ND",
  },
});

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { isLoggedIn, user } = useAuth();
  const [product, setProduct] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [quantity, setQuantity] = useState(1000);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });
  const [reviews, setReviews] = useState([]);
  const [myRating, setMyRating] = useState(5);
  const [myReviewText, setMyReviewText] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  // Determine role
  const role = !isLoggedIn ? ROLE.GUEST
    : user?.role === "enterprise" ? ROLE.ENTERPRISE
    : ROLE.FARMER;

  const isEnterprise = role === ROLE.ENTERPRISE;
  const isFarmer = role === ROLE.FARMER;
  const isOwner = isFarmer && product?.createdBy &&
    (user?.id === product.createdBy || user?._id === product.createdBy);

  useEffect(() => {
    if (!isLoggedIn) {
      toast.warning("Vui lòng đăng nhập để xem chi tiết sản phẩm", TOAST_DURATION.DEFAULT);
      navigate(ROUTES.AUTH);
      return;
    }
    const load = async () => {
      try {
        const res = await productService.getById(id);
        if (res?.data?.product) {
          setProduct(toUiProductDetail(res.data.product));
          // Try to load similar products from API
          try {
            const simRes = await productService.getSimilar(id);
            if (Array.isArray(simRes?.data?.products)) {
              setSimilar(simRes.data.products.map(toUiProductDetail));
            }
          } catch { /* ignore */ }
          window.scrollTo(0, 0);
          return;
        }
      } catch {
        toast.error("Không tìm thấy sản phẩm", TOAST_DURATION.DEFAULT);
        navigate(ROUTES.PRODUCTS);
        return;
      }
      window.scrollTo(0, 0);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, navigate, isLoggedIn]);

  // Countdown timer (simulated: next harvest date)
  useEffect(() => {
    if (!product?.expectedDate || product.expectedDate === "Quanh năm") return;
    // Support both DD/MM/YYYY (static data) and YYYY-MM-DD (API/ISO)
    let target;
    if (/^\d{4}-\d{2}-\d{2}/.test(product.expectedDate)) {
      target = new Date(product.expectedDate);
    } else {
      const parts = product.expectedDate.split("/");
      target = new Date(parts[2], parts[1] - 1, parts[0]);
    }
    if (isNaN(target.getTime())) return;
    const timer = setInterval(() => {
      const now = new Date();
      const diff = Math.max(0, target - now);
      setCountdown({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        mins: Math.floor((diff % 3600000) / 60000),
        secs: Math.floor((diff % 60000) / 1000),
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [product]);

  // Load reviews when product is available
  useEffect(() => {
    if (!id) return;
    const loadReviews = async () => {
      try {
        const res = await productService.getReviews(id);
        if (Array.isArray(res?.data?.reviews)) {
          setReviews(res.data.reviews);
        }
      } catch { /* ignore */ }
    };
    loadReviews();
  }, [id]);

  if (!product) return null;

  const region = REGIONS[product.region.toUpperCase()] || REGIONS.SOUTH;
  const committedPct = product.totalQuantity > 0
    ? Math.min(100, ((product.totalQuantity - product.remaining) / product.totalQuantity) * 100)
    : (product.progress || 0);
  const remainPct = (100 - committedPct).toFixed(1);

  // Real review distribution from fetched reviews
  const distribution = [5, 4, 3, 2, 1].map(star => {
    const count = reviews.filter(r => r.rating === star).length;
    return { star, count, percent: reviews.length > 0 ? Math.round((count / reviews.length) * 100) : 0 };
  });

  const alreadyReviewed = reviews.some(
    r => r.reviewerId === user?.id || r.reviewerId === user?._id
  );

  const handleSubmitReview = async () => {
    if (!myReviewText.trim()) {
      toast.warning("Vui lòng nhập nội dung đánh giá.");
      return;
    }
    setSubmittingReview(true);
    try {
      const res = await productService.addReview(product.id, { rating: myRating, text: myReviewText });
      if (res?.data?.review) {
        setReviews(prev => [res.data.review, ...prev]);
        setMyReviewText("");
        setMyRating(5);
        toast.success("Đánh giá của bạn đã được ghi nhận!");
        // Update local product rating
        setProduct(prev => ({
          ...prev,
          rating: res.data.review.rating,
          reviewCount: (prev.reviewCount || 0) + 1,
        }));
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Không thể gửi đánh giá. Vui lòng thử lại.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleGoContract = () => {
    navigate(`${ROUTES.CONTRACT_FLOW}?product=${product.id}`);
  };

  const handleOpenMessaging = () => {
    const partnerId = product?.seller?.userId?._id || product?.seller?.userId;
    const partnerName = product?.seller?.name || "";

    if (!partnerId || isOwner) {
      navigate(ROUTES.MESSAGING);
      return;
    }

    navigate(
      `${ROUTES.MESSAGING}?partnerId=${encodeURIComponent(partnerId)}&partnerName=${encodeURIComponent(partnerName)}`
    );
  };

  return (
    <motion.div className="product-detail-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Navbar />

      <div className="pd-container">
        {/* BREADCRUMB */}
        <div className="pd-breadcrumb">
          <span onClick={() => navigate(ROUTES.HOME)}>Trang chủ</span>
          <span className="sep">›</span>
          <span onClick={() => navigate(ROUTES.PRODUCTS)}>Sản phẩm</span>
          <span className="sep">›</span>
          <span className="current">{product.name}</span>
        </div>

        {/* MAIN CONTENT */}
        <div className="pd-main">
          {/* LEFT: IMAGE + INFO */}
          <div className="pd-left">
            <motion.div className="pd-image-wrap" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <img src={product.image} alt={product.name} />
              {product.badge && <span className="pd-badge">{product.badge}</span>}
              <span className="pd-region-tag" style={{ background: region.color }}>
                {region.icon} {region.label}
              </span>
            </motion.div>

            {/* DESCRIPTION */}
            <div className="pd-description">
              <h3>Mô tả sản phẩm</h3>
              <p>{product.description}</p>
              <h4>Thông tin dinh dưỡng</h4>
              <p>{product.nutritionInfo}</p>
              <h4>Chứng nhận</h4>
              <div className="pd-certs">
                {product.certifications.map((c, i) => (
                  <span key={i} className="cert-tag">{c}</span>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: PURCHASE PANEL */}
          <div className="pd-right">
            <motion.div className="pd-purchase" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
              {/* Owner badge for farmer who created this product */}
              {isOwner && (
                <div className="pd-owner-badge">Đây là sản phẩm của bạn</div>
              )}

              <h1 className="pd-name">{product.name}</h1>
              <p className="pd-location"><FiMapPin size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />{product.location} • {product.farm}</p>

              {/* RATING */}
              <div className="pd-rating">
                <div className="stars">
                  {[1, 2, 3, 4, 5].map(s => (
                    <span key={s} className={s <= Math.round(product.rating) ? "star filled" : "star"}>★</span>
                  ))}
                </div>
                <span className="rating-num">{product.rating}</span>
                <span className="review-count">({product.reviewCount} đánh giá)</span>
              </div>

              {/* PRICE */}
              <div className="pd-price">
                <span className="price-range">{formatPriceRange(product.priceMin, product.priceMax)}</span>
                <span className="price-unit">/{product.unit}</span>
              </div>

              {/* PROGRESS BAR — purchase overview */}
              <div className="pd-progress-section">
                <div className="progress-header">
                  <span>Đã cam kết</span>
                  <span className="progress-pct">{committedPct.toFixed(1)}%</span>
                </div>
                <div className="pd-progress-bar">
                  <div className="pd-progress-fill" style={{ width: `${committedPct}%` }} />
                </div>
                <div className="progress-stats">
                  <span>• Còn lại: <strong>{product.remaining.toLocaleString()} {product.unit}</strong></span>
                  <span>Tổng: {product.totalQuantity.toLocaleString()} {product.unit}</span>
                </div>
              </div>

              {/* FARMER: progress detail panel */}
              {isFarmer && (
                <div className="pd-farmer-progress-detail">
                  <div className="fpd-item">
                    <span className="fpd-label">Đã được cam kết</span>
                    <span className="fpd-val fpd-done">{committedPct.toFixed(1)}%</span>
                  </div>
                  <div className="fpd-item">
                    <span className="fpd-label">Còn trống</span>
                    <span className="fpd-val fpd-open">{remainPct}%</span>
                  </div>
                  <div className="fpd-item">
                    <span className="fpd-label">Số lượng còn lại</span>
                    <span className="fpd-val">{product.remaining.toLocaleString()} {product.unit}</span>
                  </div>
                  <div className="fpd-item">
                    <span className="fpd-label">Tổng sản lượng</span>
                    <span className="fpd-val">{product.totalQuantity.toLocaleString()} {product.unit}</span>
                  </div>
                  {isOwner && (
                    <div className="pd-owner-info-box">
                      <p>Bạn là người đăng sản phẩm này. Các doanh nghiệp có thể đăng ký bao tiêu và gửi hợp đồng cho bạn.</p>
                    </div>
                  )}
                </div>
              )}

              {/* COUNTDOWN — shown to all roles */}
              {product.expectedDate !== "Quanh năm" && (
                <div className="pd-countdown">
                  <p className="countdown-label"><FiClock size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />Thu hoạch dự kiến: {product.expectedDate}</p>
                  <div className="countdown-boxes">
                    <div className="cd-box"><span className="cd-num">{countdown.days}</span><span className="cd-label">Ngày</span></div>
                    <div className="cd-box"><span className="cd-num">{countdown.hours}</span><span className="cd-label">Giờ</span></div>
                    <div className="cd-box"><span className="cd-num">{countdown.mins}</span><span className="cd-label">Phút</span></div>
                    <div className="cd-box"><span className="cd-num">{countdown.secs}</span><span className="cd-label">Giây</span></div>
                  </div>
                </div>
              )}

              {/* ENTERPRISE ONLY: quantity + seller + action buttons */}
              {isEnterprise && (
                <>
                  <div className="pd-quantity">
                    <label>Số lượng cam kết ({product.unit})</label>
                    <div className="qty-input">
                      <button onClick={() => setQuantity(Math.max(100, quantity - 500))}>−</button>
                      <input type="number" value={quantity} onChange={(e) => setQuantity(Math.max(100, Number(e.target.value)))} />
                      <button onClick={() => setQuantity(Math.min(product.remaining, quantity + 500))}>+</button>
                    </div>
                    <p className="qty-estimate">
                      Giá ước tính: <strong>{formatPrice(quantity * product.priceMin)} – {formatPrice(quantity * product.priceMax)}</strong>
                    </p>
                  </div>

                  <div className="pd-seller">
                    <div className="seller-avatar">{product.seller.avatar}</div>
                    <div className="seller-info">
                      <p className="seller-name">{product.seller.name}</p>
                      <p className="seller-meta"><FiStar size={12} style={{ marginRight: 2, verticalAlign: 'middle' }} />{product.seller.rating} • {product.seller.totalContracts} hợp đồng</p>
                    </div>
                    <button className="btn-message" onClick={handleOpenMessaging}><FiMessageSquare size={14} style={{ marginRight: 4 }} />Nhắn tin</button>
                  </div>

                  <button className="btn-commit" onClick={handleGoContract}><FiUsers size={15} style={{ marginRight: 6 }} />Đăng ký Bao tiêu</button>
                  <button className="btn-view-contracts" onClick={() => navigate(ROUTES.ENTERPRISE)}>
                    <FiFileText size={14} style={{ marginRight: 4 }} />Xem hợp đồng của tôi
                  </button>
                </>
              )}

              {/* FARMER: view seller info (for non-owner) */}
              {isFarmer && !isOwner && (
                <div className="pd-farmer-info-box">
                  <div className="seller-avatar">{product.seller.avatar}</div>
                  <div className="seller-info">
                    <p className="seller-name">{product.seller.name}</p>
                    <p className="seller-meta"><FiStar size={12} style={{ marginRight: 2, verticalAlign: 'middle' }} />{product.seller.rating} • {product.seller.totalContracts} hợp đồng</p>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>

        {/* COMMITMENTS SECTION */}
        <div className="pd-commitments">
          <h2><FiShield size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />Cam kết từ nhà sản xuất</h2>
          <div className="commitments-grid">
            {product.commitments.map((c, i) => (
              <motion.div key={i} className="commitment-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                <span className="commit-icon"><FiCheckCircle size={20} /></span>
                <p>{c}</p>
              </motion.div>
            ))}
          </div>
          <div className="preonc-guarantee">
            <span className="guarantee-icon"><FiAward size={28} /></span>
            <div>
              <h4>Bảo đảm bởi PreOnic</h4>
              <p>Mọi giao dịch trên PreOnic đều được bảo vệ bởi hệ thống ký quỹ. Nếu nhà sản xuất vi phạm cam kết, bạn sẽ được hoàn tiền 100% qua PreOnic Escrow.</p>
            </div>
          </div>
        </div>

        {/* RATING SECTION */}
        <div className="pd-reviews">
          <h2>Đánh giá từ người mua ({reviews.length})</h2>
          {reviews.length > 0 ? (
            <div className="rating-overview">
              <div className="rating-big">
                <span className="rating-number">{product.rating}</span>
                <div className="rating-stars">
                  {[1, 2, 3, 4, 5].map(s => (
                    <span key={s} className={s <= Math.round(product.rating) ? "star filled" : "star"}>★</span>
                  ))}
                </div>
                <span className="total-reviews">{reviews.length} đánh giá</span>
              </div>
              <div className="rating-bars">
                {distribution.map(r => (
                  <div key={r.star} className="rating-bar-row">
                    <span>{r.star}★</span>
                    <div className="rbar">
                      <div className="rbar-fill" style={{ width: `${r.percent}%` }} />
                    </div>
                    <span>{r.percent}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="pd-no-reviews">Chưa có đánh giá nào. Hãy là người đầu tiên đánh giá sản phẩm này!</p>
          )}

          {/* Review submission form — Enterprise users only */}
          {isEnterprise && !alreadyReviewed && (
            <div className="pd-review-form">
              <h4>Viết đánh giá của bạn</h4>
              <div className="review-star-select">
                {[1, 2, 3, 4, 5].map(s => (
                  <span
                    key={s}
                    className={s <= myRating ? "star filled clickable" : "star clickable"}
                    onClick={() => setMyRating(s)}
                  >★</span>
                ))}
              </div>
              <textarea
                className="review-textarea"
                rows={3}
                placeholder="Chia sẻ trải nghiệm của bạn về sản phẩm này..."
                value={myReviewText}
                onChange={e => setMyReviewText(e.target.value)}
                maxLength={1000}
              />
              <button
                className="btn-submit-review"
                onClick={handleSubmitReview}
                disabled={submittingReview}
              >
                {submittingReview ? "Đang gửi..." : "Gửi đánh giá"}
              </button>
            </div>
          )}

          {isEnterprise && alreadyReviewed && (
            <p className="pd-already-reviewed">Bạn đã đánh giá sản phẩm này rồi.</p>
          )}

          {/* Reviews list */}
          {reviews.length > 0 && (
            <div className="reviews-list">
              {reviews.map((review, i) => (
                <div key={review._id || i} className="review-card">
                  <div className="review-header">
                    <div className="review-user">
                      <div className="review-avatar">{review.reviewerAvatar || review.reviewerName?.charAt(0)}</div>
                      <div>
                        <p className="review-name">{review.reviewerName}</p>
                        <p className="review-date">{new Date(review.createdAt).toLocaleDateString("vi-VN")}</p>
                      </div>
                    </div>
                    <div className="review-stars">
                      {[1, 2, 3, 4, 5].map(s => (
                        <span key={s} className={s <= review.rating ? "star filled" : "star"}>★</span>
                      ))}
                    </div>
                  </div>
                  <p className="review-text">{review.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SIMILAR PRODUCTS */}
        {similar.length > 0 && (
          <div className="pd-similar">
            <h2>Sản phẩm tương tự</h2>
            <div className="similar-grid">
              {similar.map(p => (
                <motion.div key={p.id} className="similar-card" whileHover={{ y: -5 }}
                  onClick={() => navigate(`/products/${p.id}`)}>
                  <img src={p.image} alt={p.name} />
                  <div className="similar-info">
                    <h4>{p.name}</h4>
                    <p className="sim-location"><FiMapPin size={12} style={{ marginRight: 3, verticalAlign: 'middle' }} />{p.location}</p>
                    <p className="sim-price">{formatPriceRange(p.priceMin, p.priceMax)}/{p.unit}</p>
                    <div className="sim-rating"><FiStar size={12} style={{ marginRight: 2, verticalAlign: 'middle' }} />{p.rating} ({p.reviewCount})</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ProductDetail;
