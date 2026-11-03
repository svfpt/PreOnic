// Tách từ FarmerDashboard.jsx theo SRP: form đăng bán nông sản mới.
import { useState, useRef } from "react";
import {
  FiFeather, FiCalendar, FiDollarSign, FiCamera, FiCheck, FiCheckCircle,
  FiPackage, FiAlertTriangle, FiFileText, FiEye, FiMapPin, FiInfo,
} from "react-icons/fi";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../contexts/ToastContext";
import { FILE_SIZE_LIMIT } from "../../../constants";
import productService from "../../../services/product.service";

export default function DangBanContent() {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({ cropType: "", variety: "", area: "", plantDate: "", harvestDate: "", estimatedYield: "", desiredPrice: "", unit: "kg", minBuyoutPercent: "" });
  const [certFile, setCertFile] = useState(null);
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();
  const certInputRef = useRef(null);
  const photoInputRef = useRef(null);

  const handleInputChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleCertChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > FILE_SIZE_LIMIT) {
      toast.warning(`File "${file.name}" quá lớn (tối đa 5MB). Vui lòng chọn file nhỏ hơn.`);
      return;
    }
    setCertFile(file);
  };

  const handlePhotoChange = (e) => {
    const files = Array.from(e.target.files).filter(f => {
      if (f.size > FILE_SIZE_LIMIT) {
        toast.warning(`Ảnh "${f.name}" quá lớn (tối đa 5MB). Đã bỏ qua.`);
        return false;
      }
      return true;
    });
    if (!files.length) return;
    const merged = [...photoFiles, ...files].slice(0, 10);
    setPhotoFiles(merged);
    const previews = merged.map(f => URL.createObjectURL(f));
    setPhotoPreviews(previews);
  };

  const removePhoto = (idx) => {
    const updated = photoFiles.filter((_, i) => i !== idx);
    setPhotoFiles(updated);
    setPhotoPreviews(updated.map(f => URL.createObjectURL(f)));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Upload first photo to server; get back a real URL (not base64)
      let imageUrl = undefined;
      if (photoFiles.length > 0) {
        try {
          imageUrl = await productService.uploadImage(photoFiles[0]);
        } catch {
          toast.warning("Không thể tải ảnh lên. Sản phẩm sẽ được đăng mà không có ảnh.");
        }
      }

      const detectCategory = (name) => {
        const n = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
        if (/xoai|thanh long|buoi|cam|quit|dua hau|chuoi|mit|sau rieng|vai|nhan|chom chom|man|dao|le|tao|khe|oi|na/.test(n)) return "fruit";
        if (/lua|gao|nep/.test(n)) return "rice";
        if (/ca phe|cafe|coffee/.test(n)) return "coffee";
        if (/che|tra xanh|tra/.test(n)) return "tea";
        if (/ot|tieu|gung|nghe|que|hoi|xa|rieng/.test(n)) return "spice";
        if (/rau|cai|cu cai|bong cai|ca rot|hanh|toi|bap cai|mung|dau/.test(n)) return "vegetable";
        if (/ngo|bap|lua mi|dau tuong|dau phong|khoai mi|san/.test(n)) return "grain";
        return "other";
      };
      const priceNum = parseInt(String(formData.desiredPrice).replace(/[^0-9]/g, ""), 10) || 0;
      const totalQty = parseFloat(formData.estimatedYield) * 1000 || 1000;
      const productData = {
        name: formData.variety
          ? `${formData.cropType} ${formData.variety}`.trim()
          : formData.cropType,
        location: user?.province || user?.location || "Việt Nam",
        farm: formData.variety || `Nông trại ${user?.fullName || ""}`.trim() || "Nông trại",
        category: detectCategory(formData.cropType),
        region: formData.region || "south",
        priceMin: priceNum,
        priceMax: Math.round(priceNum * 1.15) || priceNum + 5000,
        unit: formData.unit || "kg",
        totalQuantity: totalQty,
        remaining: totalQty,
        progress: 0,
        expectedDate: formData.harvestDate || undefined,
        certifications: certFile ? [certFile.name] : [],
        ...(imageUrl && { image: imageUrl }),
      };
      await productService.create(productData);
      toast.success("Đăng bán sản phẩm thành công!");
      setCurrentStep(1);
      setFormData({ cropType: "", variety: "", area: "", plantDate: "", harvestDate: "", estimatedYield: "", desiredPrice: "", unit: "kg", minBuyoutPercent: "", region: "" });
      setPhotoFiles([]);
      setPhotoPreviews([]);
      setCertFile(null);
    } catch (err) {
      toast.error(err?.message || "Đăng bán thất bại. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  const stepLabels = ["Sản phẩm", "Mùa vụ", "Giá & Bao tiêu", "Chứng chỉ & Ảnh"];
  const stepIcons = [<FiFeather size={18} />, <FiCalendar size={18} />, <FiDollarSign size={18} />, <FiCamera size={18} />];
  const stepDescs = ["Tên và loại cây trồng", "Thời vụ và sản lượng", "Mức giá và điều kiện", "Giấy tờ và hình ảnh"];
  const regionLabels = { north: "Miền Bắc", central: "Miền Trung", south: "Miền Nam" };

  const pricePreview = parseInt(String(formData.desiredPrice).replace(/[^0-9]/g, ""), 10) || 0;
  const qtyPreview = parseFloat(formData.estimatedYield) * 1000 || 0;
  const totalValuePreview = pricePreview * qtyPreview;

  const canNext = () => {
    if (currentStep === 1) return formData.cropType.trim().length > 0;
    if (currentStep === 2) return !!formData.estimatedYield && parseFloat(formData.estimatedYield) > 0;
    if (currentStep === 3) return !!formData.desiredPrice && pricePreview > 0;
    return true;
  };

  const productDisplayName = [formData.cropType, formData.variety].filter(Boolean).join(" ") || "Tên sản phẩm";

  return (
    <>
      <div className="fd-pg-header">
        <div>
          <div className="fd-breadcrumb"><span>Trang chủ</span><span className="fd-bc-arrow">›</span><span>Đăng bán nông sản</span></div>
          <h2>Đăng ký Bán Nông sản Mới</h2>
          <p className="fd-pg-subtitle">Điền thông tin để kết nối với nhà bao tiêu uy tín trên toàn quốc.</p>
        </div>
      </div>

      <div className="db2-wrap">
        {/* LEFT: Wizard */}
        <div className="db2-main">
          {/* Step indicator */}
          <div className="db2-steps">
            {stepLabels.map((label, i) => {
              const num = i + 1;
              const state = num < currentStep ? "done" : num === currentStep ? "active" : "idle";
              return (
                <div key={num} className={`db2-step ${state}`}>
                  <div className="db2-step-circle">
                    {state === "done" ? <FiCheck size={16} /> : stepIcons[i]}
                  </div>
                  <div className="db2-step-info">
                    <span className="db2-step-label">{label}</span>
                    <span className="db2-step-desc">{stepDescs[i]}</span>
                  </div>
                  {num < stepLabels.length && <div className="db2-step-connector" />}
                </div>
              );
            })}
          </div>

          {/* Form card */}
          <div className="db2-card">
            {/* Step 1: Nông sản */}
            {currentStep === 1 && (
              <div className="db2-step-body">
                <div className="db2-card-header">
                  <span className="db2-card-icon"><FiFeather size={30} /></span>
                  <div>
                    <h3>Thông tin nông sản</h3>
                    <p>Nhập tên sản phẩm và thông tin cơ bản</p>
                  </div>
                </div>
                <div className="db2-grid">
                  <div className="db2-field span-2">
                    <label>Tên / Loại nông sản <span className="db2-req">*</span></label>
                    <input className="db2-input" type="text" value={formData.cropType}
                      onChange={e => handleInputChange("cropType", e.target.value)}
                      placeholder="VD: Xoài, Lúa ST25, Cà phê Arabica, Thanh long ruột đỏ..." />
                    <span className="db2-hint">Nhập tên đầy đủ để doanh nghiệp dễ tìm kiếm</span>
                  </div>
                  <div className="db2-field">
                    <label>Giống / Phân loại</label>
                    <input className="db2-input" type="text" value={formData.variety}
                      onChange={e => handleInputChange("variety", e.target.value)}
                      placeholder="VD: Cát Hòa Lộc, ST25..." />
                  </div>
                  <div className="db2-field">
                    <label>Diện tích canh tác (ha)</label>
                    <div className="db2-input-suffix">
                      <input className="db2-input" type="number" min="0" step="0.1" value={formData.area}
                        onChange={e => handleInputChange("area", e.target.value)} placeholder="0.0" />
                      <span>ha</span>
                    </div>
                  </div>
                  <div className="db2-field span-2">
                    <label>Khu vực sản xuất</label>
                    <div className="db2-region-group">
                      {Object.entries(regionLabels).map(([key, label]) => (
                        <button key={key} type="button"
                          className={`db2-region-btn ${(formData.region || "south") === key ? "active" : ""}`}
                          onClick={() => handleInputChange("region", key)}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Mùa vụ */}
            {currentStep === 2 && (
              <div className="db2-step-body">
                <div className="db2-card-header">
                  <span className="db2-card-icon"><FiCalendar size={30} /></span>
                  <div>
                    <h3>Thông tin mùa vụ</h3>
                    <p>Thời gian canh tác và sản lượng dự kiến</p>
                  </div>
                </div>
                <div className="db2-grid">
                  <div className="db2-field">
                    <label>Ngày bắt đầu gieo / trồng</label>
                    <input className="db2-input" type="date" value={formData.plantDate}
                      onChange={e => handleInputChange("plantDate", e.target.value)} />
                  </div>
                  <div className="db2-field">
                    <label>Ngày thu hoạch dự kiến <span className="db2-req">*</span></label>
                    <input className="db2-input" type="date" value={formData.harvestDate}
                      onChange={e => handleInputChange("harvestDate", e.target.value)} />
                  </div>
                  <div className="db2-field span-2">
                    <label>Sản lượng ước tính <span className="db2-req">*</span></label>
                    <div className="db2-input-suffix">
                      <input className="db2-input" type="number" min="0" step="0.1" value={formData.estimatedYield}
                        onChange={e => handleInputChange("estimatedYield", e.target.value)} placeholder="0.0" />
                      <span>tấn</span>
                    </div>
                    {qtyPreview > 0 && (
                      <div className="db2-computed-box">
                        <FiPackage size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Tương đương <strong>{qtyPreview.toLocaleString("vi-VN")} kg</strong>
                      </div>
                    )}
                    <span className="db2-hint">Nhập sản lượng dự kiến, đơn vị tính bằng tấn</span>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Giá & Bao tiêu */}
            {currentStep === 3 && (
              <div className="db2-step-body">
                <div className="db2-card-header">
                  <span className="db2-card-icon"><FiDollarSign size={30} /></span>
                  <div>
                    <h3>Giá và điều kiện bao tiêu</h3>
                    <p>Thiết lập mức giá và tỉ lệ bao tiêu mong muốn</p>
                  </div>
                </div>
                <div className="db2-grid">
                  <div className="db2-field">
                    <label>Đơn vị tính giá</label>
                    <div className="db2-region-group">
                      {[["kg", "kg"], ["ta", "Tạ"], ["tan", "Tấn"]].map(([val, label]) => (
                        <button key={val} type="button"
                          className={`db2-region-btn ${formData.unit === val ? "active" : ""}`}
                          onClick={() => handleInputChange("unit", val)}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="db2-field">
                    <label>Giá mong muốn <span className="db2-req">*</span></label>
                    <div className="db2-input-suffix">
                      <input className="db2-input" type="text" value={formData.desiredPrice}
                        onChange={e => handleInputChange("desiredPrice", e.target.value)} placeholder="50,000" />
                      <span>VNĐ/{formData.unit === "tan" ? "tấn" : formData.unit === "ta" ? "tạ" : "kg"}</span>
                    </div>
                    {pricePreview > 0 && qtyPreview > 0 && (
                      <div className="db2-computed-box">
                        <FiDollarSign size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Ước tính tổng giá trị: <strong>{totalValuePreview.toLocaleString("vi-VN")} VNĐ</strong>
                        {" "}· Giá niêm yết: <strong>{pricePreview.toLocaleString("vi-VN")}đ – {Math.round(pricePreview * 1.15).toLocaleString("vi-VN")}đ/{formData.unit === "tan" ? "tấn" : formData.unit === "ta" ? "tạ" : "kg"}</strong>
                      </div>
                    )}
                  </div>
                  <div className="db2-field span-2">
                    <label>Tỉ lệ bao tiêu tối thiểu chấp nhận (%)</label>
                    <div className="db2-buyout-slider">
                      <input className="db2-input" type="number" min="0" max="100"
                        value={formData.minBuyoutPercent}
                        onChange={e => handleInputChange("minBuyoutPercent", e.target.value)} placeholder="50" />
                      <div className="db2-buyout-presets">
                        {[25, 50, 75, 100].map(v => (
                          <button key={v} type="button"
                            className={`db2-preset-btn ${formData.minBuyoutPercent === String(v) ? "active" : ""}`}
                            onClick={() => handleInputChange("minBuyoutPercent", String(v))}>
                            {v}%
                          </button>
                        ))}
                      </div>
                    </div>
                    <span className="db2-hint">Tỉ lệ tối thiểu sản lượng bạn muốn được bao tiêu</span>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Chứng chỉ & Ảnh */}
            {currentStep === 4 && (
              <div className="db2-step-body">
                <div className="db2-card-header">
                  <span className="db2-card-icon"><FiCamera size={30} /></span>
                  <div>
                    <h3>Chứng chỉ và hình ảnh</h3>
                    <p>Tải lên ảnh thực tế và giấy tờ chứng nhận</p>
                  </div>
                </div>
                <div className="db2-upload-grid">
                  {/* Photos */}
                  <div className="db2-field span-2">
                    <label>Ảnh thực tế <span className="db2-req">*</span>
                      <span className="db2-hint-inline"> · tối thiểu 3 ảnh, tối đa 10</span>
                    </label>
                    <input ref={photoInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handlePhotoChange} />
                    {photoPreviews.length < 10 && (
                      <div className="db2-upload-box" onClick={() => photoInputRef.current.click()}>
                        <span className="db2-upload-icon"><FiCamera size={36} /></span>
                        <p className="db2-upload-title">
                          {photoFiles.length > 0 ? `Đã chọn ${photoFiles.length} ảnh — nhấn để thêm` : "Nhấn để tải ảnh lên"}
                        </p>
                        <p className="db2-upload-sub">JPG, PNG · tối đa 5MB mỗi ảnh</p>
                      </div>
                    )}
                    {photoPreviews.length > 0 && (
                      <div className="db2-photo-grid">
                        {photoPreviews.map((src, i) => (
                          <div key={i} className="db2-photo-item">
                            <img src={src} alt={`preview-${i}`} />
                            {i === 0 && <span className="db2-photo-main-tag">Ảnh chính</span>}
                            <button className="db2-photo-remove" onClick={e => { e.stopPropagation(); removePhoto(i); }}>×</button>
                          </div>
                        ))}
                      </div>
                    )}
                    {photoFiles.length < 3 && (
                      <div className="db2-upload-warn"><FiAlertTriangle size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Cần ít nhất 3 ảnh để tăng độ tin cậy</div>
                    )}
                  </div>

                  {/* Certificate */}
                  <div className="db2-field span-2">
                    <label>Chứng nhận VietGAP / GlobalGAP / Hữu cơ
                      <span className="db2-hint-inline"> · không bắt buộc</span>
                    </label>
                    <input ref={certInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={handleCertChange} />
                    <div className={`db2-cert-box ${certFile ? "has-file" : ""}`} onClick={() => certInputRef.current.click()}>
                      {certFile ? (
                        <>
                          <span className="db2-cert-icon"><FiCheckCircle size={28} /></span>
                          <div>
                            <p className="db2-cert-name">{certFile.name}</p>
                            <p className="db2-cert-hint">Nhấn để đổi file</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <span className="db2-cert-icon"><FiFileText size={28} /></span>
                          <div>
                            <p className="db2-cert-name">Tải lên chứng nhận</p>
                            <p className="db2-cert-hint">PDF, JPG, PNG · tối đa 5MB</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="db2-nav">
              <button className="db2-btn-back" type="button"
                onClick={() => currentStep > 1 && setCurrentStep(s => s - 1)}
                disabled={currentStep === 1}>
                ← Quay lại
              </button>
              <div className="db2-step-dots">
                {stepLabels.map((_, i) => (
                  <span key={i} className={`db2-dot ${currentStep === i + 1 ? "active" : currentStep > i + 1 ? "done" : ""}`} />
                ))}
              </div>
              <button className="db2-btn-next" type="button" disabled={submitting || (!canNext() && currentStep < 4)}
                onClick={() => {
                  if (currentStep < 4) setCurrentStep(s => s + 1);
                  else handleSubmit();
                }}>
                {submitting ? "Đang gửi..." : currentStep === 4 ? "Đăng bán ngay" : "Tiếp theo →"}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT: Live preview */}
        <div className="db2-sidebar">
          <div className="db2-preview-card">
            <p className="db2-preview-label"><FiEye size={12} style={{ marginRight: 5, verticalAlign: 'middle' }} />Xem trước sản phẩm</p>
            <div className="db2-preview-img">
              {photoPreviews[0]
                ? <img src={photoPreviews[0]} alt="preview" />
                : <div className="db2-preview-placeholder"><FiFeather size={24} color="#16a34a" /><p>Ảnh sẽ hiển thị ở đây</p></div>
              }
            </div>
            <div className="db2-preview-body">
              <h4 className="db2-preview-name">{productDisplayName}</h4>
              <p className="db2-preview-loc"><FiMapPin size={12} style={{ marginRight: 3, verticalAlign: 'middle' }} />{user?.province || "Địa điểm của bạn"}</p>
              {pricePreview > 0 && (
                <p className="db2-preview-price">
                  {pricePreview.toLocaleString("vi-VN")}đ – {Math.round(pricePreview * 1.15).toLocaleString("vi-VN")}đ
                  <span>/{formData.unit === "tan" ? "tấn" : formData.unit === "ta" ? "tạ" : "kg"}</span>
                </p>
              )}
              <div className="db2-preview-tags">
                {formData.region && <span className="db2-tag">{regionLabels[formData.region]}</span>}
                {certFile && <span className="db2-tag db2-tag-green"><FiCheckCircle size={10} style={{ marginRight: 3 }} />VietGAP</span>}
                {qtyPreview > 0 && <span className="db2-tag"><FiPackage size={10} style={{ marginRight: 3 }} />{qtyPreview.toLocaleString("vi-VN")} kg</span>}
              </div>
              {totalValuePreview > 0 && (
                <div className="db2-preview-value">
                  <FiDollarSign size={14} style={{ marginRight: 5, verticalAlign: 'middle' }} />Tổng giá trị ước tính<br />
                  <strong>{(totalValuePreview / 1_000_000).toFixed(1)} triệu VNĐ</strong>
                </div>
              )}
            </div>
          </div>

          <div className="db2-tips-card">
            <p className="db2-tips-title"><FiInfo size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Mẹo tăng tỉ lệ bao tiêu</p>
            <ul className="db2-tips-list">
              <li><FiCamera size={12} style={{ marginRight: 5 }} />Ảnh rõ nét, chụp thực tế tăng <strong>3×</strong> tỉ lệ quan tâm</li>
              <li><FiCheckCircle size={12} style={{ marginRight: 5 }} />Chứng nhận VietGAP thu hút DN lớn</li>
              <li><FiDollarSign size={12} style={{ marginRight: 5 }} />Giá hợp lý so thị trường → nhiều đề xuất hơn</li>
              <li><FiCalendar size={12} style={{ marginRight: 5 }} />Ghi đúng ngày thu hoạch để DN chủ động kế hoạch</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
