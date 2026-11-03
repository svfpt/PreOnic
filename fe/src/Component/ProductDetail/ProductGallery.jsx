import { useEffect, useRef, useState } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { resolveImageUrl } from "../../services/product.service";

export default function ProductGallery({ images, image, name, children }) {
  const [index, setIndex] = useState(0);
  const touchStart = useRef(null);
  const source = Array.isArray(images) && images.length ? images : [image];
  const photos = [...new Set(source.filter(value => typeof value === "string" && value).map(resolveImageUrl))];
  if (!photos.length) photos.push(resolveImageUrl(null));
  const current = index % photos.length;
  const move = delta => setIndex(previous => (previous + delta + photos.length) % photos.length);
  useEffect(() => { setIndex(0); }, [images, image]);

  return (
    <div className="pd-gallery" role="region" aria-label={`Ảnh sản phẩm ${name}`} tabIndex={0}
      onKeyDown={event => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          move(event.key === "ArrowLeft" ? -1 : 1);
        }
      }}>
      <div className="pd-image-wrap"
        onTouchStart={event => { touchStart.current = event.touches[0].clientX; }}
        onTouchEnd={event => {
          if (touchStart.current === null) return;
          const distance = touchStart.current - event.changedTouches[0].clientX;
          if (Math.abs(distance) > 40) move(distance > 0 ? 1 : -1);
          touchStart.current = null;
        }}>
        <img className="pd-gallery-main" src={photos[current]} alt={`${name} — ảnh ${current + 1}`}
          onError={event => { const fallback = resolveImageUrl(null); if (!event.currentTarget.src.endsWith(fallback)) event.currentTarget.src = fallback; }} />
        {children}
        {photos.length > 1 && <>
          <button type="button" className="pd-gallery-arrow pd-gallery-prev" aria-label="Ảnh trước" onClick={() => move(-1)}><FiChevronLeft /></button>
          <button type="button" className="pd-gallery-arrow pd-gallery-next" aria-label="Ảnh tiếp theo" onClick={() => move(1)}><FiChevronRight /></button>
          <span className="pd-gallery-counter" aria-live="polite">{current + 1} / {photos.length}</span>
        </>}
      </div>
      {photos.length > 1 && <div className="pd-gallery-thumbnails" aria-label="Chọn ảnh sản phẩm">
        {photos.map((url, position) => <button type="button" key={url} className={`pd-gallery-thumb ${position === current ? "is-active" : ""}`}
          aria-label={`Xem ảnh ${position + 1}`} aria-pressed={position === current} onClick={() => setIndex(position)}>
          <img src={url} alt="" loading="lazy" />
        </button>)}
      </div>}
    </div>
  );
}
