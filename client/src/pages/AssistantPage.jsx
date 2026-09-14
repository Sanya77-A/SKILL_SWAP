import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Bot, Database, Send, Sparkles } from "lucide-react";
import { api } from "../utils/api";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardContent } from "../components/ui/Card";

const starters = [
  ["find_mentors", "Find mentors for me"], ["suggest_skills", "What should I learn next?"],
  ["recommend_swaps", "Recommend mutual swaps"], ["improve_profile", "How can I improve my profile?"],
  ["prepare_session", "Help me prepare for my next session"], ["summarize_progress", "Summarize my learning progress"],
  ["recommend_roadmap", "Recommend a learning roadmap"], ["next_actions", "What should I do next?"],
];

export default function AssistantPage() {
  const [messages, setMessages] = useState([{ role: "assistant", answer: "Ask about mentors, skills, swaps, match scores, your profile, sessions, roadmaps, progress, or next actions. Recommendations are tied to your live SkillSwap data." }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const ask = async (message, intent) => {
    if (!message.trim() || loading) return;
    setMessages((current) => [...current, { role: "user", answer: message.trim() }]);
    setInput(""); setLoading(true);
    try {
      const response = await api.post("/assistant/ask", { message: message.trim(), ...(intent && { intent }) });
      setMessages((current) => [...current, { role: "assistant", ...response.data.data }]);
    } catch (error) { toast.error(error.response?.data?.message || "The assistant is unavailable"); }
    finally { setLoading(false); }
  };
  const submit = (event) => { event.preventDefault(); ask(input); };

  return <div className="mx-auto max-w-5xl space-y-5"><header><div className="flex items-center gap-2"><Sparkles className="h-7 w-7 text-accent" /><h1 className="font-heading text-3xl font-bold text-text-primary">SkillSwap Assistant</h1></div><p className="mt-1 text-sm text-text-secondary">Guidance grounded in your profile, canonical skills, matches, listings, and bookings.</p></header><div className="flex flex-wrap gap-2">{starters.map(([intent, label]) => <button key={intent} onClick={() => ask(label, intent)} disabled={loading} className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-text-secondary hover:border-accent hover:text-accent disabled:opacity-50">{label}</button>)}</div><Card className="flex min-h-[58vh] flex-col overflow-hidden"><CardContent className="flex flex-1 flex-col p-0"><div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6" aria-live="polite">{messages.map((message, index) => <div key={index} className={message.role === "user" ? "ml-auto max-w-[85%]" : "max-w-[92%]"}>{message.role === "assistant" && <div className="mb-1.5 flex items-center gap-2"><Bot className="h-4 w-4 text-accent" /><span className="text-xs font-medium text-text-secondary">SkillSwap Assistant</span>{message.provider && <Badge variant="default"><Database className="mr-1 h-3 w-3" />{message.grounded ? "Grounded mode" : message.provider}</Badge>}</div>}<div className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm ${message.role === "user" ? "bg-accent text-on-accent" : "bg-surface-2 text-text-primary"}`}>{message.answer}</div>{message.cards?.length > 0 && <div className="mt-3 grid gap-3 sm:grid-cols-2">{message.cards.map((card) => <Link key={`${card.type}-${card.id}`} to={card.link} className="rounded-xl border border-border bg-surface p-3 transition-colors hover:border-accent"><div className="flex items-center justify-between gap-2"><p className="font-medium text-text-primary">{card.title}</p><Badge variant="accent">{card.type}</Badge></div><p className="mt-1 text-xs text-text-secondary">{card.subtitle}</p>{card.matchScore != null && <p className="mt-2 text-sm font-semibold text-accent">{card.matchScore}% match</p>}{card.reasons?.length > 0 && <p className="mt-1 text-xs text-text-secondary">{card.reasons.slice(0, 2).join(" · ")}</p>}</Link>)}</div>}</div>)}{loading && <div className="flex items-center gap-2 text-sm text-text-secondary"><Bot className="h-4 w-4 animate-pulse text-accent" />Checking your SkillSwap data…</div>}<div ref={bottomRef} /></div><form onSubmit={submit} className="flex gap-2 border-t border-border p-4"><input aria-label="Ask SkillSwap Assistant" value={input} onChange={(event) => setInput(event.target.value)} maxLength={4000} placeholder="Ask about your learning journey…" className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-secondary focus:ring-2 focus:ring-accent" /><Button type="submit" disabled={loading || input.trim().length < 2}><Send className="mr-1 h-4 w-4" />Ask</Button></form></CardContent></Card><p className="text-center text-xs text-text-secondary">AI narrative is advisory. Match scores, balances, bookings, ratings, and progress remain server-authoritative.</p></div>;
}
