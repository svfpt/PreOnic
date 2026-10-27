import "./BrandLogo.css";
import symbolPng from "../../assets/branding/preonic-symbol.png";
import wordmarkPng from "../../assets/branding/preonic-wordmark.png";

export default function BrandLogo({
  size = "md",
  className = "",
}) {
  const classes = ["brand-logo", `brand-logo-${size}`, className].filter(Boolean).join(" ");

  return (
    <div className={classes}>
      <img className="brand-logo-symbol" src={symbolPng} alt="PreOnic icon" />
      <img className="brand-logo-wordmark" src={wordmarkPng} alt="PreOnic" />
    </div>
  );
}
