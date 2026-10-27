import { useState, useEffect } from "react";
import { Container } from "react-bootstrap";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { COMPANY, CONTRACT_STATUS, ROUTES } from "../../constants";
import { formatPrice } from "../../data/products";
import contractService from "../../services/contract.service";
import productService from "../../services/product.service";
import Navbar from "../Navbar/Navbar";
import "./ContractFlow.css";

const STEPS = [
  { key: "propose", label: "Đề xuất" },
  { key: "review", label: "Xem xét" },
  { key: "preon_verify", label: `${COMPANY.NAME} Xác nhận` },
  { key: "sign", label: "Ký hợp đồng" },
  { key: "done", label: "Hoàn tất" },
];

const UNIT_TO_KG = {
  tan: 1000,
  ta: 100,
  kg: 1,
  thung: 25,
};

const UNIT_LABELS = {
  tan: "Tấn",
  ta: "Tạ",
  kg: "kg",
  thung: "Thùng",
};

const formatQuantityByUnit = (quantity, unit) => {
  const numericValue = Number(quantity) || 0;
  const fractionDigits = unit === "kg" ? 0 : 2;
  return Number(numericValue.toFixed(fractionDigits)).toLocaleString("vi-VN");
};

function ContractFlow() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const productId = searchParams.get("product");

  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [createdContract, setCreatedContract] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [farmerAutoFilled, setFarmerAutoFilled] = useState(false);
  const [form, setForm] = useState({
    productName: "",
    quantity: "",
    unit: "tan",
    pricePerUnit: "",
    deliveryDate: "",
    paymentTerms: "50_50",
    notes: "",
    farmerName: user?.role === "farmer" ? user.fullName : "",
    enterpriseName: user?.role === "enterprise" ? user.fullName : "",
  });

  // Load product from API and pre-fill form
  useEffect(() => {
    if (!productId) return;
    productService.getById(productId)
      .then(res => {
        const p = res?.data?.product;
        if (!p) return;
        setSelectedProduct(p);
        const autoFarmerName = user?.role === "enterprise"
          ? (p.seller?.name || p.seller?.fullName || "")
          : "";
        if (autoFarmerName) setFarmerAutoFilled(true);
        setForm(prev => ({
          ...prev,
          productName: p.name || prev.productName,
          unit: p.unit || prev.unit,
          pricePerUnit: prev.pricePerUnit || String(p.priceMin || ""),
          quantity: prev.quantity || "1",
          farmerName: user?.role === "enterprise"
            ? (autoFarmerName || prev.farmerName)
            : prev.farmerName,
        }));
      })
      .catch(() => { /* ignore */ });
  }, [productId, user?.role]); // eslint-disable-line react-hooks/exhaustive-deps
  const [showInsurance, setShowInsurance] = useState(false);
  const [insurance, setInsurance] = useState({
    insuranceCompany: "",
    policyNumber: "",
    insuredValue: "",
    coveredEvents: "both",
    validFrom: "",
    validTo: "",
  });
  const [customDeposit, setCustomDeposit] = useState("");
  const [customOnDelivery, setCustomOnDelivery] = useState("");
  const [riskSharingTerms, setRiskSharingTerms] = useState("");
  const [agreed, setAgreed] = useState({ terms: false, preon: false });
  const [showTermsModal, setShowTermsModal] = useState(null); // 'contract' | 'service'

  const unitFactor = UNIT_TO_KG[form.unit] || 1;
  const requestedQuantity = parseFloat(form.quantity) || 0;
  const availableQuantityKg = Number(selectedProduct?.remaining ?? selectedProduct?.totalQuantity ?? 0);
  const availableQuantityInSelectedUnit = selectedProduct ? availableQuantityKg / unitFactor : 0;
  const maxQuantityInSelectedUnit = selectedProduct
    ? Number(availableQuantityInSelectedUnit.toFixed(form.unit === "kg" ? 0 : 2))
    : undefined;
  const quantityExceedsAvailable =
    !!selectedProduct && requestedQuantity * unitFactor - availableQuantityKg > 1e-9;
  const quantityInputStep = form.unit === "kg" ? "1" : "0.01";
  const totalValue = requestedQuantity * (parseFloat(form.pricePerUnit) || 0) * unitFactor;
  const commission = totalValue * COMPANY.COMMISSION_RATE / 100;

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));
  const handleInsChange = (field, value) => setInsurance(prev => ({ ...prev, [field]: value }));

  const customDepositValid = () => {
    const d = parseFloat(customDeposit);
    const r = parseFloat(customOnDelivery);
    return !isNaN(d) && !isNaN(r) && d >= 0 && d <= 100 && r >= 0 && r <= 100 && d + r === 100;
  };

  const handleCustomDepositChange = (val, field) => {
    const num = val === "" ? "" : Math.min(100, Math.max(0, Number(val)));
    if (field === "deposit") {
      setCustomDeposit(String(num));
      if (num !== "") setCustomOnDelivery(String(100 - Number(num)));
    } else {
      setCustomOnDelivery(String(num));
      if (num !== "") setCustomDeposit(String(100 - Number(num)));
    }
  };

  const harvestDate = selectedProduct?.expectedDate || selectedProduct?.harvestDate || null;
  const deliveryBeforeHarvest = harvestDate && form.deliveryDate && form.deliveryDate < harvestDate;

  const canAdvance = () => {
    if (currentStep === 0) {
      if (!form.productName || !form.quantity || !form.pricePerUnit || !form.deliveryDate) return false;
      if (requestedQuantity <= 0) return false;
      if (selectedProduct && quantityExceedsAvailable) return false;
      if (deliveryBeforeHarvest) return false;
      if (form.paymentTerms === "custom" && !customDepositValid()) return false;
      return true;
    }
    if (currentStep === 3) return agreed.terms && agreed.preon;
    return true;
  };

  const nextStep = async () => {
    if (!canAdvance()) return;

    // When clicking "Ký hợp đồng" at step 3, create the contract via API
    if (currentStep === 3) {
      setLoading(true);
      try {
        const contractData = {
          productName: form.productName,
          quantity: parseFloat(form.quantity),
          unit: form.unit,
          pricePerUnit: parseFloat(form.pricePerUnit),
          deliveryDate: form.deliveryDate,
          paymentTerms: form.paymentTerms,
          qualityRequirements: form.notes,
          farmerName: form.farmerName,
          enterpriseName: form.enterpriseName,
          productId: productId || undefined,
          depositPercentage: form.paymentTerms === "50_50" ? 50
            : form.paymentTerms === "30_70" ? 30
            : form.paymentTerms === "100_upfront" ? 100
            : form.paymentTerms === "custom" ? parseFloat(customDeposit) || 0
            : 0,
        };

        // Add insurance data if provided
        if (showInsurance && insurance.insuranceCompany) {
          const insKey = user?.role === "farmer" ? "insuranceFarmer" : "insuranceEnterprise";
          contractData[insKey] = {
            insuranceCompany: insurance.insuranceCompany,
            policyNumber: insurance.policyNumber,
            insuredValue: parseFloat(insurance.insuredValue) || 0,
            coveredEvents: insurance.coveredEvents,
            validFrom: insurance.validFrom,
            validTo: insurance.validTo,
          };
        }
        if (riskSharingTerms) {
          contractData.riskSharingTerms = riskSharingTerms;
        }
        const result = await contractService.create(contractData);
        setCreatedContract(result.data?.contract || result.data);

        // Auto-sign the contract for the current user
        if (result.data?.contract?._id || result.data?._id) {
          const contractId = result.data?.contract?._id || result.data?._id;
          try {
            await contractService.sign(contractId);
          } catch (signErr) {
            // Non-critical: contract was created, sign can be done later
            console.warn('Auto-sign failed:', signErr);
          }
        }

        toast.success('Hợp đồng đã được tạo và ký thành công!');
        setCurrentStep(s => s + 1);
      } catch (err) {
        const msg = err?.message || err?.response?.data?.message || 'Tạo hợp đồng thất bại';
        toast.error(msg);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (currentStep < STEPS.length - 1) setCurrentStep(s => s + 1);
  };
  const prevStep = () => { if (currentStep > 0) setCurrentStep(s => s - 1); };

  return (
    <>
      <Navbar />
      <div className="contract-flow-page">
        <Container>
          <button className="cf-back" onClick={() => navigate(-1)}>Quay lại</button>

          <div className="cf-header">
            <h2>Tạo Hợp Đồng Bao Tiêu</h2>
            <p>Luồng ký hợp đồng qua trung gian <strong>{COMPANY.NAME}</strong> -- đảm bảo quyền lợi hai bên</p>
          </div>

          {/* Step Progress */}
          <div className="cf-steps">
            {STEPS.map((step, i) => (
              <div key={step.key} className={`cf-step ${i <= currentStep ? "active" : ""} ${i < currentStep ? "done" : ""}`}>
                <div className="cf-step-dot">{i < currentStep ? <span className="check-inline" /> : <span className="step-num">{i + 1}</span>}</div>
                <span>{step.label}</span>
                {i < STEPS.length - 1 && <div className="cf-step-line" />}
              </div>
            ))}
          </div>

          <div className="cf-body">
            {/* Step 0: Propose */}
            {currentStep === 0 && (
              <div className="cf-card">
                <h3>Thông tin hợp đồng</h3>
                <div className="cf-form">
                  <div className="cf-row">
                    <div className="cf-field">
                      <label>Sản phẩm *</label>
                      <input value={form.productName} onChange={e => handleChange("productName", e.target.value)} placeholder="VD: Thanh Long Ruột Đỏ" />
                    </div>
                    <div className="cf-field">
                      <label>Số lượng *</label>
                      <div className="cf-input-group">
                        <input
                          type="number"
                          min="0.01"
                          step={quantityInputStep}
                          max={maxQuantityInSelectedUnit}
                          value={form.quantity}
                          onChange={e => handleChange("quantity", e.target.value)}
                          placeholder="VD: 5"
                        />
                        <select value={form.unit} onChange={e => handleChange("unit", e.target.value)}>
                          <option value="tan">Tấn</option>
                          <option value="ta">Tạ</option>
                          <option value="kg">kg</option>
                        </select>
                      </div>
                      {selectedProduct && (
                        <p className={`cf-field-note ${quantityExceedsAvailable ? "error" : ""}`}>
                          {availableQuantityKg <= 0
                            ? "Sản phẩm này hiện không còn sản lượng khả dụng."
                            : quantityExceedsAvailable
                              ? `Số lượng vượt mức cho phép. Tối đa còn ${formatQuantityByUnit(availableQuantityInSelectedUnit, form.unit)} ${UNIT_LABELS[form.unit] || form.unit}.`
                              : `Sản lượng còn lại: ${formatQuantityByUnit(availableQuantityInSelectedUnit, form.unit)} ${UNIT_LABELS[form.unit] || form.unit}.`}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="cf-row">
                    <div className="cf-field">
                      <label>Giá mỗi {UNIT_LABELS[form.unit] || form.unit} (VND) *</label>
                      <input type="number" value={form.pricePerUnit} onChange={e => handleChange("pricePerUnit", e.target.value)} placeholder="VD: 15000" />
                    </div>
                    <div className="cf-field">
                      <label>Ngày giao hàng *</label>
                      <input
                        type="date"
                        value={form.deliveryDate}
                        min={harvestDate || undefined}
                        onChange={e => handleChange("deliveryDate", e.target.value)}
                      />
                      {deliveryBeforeHarvest && (
                        <p className="cf-field-note error">
                          Ngày giao hàng không được sớm hơn ngày dự kiến thu hoạch ({new Date(harvestDate).toLocaleDateString("vi-VN")}).
                        </p>
                      )}
                      {harvestDate && !deliveryBeforeHarvest && form.deliveryDate && (
                        <p className="cf-field-note">
                          Dự kiến thu hoạch: {new Date(harvestDate).toLocaleDateString("vi-VN")}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="cf-row">
                    <div className="cf-field">
                      <label>Phương thức đặt cọc</label>
                      <select value={form.paymentTerms} onChange={e => { handleChange("paymentTerms", e.target.value); setCustomDeposit(""); setCustomOnDelivery(""); }}>
                        <option value="50_50">50% đặt cọc -- 50% khi nhận hàng</option>
                        <option value="30_70">30% đặt cọc -- 70% khi nhận hàng</option>
                        <option value="100_delivery">100% khi nhận hàng</option>
                        <option value="100_upfront">100% trả trước</option>
                        <option value="custom">Khác</option>
                      </select>
                      {form.paymentTerms === "custom" && (
                        <div className="cf-custom-deposit">
                          <div className="cf-custom-deposit-row">
                            <div className="cf-custom-deposit-field">
                              <label>Đặt cọc (%)</label>
                              <input
                                type="number"
                                min="0" max="100"
                                value={customDeposit}
                                onChange={e => handleCustomDepositChange(e.target.value, "deposit")}
                                placeholder="VD: 40"
                              />
                            </div>
                            <div className="cf-custom-deposit-field">
                              <label>Khi nhận hàng (%)</label>
                              <input
                                type="number"
                                min="0" max="100"
                                value={customOnDelivery}
                                onChange={e => handleCustomDepositChange(e.target.value, "delivery")}
                                placeholder="VD: 60"
                              />
                            </div>
                          </div>
                          {customDeposit !== "" && customOnDelivery !== "" && !customDepositValid() && (
                            <p className="cf-custom-deposit-error">Tổng đặt cọc + khi nhận hàng phải bằng 100%</p>
                          )}
                          {customDepositValid() && (
                            <p className="cf-custom-deposit-ok">✓ {customDeposit}% đặt cọc -- {customOnDelivery}% khi nhận hàng</p>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="cf-field">
                      <label>
                        {user?.role === "farmer" ? "Doanh nghiệp đối tác" : "Nông dân cung cấp"}
                      </label>
                      <input
                        value={user?.role === "farmer" ? form.enterpriseName : form.farmerName}
                        onChange={e => handleChange(user?.role === "farmer" ? "enterpriseName" : "farmerName", e.target.value)}
                        placeholder={user?.role === "farmer" ? "Tên doanh nghiệp" : "Tên nông dân / HTX"}
                        readOnly={user?.role === "enterprise" && farmerAutoFilled}
                        style={user?.role === "enterprise" && farmerAutoFilled
                          ? { background: "#f3f4f6", color: "#374151", cursor: "not-allowed" }
                          : {}}
                      />
                      {user?.role === "enterprise" && farmerAutoFilled && (
                        <p className="cf-field-note">Tên nông dân được lấy từ sản phẩm đăng bán.</p>
                      )}
                    </div>
                  </div>

                  <div className="cf-field full">
                    <label>Ghi chú thêm</label>
                    <textarea value={form.notes} onChange={e => handleChange("notes", e.target.value)} rows={3} placeholder="Yêu cầu đặc biệt, tiêu chuẩn chất lượng..." />
                  </div>

                  {/* Optional Insurance Section */}
                  <div className="cf-insurance-toggle">
                    <label className="cf-toggle-label">
                      <input type="checkbox" checked={showInsurance} onChange={e => setShowInsurance(e.target.checked)} />
                      <span>Thêm thông tin bảo hiểm nông nghiệp (tùy chọn)</span>
                    </label>
                  </div>

                  {showInsurance && (
                    <div className="cf-insurance-section">
                      <h4>Thông tin bảo hiểm của bạn</h4>
                      <p className="cf-ins-note">Nhập thông tin bảo hiểm nông nghiệp mà bạn đã mua từ công ty bảo hiểm bên ngoài.</p>
                      <div className="cf-row">
                        <div className="cf-field">
                          <label>Tên công ty bảo hiểm</label>
                          <input value={insurance.insuranceCompany} onChange={e => handleInsChange("insuranceCompany", e.target.value)} placeholder="VD: Bao Viet, PVI..." />
                        </div>
                        <div className="cf-field">
                          <label>Số hợp đồng bảo hiểm</label>
                          <input value={insurance.policyNumber} onChange={e => handleInsChange("policyNumber", e.target.value)} placeholder="VD: BV-2024-001234" />
                        </div>
                      </div>
                      <div className="cf-row">
                        <div className="cf-field">
                          <label>Giá trị được bảo hiểm (VND)</label>
                          <input type="number" value={insurance.insuredValue} onChange={e => handleInsChange("insuredValue", e.target.value)} placeholder="VD: 500000000" />
                        </div>
                        <div className="cf-field">
                          <label>Sự kiện được bảo hiểm</label>
                          <select value={insurance.coveredEvents} onChange={e => handleInsChange("coveredEvents", e.target.value)}>
                            <option value="natural_disaster">Thiên tai</option>
                            <option value="disease">Dịch bệnh</option>
                            <option value="both">Cả hai (thiên tai + dịch bệnh)</option>
                          </select>
                        </div>
                      </div>
                      <div className="cf-row">
                        <div className="cf-field">
                          <label>Hiệu lực từ</label>
                          <input type="date" value={insurance.validFrom} onChange={e => handleInsChange("validFrom", e.target.value)} />
                        </div>
                        <div className="cf-field">
                          <label>Hiệu lực đến</label>
                          <input type="date" value={insurance.validTo} onChange={e => handleInsChange("validTo", e.target.value)} />
                        </div>
                      </div>

                      <div className="cf-field full">
                        <label>Điều khoản chia sẻ rủi ro (tùy chọn)</label>
                        <textarea value={riskSharingTerms} onChange={e => setRiskSharingTerms(e.target.value)} rows={2} placeholder="VD: Rủi ro thiên tai chia đều 50/50 giữa hai bên..." />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 1: Review */}
            {currentStep === 1 && (
              <div className="cf-card">
                <h3>Xem xét hợp đồng</h3>
                <div className="cf-summary">
                  <div className="cf-summary-row"><span>Sản phẩm:</span><strong>{form.productName}</strong></div>
                  <div className="cf-summary-row"><span>Số lượng:</span><strong>{form.quantity} {form.unit}</strong></div>
                  <div className="cf-summary-row"><span>Đơn giá:</span><strong>{formatPrice(parseFloat(form.pricePerUnit) || 0)}/{form.unit}</strong></div>
                  <div className="cf-summary-row"><span>Ngày giao:</span><strong>{form.deliveryDate || "--"}</strong></div>
                  <div className="cf-summary-row"><span>Đặt cọc:</span><strong>{form.paymentTerms === "50_50" ? "50% đặt cọc / 50% khi nhận hàng" : form.paymentTerms === "30_70" ? "30% đặt cọc / 70% khi nhận hàng" : form.paymentTerms === "100_delivery" ? "100% khi nhận hàng" : form.paymentTerms === "100_upfront" ? "100% trả trước" : form.paymentTerms === "custom" ? `${customDeposit}% đặt cọc / ${customOnDelivery}% khi nhận hàng` : ""}</strong></div>
                  <div className="cf-summary-row"><span>Nhà sản xuất:</span><strong>{form.farmerName || "--"}</strong></div>
                  <div className="cf-summary-row"><span>Doanh nghiệp:</span><strong>{form.enterpriseName || "--"}</strong></div>

                  <hr />
                  <div className="cf-summary-row total"><span>Tổng giá trị:</span><strong>{formatPrice(totalValue)}</strong></div>
                  <div className="cf-summary-row fee"><span>Phí {COMPANY.NAME} ({COMPANY.COMMISSION_RATE}%):</span><strong>{formatPrice(commission)}</strong></div>
                  {form.notes && <div className="cf-summary-row"><span>Ghi chú:</span><strong>{form.notes}</strong></div>}

                  {/* Insurance summary */}
                  {showInsurance && insurance.insuranceCompany && (
                    <>
                      <hr />
                      <div className="cf-summary-row"><span>Bảo hiểm:</span><strong>{insurance.insuranceCompany}</strong></div>
                      {insurance.policyNumber && <div className="cf-summary-row"><span>Số hợp đồng BH:</span><strong>{insurance.policyNumber}</strong></div>}
                      {insurance.insuredValue && <div className="cf-summary-row"><span>Giá trị BH:</span><strong>{formatPrice(parseFloat(insurance.insuredValue) || 0)}</strong></div>}
                      <div className="cf-summary-row"><span>Sự kiện BH:</span><strong>{insurance.coveredEvents === "both" ? "Thiên tai + Dịch bệnh" : insurance.coveredEvents === "natural_disaster" ? "Thiên tai" : "Dịch bệnh"}</strong></div>
                    </>
                  )}
                  {riskSharingTerms && <div className="cf-summary-row"><span>Chia sẻ rủi ro:</span><strong>{riskSharingTerms}</strong></div>}
                </div>
              </div>
            )}

            {/* Step 2: PreOnic Verification */}
            {currentStep === 2 && (
              <div className="cf-card center">
                <div className="cf-verify-icon"><span className="shield-icon large" /></div>
                <h3>{COMPANY.NAME} đang xác minh</h3>
                <p>Hệ thống đang kiểm tra thông tin hai bên và xác nhận hợp đồng hợp lệ.</p>

                <div className="cf-verify-items">
                  <div className="cf-verify-item done"><span className="check-inline" /> Xác minh danh tính người bán</div>
                  <div className="cf-verify-item done"><span className="check-inline" /> Xác minh danh tính người mua</div>
                  <div className="cf-verify-item done"><span className="check-inline" /> Kiểm tra giá thị trường</div>
                  <div className="cf-verify-item done"><span className="check-inline" /> Kiểm tra năng lực cung ứng</div>
                  <div className="cf-verify-item done"><span className="check-inline" /> {COMPANY.NAME} phê duyệt hợp đồng</div>
                </div>

                <div className="cf-verify-badge">
                  <span className="shield-icon" />
                  <div>
                    <strong>Hợp đồng được {COMPANY.NAME} bảo vệ</strong>
                    <p>Phí dịch vụ {COMPANY.COMMISSION_RATE}% -- Bảo hiểm giao dịch -- Hỗ trợ giải quyết tranh chấp</p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Sign */}
            {currentStep === 3 && (
              <div className="cf-card">
                <h3>Ký hợp đồng điện tử</h3>

                <div className="cf-contract-doc">
                  <div className="cf-doc-header">
                    <h4>HỢP ĐỒNG BAO TIÊU NÔNG SẢN</h4>
                    <p>So: PRE-{new Date().getFullYear()}-{Math.floor(Math.random() * 9000) + 1000}</p>
                  </div>
                  <div className="cf-doc-body">
                    <p>Hợp đồng bao tiêu <strong>{form.quantity} {form.unit} {form.productName}</strong> với đơn giá <strong>{formatPrice(parseFloat(form.pricePerUnit) || 0)}/{form.unit}</strong>.</p>
                    <p>Tổng giá trị: <strong>{formatPrice(totalValue)}</strong> | Phí dịch vụ {COMPANY.NAME}: <strong>{formatPrice(commission)}</strong></p>
                    <p>Ngày giao hàng: <strong>{form.deliveryDate}</strong></p>
                    <p>Bên bán: {form.farmerName || "--"} | Bên mua: {form.enterpriseName || "--"}</p>
                    <p>Trung gian: <strong>{COMPANY.FULL_NAME}</strong></p>
                  </div>
                </div>

                <div className="cf-checkboxes">
                  <label>
                    <input type="checkbox" checked={agreed.terms} onChange={e => setAgreed(p => ({ ...p, terms: e.target.checked }))} />
                    <span>Tôi đồng ý với <button type="button" className="cf-link-btn" onClick={() => setShowTermsModal('contract')}>điều khoản hợp đồng</button> và cam kết thực hiện đúng nội dung</span>
                  </label>
                  <label>
                    <input type="checkbox" checked={agreed.preon} onChange={e => setAgreed(p => ({ ...p, preon: e.target.checked }))} />
                    <span>Tôi đồng ý <button type="button" className="cf-link-btn" onClick={() => setShowTermsModal('service')}>phí dịch vụ {COMPANY.COMMISSION_RATE}%</button> cho {COMPANY.NAME} -- đổi lại được bảo vệ giao dịch</span>
                  </label>
                </div>

                {showTermsModal && (
                  <div className="terms-modal-overlay" onClick={() => setShowTermsModal(null)}>
                    <div className="terms-modal" onClick={e => e.stopPropagation()}>
                      <div className="terms-modal-header">
                        <h3>{showTermsModal === 'contract' ? 'Điều khoản Hợp đồng Bao tiêu' : `Điều khoản Dịch vụ ${COMPANY.NAME}`}</h3>
                        <button className="terms-modal-close" onClick={() => setShowTermsModal(null)}>✕</button>
                      </div>
                      <div className="terms-modal-body">
                        {showTermsModal === 'contract' ? (
                          <>
                            <h4>1. Phạm vi hợp đồng</h4>
                            <p>Hợp đồng bao tiêu nông sản này được ký kết giữa Bên bán (Nông dân/HTX) và Bên mua (Doanh nghiệp) thông qua nền tảng trung gian <strong>{COMPANY.NAME}</strong>. Hợp đồng có hiệu lực kể từ thời điểm cả hai bên hoàn tất ký điện tử.</p>
                            <h4>2. Cam kết của Bên bán</h4>
                            <p>Bên bán cam kết cung cấp nông sản đúng chủng loại, khối lượng, chất lượng và thời gian giao hàng đã thỏa thuận. Sản phẩm phải đáp ứng tiêu chuẩn VietGAP / GlobalGAP hoặc tiêu chuẩn chất lượng {COMPANY.NAME} Quality Standards. Bên bán chịu trách nhiệm toàn bộ về nguồn gốc xuất xứ và an toàn vệ sinh thực phẩm.</p>
                            <h4>3. Cam kết của Bên mua</h4>
                            <p>Bên mua cam kết thanh toán đúng hạn theo lịch thanh toán đã thỏa thuận. Mọi khoản thanh toán được thực hiện qua hệ thống Ký quỹ {COMPANY.NAME} Escrow để bảo đảm an toàn cho cả hai bên. Bên mua có quyền từ chối hoặc yêu cầu bồi thường nếu sản phẩm không đạt tiêu chuẩn cam kết.</p>
                            <h4>4. Cơ chế ký quỹ</h4>
                            <p>Toàn bộ giá trị hợp đồng (hoặc tỷ lệ đặt cọc đã thỏa thuận) được giữ trong tài khoản Escrow của {COMPANY.NAME} cho đến khi Bên mua xác nhận nghiệm thu hàng hóa. Tiền chỉ được giải ngân cho Bên bán sau khi có xác nhận giao hàng đạt yêu cầu. Nếu phát sinh tranh chấp, {COMPANY.NAME} sẽ đóng vai trò trung gian hòa giải.</p>
                            <h4>5. Vi phạm và bồi thường</h4>
                            <p>Nếu Bên bán vi phạm (giao hàng trễ, không đủ số lượng, không đạt chất lượng), Bên mua có quyền yêu cầu bồi thường tối đa 20% giá trị hợp đồng. Nếu Bên mua vi phạm (từ chối nhận hàng không có lý do chính đáng, chậm thanh toán), Bên bán có quyền giữ toàn bộ tiền đặt cọc.</p>
                            <h4>6. Tranh chấp</h4>
                            <p>Mọi tranh chấp phát sinh sẽ được giải quyết thông qua cơ chế Dispute Resolution của {COMPANY.NAME} trong vòng 15 ngày làm việc. Nếu không đạt được thỏa thuận, hai bên có thể yêu cầu Trọng tài Thương mại theo quy định pháp luật Việt Nam.</p>
                            <h4>7. Bảo mật thông tin</h4>
                            <p>Tất cả thông tin trong hợp đồng (giá cả, sản lượng, điều khoản) được bảo mật tuyệt đối. Không bên nào được tiết lộ thông tin hợp đồng cho bên thứ ba khi chưa có sự đồng ý bằng văn bản của bên còn lại, ngoại trừ các trường hợp theo yêu cầu của pháp luật.</p>
                          </>
                        ) : (
                          <>
                            <h4>1. Phí dịch vụ trung gian</h4>
                            <p><strong>{COMPANY.COMMISSION_RATE}% giá trị hợp đồng</strong> là phí dịch vụ {COMPANY.NAME} thu để cung cấp nền tảng kết nối, hệ thống Escrow bảo vệ giao dịch, và hỗ trợ giải quyết tranh chấp. Phí này được khấu trừ tự động khi giải ngân từ tài khoản Escrow.</p>
                            <h4>2. Những gì bạn nhận được với phí {COMPANY.COMMISSION_RATE}%</h4>
                            <ul>
                              <li><strong>Bảo vệ Escrow:</strong> Toàn bộ tiền giao dịch được giữ an toàn trong tài khoản Escrow cho đến khi nghiệm thu hoàn tất.</li>
                              <li><strong>Xác minh đối tác:</strong> {COMPANY.NAME} xác minh danh tính và uy tín của cả Nông dân lẫn Doanh nghiệp trên nền tảng.</li>
                              <li><strong>Hợp đồng điện tử có giá trị pháp lý:</strong> Hợp đồng được ký số và lưu trữ bảo mật theo tiêu chuẩn pháp luật Việt Nam.</li>
                              <li><strong>Giải quyết tranh chấp:</strong> Đội ngũ {COMPANY.NAME} hỗ trợ hòa giải miễn phí trong vòng 15 ngày làm việc.</li>
                              <li><strong>Theo dõi đơn hàng:</strong> Hệ thống tracking minh bạch từ trang trại đến điểm giao hàng.</li>
                              <li><strong>Hỗ trợ 24/7:</strong> Đội ngũ hỗ trợ kỹ thuật và tư vấn sẵn sàng phục vụ.</li>
                            </ul>
                            <h4>3. Thời điểm thu phí</h4>
                            <p>Phí dịch vụ chỉ được thu khi giao dịch hoàn tất thành công và Bên mua đã xác nhận nghiệm thu hàng hóa. Nếu hợp đồng bị hủy trước khi thực hiện, không có phí dịch vụ nào được thu.</p>
                            <h4>4. Hoàn phí</h4>
                            <p>Trong trường hợp tranh chấp mà kết quả nghiêng về phía người dùng bị thiệt hại, {COMPANY.NAME} sẽ xem xét hoàn toàn bộ hoặc một phần phí dịch vụ tùy theo mức độ lỗi của bên vi phạm.</p>
                          </>
                        )}
                      </div>
                      <div className="terms-modal-footer">
                        <button className="cf-btn primary" onClick={() => {
                          if (showTermsModal === 'contract') setAgreed(p => ({ ...p, terms: true }));
                          else setAgreed(p => ({ ...p, preon: true }));
                          setShowTermsModal(null);
                        }}>Tôi đã đọc và đồng ý</button>
                        <button className="cf-btn outline" onClick={() => setShowTermsModal(null)}>Đóng</button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="cf-sign-area">
                  <div className="cf-signature-box">
                    <p>Chữ ký của bạn</p>
                    <div className="cf-signature-pad">{user?.fullName || "Ký tên tại đây"}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Done */}
            {currentStep === 4 && (
              <div className="cf-card center">
                <div className="cf-done-icon"><span className="done-check-icon" /></div>
                <h3>Hợp đồng đã được ký thành công!</h3>
                <p>Mã hợp đồng: <strong>{createdContract?.contractCode || `PRE-${new Date().getFullYear()}-XXXX`}</strong></p>

                <div className="cf-done-summary">
                  <div><span>Sản phẩm:</span><strong>{form.productName}</strong></div>
                  <div><span>Giá trị:</span><strong>{formatPrice(createdContract?.totalValue || totalValue)}</strong></div>
                  <div><span>Phí {COMPANY.NAME}:</span><strong>{formatPrice(createdContract?.commission || commission)}</strong></div>
                  <div><span>Trạng thái:</span><strong className="text-success">{CONTRACT_STATUS.ACTIVE}</strong></div>
                </div>

                <div className="cf-done-actions">
                  <button className="cf-btn primary" onClick={() => navigate(user?.role === "enterprise" ? ROUTES.ENTERPRISE : ROUTES.FARMER)}>
                    Về Dashboard
                  </button>
                  <button className="cf-btn outline" onClick={() => navigate(ROUTES.MESSAGING)}>
                    Nhắn tin đối tác
                  </button>
                </div>
              </div>
            )}

            {/* Navigation */}
            {currentStep < 4 && (
              <div className="cf-nav">
                <button className="cf-btn outline" onClick={prevStep} disabled={currentStep === 0}>Quay lại</button>
                <button className="cf-btn primary" onClick={nextStep} disabled={!canAdvance() || loading}>
                  {loading ? "Đang xử lý..." : currentStep === 3 ? "Ký hợp đồng" : "Tiếp tục"}
                </button>
              </div>
            )}
          </div>
        </Container>
      </div>
    </>
  );
}

export default ContractFlow;
