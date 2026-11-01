import React, { useState, useEffect, useCallback } from 'react';
import { Pencil, Plus, Trash2, UserCog } from 'lucide-react';
import { formatDatePST, formatTimePST, getTodayPST, extractPSTDate } from '../utils/timezoneUtils';

const EMPTY_FORM = { date: "", timeIn: "", timeOut: "", breakMinutes: 0, reason: "" };

const twoWeeksAgo = () => {
  const date = new Date(`${getTodayPST()}T00:00:00`);
  date.setDate(date.getDate() - 14);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
};

const timeOf = (timestamp) => timestamp.replace("T", " ").slice(11, 16);

const EmployeeTimeEditor = ({ token, API_BASE, employees, t }) => {
  const [employeeId, setEmployeeId] = useState("");
  const [startDate, setStartDate] = useState(twoWeeksAgo());
  const [endDate, setEndDate] = useState(getTodayPST());
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchEntries = useCallback(async () => {
    if (!employeeId) {
      setEntries([]);
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/api/timeclock/admin/entries?employeeId=${employeeId}&startDate=${startDate}&endDate=${endDate}&limit=500`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await response.json();
      if (data.success) {
        setEntries(data.entries);
      }
    } catch (error) {
      console.error("Error fetching employee entries:", error);
    }
  }, [API_BASE, token, employeeId, startDate, endDate]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const closeForm = () => {
    setForm(null);
    setEditingEntry(null);
  };

  const openAdd = () => {
    setEditingEntry(null);
    setForm({ ...EMPTY_FORM, date: getTodayPST() });
  };

  const openEdit = (entry) => {
    setEditingEntry(entry);
    setForm({
      date: extractPSTDate(entry.clock_in_time),
      timeIn: timeOf(entry.clock_in_time),
      timeOut: entry.clock_out_time ? timeOf(entry.clock_out_time) : "",
      breakMinutes: entry.break_minutes || 0,
      reason: "",
    });
  };

  const send = async (url, method, body) => {
    const response = await fetch(`${API_BASE}/api/timeclock/admin/${url}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!data.success) {
      alert(data.message || data.error || t("timeclock.failed_update_entry"));
    }
    return data.success;
  };

  const handleSave = async (e) => {
    e.preventDefault();

    const shift = {
      clockInTime: `${form.date} ${form.timeIn}:00`,
      clockOutTime: form.timeOut ? `${form.date} ${form.timeOut}:00` : null,
      breakMinutes: parseInt(form.breakMinutes) || 0,
      reason: form.reason,
    };

    try {
      setSaving(true);
      const saved = editingEntry
        ? await send(`edit-entry/${editingEntry.id}`, "PUT", {
            ...shift,
            notes: editingEntry.notes,
          })
        : await send("add-manual-entry", "POST", { ...shift, employeeId: Number(employeeId) });

      if (saved) {
        closeForm();
        await fetchEntries();
      }
    } catch (error) {
      console.error("Error saving employee time:", error);
      alert(t("timeclock.failed_update_entry"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entry) => {
    const reason = window.prompt(t("timeclock.editor_delete_prompt"));
    if (reason === null) return;

    try {
      if (await send(`delete-entry/${entry.id}`, "DELETE", { reason: reason || undefined })) {
        await fetchEntries();
      }
    } catch (error) {
      console.error("Error deleting employee time:", error);
      alert(t("timeclock.failed_delete_entry"));
    }
  };

  return (
    <div className="admin-section">
      <div className="section-toggle">
        <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <UserCog size={20} /> {t("timeclock.editor_title")}
        </h3>
      </div>

      <div className="form-group">
        <label>{t("timeclock.editor_employee")}</label>
        <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
          <option value="">{t("timeclock.editor_choose")}</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.full_name || employee.username}
            </option>
          ))}
        </select>
      </div>

      {employeeId && (
        <>
          <div className="form-row">
            <div className="form-group">
              <label>{t("timeclock.editor_from")}</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label>{t("timeclock.editor_to")}</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <button className="btn-primary" onClick={openAdd} style={{ marginBottom: "0.75rem" }}>
            <Plus size={16} style={{ verticalAlign: "-3px" }} /> {t("timeclock.editor_add")}
          </button>

          {entries.length === 0 && <p>{t("timeclock.editor_no_entries")}</p>}

          {entries.map((entry) => (
            <div
              key={entry.id}
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.5rem",
                padding: "0.5rem 0",
                borderTop: "1px solid #e5e7eb",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <strong>{formatDatePST(entry.clock_in_time)}</strong>{" "}
                {formatTimePST(entry.clock_in_time)} -{" "}
                {entry.clock_out_time
                  ? formatTimePST(entry.clock_out_time)
                  : t("timeclock.still_clocked_in")}
                <span style={{ color: "#6b7280", marginLeft: "0.5rem" }}>
                  {entry.total_hours != null
                    ? `${entry.total_hours.toFixed(2)} ${t("timeclock.hrs")}`
                    : ""}
                  {(entry.status === "pending" || entry.pending_changes) &&
                    ` ${t("timeclock.waiting_for_approval")}`}
                </span>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  className="btn-secondary"
                  onClick={() => openEdit(entry)}
                  aria-label={t("timeclock.editor_edit")}
                >
                  <Pencil size={16} style={{ verticalAlign: "-3px" }} />
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => handleDelete(entry)}
                  aria-label={t("timeclock.editor_delete")}
                >
                  <Trash2 size={16} style={{ verticalAlign: "-3px" }} />
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      {form && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t(editingEntry ? "timeclock.editor_edit_title" : "timeclock.editor_add")}</h3>
              <button className="btn-close" onClick={closeForm}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ marginTop: 0, color: "#075985", fontSize: "0.875rem" }}>
                {t("timeclock.editor_notice")}
              </p>
              <form onSubmit={handleSave}>
                <div className="form-group">
                  <label>{t("timeclock.label_date")} *</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    required
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>{t("timeclock.label_clock_in_time")} *</label>
                    <input
                      type="time"
                      value={form.timeIn}
                      onChange={(e) => setForm({ ...form, timeIn: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>
                      {t("timeclock.label_clock_out_time")}
                      {editingEntry?.status === "active" ? "" : " *"}
                    </label>
                    <input
                      type="time"
                      value={form.timeOut}
                      onChange={(e) => setForm({ ...form, timeOut: e.target.value })}
                      required={editingEntry?.status !== "active"}
                    />
                  </div>
                </div>
                {form.timeIn && form.timeOut && form.timeOut <= form.timeIn && (
                  <p style={{ margin: "0 0 1rem", color: "#075985", fontSize: "0.875rem" }}>
                    {t("timeclock.clock_out_next_day")}
                  </p>
                )}
                <div className="form-group">
                  <label>{t("timeclock.label_break_minutes")}</label>
                  <input
                    type="number"
                    min="0"
                    value={form.breakMinutes}
                    onChange={(e) => setForm({ ...form, breakMinutes: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>{t("timeclock.editor_reason")}</label>
                  <input
                    type="text"
                    value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  />
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={closeForm}>
                    {t("common.cancel")}
                  </button>
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {t("common.save")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeTimeEditor;
