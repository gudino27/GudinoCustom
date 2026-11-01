import React, { useState, useEffect, useCallback } from 'react';
import { Bell, ClipboardCheck, Clock, ShieldAlert } from 'lucide-react';

const TYPE_ICONS = {
  approval: ClipboardCheck,
  timeclock: Clock,
  security: ShieldAlert,
};

const TYPE_FILTERS = ['timeclock', 'approval', 'security'];

const NotificationsPanel = ({ token, API_BASE, onUnreadChange, t }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState('all');

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
        onUnreadChange(data.unreadCount);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  }, [API_BASE, token, onUnreadChange]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markRead = async (path) => {
    try {
      await fetch(`${API_BASE}/api/notifications/${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchNotifications();
    } catch (error) {
      console.error("Error updating notifications:", error);
    }
  };

  // Only offer the kinds this person actually receives
  const filters = [
    'all',
    'unread',
    ...TYPE_FILTERS.filter((type) => notifications.some((n) => n.type === type)),
  ];

  const visible = notifications.filter((notification) => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !notification.read_at;
    return notification.type === filter;
  });

  return (
    <div className="bg-white rounded-lg shadow p-4 md:p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Bell size={20} /> {t('admin.tabs.notifications')}
        </h2>
        {unreadCount > 0 && (
          <button
            onClick={() => markRead('read-all')}
            className="text-sm text-blue-700 hover:underline"
          >
            {t('notifications.mark_all_read')}
          </button>
        )}
      </div>

      {notifications.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {filters.map((name) => (
            <button
              key={name}
              onClick={() => setFilter(name)}
              aria-pressed={filter === name}
              className={`px-3 py-1 rounded-full text-sm border transition ${
                filter === name
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t(`notifications.filter_${name}`)}
            </button>
          ))}
        </div>
      )}

      {notifications.length === 0 && (
        <p className="text-gray-500">{t('notifications.none')}</p>
      )}

      {notifications.length > 0 && visible.length === 0 && (
        <p className="text-gray-500">{t('notifications.none_in_filter')}</p>
      )}

      {visible.map((notification) => {
        const Icon = TYPE_ICONS[notification.type] || Bell;
        const unread = !notification.read_at;
        const isSecurity = notification.type === 'security';

        return (
          <div
            key={notification.id}
            className={`flex gap-3 py-3 border-t border-gray-200 ${unread ? '' : 'opacity-60'}`}
          >
            <Icon
              size={20}
              className={`flex-shrink-0 mt-0.5 ${isSecurity ? 'text-red-600' : 'text-gray-600'}`}
            />
            <div className="min-w-0 flex-1">
              <div className={unread ? 'font-semibold' : ''}>{notification.title}</div>
              {notification.body && (
                <div className="text-sm text-gray-700 break-words">{notification.body}</div>
              )}
              <div className="text-xs text-gray-500 mt-1">
                {new Date(`${notification.created_at.replace(" ", "T")}Z`).toLocaleString()}
              </div>
            </div>
            {unread && (
              <button
                onClick={() => markRead(`${notification.id}/read`)}
                className="text-xs text-blue-700 hover:underline flex-shrink-0 self-start"
              >
                {t('notifications.mark_read')}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default NotificationsPanel;
