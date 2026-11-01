import React, { useState, useEffect, useCallback } from 'react';
import { Check, ClipboardCheck, X } from 'lucide-react';
import { formatDatePST, formatTimePST } from '../utils/timezoneUtils';

const describeShift = (clockIn, clockOut, breakMinutes, t) => {
  const end = clockOut ? formatTimePST(clockOut) : t('timeclock.still_clocked_in');
  const time = `${formatDatePST(clockIn)}, ${formatTimePST(clockIn)} - ${end}`;
  return breakMinutes > 0 ? `${time} (${breakMinutes} min ${t('timeclock.break_short')})` : time;
};

const PendingApprovals = ({ token, API_BASE, t }) => {
  const [entries, setEntries] = useState([]);
  const [busyId, setBusyId] = useState(null);

  const fetchPending = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/timeclock/admin/pending-entries`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setEntries(data.entries);
      }
    } catch (error) {
      console.error("Error fetching pending entries:", error);
    }
  }, [API_BASE, token]);

  useEffect(() => {
    fetchPending();
    const interval = setInterval(fetchPending, 30000);
    return () => clearInterval(interval);
  }, [fetchPending]);

  const decide = async (entry, decision) => {
    let reason;
    if (decision === 'reject') {
      reason = window.prompt(t('timeclock.reject_reason_prompt'));
      if (reason === null) return;
    }

    try {
      setBusyId(entry.id);
      const response = await fetch(
        `${API_BASE}/api/timeclock/admin/${decision}-entry/${entry.id}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason }),
        },
      );
      const data = await response.json();
      if (!data.success) {
        alert(data.message || data.error);
      }
      await fetchPending();
    } catch (error) {
      console.error("Error deciding entry:", error);
      alert(t('timeclock.failed_update_entry'));
    } finally {
      setBusyId(null);
    }
  };

  if (entries.length === 0) return null;

  return (
    <div className="admin-section">
      <div className="section-toggle">
        <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <ClipboardCheck size={20} /> {t('timeclock.waiting_for_approval')} ({entries.length})
        </h3>
      </div>
      {entries.map((entry) => (
        <div
          key={entry.id}
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            padding: "0.75rem 0",
            borderTop: "1px solid #e5e7eb",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <strong>{entry.employee_name}</strong>
            <span style={{ color: "#6b7280", marginLeft: "0.5rem" }}>
              {t(`timeclock.approval_action_${entry.action}`)}
            </span>
            <div
              style={{
                textDecoration: entry.action === 'new' ? "none" : "line-through",
                color: entry.action === 'new' ? "#1f2937" : "#6b7280",
                fontSize: "0.875rem",
              }}
            >
              {describeShift(entry.clock_in_time, entry.clock_out_time, entry.break_minutes, t)}
            </div>
            {entry.action === 'edit' && (
              <div style={{ fontSize: "0.875rem" }}>
                {describeShift(
                  entry.pending_changes.clockIn,
                  entry.pending_changes.clockOut,
                  entry.pending_changes.breakMinutes,
                  t,
                )}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              className="btn-secondary"
              disabled={busyId === entry.id}
              onClick={() => decide(entry, 'reject')}
            >
              <X size={16} style={{ verticalAlign: "-3px" }} /> {t('timeclock.reject')}
            </button>
            <button
              className="btn-primary"
              disabled={busyId === entry.id}
              onClick={() => decide(entry, 'approve')}
            >
              <Check size={16} style={{ verticalAlign: "-3px" }} /> {t('timeclock.approve')}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PendingApprovals;
