import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FiSearch, FiAlertTriangle, FiMapPin, FiStar, FiFeather } from "react-icons/fi";
import Navbar from "../Navbar/Navbar";
import { REGIONS, ROUTES } from "../../constants";
import { formatPriceRange } from "../../data/products";
import productService, { resolveImageUrl } from "../../services/product.service";
import { useAuth } from "../../contexts/AuthContext";
import "./AllProducts.css";

const CATEGORY_LABELS = {
  fruit: "Trái cây",
  vegetable: "Rau củ",
  coffee: "Cà phê",
  rice: "Lúa gạo",
  spice: "Gia vị",
  tea: "Chè",
  grain: "Ngũ cốc",
  other: "Khác",
};
const CATEGORY_ORDER = ["fruit", "vegetable", "coffee", "rice", "spice", "tea", "grain", "other"];

const regionList = [
  { key: "all", label: "Tất cả miền", icon: null },
  { key: "north", ...REGIONS.NORTH },
  { key: "central", ...REGIONS.CENTRAL },
  { key: "south", ...REGIONS.SOUTH },
];

// Normalize API product shape to the UI shape expected by this component
const toUiProduct = (p) => ({
  id: p._id || p.id,
  name: p.name,
  location: p.location || "Việt Nam",
  farm: p.farm || "-",
  category: p.category || "other",
  region: p.region || "south",
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
});

const AllProducts = () => {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [sortBy, setSortBy] = useState("popular");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await productService.getAll({ limit: 200 });
        if (cancelled) return;
        setProducts(Array.isArray(res?.data?.products) ? res.data.products.map(toUiProduct) : []);
      } catch {
        if (!cancelled) setError("Không thể tải danh sách sản phẩm. Vui lòng thử lại.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const dynamicCategories = useMemo(() => {
    const seen = new Set(products.map(p => p.category).filter(Boolean));
    const list = [{ key: "all", label: "Tất cả" }];
    CATEGORY_ORDER.forEach(k => { if (seen.has(k)) list.push({ key: k, label: CATEGORY_LABELS[k] }); });
    return list;
  }, [products]);

  const activeRegionInfo = regionList.find(r => r.key === selectedRegion);

  const filtered = useMemo(() => {
    let result = [...products];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(q) || p.location.toLowerCase().includes(q));
    }
    if (selectedCategory !== "all") result = result.filter(p => p.category === selectedCategory);
    if (selectedRegion !== "all") result = result.filter(p => p.region === selectedRegion);
    if (sortBy === "price-asc") result.sort((a, b) => a.priceMin - b.priceMin);
    else if (sortBy === "price-desc") result.sort((a, b) => b.priceMax - a.priceMax);
    else if (sortBy === "rating") result.sort((a, b) => b.rating - a.rating);
    else result.sort((a, b) => b.reviewCount - a.reviewCount);
    return result;
  }, [products, search, selectedCategory, selectedRegion, sortBy]);

  const getRegionObj = (key) => {
    const map = { north: REGIONS.NORTH, central: REGIONS.CENTRAL, south: REGIONS.SOUTH };
    return map[key] || REGIONS.SOUTH;
  };

  return (
    <motion.div className="allproducts-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Navbar />

      <div className="ap-container">
        <div className="ap-header">
          <h1>Sản phẩm Bao tiêu</h1>
          <p>Khám phá nông sản chất lượng cao từ khắp 3 miền Việt Nam</p>
        </div>

        {/* REGION SELECTOR */}
        <div className="ap-region-selector">
          {regionList.map(r => (
            <button
              key={r.key}
              className={`region-btn ${selectedRegion === r.key ? "active" : ""}`}
              style={selectedRegion === r.key && r.color ? { borderColor: r.color, background: r.color + "15" } : {}}
              onClick={() => setSelectedRegion(r.key)}
            >
              <span className="region-icon">{r.icon}</span>
              <span>{r.label}</span>
            </button>
          ))}
        </div>

        {/* REGION HIGHLIGHT BANNER */}
        <AnimatePresence mode="wait">
          {selectedRegion !== "all" && (
            <motion.div
              className="region-highlight"
              key={selectedRegion}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{ borderLeftColor: activeRegionInfo?.color }}
            >
              <span className="rh-icon">{activeRegionInfo?.icon}</span>
              <div>
                <h3>Đặc sản {activeRegionInfo?.label}</h3>
                <p>{activeRegionInfo?.highlight}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* FILTERS BAR */}
        <div className="ap-filters">
          <div className="ap-search">
            <FiSearch size={15} />
            <input placeholder="Tìm sản phẩm, địa điểm..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="ap-category-tabs">
            {dynamicCategories.map(c => (
              <button key={c.key} className={selectedCategory === c.key ? "active" : ""}
                onClick={() => setSelectedCategory(c.key)}>{c.label}</button>
            ))}
          </div>
          <select className="ap-sort" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="popular">Phổ biến nhất</option>
            <option value="rating">Đánh giá cao</option>
            <option value="price-asc">Giá thấp → cao</option>
            <option value="price-desc">Giá cao → thấp</option>
          </select>
        </div>

        {/* RESULT COUNT */}
        {!loading && !error && (
          <p className="ap-result-count">Tìm thấy <strong>{filtered.length}</strong> sản phẩm</p>
        )}

        {/* LOADING */}
        {loading && (
          <div className="ap-loading">
            <div className="ap-spinner" />
            <p>Đang tải sản phẩm...</p>
          </div>
        )}

        {/* ERROR */}
        {error && !loading && (
          <div className="ap-empty">
            <FiAlertTriangle size={38} />
            <p>{error}</p>
            <button className="ap-retry-btn" onClick={() => { setLoading(true); setError(null); productService.getAll({ limit: 200 }).then(res => setProducts(Array.isArray(res?.data?.products) ? res.data.products.map(toUiProduct) : [])).catch(() => setError("Không thể tải danh sách sản phẩm. Vui lòng thử lại.")).finally(() => setLoading(false)); }}>Thử lại</button>
          </div>
        )}

        {/* PRODUCT GRID */}
        {!loading && !error && (
        <div className="ap-grid">
          <AnimatePresence>
            {filtered.map(product => {
              const rgn = getRegionObj(product.region);
              return (
                <motion.div
                  key={product.id}
                  className="ap-card"
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  whileHover={{ y: -6, boxShadow: "0 12px 30px rgba(0,0,0,0.12)" }}
                  onClick={() => {
                    if (!isLoggedIn) { navigate(ROUTES.AUTH); return; }
                    navigate(`/products/${product.id}`);
                  }}
                >
                  <div className="ap-card-img">
                    <img src={product.image} alt={product.name} />
                    {product.badge && <span className="ap-badge">{product.badge}</span>}
                    <span className="ap-region-badge" style={{ background: rgn.color }}>{rgn.label}</span>
                  </div>
                  <div className="ap-card-body">
                    <h3>{product.name}</h3>
                    <p className="ap-card-location"><FiMapPin size={12} style={{ marginRight: 3, verticalAlign: 'middle' }} />{product.location} • {product.farm}</p>
                    <div className="ap-card-price">
                      {formatPriceRange(product.priceMin, product.priceMax)}
                      <span>/{product.unit}</span>
                    </div>
                    <div className="ap-card-meta">
                      <span className="ap-card-rating"><FiStar size={12} style={{ marginRight: 2, verticalAlign: 'middle' }} />{product.rating} ({product.reviewCount})</span>
                      <span className="ap-card-remaining">Còn {product.remaining.toLocaleString()}{product.unit}</span>
                    </div>
                    <div className="ap-card-progress">
                      <div className="ap-pbar">
                        <div className="ap-pfill" style={{ width: `${product.progress}%` }} />
                      </div>
                      <span>{parseFloat(product.progress.toFixed(2))}% cam kết</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="ap-empty">
            <FiFeather size={38} />
            <p>{products.length === 0 ? "Chưa có sản phẩm nào trong hệ thống." : "Không tìm thấy sản phẩm phù hợp. Hãy thử bộ lọc khác!"}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default AllProducts;
