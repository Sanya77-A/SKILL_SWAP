import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Bell, Settings2 } from "lucide-react";
import {
  fetchNotifications, fetchNotificationPreferences, markAsRead, markAllAsRead, saveNotificationPreferences,
} from "../features/notifications/notificationsSlice";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardContent } from "../components/ui/Card";
import { Select } from "../components/ui/Select";

const types = ["proposal", "booking", "booking_reminder", "message", "review", "credits", "badge", "community", "session", "certificate", "system"];
const labels = Object.fromEntries(types.map((type) => [type, type.replaceAll("_", " ").replace(/^./, (value) => value.toUpperCase())]));

export default function NotificationsPage() {
  const dispatch = useDispatch();
  const { data: notifications, preferences } = useSelector((state) => state.notifications);
  const [showPreferences, setShowPreferences] = useState(false);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    dispatch(fetchNotifications({ limit: 50, ...(filter === "unread" ? { unreadOnly: true } : types.includes(filter) ? { type: filter } : {}) }));
  }, [dispatch, filter]);
  useEffect(() => { dispatch(fetchNotificationPreferences()); }, [dispatch]);

  const toggleType = (type) => dispatch(saveNotificationPreferences({ inApp: { [type]: preferences?.inApp?.[type] === false } }));

  return <div className="space-y-6"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h1 className="font-heading text-2xl font-bold text-text-primary sm:text-3xl">Notifications</h1><p className="mt-1 text-sm text-text-secondary">Updates from your learning activity, with safe links back into SkillSwap.</p></div><div className="flex gap-2"><Button variant="secondary" size="sm" onClick={() => setShowPreferences((value) => !value)}><Settings2 className="mr-1 h-4 w-4" />Preferences</Button><Button variant="secondary" size="sm" onClick={() => dispatch(markAllAsRead())}>Mark all read</Button></div></div>{showPreferences && preferences && <Card><CardContent><div className="flex flex-col justify-between gap-5 lg:flex-row"><div><h2 className="font-heading font-semibold text-text-primary">In-app preferences</h2><p className="mt-1 text-sm text-text-secondary">System notices stay enabled for account and safety updates.</p><div className="mt-4 flex flex-wrap gap-3">{types.filter((type) => type !== "system").map((type) => <label key={type} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-text-primary"><input type="checkbox" checked={preferences.inApp?.[type] !== false} onChange={() => toggleType(type)} />{labels[type]}</label>)}</div></div><div className="w-full lg:w-48"><Select label="Email digest" value={preferences.emailDigest || "off"} onChange={(event) => dispatch(saveNotificationPreferences({ emailDigest: event.target.value }))} options={[{ value: "off", label: "Off" }, { value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }]} /></div></div></CardContent></Card>}<div className="flex flex-wrap gap-2"><button onClick={() => setFilter("all")} className={`rounded-full px-3 py-1.5 text-sm ${filter === "all" ? "bg-accent text-on-accent" : "bg-surface-2 text-text-secondary"}`}>All</button><button onClick={() => setFilter("unread")} className={`rounded-full px-3 py-1.5 text-sm ${filter === "unread" ? "bg-accent text-on-accent" : "bg-surface-2 text-text-secondary"}`}>Unread</button>{types.slice(0, 6).map((type) => <button key={type} onClick={() => setFilter(type)} className={`rounded-full px-3 py-1.5 text-sm ${filter === type ? "bg-accent text-on-accent" : "bg-surface-2 text-text-secondary"}`}>{labels[type]}</button>)}</div><div className="space-y-2">{(notifications || []).map((notification) => <div key={notification._id} className={`rounded-2xl border p-4 transition-colors ${notification.read ? "border-border bg-surface" : "border-accent/20 bg-surface-2/50"}`}><div className="flex items-start justify-between gap-4"><div className="flex min-w-0 gap-3"><span className="rounded-xl bg-accent/10 p-2 text-accent"><Bell className="h-4 w-4" /></span><div><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-text-primary">{notification.title}</p><Badge variant={notification.read ? "default" : "accent"}>{labels[notification.type] || notification.type}</Badge></div>{notification.body && <p className="mt-1 text-sm text-text-secondary">{notification.body}</p>}<p className="mt-2 text-xs text-text-secondary">{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(notification.createdAt))}</p>{notification.link && <Link to={notification.link} onClick={() => !notification.read && dispatch(markAsRead(notification._id))} className="mt-2 inline-block text-sm text-accent hover:underline">View details</Link>}</div></div>{!notification.read && <Button variant="ghost" size="sm" onClick={() => dispatch(markAsRead(notification._id))}>Mark read</Button>}</div></div>)}</div>{(!notifications || notifications.length === 0) && <Card className="py-12 text-center"><Bell className="mx-auto mb-3 h-7 w-7 text-accent" /><p className="text-text-secondary">No notifications in this view.</p></Card>}</div>;
}
