import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, X, CheckCheck,
  ShoppingBag, Package, CreditCard, ShieldCheck,
  Store, UserCheck, IndianRupee, Megaphone, HelpCircle, Star,
} from 'lucide-react';
import api from '../../../utils/api';

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

const TYPE_META = {
  order:              { Icon: ShoppingBag,  color: 'bg-blue-100 text-blue-600'    },
  product:            { Icon: Package,      color: 'bg-orange-100 text-orange-600'},
  payment:            { Icon: CreditCard,   color: 'bg-green-100 text-green-600'  },
  kyc:                { Icon: ShieldCheck,  color: 'bg-purple-100 text-purple-600'},
  vendor_approval:    { Icon: Store,        color: 'bg-teal-100 text-teal-600'    },
  affiliate_approval: { Icon: UserCheck,    color: 'bg-indigo-100 text-indigo-600'},
  commission:         { Icon: IndianRupee,  color: 'bg-emerald-100 text-emerald-600'},
  ticket:             { Icon: HelpCircle,   color: 'bg-red-100 text-red-600'      },
  ad:                 { Icon: Megaphone,    color: 'bg-pink-100 text-pink-600'    },
  review:             { Icon: Star,         color: 'bg-yellow-100 text-yellow-600'},
  promo:              { Icon: Megaphone,    color: 'bg-purple-100 text-purple-600'},
  system:             { Icon: Bell,         color: 'bg-secondary-100 text-secondary-500'},
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function NotificationBell({ variant = 'dark' }) {
  const [open,          setOpen]          = useState(false);
  const [unread,        setUnread]        = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading,       setLoading]       = useState(false);
  const panelRef = useRef(null);
  const navigate = useNavigate();

  // Fast unread count poll (every 30s)
  const loadUnread = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications/unread-count');
      setUnread(data.count ?? 0);
    } catch {}
  }, []);

  useEffect(() => {
    loadUnread();
    const t = setInterval(loadUnread, 30000);
    return () => clearInterval(t);
  }, [loadUnread]);

  // Full list when dropdown opens
  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/notifications', { params: { limit: 20 } });
      setNotifications(data.notifications || []);
      setUnread(data.unreadCount ?? 0);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (open) loadNotifications();
  }, [open, loadNotifications]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // ── Actions ────────────────────────────────────────────────────────────────

  async function markRead(n) {
    if (!n.isRead) {
      api.patch(`/notifications/${n._id}/read`).catch(() => {});
      setNotifications((prev) => prev.map((x) => x._id === n._id ? { ...x, isRead: true } : x));
      setUnread((u) => Math.max(0, u - 1));
    }
    if (n.link) { setOpen(false); navigate(n.link); }
  }

  async function markAllRead() {
    api.patch('/notifications/read-all').catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
  }

  async function remove(e, id) {
    e.stopPropagation();
    api.delete(`/notifications/${id}`).catch(() => {});
    setNotifications((prev) => {
      const removed = prev.find((n) => n._id === id);
      if (removed && !removed.isRead) setUnread((u) => Math.max(0, u - 1));
      return prev.filter((n) => n._id !== id);
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="relative" ref={panelRef}>

      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`relative w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${
          variant === 'light'
            ? 'text-secondary-500 hover:text-secondary-800 hover:bg-secondary-100'
            : 'text-gray-400 hover:text-white hover:bg-white/10'
        }`}
        title="Notifications"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-11 w-[340px] bg-white rounded-2xl shadow-2xl border border-secondary-100 z-50 overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-secondary-100">
            <div className="flex items-center gap-2">
              <p className="font-bold text-sm text-secondary-900">Notifications</p>
              {unread > 0 && (
                <span className="bg-primary-50 text-primary-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {unread} new
                </span>
              )}
            </div>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-semibold"
              >
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[360px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-5 h-5 rounded-full border-2 border-secondary-200 border-t-primary-600 animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-12">
                <Bell size={32} className="mx-auto text-secondary-200 mb-2" />
                <p className="text-sm font-medium text-secondary-400">No notifications yet</p>
                <p className="text-xs text-secondary-300 mt-0.5">You're all caught up!</p>
              </div>
            ) : (
              notifications.map((n) => {
                const { Icon, color } = TYPE_META[n.type] || TYPE_META.system;
                return (
                  <div
                    key={n._id}
                    onClick={() => markRead(n)}
                    className={`relative flex gap-3 px-4 py-3 border-b border-secondary-50 last:border-0 cursor-pointer hover:bg-secondary-50 transition-colors group ${!n.isRead ? 'bg-blue-50/40' : ''}`}
                  >
                    {/* Unread dot */}
                    {!n.isRead && (
                      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary-500" />
                    )}

                    {/* Type icon */}
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${color}`}>
                      <Icon size={14} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-5">
                      <p className={`text-xs leading-snug text-secondary-900 ${!n.isRead ? 'font-bold' : 'font-semibold'}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-secondary-500 mt-0.5 leading-snug line-clamp-2">
                        {n.message}
                      </p>
                      <p className="text-[10px] text-secondary-300 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>

                    {/* Delete button — shown on hover */}
                    <button
                      onClick={(e) => remove(e, n._id)}
                      className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded text-secondary-300 hover:text-red-400 transition-all"
                      title="Dismiss"
                    >
                      <X size={11} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-secondary-100 bg-secondary-50/50 text-center">
              <p className="text-[11px] text-secondary-400">Showing last {notifications.length} notifications</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
