import { useState } from "react";

export default function UserAvatar({ user, className, fallback = "ND" }) {
  const [failedSource, setFailedSource] = useState(null);
  const source = user?.avatar;
  return <div className={className} style={{ overflow: "hidden", flexShrink: 0 }}>
    {source && source !== failedSource ? (
      <img src={source} alt={`Ảnh đại diện ${user?.fullName || "người dùng"}`}
        referrerPolicy="no-referrer" onError={() => setFailedSource(source)}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
    ) : (user?.fullName || fallback).slice(0, 2).toUpperCase()}
  </div>;
}
