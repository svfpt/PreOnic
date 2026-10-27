import { useEffect, useState } from "react";
import { FiFeather, FiMapPin, FiSearch, FiStar } from "react-icons/fi";
import { ROUTES } from "../../../constants";
import { formatPriceRange } from "../../../data/products";
import productService, { resolveImageUrl } from "../../../services/product.service";

const REGION_MAP = {
  north: "north",
  central: "central",
  south: "south",
  "Miền Bắc": "north",
  "Miền Trung": "central",
  "Miền Nam": "south",
};

export default function SanPhamContent({ navigate }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRegion, setFilterRegion] = useState("all");
  const [sortBy, setSortBy] = useState("popular");
  const [apiProducts, setApiProducts] = useState(null);

  useEffect(() => {
    productService.getAll({ limit: 100 }).then((res) => {
      // Fix: API returns res.data.products (array), not res.data (object)
      const items = (res?.data?.products || []).map((p) => ({
        id: p._id || p.id,
        name: p.name || p.productName || "Nông sản",
        location: p.location || p.origin || "Việt Nam",
        farm: p.farm || p.seller?.name || "",
        image: resolveImageUrl(p.image || p.images?.[0]) || "/images/products/default.jpg",
        badge: p.certifications?.[0] || p.badge || "",
        region: REGION_MAP[p.region] || "south",
        priceMin: p.priceMin || p.price || 0,
        priceMax: p.priceMax || p.price || 0,
        unit: p.unit || "kg",
        rating: p.rating || 0,
        reviewCount: p.reviewCount || p.reviews || 0,
        remaining: p.remaining || p.quantity || 0,
        progress: Math.min(100, Math.max(0, Number(p.progress) || 0)),
      }));
      setApiProducts(items);
    }).catch(() => setApiProducts([]));
  }, []);

  const source = apiProducts !== null ? apiProducts : [];
  const filtered = source.filter((p) => {
    const matchSearch = !searchQuery
      || p.name.toLowerCase().includes(searchQuery.toLowerCase())
      || (p.location || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchRegion = filterRegion === "all" || p.region === filterRegion;
    return matchSearch && matchRegion;
  });

  const handleViewDetail = (productId) => {
    navigate(`/products/${productId}`);
  };

  const handleCreateContract = (productId) => {
    navigate(`${ROUTES.CONTRACT_FLOW}?product=${productId}`);
  };

  const regionOptions = [
    { key: "all", label: "Tất cả miền" },
    { key: "north", label: "Miền Bắc" },
    { key: "central", label: "Miền Trung" },
    { key: "south", label: "Miền Nam" },
  ];

  return (
    <>
      {/* HEADER */}
      <div className="sp-header">
        <div className="sp-header-content">
          <h1 className="sp-title">Danh Sách Sản Phẩm Bao Tiêu</h1>
          <p className="sp-subtitle">Khám phá nông sản chất lượng cao từ khắp nơi. Cơ hội tốt nhất để tìm kiếm nguồn cung uy tín</p>
        </div>
      </div>

      {/* REGION TABS */}
      <div className="sp-regions">
        {regionOptions.map((r) => (
          <button
            key={r.key}
            className={`sp-region-btn ${filterRegion === r.key ? "active" : ""}`}
            onClick={() => setFilterRegion(r.key)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* FILTERS & SEARCH */}
      <div className="sp-controls">
        <div className="sp-search-wrapper">
          <FiSearch size={16} className="sp-search-icon" />
          <input
            type="text"
            placeholder="Tìm kiếm sản phẩm, vị trí..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="sp-search-input"
          />
        </div>
        <select className="sp-sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="popular">Phổ biến nhất</option>
          <option value="rating">Đánh giá cao</option>
          <option value="price-asc">Giá thấp → cao</option>
          <option value="price-desc">Giá cao → thấp</option>
        </select>
      </div>

      {/* RESULT COUNT */}
      {apiProducts !== null && (
        <div className="sp-result-info">
          <span className="sp-count">Tìm thấy <strong>{filtered.length}</strong> sản phẩm</span>
        </div>
      )}

      {/* PRODUCT GRID */}
      <div className="sp-grid">
        {apiProducts === null ? (
          <div className="sp-loading-state">
            <div className="sp-spinner" />
            <p>Đang tải sản phẩm...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="sp-empty-state">
            <FiFeather size={48} />
            <p>Không tìm thấy sản phẩm phù hợp</p>
            <span className="sp-empty-hint">Hãy thử thay đổi bộ lọc hoặc tìm kiếm khác</span>
          </div>
        ) : (
          filtered.map((product) => (
            <div key={product.id} className="sp-card">
              <div className="sp-card-img">
                <img src={product.image} alt={product.name} onError={(e) => { e.currentTarget.src = "/images/products/default.jpg"; }} />
                {product.badge && <span className="sp-badge">{product.badge}</span>}
                <div className="sp-progress-tag" style={{ width: `${product.progress}%` }}>
                  <span>{product.progress}%</span>
                </div>
              </div>
              <div className="sp-card-body">
                <div className="sp-location">
                  <FiMapPin size={12} />
                  {product.location}{product.farm && ` – ${product.farm}`}
                </div>
                <h3 className="sp-product-name">{product.name}</h3>
                <div className="sp-pricing-row">
                  <div className="sp-price">
                    {formatPriceRange(product.priceMin, product.priceMax)}
                    <span className="sp-unit">/{product.unit}</span>
                  </div>
                  <div className="sp-rating">
                    <FiStar size={13} fill="#fbbf24" />
                    <span>{product.rating}</span>
                  </div>
                </div>
                <div className="sp-stock-bar">
                  <div className="sp-stock-fill" style={{ width: Math.min(100, (product.remaining / 1000) * 100) }} />
                </div>
                <div className="sp-stock-info">Còn {product.remaining.toLocaleString()} {product.unit}</div>
                <div className="sp-actions">
                  <button className="sp-btn-secondary" onClick={() => handleViewDetail(product.id)}>Xem chi tiết</button>
                  <button className="sp-btn-primary" onClick={() => handleCreateContract(product.id)}>Tạo hợp đồng</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
