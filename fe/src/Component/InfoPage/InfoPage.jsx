// Trang nội dung tĩnh dùng chung cho các mục Footer (Về chúng tôi / Hỗ trợ).
// Nội dung được tra theo slug trên URL: /info/:slug
import { useParams, useNavigate } from "react-router-dom";
import { COMPANY } from "../../constants";
import Navbar from "../Navbar/Navbar";
import Footer from "../Footer/Footer";
import "./InfoPage.css";

const C = COMPANY.NAME;

// Mỗi mục: { title, intro?, sections: [{ h, p }] }
const CONTENT = {
  "ve-preonic": {
    title: `Về ${C}`,
    intro: `${C} là sàn kết nối nông sản giá sỉ, đưa nông dân và hợp tác xã đến trực tiếp với nhà hàng, quán ăn, chuỗi bán lẻ và doanh nghiệp chế biến — minh bạch, an toàn và đảm bảo quyền lợi hai bên.`,
    sections: [
      { h: "Sứ mệnh", p: "Xóa bỏ khâu trung gian không cần thiết, giúp người nông dân bán được giá tốt hơn và doanh nghiệp tiếp cận nguồn cung đạt chuẩn, ổn định." },
      { h: "Chúng tôi làm gì", p: "Cung cấp nền tảng đăng bán nông sản, ký hợp đồng bao tiêu điện tử, thanh toán ký quỹ (escrow) trung gian, theo dõi tiến độ giao hàng và đánh giá uy tín hai chiều." },
      { h: "Giá trị cốt lõi", p: "Minh bạch trong giao dịch, bảo vệ dòng tiền qua ký quỹ, và cam kết chất lượng nông sản đúng tiêu chuẩn đã thỏa thuận." },
    ],
  },
  "dieu-khoan": {
    title: "Điều khoản sử dụng",
    sections: [
      { h: "1. Chấp nhận điều khoản", p: `Khi đăng ký và sử dụng ${C}, bạn đồng ý tuân thủ các điều khoản này cùng các quy định pháp luật Việt Nam hiện hành.` },
      { h: "2. Tài khoản", p: "Người dùng chịu trách nhiệm về tính chính xác của thông tin đăng ký và bảo mật tài khoản của mình. Mỗi tài khoản phải gắn với một danh tính có thật." },
      { h: "3. Giao dịch & hợp đồng", p: `Mọi thỏa thuận mua bán nên được ký kết qua hợp đồng điện tử trên ${C} để được bảo vệ. Chữ ký điện tử có giá trị pháp lý tương đương chữ ký tay.` },
      { h: "4. Hành vi bị cấm", p: "Cấm cung cấp thông tin sai lệch, gian lận giao dịch, đăng nông sản không đúng mô tả, hoặc lợi dụng nền tảng cho mục đích trái pháp luật." },
    ],
  },
  "bao-mat": {
    title: "Chính sách bảo mật",
    sections: [
      { h: "Thu thập thông tin", p: "Chúng tôi thu thập thông tin bạn cung cấp khi đăng ký (họ tên, email, số điện thoại, địa chỉ) và dữ liệu giao dịch để vận hành dịch vụ." },
      { h: "Sử dụng thông tin", p: "Thông tin được dùng để xác thực tài khoản, xử lý hợp đồng, thanh toán ký quỹ và liên hệ hỗ trợ. Chúng tôi không bán dữ liệu cá nhân cho bên thứ ba." },
      { h: "Bảo vệ dữ liệu", p: "Mật khẩu được mã hóa, kết nối được bảo vệ bằng SSL. Bạn có quyền yêu cầu cập nhật hoặc xóa dữ liệu cá nhân của mình." },
    ],
  },
  "quy-che": {
    title: "Quy chế hoạt động",
    sections: [
      { h: "Phạm vi", p: `Quy chế áp dụng cho toàn bộ thành viên tham gia giao dịch trên ${C}, bao gồm nông dân (bên bán) và doanh nghiệp (bên mua).` },
      { h: "Phí dịch vụ", p: `${C} thu phí trung gian ${COMPANY.COMMISSION_RATE}% trên giá trị hợp đồng, được khấu trừ tự động khi giải ngân ký quỹ.` },
      { h: "Ký quỹ (Escrow)", p: "Doanh nghiệp nạp tiền ký quỹ sau khi hai bên ký hợp đồng. Tiền chỉ được giải ngân cho nông dân khi các mốc giao hàng được xác nhận." },
    ],
  },
  "tranh-chap": {
    title: "Cơ chế giải quyết tranh chấp",
    sections: [
      { h: "Bước 1 — Thương lượng", p: "Hai bên trao đổi trực tiếp qua hệ thống nhắn tin để tìm hướng giải quyết trước khi mở khiếu nại chính thức." },
      { h: "Bước 2 — Mở khiếu nại", p: `Nếu không tự giải quyết, một bên có thể gửi khiếu nại kèm bằng chứng (ảnh, video, biên bản) lên ${C}.` },
      { h: "Bước 3 — Phân xử", p: `Đội ngũ ${C} xem xét bằng chứng từ hai phía và đưa ra quyết định xử lý ký quỹ (hoàn tiền, giải ngân một phần hoặc toàn bộ) một cách công bằng.` },
    ],
  },
  "tro-giup": {
    title: "Trung tâm trợ giúp",
    intro: `Tổng hợp các hướng dẫn giúp bạn sử dụng ${C} hiệu quả. Cần hỗ trợ thêm, hãy liên hệ hotline ${COMPANY.HOTLINE}.`,
    sections: [
      { h: "Bắt đầu thế nào?", p: "Đăng ký tài khoản theo vai trò Nông dân hoặc Doanh nghiệp, hoàn thiện hồ sơ và bắt đầu đăng bán hoặc tìm nguồn cung." },
      { h: "Nạp & rút tiền", p: "Vào mục Ví & Thanh toán để nạp tiền qua chuyển khoản, hoặc tạo yêu cầu rút tiền để quản trị viên xét duyệt và chuyển khoản về tài khoản ngân hàng của bạn." },
      { h: "Liên hệ hỗ trợ", p: `Hotline: ${COMPANY.HOTLINE} · Email: ${COMPANY.EMAIL}. Thời gian hỗ trợ: 8h00 – 18h00 các ngày trong tuần.` },
    ],
  },
  "huong-dan-mua": {
    title: "Hướng dẫn mua hàng",
    sections: [
      { h: "1. Tìm sản phẩm", p: "Duyệt danh mục nông sản, lọc theo khu vực, chứng nhận (VietGAP/GlobalGAP) và xem tiến độ bao tiêu của từng sản phẩm." },
      { h: "2. Đăng ký bao tiêu", p: "Mở chi tiết sản phẩm và nhấn \"Đăng ký Bao tiêu\" để tạo hợp đồng với nông dân, nhập số lượng, đơn giá và điều khoản thanh toán." },
      { h: "3. Ký & ký quỹ", p: "Sau khi hai bên ký hợp đồng điện tử, nạp tiền ký quỹ để kích hoạt giao dịch và bắt đầu theo dõi tiến độ giao hàng." },
    ],
  },
  "huong-dan-ban": {
    title: "Hướng dẫn bán hàng",
    sections: [
      { h: "1. Đăng bán nông sản", p: "Tại trang Nông dân, nhấn \"Đăng bán nông sản mới\", điền thông tin sản phẩm, mùa vụ, giá mong muốn và tải ảnh thực tế." },
      { h: "2. Nhận hợp đồng", p: "Doanh nghiệp quan tâm sẽ gửi hợp đồng bao tiêu. Bạn xem xét điều khoản và ký điện tử ngay trên hệ thống." },
      { h: "3. Giao hàng & nhận tiền", p: "Thực hiện giao hàng theo các mốc đã thỏa thuận. Tiền ký quỹ được giải ngân về ví của bạn khi mốc được xác nhận." },
    ],
  },
  "giao-nhan": {
    title: "Giao hàng và nhận hàng",
    sections: [
      { h: "Thỏa thuận giao hàng", p: "Thời gian, địa điểm và phương thức giao nhận được ghi rõ trong hợp đồng bao tiêu giữa hai bên." },
      { h: "Xác nhận mốc giao", p: "Mỗi đợt giao hàng được xác nhận trên hệ thống kèm bằng chứng (ảnh/biên bản) làm cơ sở giải ngân ký quỹ." },
      { h: "Kiểm tra chất lượng", p: "Bên mua kiểm tra nông sản đúng tiêu chuẩn đã thỏa thuận trước khi xác nhận hoàn tất mốc giao." },
    ],
  },
  "hoan-tien": {
    title: "Trả hàng / Hoàn tiền",
    sections: [
      { h: "Điều kiện hoàn tiền", p: "Áp dụng khi nông sản không đúng mô tả, sai số lượng/chất lượng, hoặc bên bán không thực hiện đúng hợp đồng." },
      { h: "Cơ chế bảo vệ qua ký quỹ", p: "Vì tiền được giữ ở ký quỹ trung gian, khoản tiền chưa giải ngân sẽ được hoàn lại cho bên mua theo quyết định xử lý tranh chấp." },
      { h: "Thời gian xử lý", p: `Yêu cầu hoàn tiền được ${C} xem xét trong vòng 3–5 ngày làm việc kể từ khi nhận đủ bằng chứng.` },
    ],
  },
  "phan-anh": {
    title: "Cổng tiếp nhận & danh sách phản ánh",
    sections: [
      { h: "Gửi phản ánh", p: `Bạn có thể gửi phản ánh về chất lượng dịch vụ, đối tác hoặc giao dịch qua email ${COMPANY.EMAIL} hoặc hotline ${COMPANY.HOTLINE}.` },
      { h: "Tiếp nhận & xử lý", p: `Mọi phản ánh đều được ${C} ghi nhận, phân loại và phản hồi. Các trường hợp nghiêm trọng sẽ được ưu tiên xử lý.` },
      { h: "Minh bạch", p: "Kết quả xử lý các phản ánh tiêu biểu được tổng hợp định kỳ nhằm cải thiện chất lượng nền tảng." },
    ],
  },
};

export default function InfoPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const data = CONTENT[slug];

  return (
    <>
      <Navbar />
      <div className="info-page">
        <div className="info-container">
          {!data ? (
            <div className="info-notfound">
              <h1>Không tìm thấy nội dung</h1>
              <p>Mục bạn tìm chưa tồn tại hoặc đã được di chuyển.</p>
              <button onClick={() => navigate("/")}>← Về trang chủ</button>
            </div>
          ) : (
            <>
              <div className="info-head">
                <span className="info-breadcrumb" onClick={() => navigate("/")}>Trang chủ</span>
                <span className="info-arrow">›</span>
                <span>{data.title}</span>
              </div>
              <h1 className="info-title">{data.title}</h1>
              {data.intro && <p className="info-intro">{data.intro}</p>}
              <div className="info-sections">
                {data.sections.map((s, i) => (
                  <section key={i} className="info-section">
                    <h2>{s.h}</h2>
                    <p>{s.p}</p>
                  </section>
                ))}
              </div>
              <div className="info-contact-cta">
                <p>Cần hỗ trợ thêm?</p>
                <div>
                  <a href={`tel:${COMPANY.HOTLINE.replace(/\s/g, "")}`}>📞 {COMPANY.HOTLINE}</a>
                  <a href={`mailto:${COMPANY.EMAIL}`}>✉️ {COMPANY.EMAIL}</a>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}
