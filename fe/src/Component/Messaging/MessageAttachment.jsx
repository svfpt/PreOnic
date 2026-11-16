import { useEffect, useState } from 'react';
import messagingService from '../../services/messaging.service';

export default function MessageAttachment({ file }) {
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const isImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimeType);

  useEffect(() => {
    if (!isImage) return undefined;
    let cancelled = false;
    let objectUrl;
    messagingService.downloadAttachment(file._id).then(blob => {
      if (!cancelled) {
        objectUrl = URL.createObjectURL(blob);
        setPreview(objectUrl);
      }
    }).catch(() => { if (!cancelled) setError('Không thể tải ảnh'); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [file._id, isImage]);

  const download = async () => {
    setDownloading(true);
    setError('');
    try {
      const blob = await messagingService.downloadAttachment(file._id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.originalName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError('Không thể tải tệp. Vui lòng thử lại.'); }
    finally { setDownloading(false); }
  };

  return <div className="msg-attachment">
    {isImage && (preview ? <a href={preview} target="_blank" rel="noreferrer"><img src={preview} alt={file.originalName} /></a> : !error && <span>Đang tải ảnh...</span>)}
    <button type="button" onClick={download} disabled={downloading} aria-label={`Tải xuống ${file.originalName}`}>
      📎 {file.originalName} · {Math.max(1, Math.round(file.size / 1024))} KB · {downloading ? 'Đang tải...' : 'Tải xuống'}
    </button>
    {error && <span role="alert">{error}</span>}
  </div>;
}
