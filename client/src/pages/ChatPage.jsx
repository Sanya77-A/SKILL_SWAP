import { useEffect, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { fetchConversations, fetchMessages, sendMessage, markConversationRead, setActiveConversation, addMessage, applyReadReceipt } from "../features/chat/chatSlice";
import { useSocket } from "../hooks/useSocket";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Avatar } from "../components/ui/Avatar";
import { ArrowRightLeft, CalendarClock, CheckCheck, FileText, Flag, GraduationCap, Paperclip, Phone, Share2, Video as VideoIcon } from "lucide-react";
import { VideoCall } from "../components/VideoCall";
import { IncomingCallModal } from "../components/IncomingCallModal";
import { api } from "../utils/api";
import toast from "react-hot-toast";

export default function ChatPage() {
  const dispatch = useDispatch();
  const { socket, onlineUsers, realtimeEnabled } = useSocket();
  const { conversations, messages, activeConversationId } = useSelector((s) => s.chat);
  const { user } = useSelector((s) => s.auth);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [typingUserId, setTypingUserId] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareables, setShareables] = useState([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [callState, setCallState] = useState({ status: "idle", iceCandidates: [] });
  const bottomRef = useRef(null);
  const typingTimerRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeConversationId]);


  useEffect(() => {
    dispatch(fetchConversations());
  }, [dispatch]);

  useEffect(() => {
    if (activeConversationId) {
      dispatch(fetchMessages({ conversationId: activeConversationId }));
      dispatch(markConversationRead(activeConversationId));
    }
  }, [activeConversationId, dispatch]);

  useEffect(() => {
    if (realtimeEnabled || !activeConversationId) return undefined;
    const refresh = () => {
      dispatch(fetchConversations());
      dispatch(fetchMessages({ conversationId: activeConversationId }));
    };
    const timer = setInterval(refresh, 10_000);
    return () => clearInterval(timer);
  }, [activeConversationId, dispatch, realtimeEnabled]);

  useEffect(() => {
    if (!socket || !activeConversationId) return undefined;
    socket.emit("join_conversation", activeConversationId);
    return () => socket.emit("leave_conversation", activeConversationId);
  }, [socket, activeConversationId]);

  useEffect(() => {
    if (!socket) return;
    
    const handleMessage = (msg) => {
      dispatch(addMessage(msg));
      const conversationId = msg.conversation?._id || msg.conversation;
      if (conversationId === activeConversationId && String(msg.sender?._id || msg.sender) !== String(user?._id)) {
        dispatch(markConversationRead(conversationId));
      }
    };
    const handleRead = (payload) => dispatch(applyReadReceipt(payload));
    const handleTyping = ({ userId }) => setTypingUserId(userId);
    const handleTypingStop = ({ userId }) => setTypingUserId((current) => current === userId ? null : current);
    const handleIncomingCall = ({ from, offer, isVideo, callerName }) => {
      setCallState({ status: "incoming", remoteId: from, offer, isVideo, callerName, iceCandidates: [] });
    };
    const handleCallEnded = () => {
      setCallState(prev => prev.status === "incoming" ? { status: "idle" } : prev);
    };
    const handleIceCandidate = ({ candidate }) => {
      setCallState(prev => {
        if (prev.status === "idle") return prev;
        return { ...prev, iceCandidates: [...(prev.iceCandidates || []), candidate] };
      });
    };

    socket.on("message", handleMessage);
    socket.on("messages_read", handleRead);
    socket.on("user_typing", handleTyping);
    socket.on("user_typing_stop", handleTypingStop);
    socket.on("incoming_call", handleIncomingCall);
    socket.on("call_ended", handleCallEnded);
    socket.on("ice_candidate", handleIceCandidate);
    
    return () => {
      socket.off("message", handleMessage);
      socket.off("messages_read", handleRead);
      socket.off("user_typing", handleTyping);
      socket.off("user_typing_stop", handleTypingStop);
      socket.off("incoming_call", handleIncomingCall);
      socket.off("call_ended", handleCallEnded);
      socket.off("ice_candidate", handleIceCandidate);
    };
  }, [socket, dispatch, activeConversationId, user?._id]);

  useEffect(() => () => clearTimeout(typingTimerRef.current), []);

  const startCall = (isVideoCall) => {
    if (!other) return;
    setCallState({ 
      status: "calling", 
      remoteId: other._id, 
      remoteUserName: other.name, 
      isVideo: isVideoCall,
      iceCandidates: []
    });
  };

  const activeConv = conversations.find((c) => c._id === activeConversationId);
  const other = activeConv?.other || activeConv?.participants?.find((p) => p._id !== user?._id);
  const msgs = activeConversationId ? (messages[activeConversationId] || []) : [];

  const handleSend = async (e) => {
    e.preventDefault();
    if ((!input.trim() && (!attachments || attachments.length === 0)) || !activeConversationId) return;
    const draft = { content: input.trim(), files: attachments, clientMessageId: crypto.randomUUID() };
    socket?.emit("typing_stop", { conversationId: activeConversationId });
    setInput("");
    setAttachments([]);
    try {
      await dispatch(sendMessage({ conversationId: activeConversationId, ...draft })).unwrap();
    } catch (error) {
      setInput(draft.content);
      setAttachments(draft.files);
      toast.error(error?.message || "Message was not sent. Your draft has been restored.");
    }
  };

  const onFileChange = (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"];
    const list = [];
    const maxTotalBytes = 4 * 1024 * 1024;
    let totalBytes = attachments.reduce((total, file) => total + file.size, 0);
    for (let i = 0; i < Math.min(files.length, 5); i++) {
      if (allowed.includes(files[i].type) && totalBytes + files[i].size <= maxTotalBytes) {
        list.push(files[i]);
        totalBytes += files[i].size;
      }
    }
    if (list.length < files.length) toast.error("Attachments must be supported files with a combined size of 4 MB or less.");
    setAttachments((prev) => [...prev, ...list].slice(0, 5));
    e.target.value = "";
  };

  const handleTypingInput = (event) => {
    setInput(event.target.value);
    if (!socket || !activeConversationId) return;
    socket.emit("typing", { conversationId: activeConversationId });
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => socket.emit("typing_stop", { conversationId: activeConversationId }), 1200);
  };

  const openShare = async () => {
    setShareOpen((value) => !value);
    if (shareables.length) return;
    setShareLoading(true);
    try {
      const [bookingsResponse, proposalsResponse, skillsResponse] = await Promise.all([
        api.get("/bookings", { params: { view: "all", limit: 25 } }),
        api.get("/proposals", { params: { type: "all", limit: 25 } }),
        api.get("/user-skills/me"),
      ]);
      const bookingCards = (bookingsResponse.data.data || []).map((item) => ({ type: "booking", id: item._id, label: `Booking ${item.bookingCode || "session"} · ${item.skill?.name || "Skill"}` }));
      const proposalCards = (proposalsResponse.data.data || []).map((item) => ({ type: "proposal", id: item._id, label: `Proposal · ${item.offeredSkill?.name || "Skill"} ↔ ${item.requestedSkill?.name || "Skill"}` }));
      const skillCards = (skillsResponse.data.data || []).filter((item) => item.skill?.isActive !== false).map((item) => ({ type: "skill", id: item.skill?._id, label: `Skill · ${item.skill?.name}` }));
      setShareables([...bookingCards, ...proposalCards, ...skillCards].filter((item) => item.id));
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not load items to share");
    } finally { setShareLoading(false); }
  };

  const shareCard = async (card) => {
    try {
      await dispatch(sendMessage({ conversationId: activeConversationId, content: "", card, clientMessageId: crypto.randomUUID() })).unwrap();
    } catch (error) {
      toast.error(error?.message || "Card was not sent. Please try again.");
    }
    setShareOpen(false);
  };

  return (
    <div className="flex h-[75vh] flex-col gap-4 md:flex-row">
      <Card className="max-h-48 w-full flex-shrink-0 overflow-y-auto p-3 md:max-h-none md:w-72">
        <h2 className="font-heading font-semibold text-text-primary mb-3">Conversations</h2>
        {conversations.map((c) => {
          const o = c.other || c.participants?.find((p) => p._id !== user?._id);
          const online = onlineUsers?.includes(o?._id);
          return (
            <button
              key={c._id}
              onClick={() => dispatch(setActiveConversation(c._id))}
              className={`w-full text-left p-3 rounded-xl mb-1 flex items-center gap-3 transition-colors ${activeConversationId === c._id ? "bg-accent/15 text-accent" : "hover:bg-surface-2 text-text-primary"}`}
            >
              <Avatar src={o?.profileImage} name={o?.name} size="sm" />
              <span className="font-medium truncate">{o?.name}</span>
              {c.unreadCount > 0 && <span className="ml-auto w-2 h-2 rounded-full bg-accent" />}
              {online && <span className="text-accent-2 text-xs">●</span>}
            </button>
          );
        })}
        {(!conversations || conversations.length === 0) && <p className="text-sm text-text-secondary p-2">No conversations. Accept a swap to chat.</p>}
      </Card>
      <Card className="flex-1 flex flex-col min-h-0">
        {activeConv ? (
          <>
            <div className="p-4 border-b border-border flex items-center gap-3">
              <Avatar src={other?.profileImage} name={other?.name} size="sm" />
              <strong className="text-text-primary">{other?.name}</strong>
              {onlineUsers?.includes(other?._id) && <span className="text-accent-2 text-sm">Online</span>}
              <div className="ml-auto flex gap-2">
                <button disabled={!realtimeEnabled} title={realtimeEnabled ? "Start audio call" : "Calls require the optional realtime service"} onClick={() => startCall(false)} className="p-2 text-text-secondary hover:text-accent hover:bg-accent/10 rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40">
                  <Phone className="w-5 h-5" />
                </button>
                <button disabled={!realtimeEnabled} title={realtimeEnabled ? "Start video call" : "Calls require the optional realtime service"} onClick={() => startCall(true)} className="p-2 text-text-secondary hover:text-accent hover:bg-accent/10 rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40">
                  <VideoIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3" aria-live="polite">
              {msgs.map((m) => (
                <div key={m._id} className={m.sender?._id === user?._id ? "text-right" : "text-left"}>
                  <span className={`inline-block px-4 py-2 rounded-2xl max-w-[90%] text-left ${m.sender?._id === user?._id ? "bg-accent text-on-accent" : "bg-surface-2 text-text-primary"}`}>
                    {m.content && <span className="block">{m.content}</span>}
                    <MessageCard message={m} mine={m.sender?._id === user?._id} />
                    {m.attachments?.length > 0 && (
                      <span className="block mt-1 space-y-1">
                        {m.attachments.map((a, i) =>
                          a.type === "image" ? (
                            <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="block">
                              <img src={a.url} alt="Shared image attachment" loading="lazy" decoding="async" className="max-h-40 rounded object-cover" />
                            </a>
                          ) : (
                            <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className={`block text-sm underline ${m.sender?._id === user?._id ? "text-on-accent" : "text-accent"}`}>
                              <FileText className="mr-1 inline h-4 w-4" />{a.name || "Document attachment"}
                            </a>
                          )
                        )}
                      </span>
                    )}
                    <span className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${m.sender?._id === user?._id ? "text-on-accent/75" : "text-text-secondary"}`}>
                      {new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(m.createdAt))}
                      {m.sender?._id === user?._id && m.read && <CheckCheck className="h-3.5 w-3.5" aria-label="Read" />}
                      {m.sender?._id !== user?._id && <Link to={`/safety?targetType=message&targetId=${m._id}`} className="ml-1 hover:text-danger" aria-label="Report message" title="Report message"><Flag className="h-3.5 w-3.5" /></Link>}
                    </span>
                  </span>
                </div>
              ))}
              {typingUserId === other?._id && <p className="text-xs text-text-secondary">{other?.name} is typing…</p>}
              <div ref={bottomRef} />
            </div>
            <form onSubmit={handleSend} className="p-4 flex flex-col gap-2 border-t border-border">
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {attachments.map((f, i) => (
                    <span key={i} className="text-xs px-2 py-1 rounded-xl bg-surface-2 text-text-secondary flex items-center gap-1">
                      {f.name}
                      <button type="button" onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))} className="text-danger hover:opacity-80">×</button>
                    </span>
                  ))}
                </div>
              )}
              {shareOpen && <div className="max-h-40 overflow-y-auto rounded-xl border border-border bg-surface p-2">{shareLoading ? <p className="p-2 text-sm text-text-secondary">Loading shareable cards…</p> : shareables.length ? shareables.map((item) => <button key={`${item.type}-${item.id}`} type="button" onClick={() => shareCard(item)} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-2">{item.label}</button>) : <p className="p-2 text-sm text-text-secondary">Nothing available to share yet.</p>}</div>}
              <div className="flex gap-2">
                <input type="file" accept="image/*,.pdf,.doc,.docx,.txt" multiple onChange={onFileChange} className="hidden" id="chat-file" />
                <label htmlFor="chat-file" className="px-3 py-2 rounded-xl bg-surface-2 border border-border cursor-pointer text-sm text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1" aria-label="Attach file">
                  <Paperclip className="w-4 h-4" />
                </label>
                <button type="button" onClick={openShare} className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-text-secondary hover:text-accent" aria-label="Share booking, proposal, or skill"><Share2 className="h-4 w-4" /></button>
                <input aria-label="Message" value={input} onChange={handleTypingInput} placeholder="Type a message..." className="min-w-0 flex-1 px-4 py-2.5 rounded-xl bg-surface-2 border border-border text-text-primary placeholder:text-text-secondary focus:ring-2 focus:ring-accent" />
                <Button type="submit">Send</Button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-secondary">Select a conversation</div>
        )}
      </Card>
      <IncomingCallModal 
        open={callState.status === "incoming"}
        callerName={callState.callerName}
        isVideo={callState.isVideo}
        onAccept={() => setCallState({ ...callState, status: "active" })}
        onDecline={() => {
          socket?.emit("end_call", { to: callState.remoteId });
          setCallState({ status: "idle" });
        }}
      />
      
      {(callState.status === "calling" || callState.status === "active") && (
        <VideoCall 
          socket={socket}
          isInitiator={callState.status === "calling"}
          remoteUserId={callState.remoteId}
          remoteUserName={callState.remoteUserName || callState.callerName}
          isVideo={callState.isVideo}
          incomingOffer={callState.offer}
          bufferedCandidates={callState.iceCandidates}
          localUserName={user?.name}
          onEnd={() => setCallState({ status: "idle" })}
        />
      )}
    </div>
  );
}

function MessageCard({ message, mine }) {
  const textClass = mine ? "text-on-accent/80" : "text-text-secondary";
  if (message.booking) return <span className={`mt-2 block rounded-xl border border-current/20 p-3 ${textClass}`}><CalendarClock className="mr-2 inline h-4 w-4" /><strong>{message.booking.bookingCode || "Booking"}</strong><span className="mt-1 block text-xs">{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(message.booking.startAt))} · {message.booking.status}</span></span>;
  if (message.proposal) return <span className={`mt-2 block rounded-xl border border-current/20 p-3 ${textClass}`}><ArrowRightLeft className="mr-2 inline h-4 w-4" /><strong>Swap proposal</strong><span className="mt-1 block text-xs">{message.proposal.duration} minutes · {message.proposal.deliveryMode?.replaceAll("_", " ")} · {message.proposal.status}</span></span>;
  if (message.skill) return <span className={`mt-2 block rounded-xl border border-current/20 p-3 ${textClass}`}><GraduationCap className="mr-2 inline h-4 w-4" /><strong>{message.skill.name}</strong><span className="mt-1 block text-xs">{message.skill.category}</span></span>;
  return null;
}
