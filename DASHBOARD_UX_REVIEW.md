# Đánh giá & Kế hoạch nâng cấp Dashboard Farmer / Enterprise — PreOnic

> Tài liệu cho hạng mục (i) của bản cập nhật lớn. Mục tiêu: một hệ thống mới, dễ nhìn,
> dễ tương tác, thân thiện với người dùng. Đánh giá dựa trên rà soát mã nguồn thực tế
> (`fe/src/Component/FarmerDashboard/`, `fe/src/Component/EnterpriseDashboard/`).
>
> Cập nhật: 31/05/2026

---

## 1. Tổng quan nhanh

| Tiêu chí | Farmer | Enterprise | Mức độ ưu tiên sửa |
|---|---|---|---|
| Tích hợp API thật (không mock) | ✅ Tốt | ✅ Tốt | — |
| Trạng thái loading | ⚠️ Không nhất quán | ⚠️ Không nhất quán | Trung bình |
| Trạng thái rỗng (empty) | ⚠️ Rời rạc | ⚠️ Rời rạc | Thấp |
| **Responsive mobile** | ✅ Đã làm (drawer) | ✅ Đã làm (drawer) | ~~CAO~~ → xong |
| Breakpoint tablet | ✅ Đã thêm (≤991/560px) | ✅ Đã thêm | ~~Cao~~ → xong |
| Nhất quán giao diện | ⚠️ Còn inline (đã có token) | ⚠️ Còn inline (đã có token) | Trung bình |
| **Accessibility (a11y)** | ✅ Cơ bản (tablist/aria) | ✅ Cơ bản | ~~CAO~~ → xong |
| Xử lý lỗi & phản hồi | ⚠️ Catch im lặng | ⚠️ Catch im lặng | Cao |
| Phân cấp thông tin | ⚠️ Dày đặc | ⚠️ Dày đặc | Thấp |

> **Cập nhật thực thi (31/05/2026):** đã code xong Giai đoạn 1–3 + phần lớn Giai đoạn 4 (xem §7).

---

## 2. Điểm mạnh (giữ & phát huy)

1. **Dữ liệu thật xuyên suốt** — cả hai dashboard gọi service thật (`farmerService`,
   `enterpriseService`, `escrowService`, `productService`), không còn mock.
2. **Hệ thống nhãn trạng thái tập trung** — `CONTRACT_STATUS_LABEL`, `ORDER_STEPS`… giúp
   hiển thị nhất quán.
3. **Tiện ích định dạng dùng chung** — `formatDate()`, `formatMoney()` áp dụng nhiều nơi.
4. **Modal xác nhận cho thao tác nguy hiểm** — hủy/từ chối đều có modal (UX tốt).
5. **Điều hướng dạng tab** — lọc danh sách hợp đồng/đơn hàng quen thuộc, dễ dùng.
6. **(Mới trong bản cập nhật này)** Giao diện hợp đồng đã **thống nhất** giữa hai vai trò
   qua `ContractDetailView`; thông báo đã **bấm điều hướng được**; có **chuông tin nhắn**
   riêng; ví đã có **tab Rút tiền**.

---

## 3. Điểm yếu & điểm cần cải thiện (có dẫn chứng)

### 3.1. Responsive / Mobile — NGHIÊM TRỌNG
- Sidebar cố định `236px`, **không có hamburger / drawer**; trên điện thoại nội dung bị bóp.
  - `FarmerDashboard.css` chỉ có @media tại ~dòng 261–265 & 1640–1670 (đều desktop-down).
  - `.fd-wrapper` / `.ed-layout` (flex) **không có** media query → sidebar + content không xếp dọc trên mobile.
- Lưới thống kê cứng: `.fd-stats` = `repeat(3,1fr)`, `.ed-stats` = 4 cột, **không breakpoint**.
- `.main-grid` (`2fr 1fr`), `.bottom-grid` (`1fr 1fr`) không có fallback mobile.
- Bảng dữ liệu: chỗ có `overflowX:auto` (inline), chỗ không → cuộn ngang không nhất quán.
- **Thiếu hẳn dải tablet 768–1024px.**

### 3.2. Accessibility — NGHIÊM TRỌNG
- Nút icon ở sidebar không có `aria-label`; icon-only mất nghĩa nếu CSS lỗi.
- Tab lọc không có `role="tablist"/"tab"`, `aria-selected`.
- Biểu đồ (recharts LineChart, donut SVG) thiếu `role="img"`/`aria-label`/`<title>` → screen reader không đọc được.
- Modal không có focus-trap, `aria-modal`, xử lý phím Esc.
- Một số input/textarea chỉ có placeholder, **thiếu `<label>`**.
- Trạng thái chỉ phân biệt bằng màu ở vài chỗ (rủi ro cho người mù màu).

### 3.3. Xử lý lỗi & phản hồi
- Nhiều `catch(() => null)` / `catch { setX([]) }` **im lặng** — người dùng thấy rỗng nhưng
  không biết do lỗi hay chưa có dữ liệu; khó debug (không log).
- Thiếu nút **"Thử lại"** ở hầu hết section (chỉ `FarmerFinanceContent` có).
- `Promise.all` ở `TongQuanContent` — một request lỗi có thể kéo theo dữ liệu cục bộ sai lệch.

### 3.4. Nhất quán giao diện
- **Inline style tràn lan** (vd `MuaVuContent` 70+ chỗ) → không thể theme hóa / bảo trì.
- Màu lặp dưới nhiều dạng (`#13ec37`, `#3b82f6`, "green/amber"…); cỡ chữ rải rác
  (`13`, `14`, `0.85rem`, `1.05rem`).
- API nút không thống nhất (class vs inline vs kết hợp).

### 3.5. Loading / Empty / Hierarchy
- Loading lúc spinner, lúc chỉ chữ "Đang tải...", lúc trắng trang → nên có **skeleton** chung.
- Empty state mỗi nơi một kiểu icon/àvăn bản → nên có component chung.
- `MuaVuContent` / `TongQuanContent` dày đặc, thiếu vạch phân tách mục, CTA chính mờ nhạt.

### 3.6. Dữ liệu
- Fallback tên chung chung ("Nông dân"/"ND") nhiều nơi.
- Thanh tiến độ dùng `progress` trực tiếp trong tính toán SVG/`conic-gradient`, **không kẹp [0,100]** → vỡ layout nếu >100.
- Ảnh sản phẩm thiếu `onError` → 404 để lại khoảng trắng.

---

## 4. Kế hoạch tu sửa & nâng cấp (theo giai đoạn)

Ưu tiên theo tác động người dùng × công sức. Mỗi giai đoạn nên là một PR độc lập.

### Giai đoạn 1 — Nền tảng dùng chung (1–2 ngày) ⭐ ưu tiên cao
- Tạo **bộ component UI dùng chung**: `<DashboardShell>` (layout + sidebar responsive),
  `<EmptyState>`, `<LoadingState>` (skeleton + spinner), `<StatusBadge>`, `<DataTable>` (tự cuộn ngang).
- Tạo **CSS tokens** trong `:root`: màu (`--brand`, `--ok`, `--warn`, `--danger`), spacing, radius,
  cỡ chữ — thay dần inline style & hex rời rạc.
- Tận dụng hệ **font theo vị trí** đã thêm (`--font-base/heading/display`).

### Giai đoạn 2 — Mobile & Responsive (2–3 ngày) ⭐ ưu tiên cao
- Sidebar → **drawer + nút hamburger** ở header dưới 992px; overlay khi mở.
- Cho `.fd-wrapper`/`.ed-layout` xếp dọc; lưới thống kê `repeat(auto-fit, minmax(160px,1fr))`.
- Thêm breakpoint tablet (768–1024px); mọi bảng bọc trong `<DataTable>` tự cuộn.
- Kiểm thử thực tế ở 360px / 768px / 1024px.

### Giai đoạn 3 — Accessibility (1–2 ngày) ⭐ ưu tiên cao
- `aria-label` cho mọi nút icon; `role="tablist"/"tab"` + `aria-selected` cho tab.
- Focus-trap + Esc cho modal (gói chung `<Modal>`); `aria-modal="true"`.
- `<label>` đầy đủ cho input; biểu đồ thêm `aria-label`/`<title>`.
- Trạng thái: màu **+** icon/text (không chỉ màu).

### Giai đoạn 4 — Tin cậy & phản hồi (1 ngày)
- Chuẩn hóa xử lý lỗi: hiện toast + nút **"Thử lại"** thay cho catch im lặng; log `console.error` ở dev.
- Kẹp `progress` về [0,100]; thêm `onError` cho ảnh (ảnh mặc định).
- Tách lỗi từng request thay vì `Promise.all` "được ăn cả ngã về không".

### Giai đoạn 5 — Hoàn thiện trải nghiệm (1–2 ngày)
- Thêm vạch phân tách & tiêu đề mục; làm nổi CTA chính mỗi trang.
- Skeleton loader cho danh sách/biểu đồ.
- Rà soát cỡ chữ/icon cho cân đối; gỡ inline style còn lại.
- (Tùy chọn) dark-mode nhờ CSS tokens.

---

## 5. Định nghĩa "hoàn thành" (DoD)
- Dùng được mượt ở 360px → 1440px, có hamburger trên mobile.
- Mọi nút/biểu tượng có nhãn; modal/tab đạt a11y cơ bản (điều hướng bàn phím + screen reader).
- Không còn catch im lặng cho thao tác người dùng; luôn có phản hồi (toast/empty/retry).
- Inline style giảm tối thiểu; màu/cỡ chữ dùng token.
- QA checklist responsive + a11y pass trên Chrome/Firefox + 1 thiết bị di động thật.

---

## 6. Ghi chú
Bản cập nhật lần này đã xử lý: thống nhất hợp đồng (b), bỏ OTP (c), thông báo bấm-điều-hướng +
chuông tin nhắn (a), rút tiền (d), nút Đăng bán nổi bật (e), nút Đăng ký bao tiêu (f),
hệ font (g), nội dung Footer (h).

---

## 7. Nhật ký thực thi (đã code — 31/05/2026)

Hạng mục (i) đã chuyển từ "kế hoạch" sang **đã triển khai**. Tóm tắt thay đổi:

### Giai đoạn 1 — Nền tảng dùng chung ✅
- **Design tokens** trong `fe/src/index.css` (`:root`): `--brand/-strong/-soft`, `--ok/warn/danger/info`,
  `--ink/-soft`, `--muted`, `--line`, `--radius*`, `--shadow*`, `--z-overlay/-drawer`.
- **Component dùng chung** `fe/src/Component/common/DashboardStates.jsx` (+CSS):
  `<LoadingState>`, `<ListSkeleton>`, `<EmptyState>` (shimmer skeleton).

### Giai đoạn 2 — Mobile & Responsive ✅
- **CSS drawer dùng chung** `fe/src/Component/common/DashboardResponsive.css`:
  `.dash-hamburger`, `.dash-drawer` (trượt từ trái, ≤991px), `.dash-overlay`, `.dash-table-scroll`.
- **Cả 3 dashboard** (Farmer/Enterprise/Admin): thêm state `sidebarOpen`, nút hamburger ở header,
  overlay nền mờ, sidebar thành drawer; chọn mục điều hướng tự đóng drawer (`go()`).
- **Lưới responsive**: `.fd-stats`/`.ed-stats` → `repeat(auto-fit, minmax(...))`; `.main-grid`/`.bottom-grid`
  về 1 cột ở ≤991px; ≤560px ẩn ô tìm kiếm + tên user để nhường chuông/avatar.
- Admin: thay icon-rail 56px (cũ) bằng drawer đầy đủ; `.ad-main` margin-left 0 trên mobile.

### Giai đoạn 3 — Accessibility ✅ (cơ bản)
- Nav sidebar cả 3 dashboard: `role="tablist"` + `role="tab"` + `aria-selected`.
- Nút icon: `aria-label` (hamburger, input tìm kiếm); icon trang trí `aria-hidden`.
- Modal trong `ContractDetailView`: `role="dialog"` + `aria-modal="true"` + `aria-label`.

### Giai đoạn 4 — Tin cậy (phần đã làm) ✅
- **Clamp progress [0,100]**: MuaVuContent (thanh + vòng conic), SanPhamContent — hết vỡ layout khi >100.
- **Ảnh `onError`**: MuaVuContent (ẩn ảnh hỏng), SanPhamContent (fallback ảnh mặc định).

### Còn lại cho vòng sau (không chặn DoD hạng mục i)
- Gỡ toàn bộ inline style còn lại → dùng token (đang dùng song song).
- Áp `<LoadingState>/<EmptyState>` đồng bộ cho **mọi** section (hiện đã tạo + sẵn dùng).
- Chuẩn hóa catch im lặng → toast + nút "Thử lại" cho mọi section.
- Focus-trap đầy đủ + bẫy phím Esc cho mọi modal; `aria-label` cho biểu đồ recharts.

**Verify:** `cd fe && CI=false npm run build` → **Compiled successfully**; ESLint các file thay đổi sạch.
