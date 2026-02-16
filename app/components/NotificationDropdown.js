"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "@/lib/SessionContext";
import { useRealtimeNotifications } from "@/lib/useRealtime";
import { getNotifications, markAllNotificationsRead } from "@/lib/api-client";

export default function NotificationDropdown() {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef(null);

  // Load notifications
  useEffect(() => {
    if (!user?.id) return;
    getNotifications(user.id, { limit: 20 }).then((data) => {
      if (data.notifications) {
        setNotifications(data.notifications);
        setUnreadCount(data.notifications.filter((n) => !n.read).length);
      }
    });
  }, [user?.id]);

  // Realtime updates
  useRealtimeNotifications(user?.id, (newNotif) => {
    setNotifications((prev) => [newNotif, ...prev].slice(0, 20));
    setUnreadCount((c) => c + 1);
  });

  // Close on click outside
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleMarkAllRead = async () => {
    if (!user?.id) return;
    await markAllNotificationsRead(user.id);
    setNotifications((n) => n.map((x) => ({ ...x, read: true })));
    setUnreadCount(0);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-arena-muted hover:text-arena-text transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-arena-con text-white text-xs flex items-center justify-center rounded-full">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-arena-surface border border-arena-border rounded-lg shadow-xl z-50 max-h-96 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-arena-border">
            <span className="font-semibold text-sm">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs text-arena-accent hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="overflow-y-auto max-h-80">
            {notifications.length === 0 ? (
              <p className="text-sm text-arena-muted text-center py-8">No notifications</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-arena-border/50 text-sm ${
                    n.read ? "opacity-60" : ""
                  }`}
                >
                  <p className="font-medium text-xs">{n.title}</p>
                  {n.body && <p className="text-arena-muted text-xs mt-0.5">{n.body}</p>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
