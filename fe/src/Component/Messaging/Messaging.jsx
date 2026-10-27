import { useState, useRef, useEffect, useCallback } from "react";
import { Container } from "react-bootstrap";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { COMPANY, ROUTES } from "../../constants";
import messagingService from "../../services/messaging.service";
import Navbar from "../Navbar/Navbar";
import "./Messaging.css";

const POLLING_INTERVAL_MS = 5000;

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
    partnerId: partner?._id || partner?.id || null,
    name: partner?.fullName || "Người dùng",
    avatar: (partner?.fullName || "ND").slice(0, 2).toUpperCase(),
    role: partner?.role || "farmer",
    lastMessage: conversation.lastMessage || "",
    time: conversation.lastMessageAt
      ? new Date(conversation.lastMessageAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
      : "",
    unread: conversation.unreadCount || 0,
    online: false,
  };
};

const toUiMessage = (message, currentUserId) => {
  const senderId = message.sender?._id || message.sender?.id || message.sender;
  return {
    id: message._id,
    sender: senderId === currentUserId ? "me" : "them",
    text: message.text,
    time: new Date(message.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
  };
};

function Messaging() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeChat, setActiveChat] = useState(null);
  const [inputText, setInputText] = useState("");
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [conversationError, setConversationError] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const pollingRef = useRef(null);
  const inputRef = useRef(null);

  const currentUserId = getCurrentUserId(user);
  const initialPartnerId = searchParams.get("partnerId");
  const initialConversationId = searchParams.get("conversationId");

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const mergeConversation = useCallback((conversation) => {
    setConversations((prev) => {
      const next = prev.filter((item) => item.id !== conversation.id);
      return [conversation, ...next];
    });
  }, []);

  const loadMessages = useCallback(async (chatId) => {
    if (!chatId || !currentUserId) return;
    try {
      const res = await messagingService.getMessages(chatId);
      if (res?.data) {
        const apiMessages = res.data.map((m) => toUiMessage(m, currentUserId));
        setMessages((prev) => ({ ...prev, [chatId]: apiMessages }));
      }
    } catch { /* giữ nguyên messages cũ khi lỗi */ }
  }, [currentUserId]);

  useEffect(() => {
    scrollToBottom();
  }, [activeChat, messages, scrollToBottom]);

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
            const createdRes = await messagingService.createConversation(initialPartnerId);
            if (createdRes?.data) {
              const created = toUiConversation(createdRes.data, currentUserId);
              nextConvs = [created, ...nextConvs.filter((c) => c.id !== created.id)];
            }
          } catch (err) {
            if (!cancelled) setConversationError(err?.message || "Không thể bắt đầu cuộc trò chuyện mới");
          } finally {
            window.history.replaceState({}, "", window.location.pathname);
          }
        }

        if (!cancelled) {
          setConversations(nextConvs);
          // Ưu tiên mở thẳng cuộc trò chuyện được deep-link từ chuông Tin nhắn.
          const targetId = initialConversationId && nextConvs.some((c) => c.id === initialConversationId)
            ? initialConversationId
            : null;
          setActiveChat((prev) => targetId || prev || nextConvs[0]?.id || null);
          if (initialConversationId) {
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
  }, [currentUserId, initialPartnerId, initialConversationId]);

  useEffect(() => {
    if (!activeChat) return undefined;
    setLoadingMsgs(true);
    loadMessages(activeChat).finally(() => setLoadingMsgs(false));
    clearInterval(pollingRef.current);
    pollingRef.current = setInterval(() => loadMessages(activeChat), POLLING_INTERVAL_MS);
    return () => clearInterval(pollingRef.current);
  }, [activeChat, loadMessages]);

  const handleSend = async () => {
    if (!inputText.trim() || !activeChat || sending) return;
    const text = inputText.trim();
    const nowText = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    const optimistic = { id: `opt-${Date.now()}`, sender: "me", text, time: nowText };

    setMessages((prev) => ({ ...prev, [activeChat]: [...(prev[activeChat] || []), optimistic] }));
    setConversations((prev) => prev.map((c) => c.id === activeChat ? { ...c, lastMessage: text, time: nowText } : c));
    setInputText("");
    setSending(true);

    try {
      await messagingService.sendMessage(activeChat, text);
      const conv = conversations.find((c) => c.id === activeChat);
      if (conv) mergeConversation({ ...conv, lastMessage: text, time: nowText });
      await loadMessages(activeChat);
    } catch { /* optimistic message vẫn hiển thị */ } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleGoToContract = () => {
    const conv = conversations.find((c) => c.id === activeChat);
    if (conv?.partnerId) navigate(`${ROUTES.CONTRACT_FLOW}?product=&partnerId=${conv.partnerId}`);
    else navigate(ROUTES.CONTRACT_FLOW);
  };

  const activePerson = conversations.find((c) => c.id === activeChat);
  const currentMessages = messages[activeChat] || [];
  const filteredConvs = conversations.filter(
    (c) => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const roleLabel = (role) => role === "enterprise" ? "Doanh nghiệp" : "Nông dân";

  return (
    <>
      <Navbar />
      <div className="messaging-page">
        <Container fluid className="messaging-container">
          <div className="messaging-layout">
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
                      onClick={() => setActiveChat(conv.id)}
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
                    <div className="chat-person">
                      <div className="msg-item-avatar large">
                        {activePerson.avatar}
                        {activePerson.online && <span className="online-dot" />}
                      </div>
                      <div>
                        <h4>{activePerson.name}</h4>
                        <span className="chat-status">
                          {activePerson.online ? "🟢 Đang hoạt động" : "Ngoại tuyến"}
                        </span>
                      </div>
                    </div>
                    <div className="chat-actions">
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
                      <button className="chat-action-btn icon-only" title="Gọi điện">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.58 3.49 2 2 0 0 1 3.55 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9a16 16 0 0 0 6.17 6.17l1.63-1.84a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="msg-chat-body">
                    <div className="preon-notice">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                      </svg>
                      <p>
                        Cuộc trò chuyện được bảo vệ bởi {COMPANY.NAME}. Mọi thỏa thuận nên được
                        ký kết qua hợp đồng điện tử để đảm bảo quyền lợi.
                      </p>
                    </div>

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
                        <div key={msg.id} className={`msg-bubble ${msg.sender}`}>
                          <p>{msg.text}</p>
                          <span className="msg-bubble-time">{msg.time}</span>
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  <div className="msg-chat-input">
                    <button className="attach-btn" title="Đính kèm tệp">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                      </svg>
                    </button>
                    <input
                      ref={inputRef}
                      type="text"
                      placeholder="Nhập tin nhắn..."
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                    />
                    <button
                      className="send-btn"
                      onClick={handleSend}
                      disabled={!inputText.trim() || sending}
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
