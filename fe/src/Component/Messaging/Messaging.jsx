import { useState, useRef, useEffect, useCallback } from "react";
import { Container } from "react-bootstrap";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { COMPANY, ROUTES } from "../../constants";
import messagingService from "../../services/messaging.service";
import { subscribeMessaging } from "../../services/messaging-events";
import Navbar from "../Navbar/Navbar";
import MessageAttachment from "./MessageAttachment";
import useMessageDrafts from "./useMessageDrafts";
import useVisibleMessages from "./useVisibleMessages";
import { useVideoCall } from "../../contexts/VideoCallContext";
import { FiVideo } from "react-icons/fi";
import ConversationProduct from "./ConversationProduct";
import "./Messaging.css";

const POLLING_INTERVAL_MS = 30000;

const getCurrentUserId = (user) => user?._id || user?.id || user?.email || null;

const toUiConversation = (conversation, currentUserId) => {
  const partner =
    conversation.partner
    || conversation.participants?.find((p) => {
      const pid = p?._id || p?.id;
      return pid && pid !== currentUserId;
    })
    || null;

  return {
    id: conversation._id,
    aliases: conversation.aliases || [],
    partnerId: partner?._id || partner?.id || null,
    name: partner?.fullName || "Người dùng",
    avatar: (partner?.fullName || "ND").slice(0, 2).toUpperCase(),
    role: partner?.role || "farmer",
    lastMessage: conversation.lastMessage || "",
    time: conversation.lastMessageAt
      ? new Date(conversation.lastMessageAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
      : "",
    unread: conversation.unreadCount || 0,
    online: Boolean(conversation.online),
    product: conversation.product || null,
  };
};

const toUiMessage = (message, currentUserId) => {
  const senderId = message.sender?._id || message.sender?.id || message.sender;
  return {
    id: message._id,
    sender: senderId === currentUserId ? "me" : "them",
    text: message.text,
    attachments: (message.attachments || []).filter(file => file?._id),
    read: (message.readBy || []).some(id => String(id?._id || id) !== senderId),
    selfRead: (message.readBy || []).some(id => String(id?._id || id) === currentUserId),
    time: new Date(message.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
  };
};

function Messaging({ embedded = false, visible = true, target = null, onActiveChatChange, onNavigateAway }) {
  const { user } = useAuth();
  const videoCall = useVideoCall();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeChat, setActiveChat] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [conversationError, setConversationError] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [history, setHistory] = useState({});
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [messageError, setMessageError] = useState("");
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [typingPartner, setTypingPartner] = useState(null);
  const messagesEndRef = useRef(null);
  const chatBodyRef = useRef(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const nearBottomRef = useRef(true);
  const lastScrollRef = useRef({});
  const requestsRef = useRef(new Map());
  const typingTimerRef = useRef(null);
  const typingLastRef = useRef(0);
  const partnerTypingTimerRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const currentUserId = getCurrentUserId(user);
  const { inputText, setInputText, attachments, setAttachments, mergeAliases } = useMessageDrafts(currentUserId, activeChat);
  const initialPartnerId = embedded ? target?.partnerId : searchParams.get("partnerId");
  const initialProductId = embedded ? target?.productId : searchParams.get("productId");
  const initialConversationId = embedded ? target?.conversationId : searchParams.get("conversationId");
  const targetRequestId = target?.requestId;

  useEffect(() => { onActiveChatChange?.(activeChat); }, [activeChat, onActiveChatChange]);

  useEffect(() => { mergeAliases(conversations); }, [conversations, mergeAliases]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const mergeConversation = useCallback((conversation) => {
    setConversations((prev) => {
      const next = prev.filter((item) => item.id !== conversation.id);
      return [conversation, ...next];
    });
  }, []);

  const loadMessages = useCallback(async (chatId, before) => {
    if (!chatId || !currentUserId) return;
    const requestKey = `${chatId}:${before || 'latest'}`;
    if (requestsRef.current.has(requestKey)) return requestsRef.current.get(requestKey);
    const operation = (async () => {
      try {
        const existing = messagesRef.current[chatId] || [];
        let after = !before && existing.length ? existing[existing.length - 1].id : null;
        let more;
        do {
          const options = before ? { before } : after ? { after } : undefined;
          const res = options ? await messagingService.getMessages(chatId, options) : await messagingService.getMessages(chatId);
          const apiMessages = (res?.data || []).map((m) => toUiMessage(m, currentUserId));
          setMessages(prev => {
            const byId = new Map((prev[chatId] || []).map(message => [message.id, message]));
            apiMessages.forEach(message => byId.set(message.id, message));
            return { ...prev, [chatId]: [...byId.values()].sort((a, b) => a.id.localeCompare(b.id)) };
          });
          if (!after) setHistory(prev => ({ ...prev, [chatId]: res?.pagination || { hasMore: false } }));
          more = !before && after && res?.pagination?.hasMore && res?.pagination?.nextCursor !== after;
          after = res?.pagination?.nextCursor;
        } while (more);
        setMessageError("");
      } catch { setMessageError("Không thể tải tin nhắn. Vui lòng thử lại."); }
      finally { requestsRef.current.delete(requestKey); }
    })();
    requestsRef.current.set(requestKey, operation);
    return operation;
  }, [currentUserId]);

  useEffect(() => {
    const latest = messages[activeChat]?.slice(-1)[0]?.id;
    const previous = lastScrollRef.current;
    if (visible && (previous.chat !== activeChat || ((latest !== previous.latest || !previous.visible) && nearBottomRef.current))) scrollToBottom();
    lastScrollRef.current = { chat: activeChat, latest, visible };
  }, [activeChat, messages, scrollToBottom, visible]);

  const onRead = useCallback((chatId, ids) => {
    setMessages(prev => ({ ...prev, [chatId]: (prev[chatId] || []).map(message => ids.includes(message.id) ? { ...message, selfRead: true } : message) }));
    setConversations(prev => prev.map(chat => chat.id === chatId ? { ...chat, unread: Math.max(0, chat.unread - ids.length) } : chat));
  }, []);
  useVisibleMessages(chatBodyRef, activeChat, messages[activeChat], onRead, visible);

  useEffect(() => {
    if (!currentUserId) return undefined;
    let cancelled = false;

    const bootstrap = async () => {
      setLoadingConvs(true);
      setConversationError("");
      try {
        const res = await messagingService.getConversations();
        let nextConvs = (res?.data || []).map((c) => toUiConversation(c, currentUserId));

        if (initialPartnerId) {
          try {
            const createdRes = initialProductId
              ? await messagingService.createConversation(initialPartnerId, initialProductId)
              : await messagingService.createConversation(initialPartnerId);
            if (createdRes?.data) {
              const created = toUiConversation(createdRes.data, currentUserId);
              nextConvs = [created, ...nextConvs.filter((c) => c.id !== created.id)];
            }
          } catch (err) {
            if (!cancelled) setConversationError(err?.response?.data?.message || err?.message || "Không thể bắt đầu cuộc trò chuyện mới");
          } finally {
            if (!embedded) window.history.replaceState({}, "", window.location.pathname);
          }
        }

        if (!cancelled) {
          setConversations(nextConvs);
          // Ưu tiên mở thẳng cuộc trò chuyện được deep-link từ chuông Tin nhắn.
          const targetId = initialConversationId && nextConvs.find((c) => c.id === initialConversationId || c.aliases.includes(initialConversationId))?.id;
          const partnerChat = initialPartnerId && nextConvs.find((c) => c.partnerId === initialPartnerId);
          setActiveChat((prev) => targetId || partnerChat?.id || prev || (!embedded ? nextConvs[0]?.id : null) || null);
          if (initialConversationId && !embedded) {
            window.history.replaceState({}, "", window.location.pathname);
          }
        }
      } catch {
        if (!cancelled) {
          setConversationError("Không thể tải danh sách cuộc trò chuyện");
          setConversations([]);
        }
      } finally {
        if (!cancelled) setLoadingConvs(false);
      }
    };

    bootstrap();
    return () => { cancelled = true; };
  }, [currentUserId, initialPartnerId, initialConversationId, initialProductId, embedded, targetRequestId]);

  useEffect(() => {
    if (!activeChat) return undefined;
    setSendError("");
    setMessageError("");
    nearBottomRef.current = true;
    setLoadingMsgs(true);
    loadMessages(activeChat).finally(() => setLoadingMsgs(false));
  }, [activeChat, loadMessages]);

  useEffect(() => {
    if (!currentUserId) return undefined;
    let cancelled = false;
    const sync = async (event) => {
      if (event.type === 'connection') { setConnectionStatus(event.status); return; }
      if (event.type === 'product') {
        setConversations(prev => prev.map(chat => chat.id === event.conversationId ? { ...chat, product: event.product } : chat));
        return;
      }
      if (event.type === 'typing') {
        if (event.conversationId === activeChat) {
          clearTimeout(partnerTypingTimerRef.current);
          setTypingPartner(event.typing ? activeChat : null);
          if (event.typing) partnerTypingTimerRef.current = setTimeout(() => setTypingPartner(null), 4000);
        }
        return;
      }
      if (event.type === 'presence') {
        setConversations(prev => prev.map(chat => chat.partnerId === event.userId ? { ...chat, online: event.online } : chat));
        return;
      }
      if (event.type === 'read') {
        const ids = event.messageIds || [];
        setMessages(prev => ({ ...prev, [event.conversationId]: (prev[event.conversationId] || []).map(message =>
          ids.includes(message.id) ? { ...message, ...(event.userId === currentUserId ? { selfRead: true } : { read: true }) } : message) }));
      }
      if (activeChat && (event.type === 'connected' || (event.type === 'message' && event.conversationId === activeChat))) {
        await loadMessages(activeChat);
      }
      try {
        if (activeChat && event.type === 'connected') {
          const pending = (messagesRef.current[activeChat] || []).filter(message => message.sender === 'me' && !message.read).map(message => message.id);
          for (let index = 0; index < pending.length; index += 100) {
            const receiptRes = await messagingService.getReceipts(activeChat, pending.slice(index, index + 100));
            const seen = new Set((receiptRes?.data || []).filter(receipt => receipt.readBy.some(id => String(id) !== currentUserId)).map(receipt => receipt._id));
            if (!cancelled) setMessages(prev => ({ ...prev, [activeChat]: (prev[activeChat] || []).map(message => seen.has(message.id) ? { ...message, read: true } : message) }));
          }
        }
        const res = await messagingService.getConversations();
        if (!cancelled) {
          const next = (res?.data || []).map((c) => toUiConversation(c, currentUserId));
          setConversations(next);
          setActiveChat(previous => next.find(chat => chat.id === previous || chat.aliases.includes(previous))?.id || previous);
        }
      } catch { /* reconnect will resync */ }
    };
    const unsubscribe = subscribeMessaging(sync);
    // Recover even when a proxy does not support streaming.
    const timer = setInterval(() => sync({ type: 'connected' }), POLLING_INTERVAL_MS);
    return () => { cancelled = true; unsubscribe(); clearInterval(timer); };
  }, [currentUserId, activeChat, loadMessages]);

  useEffect(() => {
    setTypingPartner(null);
    typingLastRef.current = 0;
    return () => {
      clearTimeout(typingTimerRef.current);
      clearTimeout(partnerTypingTimerRef.current);
      if (activeChat) messagingService.setTyping(activeChat, false).catch(() => undefined);
    };
  }, [activeChat]);

  useEffect(() => {
    if (!visible) {
      clearTimeout(typingTimerRef.current);
      if (activeChat) messagingService.setTyping(activeChat, false).catch(() => undefined);
    }
  }, [visible, activeChat]);

  const changeInput = value => {
    setInputText(value);
    clearTimeout(typingTimerRef.current);
    if (!value.trim()) { messagingService.setTyping(activeChat, false).catch(() => undefined); return; }
    if (Date.now() - typingLastRef.current > 2000) {
      typingLastRef.current = Date.now();
      messagingService.setTyping(activeChat, true).catch(() => undefined);
    }
    typingTimerRef.current = setTimeout(() => messagingService.setTyping(activeChat, false).catch(() => undefined), 2500);
  };

  const loadOlder = async () => {
    if (loadingOlder || !history[activeChat]?.nextCursor) return;
    const container = chatBodyRef.current;
    const previousHeight = container?.scrollHeight || 0;
    const previousTop = container?.scrollTop || 0;
    setLoadingOlder(true);
    await loadMessages(activeChat, history[activeChat].nextCursor);
    setLoadingOlder(false);
    requestAnimationFrame(() => { if (container) container.scrollTop = previousTop + container.scrollHeight - previousHeight; });
  };

  const removeAttachment = async file => {
    try {
      await messagingService.removeAttachment(file._id);
      setAttachments(prev => prev.filter(item => item._id !== file._id));
      setSendError('');
    } catch (err) {
      if (err?.response?.status === 404) setAttachments(prev => prev.filter(item => item._id !== file._id));
      else setSendError('Không thể bỏ tệp. Vui lòng thử lại.');
    }
  };

  const handleFiles = async (event) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = '';
    if (!selected.length || uploading || sending) return;
    if (selected.length + attachments.length > 5) {
      setSendError('Mỗi tin nhắn chỉ được đính kèm tối đa 5 tệp.');
      return;
    }
    if (selected.some(file => file.size > 5 * 1024 * 1024 || !file.size)) {
      setSendError('Mỗi tệp phải có nội dung và không vượt quá 5 MB.');
      return;
    }
    setSendError('');
    setUploading(true);
    try {
      for (const file of selected) {
        const res = await messagingService.uploadAttachment(activeChat, file);
        if (res?.data) setAttachments(prev => [...prev, res.data]);
      }
    } catch (err) { setSendError(err?.response?.data?.message || 'Không thể tải tệp lên. Vui lòng thử lại.'); }
    finally { setUploading(false); }
  };

  const handleSend = async () => {
    if ((!inputText.trim() && !attachments.length) || !activeChat || sending || uploading) return;
    const text = inputText.trim();
    clearTimeout(typingTimerRef.current);
    messagingService.setTyping(activeChat, false).catch(() => undefined);
    nearBottomRef.current = true;
    const pendingAttachments = attachments;
    const nowText = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    setSendError("");
    setInputText("");
    setSending(true);

    try {
      const res = await messagingService.sendMessage(activeChat, text, pendingAttachments.map(file => file._id));
      setAttachments(current => current.filter(file => !pendingAttachments.some(sent => sent._id === file._id)));
      if (res?.data) {
        const saved = toUiMessage(res.data, currentUserId);
        setMessages((prev) => ({ ...prev, [activeChat]: [...(prev[activeChat] || []).filter((m) => m.id !== saved.id), saved] }));
      }
      const conv = conversations.find((c) => c.id === activeChat);
      if (conv) mergeConversation({ ...conv, lastMessage: text || `📎 ${pendingAttachments.length} tệp đính kèm`, time: nowText });
      await loadMessages(activeChat);
    } catch (err) {
      setSendError(err?.response?.data?.message || "Không thể gửi tin nhắn. Vui lòng thử lại.");
      setInputText((draft) => draft || text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleGoToContract = () => {
    const conv = conversations.find((c) => c.id === activeChat);
    if (conv?.partnerId) navigate(`${ROUTES.CONTRACT_FLOW}?product=${conv.product?._id || ''}&partnerId=${conv.partnerId}`);
    else navigate(ROUTES.CONTRACT_FLOW);
    onNavigateAway?.();
  };

  const activePerson = conversations.find((c) => c.id === activeChat);
  const currentMessages = messages[activeChat] || [];
  const filteredConvs = conversations.filter(
    (c) => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const roleLabel = (role) => role === "enterprise" ? "Doanh nghiệp" : "Nông dân";

  return (
    <>
      {!embedded && <Navbar />}
      <div className={`messaging-page ${embedded ? 'messaging-embedded' : ''} ${activeChat ? 'has-active-chat' : ''}`}>
        <Container fluid className="messaging-container">
          <div className={`messaging-layout ${activeChat ? 'chat-open' : ''}`}>
            {/* ── SIDEBAR ── */}
            <div className="msg-sidebar">
              <div className="msg-sidebar-header">
                <h3>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8, verticalAlign: "middle" }}>
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  Tin nhắn
                </h3>
                <button className="back-btn" onClick={() => navigate(-1)}>Quay lại</button>
              </div>

              <div className="msg-search">
                <input
                  type="text"
                  placeholder="Tìm kiếm cuộc trò chuyện..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {conversationError && (
                <div className="msg-list-empty"><p>{conversationError}</p></div>
              )}

              <div className="msg-list">
                {loadingConvs ? (
                  <div className="msg-list-loading">
                    <div className="msg-loading-spinner" />
                    Đang tải...
                  </div>
                ) : filteredConvs.length === 0 ? (
                  <div className="msg-list-empty">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#c6ddc9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}>
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    <p>{searchQuery ? "Không tìm thấy cuộc trò chuyện" : "Chưa có cuộc trò chuyện nào"}</p>
                    {!searchQuery && (
                      <p style={{ fontSize: "0.8rem", color: "#aaa", marginTop: 4 }}>
                        Mở từ trang sản phẩm để bắt đầu nhắn tin với đối tác.
                      </p>
                    )}
                  </div>
                ) : (
                  filteredConvs.map((conv) => (
                    <div
                      key={conv.id}
                      className={`msg-item ${activeChat === conv.id ? "active" : ""}`}
                      onClick={() => { if (!sending && !uploading) setActiveChat(conv.id); }}
                    >
                      <div className="msg-item-avatar">
                        {conv.avatar}
                        {conv.online && <span className="online-dot" />}
                      </div>
                      <div className="msg-item-content">
                        <div className="msg-item-top">
                          <h4>{conv.name}</h4>
                          <span className="msg-time">{conv.time}</span>
                        </div>
                        <div className="msg-item-bottom">
                          <p className="msg-preview">{conv.lastMessage || "Chưa có tin nhắn"}</p>
                          <span className="msg-role-tag">{roleLabel(conv.role)}</span>
                        </div>
                      </div>
                      {conv.unread > 0 && (
                        <span className="unread-badge">{conv.unread}</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ── CHAT AREA ── */}
            <div className="msg-chat">
              {activePerson ? (
                <>
                  <div className="msg-chat-header">
                    <button className="msg-back-to-list" aria-label="Về danh sách trò chuyện"
                      disabled={sending || uploading} onClick={() => setActiveChat(null)}>←</button>
                    <div className="chat-person">
                      <div className="msg-item-avatar large">
                        {activePerson.avatar}
                        {activePerson.online && <span className="online-dot" />}
                      </div>
                      <div>
                        <h4>{activePerson.name}</h4>
                        <span className="chat-status">
                          {typingPartner === activeChat ? 'Đang nhập…' : `${roleLabel(activePerson.role)} · ${activePerson.online ? 'Đang hoạt động' : 'Ngoại tuyến'}`}
                        </span>
                      </div>
                    </div>
                    <div className="chat-actions">
                      {videoCall?.enabled && <button className="chat-action-btn" title="Gọi video" aria-label="Gọi video"
                        disabled={videoCall.busy || sending || uploading}
                        onClick={() => { void videoCall.start(activeChat, activePerson.name); onNavigateAway?.(); }}><FiVideo size={18} /></button>}
                      <button
                        className="chat-action-btn contract-action"
                        title="Tạo hợp đồng với đối tác này"
                        onClick={handleGoToContract}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
                        </svg>
                        Tạo hợp đồng
                      </button>
                    </div>
                  </div>

                  <div className={`msg-connection ${connectionStatus}`} role="status">
                    {connectionStatus === 'connected' ? 'Đã kết nối realtime' : connectionStatus === 'reconnecting' ? 'Mất kết nối · Đang kết nối lại…' : 'Đang kết nối…'}
                  </div>
                  <ConversationProduct key={activeChat} conversationId={activeChat} product={activePerson.product}
                    onOpen={productId => {
                      navigate(`/products/${productId}?conversationId=${encodeURIComponent(activeChat)}`);
                      onNavigateAway?.();
                    }}
                    onChange={product => setConversations(prev => prev.map(chat => chat.id === activeChat ? { ...chat, product } : chat))} />

                  <div className="msg-chat-body" ref={chatBodyRef} onScroll={event => {
                    const node = event.currentTarget;
                    nearBottomRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 100;
                  }}>
                    <div className="preon-notice">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                      </svg>
                      <p>
                        Cuộc trò chuyện được bảo vệ bởi {COMPANY.NAME}. Mọi thỏa thuận nên được
                        ký kết qua hợp đồng điện tử để đảm bảo quyền lợi.
                      </p>
                    </div>

                    {history[activeChat]?.hasMore && <button className="msg-load-older" disabled={loadingOlder} onClick={loadOlder}>
                      {loadingOlder ? 'Đang tải tin cũ…' : 'Tải tin nhắn cũ hơn'}
                    </button>}
                    {messageError && <div role="alert" className="msg-history-error">{messageError}
                      <button onClick={() => loadMessages(activeChat)}>Thử lại</button>
                    </div>}
                    {loadingMsgs && currentMessages.length === 0 ? (
                      <div className="msgs-loading">
                        <div className="msg-loading-spinner" />
                        Đang tải tin nhắn...
                      </div>
                    ) : currentMessages.length === 0 ? (
                      <div className="msgs-empty">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#c6ddc9" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        <p>Chưa có tin nhắn. Hãy bắt đầu cuộc trò chuyện!</p>
                      </div>
                    ) : (
                      currentMessages.map((msg) => (
                        <div key={msg.id} className={`msg-bubble ${msg.sender}`} data-message-id={msg.id}
                          data-unread={msg.sender === 'them' && !msg.selfRead ? 'true' : 'false'}>
                          {msg.text && <p>{msg.text}</p>}
                          {msg.attachments.map(file => <MessageAttachment key={file._id} file={file} />)}
                          <span className="msg-bubble-time">{msg.time}{msg.sender === 'me' ? ` · ${msg.read ? 'Đã xem' : 'Đã gửi'}` : ''}</span>
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {sendError && <p role="alert" className="msg-send-error">{sendError}</p>}
                  {(attachments.length > 0 || uploading) && <div className="msg-pending-files" aria-live="polite">
                    {attachments.map(file => <div key={file._id}>
                      <span>📎 {file.originalName}</span>
                      <button type="button" aria-label={`Bỏ ${file.originalName}`} disabled={sending || uploading}
                        onClick={() => removeAttachment(file)}>×</button>
                    </div>)}
                    {uploading && <span>Đang tải tệp lên...</span>}
                  </div>}
                  <div className="msg-chat-input">
                    <input ref={fileInputRef} type="file" hidden multiple aria-label="Chọn ảnh và tệp đính kèm"
                      accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx,.zip,.txt"
                      onChange={handleFiles} disabled={uploading || sending} />
                    <button className="attach-btn" title="Đính kèm ảnh hoặc tệp (tối đa 5 MB/tệp)"
                      aria-label="Đính kèm ảnh hoặc tệp" disabled={uploading || sending || attachments.length >= 5}
                      onClick={() => fileInputRef.current?.click()}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                      </svg>
                    </button>
                    <input
                      ref={inputRef}
                      type="text"
                      maxLength={5000}
                      placeholder="Nhập tin nhắn..."
                      value={inputText}
                      onChange={(e) => changeInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && handleSend()}
                    />
                    <button
                      className="send-btn"
                      onClick={handleSend}
                      disabled={(!inputText.trim() && !attachments.length) || sending || uploading}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                      </svg>
                      Gửi
                    </button>
                  </div>
                </>
              ) : (
                <div className="msg-empty">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#c6ddc9" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  <p>Chọn cuộc trò chuyện để bắt đầu</p>
                </div>
              )}
            </div>
          </div>
        </Container>
      </div>
    </>
  );
}

export default Messaging;
