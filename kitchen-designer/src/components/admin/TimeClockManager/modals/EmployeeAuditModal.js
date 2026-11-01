import React from "react";
import { Search, FileEdit } from "lucide-react";

const EmployeeAuditModal = ({
  show,
  selectedEmployee,
  auditEntries,
  onClose,
  t,
}) => {
  if (!show || !selectedEmployee) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: "1000px", maxHeight: "90vh", overflow: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
            }}
          >
            <Search size={16} /> {t("timeclock.time_entry_audit")} -{" "}
            {selectedEmployee.full_name}
          </h3>
          <button className="btn-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div
            style={{
              marginBottom: "1rem",
              padding: "1rem",
              background: "#f0f9ff",
              borderRadius: "0.5rem",
              border: "1px solid #3b82f6",
            }}
          >
            <div
              style={{
                fontWeight: 600,
                color: "#1e40af",
                marginBottom: "0.5rem",
              }}
            >
              {t("timeclock.employee_information")}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "0.5rem",
                fontSize: "0.875rem",
              }}
            >
              <div>
                <strong>{t("timeclock.name")}:</strong>{" "}
                {selectedEmployee.full_name}
              </div>
              <div>
                <strong>{t("timeclock.email")}:</strong>{" "}
                {selectedEmployee.email}
              </div>
              <div>
                <strong>{t("timeclock.role")}:</strong> {selectedEmployee.role}
              </div>
              <div>
                <strong>{t("timeclock.total_entries")}</strong>{" "}
                {auditEntries.length}
              </div>
            </div>
          </div>

          {auditEntries.length > 0 ? (
            <div
              style={{
                background: "#f9fafb",
                borderRadius: "0.5rem",
                padding: "1rem",
                maxHeight: "500px",
                overflowY: "auto",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead
                  style={{
                    position: "sticky",
                    top: 0,
                    background: "#f9fafb",
                    zIndex: 1,
                  }}
                >
                  <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "0.75rem",
                        fontWeight: 600,
                        color: "#374151",
                      }}
                    >
                      {t("timeclock.date")}
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "0.75rem",
                        fontWeight: 600,
                        color: "#374151",
                      }}
                    >
                      {t("timeclock.clock_in")}
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "0.75rem",
                        fontWeight: 600,
                        color: "#374151",
                      }}
                    >
                      {t("timeclock.clock_out")}
                    </th>
                    <th
                      style={{
                        textAlign: "center",
                        padding: "0.75rem",
                        fontWeight: 600,
                        color: "#374151",
                      }}
                    >
                      {t("timeclock.break_min")}
                    </th>
                    <th
                      style={{
                        textAlign: "right",
                        padding: "0.75rem",
                        fontWeight: 600,
                        color: "#374151",
                      }}
                    >
                      {t("timeclock.total_hours")}
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "0.75rem",
                        fontWeight: 600,
                        color: "#374151",
                      }}
                    >
                      {t("timeclock.notes")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {auditEntries.map((entry) => (
                    <tr
                      key={entry.id}
                      style={{ borderBottom: "1px solid #e5e7eb" }}
                    >
                      <td style={{ padding: "0.75rem", color: "#111827" }}>
                        {new Date(entry.clock_in_time).toLocaleDateString()}
                      </td>
                      <td style={{ padding: "0.75rem", color: "#111827" }}>
                        {new Date(entry.clock_in_time).toLocaleTimeString()}
                      </td>
                      <td style={{ padding: "0.75rem", color: "#111827" }}>
                        {entry.clock_out_time
                          ? new Date(entry.clock_out_time).toLocaleTimeString()
                          : "Still clocked in"}
                      </td>
                      <td
                        style={{
                          padding: "0.75rem",
                          textAlign: "center",
                          color: "#111827",
                        }}
                      >
                        {entry.break_minutes || 0}
                      </td>
                      <td
                        style={{
                          padding: "0.75rem",
                          textAlign: "right",
                          color: "#059669",
                          fontWeight: 600,
                        }}
                      >
                        {entry.total_hours?.toFixed(7) || "0"}
                      </td>
                      <td
                        style={{
                          padding: "0.75rem",
                          color: "#6b7280",
                          fontSize: "0.875rem",
                        }}
                      >
                        {entry.notes &&
                        entry.notes.includes("[Manual Entry]") ? (
                          <span
                            style={{
                              background: "#dbeafe",
                              color: "#1e40af",
                              padding: "0.25rem 0.5rem",
                              borderRadius: "0.25rem",
                              fontWeight: 500,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.25rem",
                            }}
                          >
                            <FileEdit size={14} /> Manual Entry
                          </span>
                        ) : (
                          entry.notes || "-"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: "2rem",
                color: "#6b7280",
                background: "#f9fafb",
                borderRadius: "0.5rem",
              }}
            >
              <p>{t("timeclock.no_time_entries_found")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeeAuditModal;
