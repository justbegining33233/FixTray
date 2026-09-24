"use client";

import { usePhrase } from '@/lib/usePhrase';
import React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FaComments, FaExclamationTriangle, FaStore, FaUser, FaUserTie, FaWrench } from 'react-icons/fa';
import { chatMessageContent, messageListPreview } from '@/lib/messageAttachment';
import ChatMessageBody from '@/components/ChatMessageBody';
import { ChatImageAttachButton, PendingChatImage } from '@/components/ChatImageAttach';

// --- Types -------------------------------------------------------------------

interface Message {
  id: string;
  senderId: string;
  senderRole: string;
  senderName: string;
  receiverId: string;
  receiverRole: string;
  receiverName: string;
  body: string;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  createdAt: string;
  isRead: boolean;
}

interface Conversation {
  contactId: string;
  contactName: string;
  contactRole: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  messages: Message[];
  shopId?: string;
}

interface AvailableContact {
  id: string;
  name: string;
  role: string;
  shopId: string;
  contextLabel: string;
  // mapped fields for send helper
  contactId?: string;
  contactName?: string;
  contactRole?: string;
}

interface CustomerMessagingCardProps {
  header?: string;
  initialShopId?: string;
}

// --- Constants ---------------------------------------------------------------

const ROLE_ICON: Record<string, React.ReactNode> = { shop: <FaStore />, manager: <FaUserTie />, tech: <FaWrench /> };
const ROLE_LABEL: Record<string, string> = { shop: "Shop", manager: "Manager", tech: "Tech" };
const ROLE_COLOR: Record<string, string> = { shop: "#f59e0b", manager: "#8b5cf6", tech: "#10b981" };

type TabKey = "all" | "shop" | "manager" | "tech";
const ROLE_FILTERS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "shop", label: "Shops" },
  { key: "manager", label: "Managers" },
  { key: "tech", label: "Techs" },
];

// --- Component ---------------------------------------------------------------

export default function CustomerMessagingCard({ header = "Messages", initialShopId }: CustomerMessagingCardProps) {
  const say = usePhrase();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const selectedRef = useRef<Conversation | null>(null);
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [threadState, setThreadState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [authError, setAuthError] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [custMsgMsg, setCustMsgMsg] = useState<{type:'success'|'error';text:string}|null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Compose-new message state
  const [showCompose, setShowCompose] = useState(false);
  const [availableContacts, setAvailableContacts] = useState<AvailableContact[]>([]);
  const [newRecipient, setNewRecipient] = useState<AvailableContact | null>(null);
  const [composeRoleFilter, setComposeRoleFilter] = useState<TabKey>("all");
  const [contactsLoading, setContactsLoading] = useState(false);
  const [noContacts, setNoContacts] = useState(false);

  // Active tab filter
  const [activeTab, setActiveTab] = useState<TabKey>("all");

  // Conversations that are shop/tech/manager side (the people a customer chats with)
  const shopStaffConversations = useMemo(
    () => conversations.filter((c) => ["shop", "tech", "manager"].includes(c.contactRole ?? "")),
    [conversations],
  );

  // Narrow by active tab
  const filteredConversations = useMemo(() => {
    let base = shopStaffConversations;
    if (initialShopId) {
      base = base.filter((c) => c.shopId === initialShopId || c.contactId === initialShopId);
    }
    if (activeTab === "all") return base;
    return base.filter((c) => c.contactRole === activeTab);
  }, [shopStaffConversations, activeTab, initialShopId]);

  // Unread counts per tab
  const unreadByTab = useMemo(() => {
    const counts: Record<string, number> = { all: 0, shop: 0, manager: 0, tech: 0 };
    for (const c of shopStaffConversations) {
      counts.all += c.unreadCount;
      if (counts[c.contactRole] !== undefined) counts[c.contactRole] += c.unreadCount;
    }
    return counts;
  }, [shopStaffConversations]);

  const filteredAvailableContacts = useMemo(() => {
    let contacts = availableContacts;
    if (initialShopId) {
      contacts = contacts.filter((c) => c.shopId === initialShopId || c.id === initialShopId);
    }
    if (composeRoleFilter === "all") return contacts;
    return contacts.filter((c) => c.role === composeRoleFilter);
  }, [availableContacts, composeRoleFilter, initialShopId]);

  // Auto-select the conversation matching initialShopId on first data load.
  // Opening it the same way a click does, including mark-read.
  useEffect(() => {
    if (initialShopId && conversations.length > 0 && !selected) {
      const match = conversations.find(
        (c) => c.shopId === initialShopId || c.contactId === initialShopId,
      );
      if (match) {
        selectedRef.current = match;
        setSelected(match);
        setThreadMessages(match.messages ?? []);
        void markAsRead(match);
        void fetchThread(match);
      }
    }
  }, [conversations, initialShopId, selected]);

  useEffect(() => {
    // Capture userId once on mount for correct isMine checks
    const storedUserId = localStorage.getItem("userId") || "";
    setUserId(storedUserId);
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
     
  }, []);

  // Keep ref in sync with state so stale-closure polls can read the current selection
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  // Auto-scroll to bottom when thread messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadMessages]);

  // Poll the active thread every 5 s for live updates
  useEffect(() => {
    if (!selected) return;
    const interval = setInterval(() => fetchThread(selected, { background: true }), 5000);
    return () => clearInterval(interval);
     
  }, [selected?.contactId, selected?.contactRole]);

  // --- API helpers -----------------------------------------------------------

  const fetchMessages = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) { setAuthError(true); return; }
      const res = await fetch("/api/messages", { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { setAuthError(true); return; }
      const data = await res.json();
      setConversations(data.conversations || []);
      setAuthError(false);
      // keep selected metadata in sync
      const current = selectedRef.current;
      if (current) {
        const updated = (data.conversations || []).find(
          (c: Conversation) => c.contactId === current.contactId && c.contactRole === current.contactRole,
        );
        if (updated) setSelected(updated);
      }
    } catch { /* silent */ }
  };

  // Fetch the COMPLETE message history for a specific conversation (no limit)
  const fetchThread = async (conv: Conversation, options?: { background?: boolean }) => {
    if (!options?.background) setThreadState("loading");
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        if (!options?.background) setThreadState("error");
        return;
      }
      const params = new URLSearchParams({ contactId: conv.contactId, role: conv.contactRole });
      const res = await fetch(`/api/messages?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        const convData = (data.conversations || []).find(
          (c: Conversation) => c.contactId === conv.contactId && c.contactRole === conv.contactRole,
        );
        if (convData) setThreadMessages(convData.messages ?? []);
        setThreadState("ready");
      } else if (!options?.background) {
        setThreadState("error");
      }
    } catch {
      if (!options?.background) setThreadState("error");
    }
  };

  const fetchAvailableContacts = async () => {
    setContactsLoading(true);
    setNoContacts(false);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/messages/contacts", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const { contacts } = await res.json();
        setAvailableContacts(contacts || []);
        setNoContacts((contacts || []).length === 0);
      }
    } catch { /* silent */ }
    finally { setContactsLoading(false); }
  };

  const markAsRead = async (conv: Conversation) => {
    if (!conv.unreadCount) return;
    try {
      const token = localStorage.getItem("token");
      await fetch("/api/messages", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ contactId: conv.contactId, contactRole: conv.contactRole }),
      });
      fetchMessages();
    } catch { /* silent */ }
  };

  // --- Actions ---------------------------------------------------------------

  const handleSelectConversation = (conv: Conversation) => {
    setSelected(conv);
    setThreadMessages(conv.messages ?? []);  // Show existing messages immediately
    setShowCompose(false);
    setPendingUrl(null);
    markAsRead(conv);
    fetchThread(conv);  // Then load full history
  };

  const handleSend = async () => {
    const target = showCompose
      ? (newRecipient ? { contactId: newRecipient.id, contactRole: newRecipient.role, contactName: newRecipient.name } : null)
      : selected;
    if ((!messageText.trim() && !pendingUrl) || !target) return;
    setLoading(true);
    const draft = messageText.trim();
    const draftImage = pendingUrl;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          receiverId: target.contactId,
          receiverRole: target.contactRole,
          receiverName: target.contactName,
          messageBody: draft,
          attachmentUrl: draftImage,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.message?.id) {
        setCustMsgMsg({ type: "error", text: data.error || "Message was not saved. Your draft is still here." });
        return;
      }
      setThreadMessages((current) => current.some((row) => row.id === data.message.id) ? current : [...current, data.message]);
      {
        setMessageText("");
        setPendingUrl(null);
        if (showCompose && target) {
          setShowCompose(false);
          setNewRecipient(null);
          const opened: Conversation = {
            contactId: target.contactId,
            contactRole: target.contactRole,
            contactName: target.contactName,
            lastMessage: messageListPreview(draft, draftImage),
            lastMessageAt: new Date().toISOString(),
            unreadCount: 0,
            messages: [],
          };
          selectedRef.current = opened;
          setSelected(opened);
          await fetchThread(opened);
        } else if (selected) {
          await fetchThread(selected);
        }
        await fetchMessages();
      }
    } catch { setCustMsgMsg({type:'error',text:"Message was not saved. Your draft is still here."}); }
    finally { setLoading(false); }
  };

  // --- Render ----------------------------------------------------------------

  return (
    <div style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>

      {/* Auth error banner */}
      {authError && (
        <div style={{ padding: "10px 16px", background: "rgba(239,68,68,0.15)", color: "#fecdd3", fontSize: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{say("Session expired. Please sign in again.")}</span>
          <button onClick={() => { localStorage.clear(); window.location.href = "/auth/login"; }}
            style={{ padding: "4px 10px", background: "#ef4444", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
            {say("Log-In")}{' '}</button>
        </div>
      )}

      {/* Header */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ margin: 0, color: "#e5e7eb", fontSize: 16, fontWeight: 700 }}>{say(header)}</h3>
          <p style={{ margin: 0, color: "#9ca3af", fontSize: 12 }}>{say("Chat with shops, managers & techs")}</p>
        </div>
        <button
          onClick={() => { setShowCompose(true); setSelected(null); setPendingUrl(null); setComposeRoleFilter(activeTab); fetchAvailableContacts(); }}
          style={{ padding: "6px 12px", background: "#e5332a", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
          {say("+ New")}{' '}</button>
      </div>

      {/* Category dropdown */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.2)" }}>
        <label style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>{say("Category")}</label>
        <select
          value={activeTab}
          onChange={(e) => {
            setActiveTab(e.target.value as TabKey);
            setSelected(null);
          }}
          style={{ flex: 1, padding: "7px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(0,0,0,0.3)", color: "#e5e7eb", fontSize: 12, fontWeight: 600 }}>
          {ROLE_FILTERS.map((filter) => {
            const count = unreadByTab[filter.key] || 0;
            return (
              <option key={filter.key} value={filter.key}>
                {say(filter.label)}{count > 0 ? ` (${count > 99 ? "99+" : count} unread)` : ""}
              </option>
            );
          })}
        </select>
        <span style={{ fontSize: 11, color: "#6b7280" }}>
          {say(filteredConversations.length)} thread{filteredConversations.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Body */}
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", minHeight: 360 }}>

        {/* Left: conversation list */}
        <div style={{ borderRight: "1px solid rgba(255,255,255,0.06)", overflowY: "auto", maxHeight: 480 }}>
          {filteredConversations.length === 0 ? (
            <div style={{ padding: "24px 16px", color: "#6b7280", fontSize: 12, textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}><FaComments style={{marginRight:4}} /></div>
              {say("No conversations yet.")}{' '}<br />
              <span style={{ color: "#4b5563" }}>{say("Click")}{' '}<strong style={{ color: "#e5332a" }}>{say("+ New")}</strong> {say("to start one.")}</span>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const icon = ROLE_ICON[conv.contactRole] ?? <FaUser />;
              const color = ROLE_COLOR[conv.contactRole] ?? "#9ca3af";
              const previewImage = chatMessageContent(conv.messages?.[0] || {}).media.find((item) => item.kind === "image")?.url;
              const isActive = selected?.contactId === conv.contactId && selected?.contactRole === conv.contactRole;
              return (
                <button key={`${conv.contactRole}_${conv.contactId}`} onClick={() => handleSelectConversation(conv)}
                  style={{ width: "100%", padding: "12px 14px", textAlign: "left", background: isActive ? "rgba(229,51,42,0.12)" : "transparent", border: "none", borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{say(icon)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: isActive ? "#f3f4f6" : "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>
                        {say(conv.contactName)}
                      </span>
                      {conv.unreadCount > 0 && (
                        <span style={{ background: "#e5332a", color: "white", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                          {say(conv.unreadCount)}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 10, color, fontWeight: 600, marginBottom: 3, display: "block" }}>
                      {ROLE_LABEL[conv.contactRole] ?? conv.contactRole}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {previewImage && (
                        <img src={previewImage} alt="" style={{ width: 28, height: 28, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
                      )}
                      <div style={{ fontSize: 11, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {conv.lastMessage.length > 40 ? conv.lastMessage.slice(0, 40) + "..." : conv.lastMessage}
                      </div>
                    </div>
                    <div style={{ fontSize: 9, color: "#4b5563", marginTop: 2 }}>
                      {new Date(conv.lastMessageAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Right: thread / compose */}
        <div style={{ display: "flex", flexDirection: "column", maxHeight: 480 }}>
          {showCompose ? (
            /* Compose new message */
            <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 16, gap: 12 }}>
              <div>
                <label style={{ display: "block", color: "#9ca3af", fontSize: 12, marginBottom: 6 }}>{say("Recipient type:")}</label>
                <select
                  value={composeRoleFilter}
                  onChange={(e) => {
                    setComposeRoleFilter(e.target.value as TabKey);
                    setNewRecipient(null);
                  }}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(0,0,0,0.3)", color: "#e5e7eb", fontSize: 13, marginBottom: 10 }}>
                  {ROLE_FILTERS.map((filter) => (
                    <option key={`compose-${filter.key}`} value={filter.key}>{say(filter.label)}</option>
                  ))}
                </select>

                <label style={{ display: "block", color: "#9ca3af", fontSize: 12, marginBottom: 6 }}>{say("To:")}</label>
                {contactsLoading ? (
                  <div style={{ color: "#6b7280", fontSize: 12 }}>{say("Loading contacts...")}</div>
                ) : noContacts || filteredAvailableContacts.length === 0 ? (
                  <div style={{ color: "#f59e0b", fontSize: 13, padding: "10px 12px", background: "rgba(245,158,11,0.08)", borderRadius: 8 }}>
                    <FaExclamationTriangle style={{marginRight:4}} /> {say("No messageable contacts found.")}{' '}<br />
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>
                      {say("You can message shops, managers, and techs only when you have an open work order, a road call request, or a booked appointment.")}{' '}</span>
                  </div>
                ) : (
                  <select
                    value={newRecipient ? `${newRecipient.role}_${newRecipient.id}` : ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) { setNewRecipient(null); return; }
                      const underscoreIdx = val.indexOf("_");
                      const role = val.slice(0, underscoreIdx);
                      const id = val.slice(underscoreIdx + 1);
                      const c = filteredAvailableContacts.find((x) => x.id === id && x.role === role);
                      setNewRecipient(c ?? null);
                    }}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(0,0,0,0.3)", color: "#e5e7eb", fontSize: 13 }}>
                    <option value=""> {say("-  Select recipient  -")}{' '}</option>
                    {filteredAvailableContacts.map((c) => (
                      <option key={`${c.role}_${c.id}`} value={`${c.role}_${c.id}`}>
                        {ROLE_ICON[c.role]} {say(c.name)} ({ROLE_LABEL[c.role] ?? c.role})  -  {say(c.contextLabel)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {pendingUrl && <PendingChatImage url={pendingUrl} onRemove={() => setPendingUrl(null)} />}
              <div style={{ display: "flex", gap: 8, flex: 1, minHeight: 120 }}>
                <ChatImageAttachButton
                  disabled={loading}
                  onUploaded={(url) => { setPendingUrl(url); setCustMsgMsg(null); }}
                  onError={(message) => setCustMsgMsg({ type: "error", text: message })}
                  style={{ alignSelf: "flex-end", height: 40 }}
                />
                <textarea
                  placeholder={say("Type your message...")}
                  value={messageText}
                  maxLength={5000}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend(); }}
                  style={{ flex: 1, padding: 12, borderRadius: 6, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(0,0,0,0.25)", color: "#e5e7eb", fontSize: 13, resize: "none", minHeight: 120 }}
                />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleSend} disabled={loading || (!messageText.trim() && !pendingUrl) || !newRecipient}
                  style={{ flex: 1, padding: "10px 0", background: "#e5332a", color: "white", border: "none", borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: loading || (!messageText.trim() && !pendingUrl) || !newRecipient ? "not-allowed" : "pointer", opacity: loading || (!messageText.trim() && !pendingUrl) || !newRecipient ? 0.5 : 1 }}>
                  {loading ? say("Sending...") : say("Send Message")}
                </button>
                <button onClick={() => { setShowCompose(false); setNewRecipient(null); setMessageText(""); setPendingUrl(null); setComposeRoleFilter(activeTab); }}
                  style={{ padding: "10px 16px", background: "rgba(255,255,255,0.07)", color: "#9ca3af", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                  {say("Cancel")}{' '}</button>
              </div>
            </div>

          ) : selected ? (
            /* Conversation thread */
            <>
              {/* Thread header */}
              <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,0.2)" }}>
                <span style={{ fontSize: 18 }}>{ROLE_ICON[selected.contactRole] ?? <FaUser />}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#e5e7eb" }}>{say(selected.contactName)}</div>
                  <div style={{ fontSize: 11, color: ROLE_COLOR[selected.contactRole] ?? "#9ca3af", fontWeight: 600 }}>
                    {ROLE_LABEL[selected.contactRole] ?? selected.contactRole}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                {threadMessages.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#4b5563', fontSize: 12, padding: 12 }}>
                    {threadState === "error"
                      ? say("Could not load messages. The thread is still here.")
                      : threadState === "loading"
                        ? say("Loading messages...")
                        : say("No messages yet.")}
                  </div>
                )}
                {threadMessages
                  .slice()
                  .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                  .map((msg) => {
                    const isMine = msg.senderId === userId;
                    return (
                      <div key={msg.id} style={{ alignSelf: isMine ? "flex-end" : "flex-start", maxWidth: "72%" }}>
                        <div style={{ background: isMine ? "rgba(229,51,42,0.2)" : "rgba(59,130,246,0.18)", border: `1px solid ${isMine ? "rgba(229,51,42,0.35)" : "rgba(59,130,246,0.35)"}`, borderRadius: 10, padding: "8px 12px" }}>
                          {!isMine && (
                            <div style={{ fontSize: 10, color: ROLE_COLOR[msg.senderRole] ?? "#9ca3af", fontWeight: 700, marginBottom: 4 }}>
                              {say(msg.senderName)}
                            </div>
                          )}
                          <ChatMessageBody body={msg.body} attachmentUrl={msg.attachmentUrl} textStyle={{ fontSize: 13, color: "#e5e7eb" }} />
                          <div style={{ fontSize: 9, color: "#6b7280", marginTop: 4, textAlign: "right" }}>
                            {new Date(msg.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                {/* Scroll anchor */}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply box */}
              <div style={{ padding: "10px 12px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                {pendingUrl && <PendingChatImage url={pendingUrl} onRemove={() => setPendingUrl(null)} />}
                <div style={{ display: "flex", gap: 8 }}>
                  <ChatImageAttachButton
                    disabled={loading}
                    onUploaded={(url) => { setPendingUrl(url); setCustMsgMsg(null); }}
                    onError={(message) => setCustMsgMsg({ type: "error", text: message })}
                    style={{ alignSelf: "flex-end", height: 40 }}
                  />
                  <textarea
                    value={messageText}
                    maxLength={5000}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder={`Reply to ${selected.contactName}...`}
                    style={{ flex: 1, padding: "8px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.25)", color: "#e5e7eb", fontSize: 13, resize: "none", minHeight: 44, maxHeight: 100 }}
                  />
                  <button onClick={handleSend} disabled={loading || (!messageText.trim() && !pendingUrl)}
                    style={{ padding: "8px 16px", background: "#e5332a", color: "white", border: "none", borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: loading || (!messageText.trim() && !pendingUrl) ? "not-allowed" : "pointer", opacity: loading || (!messageText.trim() && !pendingUrl) ? 0.5 : 1, alignSelf: "flex-end" }}>
                    {loading ? "..." : say("Send")}
                  </button>
                </div>
              </div>
            </>

          ) : (
            /* Empty state */
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#4b5563", gap: 8, padding: 24 }}>
              <span style={{ fontSize: 36 }}><FaComments style={{marginRight:4}} /></span>
              <div style={{ fontSize: 14, color: "#6b7280", textAlign: "center" }}>
                {say("Select a conversation on the left")}<br />{say("or click")}{' '}<strong style={{ color: "#e5332a" }}>{say("+ New")}</strong> {say("to start one.")}{' '}</div>
              <div style={{ fontSize: 11, color: "#374151", marginTop: 4, textAlign: "center" }}>
                {say("You can message shops, managers & techs when you have an open work order, a road call request, or a booked appointment.")}{' '}</div>
            </div>
          )}
        </div>
      </div>
      {custMsgMsg && (
        <div style={{position:'fixed',bottom:24,right:24,background:custMsgMsg.type==='success'?'#dcfce7':'#fde8e8',color:custMsgMsg.type==='success'?'#166534':'#991b1b',borderRadius:10,padding:'12px 20px',zIndex:9999,fontSize:14,fontWeight:600,boxShadow:'0 4px 12px rgba(0,0,0,0.3)'}}>
          {say(custMsgMsg.text)}
          <button aria-label={say("Dismiss")} onClick={()=>setCustMsgMsg(null)} style={{marginLeft:12,background:'none',border:'none',cursor:'pointer',fontSize:16,color:'inherit'}}>×</button>
        </div>
      )}
    </div>
  );
}
