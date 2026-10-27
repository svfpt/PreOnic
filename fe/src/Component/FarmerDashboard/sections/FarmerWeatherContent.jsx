import { useMemo, useState, useEffect } from "react";
import {
  FiBell, FiCloud, FiClock, FiDroplet, FiMap, FiMapPin,
  FiRefreshCw, FiShield, FiWind, FiZap, FiCheckCircle,
  FiAlertTriangle, FiInfo, FiPhone, FiChevronDown,
} from "react-icons/fi";
import { useAuth } from "../../../contexts/AuthContext";
import { matchProvince, getDistricts } from "../../../data/vn-locations";
import weatherService from "../../../services/weather.service";
import { INSURANCE_PROGRAMS } from "../../../constants";
import "../../common/WeatherInsurance.css";

const VIETNAM_PROVINCES = [
  { value: "Ha Noi", label: "Hà Nội" }, { value: "Ho Chi Minh", label: "TP. Hồ Chí Minh" },
  { value: "Da Nang", label: "Đà Nẵng" }, { value: "Hai Phong", label: "Hải Phòng" },
  { value: "Can Tho", label: "Cần Thơ" }, { value: "Binh Duong", label: "Bình Dương" },
  { value: "Dong Nai", label: "Đồng Nai" }, { value: "Lam Dong", label: "Lâm Đồng" },
  { value: "Dak Lak", label: "Đắk Lắk" }, { value: "Gia Lai", label: "Gia Lai" },
  { value: "Long An", label: "Long An" }, { value: "Tien Giang", label: "Tiền Giang" },
  { value: "Ben Tre", label: "Bến Tre" }, { value: "An Giang", label: "An Giang" },
  { value: "Binh Thuan", label: "Bình Thuận" }, { value: "Khanh Hoa", label: "Khánh Hòa" },
  { value: "Tay Ninh", label: "Tây Ninh" }, { value: "Thai Nguyen", label: "Thái Nguyên" },
  { value: "Bac Giang", label: "Bắc Giang" }, { value: "Thanh Hoa", label: "Thanh Hóa" },
  { value: "Nghe An", label: "Nghệ An" }, { value: "Ha Tinh", label: "Hà Tĩnh" },
  { value: "Quang Binh", label: "Quảng Bình" }, { value: "Hue", label: "Thừa Thiên Huế" },
  { value: "Quang Nam", label: "Quảng Nam" }, { value: "Quang Ngai", label: "Quảng Ngãi" },
  { value: "Binh Dinh", label: "Bình Định" }, { value: "Phu Yen", label: "Phú Yên" },
];

// Toạ độ tỉnh được fetch một lần từ BE (xem weatherService.getProvinceCoords) — không hardcode FE nữa.

// Tâm địa lý xấp xỉ của Việt Nam — dùng khi tỉnh chưa có trong bảng coords
const VIETNAM_CENTER_COORDS = { lat: 16.0, lng: 107.0 };
const WINDY_ZOOM_DISTRICT = 10;
const WINDY_ZOOM_PROVINCE = 8;


const ALERT_TYPE_LABEL = {
  extreme_heat: "Nắng nóng",
  extreme_cold: "Rét đậm",
  heavy_rain: "Mưa lớn",
  strong_wind: "Gió mạnh",
  drought: "Hạn hán",
};

function InsuranceSection({ weather, alerts }) {
  const [expanded, setExpanded] = useState(null);

  const risk = useMemo(() => {
    const critical = alerts.filter(a => a.severity === "critical" && !a.isRead);
    const warning = alerts.filter(a => a.severity === "warning" && !a.isRead);
    if (critical.length > 0) return { label: "Cao", key: "high", Icon: FiAlertTriangle };
    if (warning.length > 0) return { label: "Trung bình", key: "medium", Icon: FiAlertTriangle };
    return { label: "Thấp", key: "low", Icon: FiCheckCircle };
  }, [alerts]);

  const activeAlertTypes = useMemo(() =>
    [...new Set(alerts.filter(a => !a.isRead).map(a => a.alertType))],
    [alerts]
  );

  return (
    <div className="ins-page">
      {/* Risk banner */}
      <div className={`ins-risk-banner ins-risk-${risk.key}`}>
        <div className="ins-risk-icon-wrap">
          <risk.Icon size={22} />
        </div>
        <div className="ins-risk-content">
          <span className="ins-risk-label">Mức rủi ro thời tiết hiện tại</span>
          <strong className="ins-risk-level">{risk.label}</strong>
          <p className="ins-risk-desc">
            {activeAlertTypes.length > 0
              ? <>Đang có cảnh báo: <strong>{activeAlertTypes.map(t => ALERT_TYPE_LABEL[t] || t).join(", ")}</strong>. Khuyến nghị kiểm tra các gói bảo hiểm phù hợp.</>
              : "Thời tiết ổn định. Đây là thời điểm tốt để cân nhắc tham gia bảo hiểm nông nghiệp."
            }
          </p>
          {weather && (
            <div className="ins-weather-chips">
              <span className="ins-chip"><FiDroplet size={12} /> {weather.humidity}% độ ẩm</span>
              <span className="ins-chip"><FiWind size={12} /> {weather.windSpeed?.toFixed(1)} km/h</span>
              <span className="ins-chip"><FiCloud size={12} /> {weather.temp?.toFixed(1)}°C</span>
            </div>
          )}
        </div>
      </div>

      {/* Section header */}
      <div className="ins-section-header">
        <h3 className="ins-section-title">Các gói bảo hiểm nông nghiệp</h3>
        <p className="ins-section-sub">Thông tin tham khảo các chương trình bảo hiểm phổ biến tại Việt Nam</p>
      </div>

      {/* Program accordion list */}
      <div className="ins-program-list">
        {INSURANCE_PROGRAMS.map(prog => {
          const isOpen = expanded === prog.id;
          return (
            <div key={prog.id} className={`ins-program-card ${isOpen ? "open" : ""}`} style={{ "--accent": prog.accentColor }}>
              <button
                className="ins-program-header"
                onClick={() => setExpanded(isOpen ? null : prog.id)}
              >
                <div className="ins-program-icon">
                  <FiShield size={18} />
                </div>
                <div className="ins-program-info">
                  <span className="ins-program-name">{prog.name}</span>
                  <span className="ins-program-provider">{prog.provider}</span>
                </div>
                <div className="ins-program-actions">
                  <a
                    href={`tel:${prog.hotline.replace(/\s/g, "")}`}
                    className="ins-hotline-btn"
                    onClick={e => e.stopPropagation()}
                  >
                    <FiPhone size={12} />
                    {prog.hotline}
                  </a>
                  <span className={`ins-chevron ${isOpen ? "open" : ""}`}>
                    <FiChevronDown size={16} />
                  </span>
                </div>
              </button>

              {isOpen && (
                <div className="ins-program-body">
                  <div className="ins-coverages-grid">
                    <div className="ins-coverages-col">
                      <div className="ins-col-label">
                        <FiCheckCircle size={13} /> Phạm vi bảo hiểm
                      </div>
                      <ul className="ins-coverage-list">
                        {prog.coverages.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="ins-coverages-col">
                      <div className="ins-col-label">
                        <FiInfo size={13} /> Phù hợp với
                      </div>
                      <ul className="ins-coverage-list">
                        {prog.suitable.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="ins-note-row">
                    <FiInfo size={13} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>{prog.note}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Government support note */}
      <div className="ins-govt-card">
        <div className="ins-govt-icon">
          <FiShield size={20} />
        </div>
        <div className="ins-govt-body">
          <p className="ins-govt-title">Chương trình hỗ trợ phí bảo hiểm Nhà nước</p>
          <p className="ins-govt-desc">
            Theo <strong>Nghị định 58/2018/NĐ-CP</strong>, nông dân nghèo và cận nghèo được hỗ trợ tới <strong>90%</strong> phí bảo hiểm.
            Nông dân không thuộc diện nghèo được hỗ trợ <strong>20%</strong>. Liên hệ UBND xã/phường để được hướng dẫn đăng ký.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function FarmerWeatherContent() {
  const { user } = useAuth();
  const defaultProvince = matchProvince(user?.province) || "Ha Noi";
  const [selectedProvince, setSelectedProvince] = useState(defaultProvince);
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [thresholds, setThresholds] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("weather");
  const [provinceCoords, setProvinceCoords] = useState({});

  useEffect(() => {
    let cancelled = false;
    weatherService.getProvinceCoords().then(coords => { if (!cancelled) setProvinceCoords(coords); });
    return () => { cancelled = true; };
  }, []);

  const districtOptions = useMemo(() => getDistricts(selectedProvince), [selectedProvince]);

  const handleProvinceChange = (e) => {
    setSelectedProvince(e.target.value);
    setSelectedDistrict("");
  };

  useEffect(() => { loadData(selectedProvince); }, [selectedProvince]);

  const loadData = async (province) => {
    setLoading(true);
    try {
      const [weatherRes, forecastRes, alertsRes, thresholdsRes] = await Promise.all([
        weatherService.getCurrentWeather(province).catch(() => null),
        weatherService.getForecast(province).catch(() => null),
        weatherService.getAlerts(1, 10).catch(() => ({ data: [] })),
        weatherService.getThresholds().catch(() => null),
      ]);
      setWeather(weatherRes?.data || null);
      setForecast(Array.isArray(forecastRes?.data) ? forecastRes.data : []);
      setAlerts(alertsRes?.data || []);
      setThresholds(thresholdsRes?.data || null);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (id) => {
    try {
      await weatherService.markAlertAsRead(id);
      setAlerts(prev => prev.map(a => a._id === id ? { ...a, isRead: true } : a));
    } catch { /* silent */ }
  };

  const markAllRead = async () => {
    try {
      await weatherService.markAllAlertsAsRead();
      setAlerts(prev => prev.map(a => ({ ...a, isRead: true })));
    } catch { /* silent */ }
  };

  const getAlertIconClass = (t) =>
    ({ extreme_heat: "heat", extreme_cold: "cold", heavy_rain: "rain", strong_wind: "wind", drought: "drought" })[t] || "rain";

  const getAlertLabel = (t) =>
    ({ extreme_heat: "Nắng nóng", extreme_cold: "Rét đậm", heavy_rain: "Mưa lớn", strong_wind: "Gió mạnh", drought: "Hạn hán" })[t] || t;

  const formatDateStr = (d) =>
    new Date(d).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const formatForecastDate = (ds) => {
    const d = new Date(ds);
    const days = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
    return { day: days[d.getDay()], date: `${d.getDate()}/${d.getMonth() + 1}` };
  };

  const getHeroGradient = (icon) => {
    if (!icon) return "linear-gradient(145deg, #2d6a4f 0%, #40916c 60%, #52b788 100%)";
    const code = icon.slice(0, 2);
    const isDay = icon.endsWith("d");
    if (code === "01") return isDay
      ? "linear-gradient(145deg, #0369a1 0%, #0ea5e9 55%, #38bdf8 100%)"
      : "linear-gradient(145deg, #0f172a 0%, #1e3a5f 55%, #1e40af 100%)";
    if (code === "02") return isDay
      ? "linear-gradient(145deg, #0284c7 0%, #38bdf8 55%, #7dd3fc 100%)"
      : "linear-gradient(145deg, #1e293b 0%, #334155 55%, #475569 100%)";
    if (["03", "04"].includes(code)) return "linear-gradient(145deg, #475569 0%, #64748b 55%, #94a3b8 100%)";
    if (["09", "10"].includes(code)) return "linear-gradient(145deg, #1e3a5f 0%, #374151 55%, #4b5563 100%)";
    if (code === "11") return "linear-gradient(145deg, #111827 0%, #1f2937 55%, #374151 100%)";
    return "linear-gradient(145deg, #2d6a4f 0%, #40916c 60%, #52b788 100%)";
  };

  const provinceLabel = VIETNAM_PROVINCES.find(p => p.value === selectedProvince)?.label || selectedProvince;
  const displayLocation = selectedDistrict ? `${selectedDistrict}, ${provinceLabel}` : provinceLabel;
  const coords = provinceCoords[selectedProvince] || VIETNAM_CENTER_COORDS;
  const windyZoom = selectedDistrict ? WINDY_ZOOM_DISTRICT : WINDY_ZOOM_PROVINCE;
  const windyUrl = `https://embed.windy.com/embed2.html?lat=${coords.lat}&lon=${coords.lng}&detailLat=${coords.lat}&detailLon=${coords.lng}&zoom=${windyZoom}&level=surface&overlay=temp&menu=&message=&marker=true&calendar=&pressure=&type=map&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1`;

  const unreadCount = alerts.filter(a => !a.isRead).length;

  const sectionTabs = [
    { key: "weather", label: "Thời tiết", Icon: FiCloud },
    { key: "map", label: "Bản đồ", Icon: FiMap },
    { key: "alerts", label: "Cảnh báo", Icon: FiBell, badge: unreadCount },
    { key: "thresholds", label: "Ngưỡng", Icon: FiZap },
    { key: "insurance", label: "Bảo hiểm", Icon: FiShield },
  ];

  return (
    <div className="fd-weather-wrap">
      <div className="fd-breadcrumb"><span>Trang chủ</span><span className="fd-bc-arrow">›</span><span>Thời tiết &amp; Bảo hiểm</span></div>

      <div className="wi-page-header">
        <div>
          <h2>Thời tiết &amp; Bảo hiểm</h2>
          <p className="wi-page-subtitle">Theo dõi thời tiết và quản lý thông tin bảo hiểm cho vùng canh tác.</p>
        </div>
      </div>

      {/* ── Weather hero ── */}
      <div className="wthr-hero" style={{ background: getHeroGradient(weather?.icon) }}>
        <div className="wthr-deco wthr-deco-1" />
        <div className="wthr-deco wthr-deco-2" />

        <div className="wthr-loc-row">
          <div className="wthr-loc-selects">
            <select className="wthr-loc-select" value={selectedProvince} onChange={handleProvinceChange}>
              {VIETNAM_PROVINCES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <select
              className="wthr-loc-select"
              value={selectedDistrict}
              onChange={e => setSelectedDistrict(e.target.value)}
              disabled={districtOptions.length === 0}
            >
              <option value="">{districtOptions.length > 0 ? "Tất cả Quận/Huyện" : "— Không có dữ liệu —"}</option>
              {districtOptions.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <button className="wthr-refresh-btn" onClick={() => loadData(selectedProvince)} disabled={loading}>
            {loading ? <FiClock size={14} /> : <FiRefreshCw size={14} />} Làm mới
          </button>
        </div>

        {loading ? (
          <div className="wthr-hero-loading">
            <div className="wthr-spinner" />
            <span>Đang tải dữ liệu thời tiết...</span>
          </div>
        ) : weather ? (
          <div className="wthr-current">
            <div className="wthr-location-label">
              <FiMapPin size={13} style={{ marginRight: 4, verticalAlign: "middle" }} />
              {displayLocation}
            </div>
            <div className="wthr-main-row">
              <div className="wthr-icon-temp">
                <img
                  src={`https://openweathermap.org/img/wn/${weather.icon}@4x.png`}
                  alt={weather.description}
                  className="wthr-big-icon"
                />
                <div>
                  <div className="wthr-temp">{weather.temp?.toFixed(1)}°C</div>
                  <div className="wthr-desc-text">{weather.description}</div>
                </div>
              </div>
              <div className="wthr-stats-grid">
                <div className="wthr-stat-badge">
                  <span className="stat-emoji"><FiDroplet size={18} /></span>
                  <div>
                    <div className="stat-lbl">Độ ẩm</div>
                    <div className="stat-val">{weather.humidity}%</div>
                  </div>
                </div>
                <div className="wthr-stat-badge">
                  <span className="stat-emoji"><FiWind size={18} /></span>
                  <div>
                    <div className="stat-lbl">Gió</div>
                    <div className="stat-val">{weather.windSpeed?.toFixed(1)} km/h</div>
                  </div>
                </div>
                <div className="wthr-stat-badge">
                  <span className="stat-emoji"><FiCloud size={18} /></span>
                  <div>
                    <div className="stat-lbl">Mưa 1h</div>
                    <div className="stat-val">{weather.rain1h?.toFixed(1) || 0} mm</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* ── Section tabs (outside hero) ── */}
      <div className="weather-section-tabs">
        {sectionTabs.map(({ key, label, Icon, badge }) => (
          <button
            key={key}
            className={`ws-tab ${activeSection === key ? "active" : ""}`}
            onClick={() => setActiveSection(key)}
          >
            <Icon size={14} />
            {label}
            {badge > 0 && <span className="ws-tab-badge">{badge}</span>}
          </button>
        ))}
      </div>

      {/* ── Section content ── */}
      {!loading && (
        <>
          {/* Forecast */}
          {activeSection === "weather" && (
            <div className="wthr-forecast-section">
              <h3 className="wthr-forecast-title">Dự báo 5 ngày</h3>
              <div className="wthr-forecast-strip">
                {forecast.length === 0 ? (
                  <div className="wthr-no-data">Chưa có dữ liệu dự báo</div>
                ) : forecast.map((f, i) => {
                  const label = formatForecastDate(f.date || f.dt_txt || "");
                  return (
                    <div key={i} className={`wthr-day-card ${i === 0 ? "today" : ""}`}>
                      <div className="wthr-day-label">{label.day}</div>
                      <div className="wthr-day-date">{label.date}</div>
                      <img
                        src={`https://openweathermap.org/img/wn/${f.icon}@2x.png`}
                        alt={f.description}
                        className="wthr-day-icon"
                      />
                      <div className="wthr-day-temp-max">{f.temp?.toFixed?.(0) ?? f.temp}°C</div>
                      <div className="wthr-day-desc">{f.description}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Map */}
          {activeSection === "map" && (
            <div className="wthr-map-section">
              <div className="wthr-map-header">
                <div className="wthr-map-title">Bản đồ thời tiết</div>
                <div className="wthr-map-loc">{displayLocation}</div>
                <div className="wthr-map-sub">Dữ liệu từ Windy.com — overlay nhiệt độ bề mặt</div>
              </div>
              <iframe title="windy" src={windyUrl} frameBorder="0" className="wthr-map-frame" />
            </div>
          )}

          {/* Alerts */}
          {activeSection === "alerts" && (
            <div className="weather-alerts-section">
              <div className="wa-header">
                <h3>Cảnh báo thời tiết</h3>
                {alerts.length > 0 && (
                  <button onClick={markAllRead} className="wa-mark-all">Đánh dấu tất cả đã đọc</button>
                )}
              </div>
              {alerts.length === 0 ? (
                <div className="wa-empty">
                  <span className="wa-empty-icon" />
                  Không có cảnh báo nào
                </div>
              ) : (
                <div className="wa-list">
                  {alerts.map(a => (
                    <div
                      key={a._id}
                      className={`wa-item ${a.severity === "critical" ? "weather-critical" : "weather-warning"} ${a.isRead ? "read" : "unread"}`}
                      onClick={() => !a.isRead && markRead(a._id)}
                    >
                      <div className="wa-item-icon">
                        <span className={`alert-type-icon ${getAlertIconClass(a.alertType)}-icon`} />
                      </div>
                      <div className="wa-item-body">
                        <div className="wa-item-header">
                          <span className={`wa-badge ${a.severity}`}>
                            {a.severity === "critical" ? "Khẩn cấp" : "Cảnh báo"}
                          </span>
                          <span className="wa-type">{getAlertLabel(a.alertType)}</span>
                          <span className="wa-date">{formatDateStr(a.createdAt)}</span>
                        </div>
                        <p className="wa-message">{a.message}</p>
                        {a.thresholdExceeded && <p className="wa-detail">{a.thresholdExceeded}</p>}
                        <p className="wa-location">
                          {a.location?.province}{a.location?.district ? ` - ${a.location.district}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Thresholds */}
          {activeSection === "thresholds" && (
            <div className="weather-thresholds-card">
              <h3>Ngưỡng cảnh báo hệ thống</h3>
              <p className="wt-desc">Hệ thống tự động phát cảnh báo khi các chỉ số vượt ngưỡng dưới đây.</p>
              <div className="wt-grid">
                <div className="wt-item heat">
                  <span className="wt-icon heat-icon" />
                  <div><h4>Nắng nóng</h4><p>Trên {thresholds?.extremeHeatTemp || 38}°C</p></div>
                </div>
                <div className="wt-item cold">
                  <span className="wt-icon cold-icon" />
                  <div><h4>Rét đậm</h4><p>Dưới {thresholds?.extremeColdTemp || 5}°C</p></div>
                </div>
                <div className="wt-item rain">
                  <span className="wt-icon rain-icon" />
                  <div><h4>Mưa lớn</h4><p>Trên {thresholds?.heavyRainMm || 100}mm/ngày</p></div>
                </div>
                <div className="wt-item wind">
                  <span className="wt-icon wind-icon" />
                  <div><h4>Gió mạnh</h4><p>Trên {thresholds?.strongWindKmh || 60} km/h</p></div>
                </div>
                <div className="wt-item drought">
                  <span className="wt-icon drought-icon" />
                  <div>
                    <h4>Hạn hán</h4>
                    <p>Dưới {thresholds?.droughtMm || 5}mm / {thresholds?.droughtDays || 14} ngày</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Insurance */}
          {activeSection === "insurance" && (
            <InsuranceSection weather={weather} alerts={alerts} thresholds={thresholds} />
          )}
        </>
      )}
    </div>
  );
}
