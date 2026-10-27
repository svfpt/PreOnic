import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FiCheckCircle, FiShield, FiStar, FiTarget, FiUsers } from "react-icons/fi";
import { useToast } from "../../contexts/ToastContext";
import partnerRatingService from "../../services/partnerRating.service";
import "./BilateralRating.css";

const FLOW_SUPPLIER_TO_BUYER = "supplier_to_buyer";
const FLOW_BUYER_TO_SUPPLIER = "buyer_to_supplier";

const FLOW_CONFIG = {
  [FLOW_SUPPLIER_TO_BUYER]: {
    title: "Nông dân / Supplier đánh giá Doanh nghiệp",
    helper:
      "Đánh giá tính minh bạch, thanh toán và phối hợp hợp đồng trước mùa vụ để giảm rủi ro bị ép giá, chậm tiền.",
    criteria: [
      "Minh bạch điều khoản",
      "Thanh toán đúng hạn",
      "Phối hợp hợp đồng trước mùa vụ",
    ],
    impacts: [
      "Xếp hạng doanh nghiệp đáng tin cậy để hợp tác lâu dài",
      "Bảo vệ nông dân trước rủi ro chậm thanh toán",
      "Tăng khả năng lập kế hoạch gieo trồng an toàn",
    ],
  },
  [FLOW_BUYER_TO_SUPPLIER]: {
    title: "Doanh nghiệp / Buyer đánh giá Nông dân",
    helper:
      "Đánh giá chất lượng, tiến độ giao và khối lượng cam kết để tối ưu nguồn cung và kế hoạch sản xuất.",
    criteria: [
      "Chất lượng sản phẩm",
      "Đúng thời gian giao",
      "Đủ khối lượng cam kết",
    ],
    impacts: [
      "Chọn đúng nhà cung cấp ổn định",
      "Giảm thiểu rủi ro thiếu hụt nguyên liệu",
      "Cải thiện độ chính xác của kế hoạch sản xuất",
    ],
  },
};

const ROLE_LABELS = {
  farmer: "Nông dân",
  enterprise: "Doanh nghiệp",
};

const CONTRACT_STATUS_LABELS = {
  draft: "Bản nháp",
  pending: "Chờ duyệt",
  approved: "Đã phê duyệt",
  active: "Đang thực hiện",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};

const NumberRating = ({ value, onChange }) => (
  <div className="br-stars" role="radiogroup" aria-label="rating">
    {[1, 2, 3, 4, 5].map((score) => (
      <button
        type="button"
        key={score}
        className={`br-star-btn ${value >= score ? "active" : ""}`}
        onClick={() => onChange(score)}
      >
        <FiStar size={14} />
      </button>
    ))}
    <span className="br-score-pill">{value}/5</span>
  </div>
);

export default function BilateralRating({ currentRole = "farmer" }) {
  const { success, error, warning } = useToast();

  const defaultFlow =
    currentRole === "enterprise"
      ? FLOW_BUYER_TO_SUPPLIER
      : FLOW_SUPPLIER_TO_BUYER;

  const [partners, setPartners] = useState([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [selectedContractId, setSelectedContractId] = useState("");
  const [comment, setComment] = useState("");
  const [criterionScores, setCriterionScores] = useState([5, 5, 5]);
  const [givenRatings, setGivenRatings] = useState([]);
  const [receivedRatings, setReceivedRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const activeFlow = defaultFlow;
  const flowDetail = FLOW_CONFIG[activeFlow];

  const selectedPartner = useMemo(
    () => partners.find((item) => item.partnerId === selectedPartnerId) || null,
    [partners, selectedPartnerId]
  );

  const availableContracts = selectedPartner?.contracts || [];
  const selectedContract = availableContracts.find(
    (item) => item.contractId === selectedContractId
  );

  const averageScore = useMemo(
    () =>
      criterionScores.reduce((sum, score) => sum + score, 0) /
      criterionScores.length,
    [criterionScores]
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const [eligibleRes, mineRes] = await Promise.all([
        partnerRatingService.getEligiblePartners(),
        partnerRatingService.getMyRatings(),
      ]);

      const eligiblePartners = eligibleRes?.data?.partners || [];
      setPartners(eligiblePartners);

      if (eligiblePartners.length > 0) {
        const firstPartner = eligiblePartners[0];
        setSelectedPartnerId(firstPartner.partnerId);
        setSelectedContractId(firstPartner.contracts?.[0]?.contractId || "");
      } else {
        setSelectedPartnerId("");
        setSelectedContractId("");
      }

      setGivenRatings(mineRes?.data?.givenRatings || []);
      setReceivedRatings(mineRes?.data?.receivedRatings || []);
    } catch {
      error("Không thể tải dữ liệu đánh giá đối tác");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRole]);

  useEffect(() => {
    if (!selectedPartner) {
      setSelectedContractId("");
      return;
    }

    const hasSelectedContract = selectedPartner.contracts.some(
      (item) => item.contractId === selectedContractId
    );

    if (!hasSelectedContract) {
      setSelectedContractId(selectedPartner.contracts?.[0]?.contractId || "");
    }
  }, [selectedPartner, selectedContractId]);

  const handleChangeScore = (index, score) => {
    setCriterionScores((prev) => prev.map((value, idx) => (idx === index ? score : value)));
  };

  const buildCriteriaPayload = () => {
    if (activeFlow === FLOW_SUPPLIER_TO_BUYER) {
      return {
        transparency: criterionScores[0],
        paymentPunctuality: criterionScores[1],
        coordination: criterionScores[2],
      };
    }

    return {
      quality: criterionScores[0],
      onTimeDelivery: criterionScores[1],
      committedVolume: criterionScores[2],
    };
  };

  const handleSubmitRating = async () => {
    if (!selectedPartner || !selectedContractId || !comment.trim()) {
      warning("Vui lòng chọn đối tác, hợp đồng và nhập nhận xét");
      return;
    }

    setSubmitting(true);
    try {
      await partnerRatingService.createRating({
        contractId: selectedContractId,
        revieweeId: selectedPartner.partnerId,
        criteria: buildCriteriaPayload(),
        comment: comment.trim(),
      });

      success("Gửi đánh giá đối tác thành công");
      setComment("");
      setCriterionScores([5, 5, 5]);
      await loadData();
    } catch (err) {
      error(err?.response?.data?.message || "Không thể gửi đánh giá");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <section className="bilateral-rating br-embedded">
        <div className="br-heading">
          <h2>Đang tải hệ thống đánh giá đối tác...</h2>
        </div>
      </section>
    );
  }

  return (
    <section className="bilateral-rating br-embedded">
      <motion.div
        className="br-heading"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.4 }}
      >
        <span className="br-kicker">
          <FiShield size={14} />
          Rating đối tác 2 chiều
        </span>
        <h2>Đánh giá chéo Doanh nghiệp - Nông dân theo từng hợp đồng</h2>
        <p>
          Sau mỗi hợp đồng hoàn tất, hai bên có thể đánh giá nhau theo bộ tiêu chí riêng
          để xây dựng điểm tin cậy và giảm rủi ro hợp tác cho mùa vụ tiếp theo.
        </p>
      </motion.div>

      <div className="br-layout">
        <motion.article
          className="br-card br-form-card"
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.4 }}
        >
          <div className="br-card-head">
            <span className="br-pill">{flowDetail.title}</span>
          </div>

          <p className="br-subtitle">{flowDetail.helper}</p>

          <div className="br-field-grid">
            <label>
              Đối tác được đánh giá
              <select
                value={selectedPartnerId}
                onChange={(event) => setSelectedPartnerId(event.target.value)}
              >
                <option value="">Chọn đối tác</option>
                {partners.map((partner) => (
                  <option key={partner.partnerId} value={partner.partnerId}>
                    {partner.partnerName} ({partner.contracts.length} hợp đồng)
                  </option>
                ))}
              </select>
            </label>
            <label>
              Mã hợp đồng
              <select
                value={selectedContractId}
                onChange={(event) => setSelectedContractId(event.target.value)}
                disabled={!selectedPartner}
              >
                <option value="">Chọn hợp đồng</option>
                {availableContracts.map((contract) => (
                  <option key={contract.contractId} value={contract.contractId}>
                    {contract.contractCode} - {contract.productName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedContract && (
            <div className="br-contract-note">
              Hợp đồng đang chọn: <strong>{selectedContract.contractCode}</strong> (
              {CONTRACT_STATUS_LABELS[selectedContract.status] || selectedContract.status})
            </div>
          )}

          <div className="br-criteria-list">
            {flowDetail.criteria.map((criterion, index) => (
              <div key={criterion} className="br-criteria-item">
                <div className="br-criteria-label">
                  <FiTarget size={14} />
                  <span>{criterion}</span>
                </div>
                <NumberRating
                  value={criterionScores[index]}
                  onChange={(score) => handleChangeScore(index, score)}
                />
              </div>
            ))}
          </div>

          <label className="br-comment-field">
            Nhận xét chi tiết
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Nhập nhận xét thực tế để đối tác cải thiện quá trình hợp tác..."
              rows={4}
            />
          </label>

          <div className="br-form-footer">
            <div className="br-average">
              <span>Điểm trung bình</span>
              <strong>{averageScore.toFixed(1)}/5</strong>
            </div>
            <button
              type="button"
              className="br-submit-btn"
              onClick={handleSubmitRating}
              disabled={
                submitting ||
                !selectedPartner ||
                !selectedContractId ||
                !comment.trim()
              }
            >
              {submitting ? "Đang gửi..." : "Gửi đánh giá"}
            </button>
          </div>
        </motion.article>

        <motion.article
          className="br-card br-info-card"
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.4 }}
        >
          <div className="br-impact-box">
            <div className="br-impact-title">
              <FiUsers size={15} />
              <span>Giá trị vận hành</span>
            </div>
            <ul>
              {flowDetail.impacts.map((item) => (
                <li key={item}>
                  <FiCheckCircle size={14} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="br-history-head">
            <h4>Đánh giá đã gửi</h4>
            <span>{givenRatings.length} bản ghi</span>
          </div>

          <div className="br-history-list">
            {givenRatings.map((item) => (
              <div key={item.id} className="br-history-item">
                <div className="br-history-top">
                  <strong>{item.revieweeId?.fullName || "Đối tác"}</strong>
                  <span>{Number(item.overallRating || 0).toFixed(1)}/5</span>
                </div>
                <p>{item.comment}</p>
                <div className="br-history-meta">
                  <span>{item.contractId?.contractCode || "-"}</span>
                  <span>{ROLE_LABELS[item.revieweeRole] || item.revieweeRole}</span>
                </div>
              </div>
            ))}
            {givenRatings.length === 0 && (
              <div className="br-history-item">
                <p>Bạn chưa gửi đánh giá nào.</p>
              </div>
            )}
          </div>

          <div className="br-history-head" style={{ marginTop: 16 }}>
            <h4>Đánh giá nhận được</h4>
            <span>{receivedRatings.length} bản ghi</span>
          </div>
          <div className="br-history-list">
            {receivedRatings.map((item) => (
              <div key={item.id} className="br-history-item">
                <div className="br-history-top">
                  <strong>{item.reviewerId?.fullName || "Đối tác"}</strong>
                  <span>{Number(item.overallRating || 0).toFixed(1)}/5</span>
                </div>
                <p>{item.comment}</p>
                <div className="br-history-meta">
                  <span>{item.contractId?.contractCode || "-"}</span>
                  <span>{ROLE_LABELS[item.reviewerRole] || item.reviewerRole}</span>
                </div>
              </div>
            ))}
            {receivedRatings.length === 0 && (
              <div className="br-history-item">
                <p>Chưa có đánh giá nào được gửi cho bạn.</p>
              </div>
            )}
          </div>
        </motion.article>
      </div>
    </section>
  );
}