import { useLocation, useSearchParams } from "react-router-dom";
import EmailOtpForm from "./EmailOtpForm";
export default function VerifyEmail() {
  const [params] = useSearchParams();
  const location = useLocation();
  return <div className="verify-page"><div className="verify-card">
    <div className="verify-brand"><h2>PreOnic</h2></div>
    <EmailOtpForm key={params.get("email") || ""} initialEmail={params.get("email") || ""}
      initiallySent={location.state?.otpSent === true} />
  </div></div>;
}
