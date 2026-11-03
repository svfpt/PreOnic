import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { ROUTES } from "../../constants";
import authService from "../../services/auth.service";
import productService from "../../services/product.service";
import { formatMoney } from "../../hooks/useApiData";
import { FiArrowLeft, FiCamera, FiCheckCircle, FiEdit3, FiShield, FiUser } from "react-icons/fi";
import "./Profile.css";

function validate(form, role) {
  const errors = {};
  if (!form.fullName.trim()) errors.fullName = "Họ tên không được để trống";
  if (!form.phone || !/^[0-9]{10,11}$/.test(form.phone.trim())) errors.phone = "Số điện thoại bắt buộc (10-11 chữ số)";
  if (!form.province?.trim()) errors.province = "Vui lòng nhập tỉnh/thành phố";
  if (role === "farmer") {
    if (!form.farmName?.trim()) errors.farmName = "Tên nông trại bắt buộc";
    if (form.farmSize && (!Number.isFinite(Number(form.farmSize)) || Number(form.farmSize) < 0)) errors.farmSize = "Diện tích phải là số không âm";
  } else if (role === "enterprise") {
    if (!form.companyName?.trim()) errors.companyName = "Tên công ty bắt buộc";
    if (!form.taxCode?.trim()) errors.taxCode = "Mã số thuế bắt buộc";
  }
  return errors;
}

// Kiểm tra hồ sơ đã đủ chưa — phải khớp logic isProfileComplete bên BE.
function isProfileComplete(u) {
  if (!u) return false;
  if (!u.fullName || !u.phone || !u.province) return false;
  if (u.role === 'farmer') return !!u.farmName;
  if (u.role === 'enterprise') return !!u.companyName && !!u.taxCode;
  return true;
}

export default function Profile() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const incompletePrompt = searchParams.get("incomplete") === "1";

  const [editing, setEditing] = useState(incompletePrompt);
  const [form, setForm] = useState({ fullName: "", phone: "", address: "", province: "", farmName: "", farmSize: "", companyName: "", taxCode: "" });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  useEffect(() => {
    if (!avatarFile) { setAvatarPreview(""); return undefined; }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  const chooseAvatar = event => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setAvatarError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setAvatarError("Vui lòng chọn ảnh JPG, PNG hoặc WebP."); return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("Ảnh đại diện tối đa 5MB."); return;
    }
    setAvatarFile(file);
  };

  const saveAvatar = async () => {
    if (!avatarFile || savingAvatar) return;
    setSavingAvatar(true); setAvatarError("");
    try {
      const avatar = await productService.uploadImage(avatarFile);
      const response = await authService.updateProfile({ avatar });
      if (!response.data?.user) throw new Error("Chưa lưu được ảnh đại diện. Vui lòng thử lại.");
      setProfile(response.data.user);
      updateUser(response.data.user);
      setAvatarFile(null);
      toast.success("Đổi ảnh đại diện thành công!");
    } catch (error) { setAvatarError(error.message || "Không thể đổi ảnh đại diện. Vui lòng thử lại."); }
    finally { setSavingAvatar(false); }
  };

  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
  const [pwErrors, setPwErrors] = useState({});
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await authService.getMe();
        if (res?.data?.user) {
          const u = res.data.user;
          setProfile(u);
          setForm({ fullName: u.fullName || "", phone: u.phone || "", address: u.address || "", province: u.province || "", farmName: u.farmName || "", farmSize: u.farmSize || "", companyName: u.companyName || "", taxCode: u.taxCode || "" });
        }
      } catch {
        if (user) {
          setProfile(user);
          setForm({ fullName: user.fullName || "", phone: user.phone || "", address: user.address || "", province: user.province || "", farmName: user.farmName || "", farmSize: user.farmSize || "", companyName: user.companyName || "", taxCode: user.taxCode || "" });
        }
      }
    };
    loadProfile();
  }, [user]);

  const data = profile || user || {};
  const isFarmer = data.role === "farmer";
  const isAdmin = data.role === "admin";
  const requiredFields = [data.fullName, data.phone, data.province,
    ...(isFarmer ? [data.farmName] : data.role === "enterprise" ? [data.companyName, data.taxCode] : [])];
  const completion = Math.round(requiredFields.filter(value => String(value || "").trim()).length / requiredFields.length * 100);

  const handleSave = async () => {
    if (saving) return;
    const errs = validate(form, data.role);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setSaving(true);
    try {
      const res = await authService.updateProfile(form);
      if (res?.data?.user) {
        setProfile(res.data.user);
        if (updateUser) updateUser(res.data.user);
        toast.success("Cập nhật hồ sơ thành công!");
      }
      setEditing(false);
    } catch (err) {
      toast.error(err?.message || "Cập nhật thất bại. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setErrors({});
    setForm({ fullName: data.fullName || "", phone: data.phone || "", address: data.address || "", province: data.province || "", farmName: data.farmName || "", farmSize: data.farmSize || "", companyName: data.companyName || "", taxCode: data.taxCode || "" });
  };

  const handleSavePassword = async () => {
    const errs = {};
    if (!pwForm.currentPassword) errs.currentPassword = "Nhập mật khẩu hiện tại";
    if (!pwForm.newPassword || pwForm.newPassword.length < 6) errs.newPassword = "Mật khẩu mới ít nhất 6 ký tự";
    if (pwForm.newPassword !== pwForm.confirmNewPassword) errs.confirmNewPassword = "Mật khẩu xác nhận không khớp";
    if (Object.keys(errs).length > 0) { setPwErrors(errs); return; }
    setPwErrors({});
    setSavingPw(true);
    try {
      await authService.updatePassword(pwForm);
      toast.success("Đổi mật khẩu thành công!");
      setPwForm({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
      setShowPasswordSection(false);
    } catch (err) {
      toast.error(err?.message || "Đổi mật khẩu thất bại");
    } finally {
      setSavingPw(false);
    }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("vi-VN") : "—";

  const dashRoute = isAdmin ? ROUTES.ADMIN : isFarmer ? ROUTES.FARMER : ROUTES.ENTERPRISE;
  const roleBadgeCls = isFarmer ? "role-farmer" : "role-enterprise";
  const roleLabel = isAdmin ? "Quản trị viên" : isFarmer ? "Nông dân" : "Doanh nghiệp";

  return (
    <div className="profile-page">
      {/* Topbar */}
      <div className="profile-topbar">
        <button className="profile-topbar-logo" onClick={() => navigate(ROUTES.HOME)} aria-label="Về trang chủ PreOnic">
          <div className="profile-topbar-logo-img" />
          <span className="profile-topbar-brand">PreOnic</span>
        </button>
        <button className="profile-back-btn" onClick={() => navigate(dashRoute)}>
          <FiArrowLeft aria-hidden="true" /> Về trang quản lý
        </button>
      </div>

      <div className="profile-container">
        <div className="profile-page-heading">
          <span>TÀI KHOẢN CỦA TÔI</span>
          <h1>Hồ sơ cá nhân</h1>
          <p>Quản lý thông tin cá nhân và bảo mật tài khoản của bạn.</p>
        </div>
        {!isProfileComplete(data) && (
          <div style={{
            background: '#fff7e6', border: '1px solid #f59e0b', color: '#92400e',
            borderRadius: 10, padding: '14px 18px', marginBottom: 18,
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: 22 }}>⚠️</span>
            <div style={{ flex: 1, minWidth: 240 }}>
              <strong>Hồ sơ chưa hoàn thiện.</strong>{' '}
              Bạn cần cập nhật đầy đủ thông tin {isFarmer ? 'nông trại' : 'doanh nghiệp'} (tên, địa chỉ, {isFarmer ? 'tên nông trại' : 'mã số thuế'}) trước khi thực hiện các thao tác trên hệ thống.
            </div>
            {!editing && (
              <button className="btn-edit" disabled={savingAvatar || Boolean(avatarFile)} onClick={() => setEditing(true)}>
                Bổ sung ngay
              </button>
            )}
          </div>
        )}

        {/* Header Card */}
        <div className="profile-header">
          <div className="profile-avatar-control">
            <div className="profile-avatar">
              {avatarPreview || data.avatar ? <img src={avatarPreview || data.avatar} alt="Ảnh đại diện" referrerPolicy="no-referrer" /> : (data.fullName || "U").trim().split(/\s+/).map(word => word[0]).slice(-2).join("").toUpperCase()}
            </div>
            <label className={`profile-avatar-picker${savingAvatar || editing ? " is-disabled" : ""}`}>
              <FiCamera aria-hidden="true" /> Đổi ảnh
              <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Chọn ảnh đại diện"
                disabled={savingAvatar || editing} onChange={chooseAvatar} />
            </label>
          </div>
          <div className="profile-header-info">
            <h2>{data.fullName || "Người dùng"}</h2>
            <p className="profile-role">{data.email}</p>
            <div className="profile-badges">
              <span className={`badge ${roleBadgeCls}`}>{roleLabel}</span>
              {data.isVerified ? <span className="badge verified"><FiCheckCircle aria-hidden="true" /> Đã xác thực email</span> : <span className="badge unverified">Chưa xác thực email</span>}
            </div>
          </div>
          {!editing && (
            <button className="btn-edit" disabled={savingAvatar || Boolean(avatarFile)} onClick={() => setEditing(true)}>
              <FiEdit3 aria-hidden="true" /> Chỉnh sửa hồ sơ
            </button>
          )}
        </div>

        {(avatarFile || avatarError) && <div className="profile-avatar-confirm" aria-busy={savingAvatar}>
          <div><strong>{avatarFile ? "Xem trước ảnh đại diện" : "Chọn ảnh đại diện"}</strong>
            <p>JPG, PNG hoặc WebP · Tối đa 5MB. Ảnh được cắt vừa khung đại diện.</p>
            {avatarError && <p role="alert" className="field-error">{avatarError}</p>}
          </div>
          {avatarFile && <div className="profile-avatar-actions">
            <button className="btn-cancel" disabled={savingAvatar} onClick={() => { setAvatarFile(null); setAvatarError(""); }}>Hủy đổi ảnh</button>
            <button className="btn-save" disabled={savingAvatar} onClick={saveAvatar}>{savingAvatar ? "Đang tải ảnh…" : "Lưu ảnh đại diện"}</button>
          </div>}
        </div>}

        <div className="profile-completion">
          <div><span><FiCheckCircle aria-hidden="true" /> Hoàn thiện hồ sơ</span><strong>{completion}%</strong></div>
          <div className="profile-completion-track" role="progressbar" aria-label="Mức độ hoàn thiện hồ sơ" aria-valuenow={completion} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${completion}%` }} /></div>
          <p>{isProfileComplete(data) ? "Thông tin đã đầy đủ. Bạn có thể sử dụng các tính năng trên hệ thống." : "Bổ sung thông tin liên hệ và thông tin hoạt động để bắt đầu giao dịch."}</p>
        </div>

        {/* Info Grid */}
        <div className="profile-grid">
          {/* Account Info */}
          <div className="profile-card">
            <div className="profile-card-header">
              <h3><FiUser aria-hidden="true" /> Thông tin tài khoản</h3>
            </div>
            <div className="profile-field">
              <label>Họ tên</label>
              {editing ? (
                <>
                  <input aria-label="Họ tên" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} className={errors.fullName ? "error" : ""} placeholder="Nhập họ tên..." />
                  {errors.fullName && <span className="field-error">{errors.fullName}</span>}
                </>
              ) : (
                <p className={data.fullName ? "" : "placeholder"}>{data.fullName || "Chưa cập nhật"}</p>
              )}
            </div>
            <div className="profile-field">
              <label>Email</label>
              <input aria-label="Email" value={data.email || ""} disabled />
            </div>
            <div className="profile-field">
              <label>Số điện thoại</label>
              {editing ? (
                <>
                  <input aria-label="Số điện thoại" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className={errors.phone ? "error" : ""} placeholder="VD: 0901234567" />
                  {errors.phone && <span className="field-error">{errors.phone}</span>}
                </>
              ) : (
                <p className={data.phone ? "" : "placeholder"}>{data.phone || "Chưa cập nhật"}</p>
              )}
            </div>
            <div className="profile-field">
              <label>Tỉnh/Thành phố</label>
              {editing ? (
                <><input aria-label="Tỉnh/Thành phố" value={form.province} onChange={e => setForm({ ...form, province: e.target.value })} className={errors.province ? "error" : ""} placeholder="VD: Hà Nội, Lâm Đồng..." />
                {errors.province && <span className="field-error">{errors.province}</span>}</>
              ) : (
                <p className={data.province ? "" : "placeholder"}>{data.province || "Chưa cập nhật"}</p>
              )}
            </div>
            <div className="profile-field">
              <label>Địa chỉ chi tiết</label>
              {editing ? (
                <>
                  <input aria-label="Địa chỉ chi tiết" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className={errors.address ? "error" : ""} placeholder="Địa chỉ của bạn..." />
                  {errors.address && <span className="field-error">{errors.address}</span>}
                </>
              ) : (
                <p className={data.address ? "" : "placeholder"}>{data.address || "Chưa cập nhật"}</p>
              )}
            </div>
          </div>

          {/* Role-specific info */}
          <div className="profile-card">
            <div className="profile-card-header">
              <h3>{isAdmin ? "Thông tin hoạt động" : isFarmer ? "Thông tin nông trại" : "Thông tin doanh nghiệp"}</h3>
            </div>
            {isFarmer ? (
              <>
                <div className="profile-field">
                  <label>Tên nông trại <span style={{color:'#dc2626'}}>*</span></label>
                  {editing ? (
                    <>
                      <input aria-label="Tên nông trại" value={form.farmName} onChange={e => setForm({ ...form, farmName: e.target.value })} className={errors.farmName ? "error" : ""} placeholder="VD: Nông trại Xanh..." />
                      {errors.farmName && <span className="field-error">{errors.farmName}</span>}
                    </>
                  ) : (
                    <p className={data.farmName ? "" : "placeholder"}>{data.farmName || "Chưa cập nhật"}</p>
                  )}
                </div>
                <div className="profile-field">
                  <label>Diện tích (ha)</label>
                  {editing ? (
                    <>
                      <input aria-label="Diện tích (ha)" value={form.farmSize} onChange={e => setForm({ ...form, farmSize: e.target.value })} className={errors.farmSize ? "error" : ""} placeholder="VD: 2.5" type="text" />
                      {errors.farmSize && <span className="field-error">{errors.farmSize}</span>}
                    </>
                  ) : (
                    <p className={data.farmSize ? "" : "placeholder"}>{data.farmSize ? `${data.farmSize} ha` : "Chưa cập nhật"}</p>
                  )}
                </div>
              </>
            ) : !isAdmin ? (
              <>
                <div className="profile-field">
                  <label>Tên công ty <span style={{color:'#dc2626'}}>*</span></label>
                  {editing ? (
                    <>
                      <input aria-label="Tên công ty" value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })} className={errors.companyName ? "error" : ""} placeholder="VD: Công ty TNHH ABC..." />
                      {errors.companyName && <span className="field-error">{errors.companyName}</span>}
                    </>
                  ) : (
                    <p className={data.companyName ? "" : "placeholder"}>{data.companyName || "Chưa cập nhật"}</p>
                  )}
                </div>
                <div className="profile-field">
                  <label>Mã số thuế <span style={{color:'#dc2626'}}>*</span></label>
                  {editing ? (
                    <>
                      <input aria-label="Mã số thuế" value={form.taxCode} onChange={e => setForm({ ...form, taxCode: e.target.value })} className={errors.taxCode ? "error" : ""} placeholder="VD: 0123456789" />
                      {errors.taxCode && <span className="field-error">{errors.taxCode}</span>}
                    </>
                  ) : (
                    <p className={data.taxCode ? "" : "placeholder"}>{data.taxCode || "Chưa cập nhật"}</p>
                  )}
                </div>
              </>
            ) : <p className="profile-admin-note">Tài khoản quản trị hệ thống PreOnic.</p>}
            <div className="profile-field">
              <label>Ngày tham gia</label>
              <p>{fmtDate(data.createdAt)}</p>
            </div>
            <div className="profile-field">
              <label>Đăng nhập lần cuối</label>
              <p>{fmtDate(data.lastLogin)}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="profile-card stats-card">
            <div className="profile-card-header">
              <h3>Thống kê tài khoản</h3>
            </div>
            <div className="profile-stats">
              <div className="stat-box">
                <span className="stat-number">{data.reputationScore?.toFixed(1) ?? "0.0"}</span>
                <span className="stat-label">Điểm uy tín</span>
              </div>
              <div className="stat-box">
                <span className="stat-number">{formatMoney(data.virtualBalance ?? 0)}</span>
                <span className="stat-label">Số dư ví</span>
              </div>
              <div className="stat-box">
                <span className="stat-number">{data.contractCount ?? 0}</span>
                <span className="stat-label">Hợp đồng</span>
              </div>
              <div className="stat-box">
                <span className="stat-number">{data.province || "—"}</span>
                <span className="stat-label">Tỉnh / TP</span>
              </div>
            </div>
          </div>
        </div>

        {/* Edit Actions */}
        {editing && (
          <div className="profile-actions">
            <button className="btn-cancel" onClick={handleCancelEdit} disabled={saving}>Hủy</button>
            <button className="btn-save" onClick={handleSave} disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        )}

        {/* Password Change Section */}
        <div className="profile-password-card">
          <div className="profile-card-header">
            <h3><FiShield aria-hidden="true" /> Bảo mật tài khoản</h3>
            <button className="btn-password-toggle" onClick={() => { setShowPasswordSection(v => !v); setPwErrors({}); setPwForm({ currentPassword: "", newPassword: "", confirmNewPassword: "" }); }}>
              {showPasswordSection ? "Ẩn" : "Đổi mật khẩu"}
            </button>
          </div>
          {!showPasswordSection && (
            <p style={{ fontSize: 13, color: "#618968" }}>Mật khẩu của bạn được bảo mật. Nhấn "Đổi mật khẩu" để thay đổi.</p>
          )}
          {showPasswordSection && (
            <>
              <div className="password-grid">
                <div className="profile-field">
                  <label>Mật khẩu hiện tại</label>
                  <input aria-label="Mật khẩu hiện tại" autoComplete="current-password" type="password" value={pwForm.currentPassword} onChange={e => setPwForm({ ...pwForm, currentPassword: e.target.value })} className={pwErrors.currentPassword ? "error" : ""} placeholder="••••••••" />
                  {pwErrors.currentPassword && <span className="field-error">{pwErrors.currentPassword}</span>}
                </div>
                <div className="profile-field">
                  <label>Mật khẩu mới</label>
                  <input aria-label="Mật khẩu mới" autoComplete="new-password" type="password" value={pwForm.newPassword} onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })} className={pwErrors.newPassword ? "error" : ""} placeholder="Ít nhất 6 ký tự" />
                  {pwErrors.newPassword && <span className="field-error">{pwErrors.newPassword}</span>}
                </div>
                <div className="profile-field">
                  <label>Xác nhận mật khẩu mới</label>
                  <input aria-label="Xác nhận mật khẩu mới" autoComplete="new-password" type="password" value={pwForm.confirmNewPassword} onChange={e => setPwForm({ ...pwForm, confirmNewPassword: e.target.value })} className={pwErrors.confirmNewPassword ? "error" : ""} placeholder="Nhập lại mật khẩu mới" />
                  {pwErrors.confirmNewPassword && <span className="field-error">{pwErrors.confirmNewPassword}</span>}
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button className="btn-cancel" onClick={() => { setShowPasswordSection(false); setPwErrors({}); }}>Hủy</button>
                <button className="btn-save-password" onClick={handleSavePassword} disabled={savingPw}>
                  {savingPw ? "Đang đổi..." : "Xác nhận đổi mật khẩu"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
