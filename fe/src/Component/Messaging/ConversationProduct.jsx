import { useEffect, useState } from 'react';
import { Modal } from 'react-bootstrap';
import messagingService from '../../services/messaging.service';
import { resolveImageUrl } from '../../services/product.service';
import { formatPriceRange } from '../../data/products';

export default function ConversationProduct({ conversationId, product, onChange, onOpen }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    const timer = setTimeout(async () => {
      try {
        const res = await messagingService.getConversationProducts(conversationId, { search });
        if (!cancelled) { setProducts(res.data || []); setPagination(res.pagination || {}); }
      } catch { if (!cancelled) setError('Không thể tải sản phẩm. Thử đóng và mở lại để tải lại.'); }
      finally { if (!cancelled) setLoading(false); }
    }, 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [open, search, conversationId]);

  const loadMore = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await messagingService.getConversationProducts(conversationId, { search, before: pagination.nextCursor });
      setProducts(prev => [...prev, ...(res.data || [])]);
      setPagination(res.pagination || {});
    } catch { setError('Không thể tải thêm sản phẩm. Vui lòng thử lại.'); }
    finally { setLoading(false); }
  };

  const select = async item => {
    setSaving(true);
    setError('');
    try {
      const res = await messagingService.attachProduct(conversationId, item._id);
      onChange(res.data);
      setOpen(false);
    } catch (err) { setError(err?.response?.data?.message || 'Không thể gắn sản phẩm. Vui lòng thử lại.'); }
    finally { setSaving(false); }
  };

  return <>
    <div className="msg-product-row">
      {product?._id ? <button className="msg-product-context" onClick={() => onOpen(product._id)}>
        {product.image && <img src={resolveImageUrl(product.image)} alt="" />}
        <span>Đang trao đổi về sản phẩm<strong>{product.name}</strong>
          {formatPriceRange(product.priceMin || 0, product.priceMax || product.priceMin || 0)}/{product.unit || 'kg'}
        </span>
        <span>Xem sản phẩm →</span>
      </button> : <span className="msg-no-product">Chưa gắn sản phẩm cho cuộc trò chuyện này</span>}
      <button className="msg-link-product" onClick={() => { setSearch(''); setOpen(true); }}>
        {product?._id ? 'Đổi sản phẩm' : '+ Gắn sản phẩm'}
      </button>
    </div>
    <Modal show={open} onHide={() => { if (!saving) setOpen(false); }} centered aria-labelledby="chat-product-picker-title" data-messenger-dialog="true">
      <Modal.Header closeButton={!saving}><Modal.Title id="chat-product-picker-title">Chọn sản phẩm để trao đổi</Modal.Title></Modal.Header>
      <Modal.Body>
        <label className="msg-product-search">Tìm sản phẩm
          <input value={search} disabled={saving} onChange={event => setSearch(event.target.value)} placeholder="Nhập tên sản phẩm…" />
        </label>
        {error && <p role="alert" className="msg-history-error">{error}</p>}
        {loading && <p role="status">Đang tải sản phẩm…</p>}
        {!loading && !error && products.length === 0 && <p>Chưa có sản phẩm phù hợp của hai bên trong cuộc trò chuyện.</p>}
        <div className="msg-product-options">
          {products.map(item => <button key={item._id} disabled={saving || loading} onClick={() => select(item)} aria-label={`Gắn sản phẩm ${item.name}`}>
            {item.image && <img src={resolveImageUrl(item.image)} alt="" />}
            <span><strong>{item.name}</strong>{formatPriceRange(item.priceMin || 0, item.priceMax || item.priceMin || 0)}/{item.unit || 'kg'}</span>
            <span>{saving ? 'Đang gắn…' : 'Chọn'}</span>
          </button>)}
        </div>
        {pagination.hasMore && <button className="msg-load-older" disabled={saving || loading} onClick={loadMore}>Tải thêm sản phẩm</button>}
      </Modal.Body>
    </Modal>
  </>;
}
