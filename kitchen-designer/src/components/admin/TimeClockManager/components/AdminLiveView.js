import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {Users,Clock,Coffee, FileText, BarChart3, Calendar, FileEdit, Briefcase, AlertTriangle } from 'lucide-react';
import { formatTimePST, formatDatePST, getTodayPST } from '../utils/timezoneUtils';
import HoursReportModal from '../modals/HoursReportModal';
import EmployeeAuditModal from '../modals/EmployeeAuditModal';
import PendingApprovals from './PendingApprovals';
import EmployeeTimeEditor from './EmployeeTimeEditor';

const AdminLiveView = ({ token, API_BASE, user, onSetPayroll, t }) => {
  const [liveEmployees, setLiveEmployees] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [employeePayrollInfo, setEmployeePayrollInfo] = useState({}); // Store payroll info by employee ID
  const [loading, setLoading] = useState(true);
  const [showPayrollSection, setShowPayrollSection] = useState(false);
  const [manualEntries, setManualEntries] = useState([]);
  const [showManualEntriesLog, setShowManualEntriesLog] = useState(true);
  const [showHoursReport, setShowHoursReport] = useState(false);
  const [hoursReportData, setHoursReportData] = useState([]);
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");
  const [showEmployeeAudit, setShowEmployeeAudit] = useState(false);
  const [selectedEmployeeForAudit, setSelectedEmployeeForAudit] =
    useState(null);
  const [auditEntries, setAuditEntries] = useState([]);

  // Initialize default date range (last 2 weeks)
  useEffect(() => {
    const today = new Date();
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(today.getDate() - 14);

    setReportEndDate(today.toISOString().split("T")[0]);
    setReportStartDate(twoWeeksAgo.toISOString().split("T")[0]);
  }, []);

  useEffect(() => {
    if (token) {
      fetchLiveStatus();
      fetchAllEmployees();
      fetchManualEntries();
      const interval = setInterval(() => {
        fetchLiveStatus();
        fetchManualEntries();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [token]);

  // Fetch payroll info for all employees when payroll section is shown
  useEffect(() => {
    if (showPayrollSection && allEmployees.length > 0) {
      fetchAllPayrollInfo();
    }
  }, [showPayrollSection, allEmployees]);

  const fetchManualEntries = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/timeclock/admin/entries`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        // Filter entries with [Manual Entry] in notes (last 24 hours)
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        const manual = data.entries
          .filter(
            (entry) =>
              entry.notes &&
              entry.notes.includes("[Manual Entry]") &&
              new Date(entry.clock_in_time) >= oneDayAgo
          )
          .sort(
            (a, b) => new Date(b.clock_in_time) - new Date(a.clock_in_time)
          );

        // Get seen entry IDs from localStorage
        const seenEntriesStr = localStorage.getItem("seenManualEntries");
        const seenEntries = seenEntriesStr ? JSON.parse(seenEntriesStr) : [];

        // Filter out entries that have been seen
        const unseenEntries = manual.filter(
          (entry) => !seenEntries.includes(entry.id)
        );

        setManualEntries(unseenEntries);

        // If there are unseen entries, show the banner
        if (unseenEntries.length > 0) {
          setShowManualEntriesLog(true);
        }
      }
    } catch (error) {
      console.error("Error fetching manual entries:", error);
    }
  };

  const dismissManualEntriesLog = () => {
    // Mark all current entries as seen
    const seenEntriesStr = localStorage.getItem("seenManualEntries");
    const seenEntries = seenEntriesStr ? JSON.parse(seenEntriesStr) : [];

    // Add current manual entry IDs to seen list
    const currentEntryIds = manualEntries.map((entry) => entry.id);
    const updatedSeenEntries = [
      ...new Set([...seenEntries, ...currentEntryIds]),
    ];

    // Keep only last 100 seen entries to prevent localStorage bloat
    const recentSeenEntries = updatedSeenEntries.slice(-100);
    localStorage.setItem(
      "seenManualEntries",
      JSON.stringify(recentSeenEntries)
    );

    // Hide the banner
    setShowManualEntriesLog(false);
  };

  const fetchHoursReport = async () => {
    if (!reportStartDate || !reportEndDate) {
      alert("Please select both start and end dates");
      return;
    }

    if (new Date(reportEndDate) < new Date(reportStartDate)) {
      alert("End date must be after start date");
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/api/timeclock/admin/entries?startDate=${reportStartDate}&endDate=${reportEndDate}&limit=100000`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const data = await response.json();

      if (data.success) {
        // Filter entries by date range
        const startDate = new Date(reportStartDate);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(reportEndDate);
        endDate.setHours(23, 59, 59, 999);

        const filteredEntries = data.entries.filter((entry) => {
          const clockInDate = new Date(entry.clock_in_time);
          return clockInDate >= startDate && clockInDate <= endDate;
        });

        // Aggregate by employee
        const employeeMap = {};
        filteredEntries.forEach((entry) => {
          const employeeId = entry.employee_id;
          if (!employeeMap[employeeId]) {
            employeeMap[employeeId] = {
              employeeId,
              employeeName: entry.employee_name,
              totalHours: 0,
              regularHours: 0,
              overtimeHours: 0,
              estimatedPay: 0,
            };
          }

          const hours = parseFloat(entry.total_hours) || 0;
          employeeMap[employeeId].totalHours += hours;
          employeeMap[employeeId].regularHours += parseFloat(entry.regular_hours) || 0;
          employeeMap[employeeId].overtimeHours += parseFloat(entry.overtime_hours) || 0;
        });

        // Calculate pay for each employee
        const reportData = await Promise.all(
          Object.values(employeeMap).map(async (empData) => {
            // Fetch payroll info for this employee
            const payrollResponse = await fetch(
              `${API_BASE}/api/timeclock/admin/payroll-info/${empData.employeeId}`,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );
            const payrollData = await payrollResponse.json();

            if (payrollData.success && payrollData.payrollInfo) {
              const payroll = payrollData.payrollInfo;

              // Calculate estimated pay
              if (payroll.employment_type === "hourly") {
                const regularPay =
                  empData.regularHours * (payroll.hourly_rate || 0);
                const overtimePay =
                  empData.overtimeHours * (payroll.overtime_rate || 0);
                empData.estimatedPay = regularPay + overtimePay;
              } else {
                // For salary, estimate based on pay period
                const annualSalary = payroll.salary || 0;
                const weeksInRange =
                  (new Date(reportEndDate) - new Date(reportStartDate)) /
                  (7 * 24 * 60 * 60 * 1000);
                empData.estimatedPay = (annualSalary / 52) * weeksInRange;
              }
            }

            return empData;
          })
        );

        setHoursReportData(
          reportData.sort((a, b) =>
            a.employeeName.localeCompare(b.employeeName)
          )
        );
      }
    } catch (error) {
      console.error("Error fetching hours report:", error);
      alert("Failed to generate hours report. Please try again.");
    }
  };

  const fetchEmployeeAudit = async (employee) => {
    setSelectedEmployeeForAudit(employee);
    setShowEmployeeAudit(true);

    try {
      const response = await fetch(`${API_BASE}/api/timeclock/admin/entries`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();

      if (data.success) {
        // Filter entries for this specific employee, sorted by most recent
        const employeeEntries = data.entries
          .filter((entry) => entry.employee_id === employee.id)
          .sort(
            (a, b) => new Date(b.clock_in_time) - new Date(a.clock_in_time)
          );

        setAuditEntries(employeeEntries);
      }
    } catch (error) {
      console.error("Error fetching employee audit:", error);
      alert("Failed to fetch employee time entries");
    }
  };

  const exportToCSV = () => {
    if (hoursReportData.length === 0) {
      alert("No data to export");
      return;
    }

    // Create CSV content
    const headers = [
      "Employee Name",
      "Total Hours",
      "Regular Hours",
      "Overtime Hours",
      "Estimated Pay",
    ];
    const rows = hoursReportData.map((row) => [
      row.employeeName,
      row.totalHours.toFixed(2),
      row.regularHours.toFixed(2),
      row.overtimeHours.toFixed(2),
      row.estimatedPay.toFixed(2),
    ]);

    // Add totals row
    const totals = [
      "TOTAL",
      hoursReportData.reduce((sum, row) => sum + row.totalHours, 0).toFixed(2),
      hoursReportData
        .reduce((sum, row) => sum + row.regularHours, 0)
        .toFixed(2),
      hoursReportData
        .reduce((sum, row) => sum + row.overtimeHours, 0)
        .toFixed(2),
      hoursReportData
        .reduce((sum, row) => sum + row.estimatedPay, 0)
        .toFixed(2),
    ];

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
      totals.join(","),
    ].join("\n");

    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `hours_report_${reportStartDate}_to_${reportEndDate}.csv`;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const fetchAllEmployees = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        // Include ALL users (employees, admins, super admins)
        setAllEmployees(data.users);
      } else {
        console.error("Failed to fetch employees:", data.message);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const fetchAllPayrollInfo = async () => {
    try {
      // Fetch payroll info for each employee
      const payrollPromises = allEmployees.map(async (employee) => {
        try {
          const response = await fetch(
            `${API_BASE}/api/timeclock/admin/payroll-info/${employee.id}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );
          const data = await response.json();
          return { employeeId: employee.id, payrollInfo: data.payrollInfo };
        } catch (error) {
          console.error(
            `Error fetching payroll for employee ${employee.id}:`,
            error
          );
          return { employeeId: employee.id, payrollInfo: null };
        }
      });

      const results = await Promise.all(payrollPromises);
      const payrollMap = {};
      results.forEach(({ employeeId, payrollInfo }) => {
        payrollMap[employeeId] = payrollInfo;
      });
      setEmployeePayrollInfo(payrollMap);
    } catch (error) {
      console.error("Error fetching all payroll info:", error);
    }
  };

  const fetchLiveStatus = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/api/timeclock/admin/live-status`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await response.json();
      if (data.success) {
        setLiveEmployees(data.entries);
      }
    } catch (error) {
      console.error("Error fetching live status:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateString) => {
    return formatTimePST(dateString);
  };

  if (loading) {
    return (
      <div className="timeclock-manager">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>{t("timeclock.loading_time_clock")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-live-view">
      {/* Manual Entries Log */}
      {manualEntries.length > 0 && showManualEntriesLog && (
        <div
          className="warning-banner"
          style={{
            background: "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)",
            border: "2px solid #3b82f6",
            borderRadius: "0.75rem",
            padding: "1rem 1.5rem",
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "flex-start",
            gap: "1rem",
            position: "relative",
          }}
        >
          <button
            onClick={dismissManualEntriesLog}
            style={{
              position: "absolute",
              top: "0.75rem",
              right: "0.75rem",
              background: "rgba(255, 255, 255, 0.8)",
              border: "1px solid #3b82f6",
              borderRadius: "50%",
              width: "28px",
              height: "28px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: "1.25rem",
              color: "#1e40af",
              fontWeight: "bold",
              transition: "all 0.2s",
              lineHeight: "1",
              padding: "0",
              paddingBottom: "5px",
            }}
            onMouseOver={(e) => {
              e.target.style.background = "#3b82f6";
              e.target.style.color = "white";
            }}
            onMouseOut={(e) => {
              e.target.style.background = "rgba(255, 255, 255, 0.8)";
              e.target.style.color = "#1e40af";
            }}
            title="Dismiss notification"
          >
            ×
          </button>
          <div style={{ fontSize: "2rem" }}><FileEdit size={24} /></div>
          <div style={{ flex: 1, paddingRight: "2rem" }}>
            <div
              style={{
                fontWeight: 700,
                color: "#1e40af",
                marginBottom: "0.5rem",
              }}
            >
              {manualEntries.length} Manual Time{" "}
              {manualEntries.length === 1 ? "Entry" : "Entries"} (Last 24 Hours)
            </div>
            <div
              style={{
                fontSize: "0.875rem",
                color: "#1e3a8a",
                marginBottom: "0.75rem",
              }}
            >
              Employees have added these missed clock-in/out entries:
            </div>
            <div
              style={{
                background: "rgba(255, 255, 255, 0.7)",
                borderRadius: "0.5rem",
                padding: "0.75rem",
                maxHeight: "200px",
                overflowY: "auto",
              }}
            >
              {manualEntries.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    padding: "0.5rem",
                    borderBottom: "1px solid rgba(59, 130, 246, 0.2)",
                    fontSize: "0.875rem",
                  }}
                >
                  <strong>{entry.employee_name}</strong> -{" "}
                  {formatTime(entry.clock_in_time)} to{" "}
                  {formatTime(entry.clock_out_time)}
                  <span style={{ color: "#6b7280", marginLeft: "0.5rem" }}>
                    ({entry.total_hours ?? t("timeclock.waiting_for_approval")}{entry.total_hours != null && " hrs"})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <PendingApprovals token={token} API_BASE={API_BASE} t={t} />

      <EmployeeTimeEditor
        token={token}
        API_BASE={API_BASE}
        employees={allEmployees.filter(
          (employee) => user?.role === "super_admin" || employee.role !== "super_admin",
        )}
        t={t}
      />

      {/* Hours Report Button */}
      <div className="admin-section" style={{ marginBottom: "1rem" }}>
        <button
          onClick={() => setShowHoursReport(true)}
          className="btn-primary"
          style={{
            width: "100%",
            padding: "1rem",
            fontSize: "1rem",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
          }}
        >
          <BarChart3 size={16} /> {t("timeclock.view_hours_report")} & Export
        </button>
      </div>

      {/* Live Clock-Ins Section */}
      <div className="admin-section">
        <div className="live-header">
          <h3>{t("timeclock.currently_clocked_in")}</h3>
          <div className="live-count">
            <Users size={20} />
            <span>
              {liveEmployees.length}{" "}
              {liveEmployees.length === 1 ? "Employee" : "Employees"}
            </span>
          </div>
        </div>

        {liveEmployees.length === 0 ? (
          <div className="empty-state">
            <Clock size={48} />
            <p>{t("timeclock.no_employees_clocked_in")}</p>
          </div>
        ) : (
          <div className="employee-list">
            {liveEmployees.map((entry) => (
              <div key={entry.id} className="employee-card">
                <div className="employee-info">
                  <div className="employee-name">{entry.employee_name}</div>
                  <div className="employee-details">
                    <span>
                      {t("timeclock.clocked_in_at")}:{" "}
                      {formatTime(entry.clock_in_time)}
                    </span>
                    {entry.isOnBreak && (
                      <span className="break-badge">
                        <Coffee size={14} />
                        {t("timeclock.on_break")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="employee-hours">
                  <div className="hours-value">{entry.currentHours}</div>
                  <div className="hours-label">
                    {t("timeclock.hours_today")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payroll Management Section */}
      <div className="admin-section">
        <div className="section-toggle">
          <h3>{t("timeclock.employee_payroll_management")}</h3>
          <button
            className="btn-toggle"
            onClick={() => setShowPayrollSection(!showPayrollSection)}
          >
            {showPayrollSection ? (
              <>{t("timeclock.hide")}</>
            ) : (
              <>{t("timeclock.show")}</>
            )}
          </button>
        </div>

        {showPayrollSection && (
          <div className="payroll-management">
            <p className="section-description">
              Set hourly rates and employment details for employees
            </p>
            {allEmployees.length === 0 ? (
              <div className="empty-state">
                <p>Loading employees or no employees found...</p>
                <p style={{ fontSize: "0.875rem", color: "#6b7280" }}>
                  Check browser console for errors
                </p>
              </div>
            ) : (
              <div className="employee-payroll-list">
                {allEmployees
                  .filter((employee) => {
                    // Super admin can see all users
                    if (user?.role === "super_admin") return true;
                    // Admin can see employees and other admins (but not super_admin)
                    if (user?.role === "admin") {
                      return (
                        employee.role === "employee" ||
                        employee.role === "admin"
                      );
                    }
                    return false;
                  })
                  .map((employee) => {
                    const payrollInfo = employeePayrollInfo[employee.id];
                    return (
                      <div key={employee.id} className="payroll-employee-card">
                        <div className="employee-info">
                          <div className="employee-name">
                            {employee.full_name}
                          </div>
                          <div className="employee-role">{employee.role}</div>
                          {payrollInfo ? (
                            <div className="payroll-summary">
                              <div className="payroll-detail">
                                <span className="label">
                                  {t("timeclock.type")}:
                                </span>
                                <span className="value">
                                  {payrollInfo.employment_type === "hourly" ? (
                                    <>
                                      {" "}<Clock size={14} style={{ verticalAlign: "-2px" }} /> {t('timeclock.type_hourly')}
                                    </>
                                  ) : (
                                    <>
                                      {" "}<Briefcase size={14} style={{ verticalAlign: "-2px" }} /> {t('timeclock.type_salary')}
                                    </>
                                  )}
                                </span>
                              </div>
                              {payrollInfo.employment_type === "hourly" ? (
                                <>
                                  <div className="payroll-detail">
                                    <span className="label">
                                      {t("timeclock.rate")}
                                    </span>
                                    <span className="value">
                                      ${payrollInfo.hourly_rate?.toFixed(2)} {t('timeclock.per_hour')}
                                    </span>
                                  </div>
                                  <div className="payroll-detail">
                                    <span className="label">
                                      {t("timeclock.ot_rate")}
                                    </span>
                                    <span className="value">
                                      ${payrollInfo.overtime_rate?.toFixed(2)} {t('timeclock.per_hour')}
                                    </span>
                                  </div>
                                </>
                              ) : (
                                <div className="payroll-detail">
                                  <span className="label">
                                    {t("timeclock.salary")}:
                                  </span>
                                  <span className="value">
                                    ${payrollInfo.salary?.toFixed(2)} {t('timeclock.per_year')}
                                  </span>
                                </div>
                              )}
                              <div className="payroll-detail">
                                <span className="label">
                                  {t("timeclock.period")}:
                                </span>
                                  <span className="value">
                                    {payrollInfo.pay_period_type === "weekly" && (
                                      <><Calendar size={14} /> {t('timeclock.weekly')}</>
                                    )}
                                    {payrollInfo.pay_period_type === "biweekly" && (
                                      <><Calendar size={14} /> {t('timeclock.biweekly')}</>
                                    )}
                                    {payrollInfo.pay_period_type === "semimonthly" && (
                                      <><Calendar size={14} /> {t('timeclock.semimonthly')}</>
                                    )}
                                    {payrollInfo.pay_period_type === "monthly" && (
                                      <><Calendar size={14} /> {t('timeclock.monthly')}</>
                                    )}
                                  </span>
                              </div>
                            </div>
                          ) : (
                            <div className="no-payroll-info">
                              <AlertTriangle className="warning-icon" size={16} />
                              <span>{t("timeclock.no_payroll_info_set")}</span>
                            </div>
                          )}
                        </div>
                        <button
                          className="btn-set-payroll"
                          onClick={() => onSetPayroll(employee)}
                        >
                          {payrollInfo ? t('timeclock.edit') : t('timeclock.set')}{' '}
                          {t('timeclock.payroll_info_button')}
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hours Report Modal - Rendered via Portal */}
      {ReactDOM.createPortal(
        <HoursReportModal
          show={showHoursReport}
          reportStartDate={reportStartDate}
          setReportStartDate={setReportStartDate}
          reportEndDate={reportEndDate}
          setReportEndDate={setReportEndDate}
          hoursReportData={hoursReportData}
          allEmployees={allEmployees}
          onFetchReport={fetchHoursReport}
          onExportToCSV={exportToCSV}
          onFetchEmployeeAudit={fetchEmployeeAudit}
          onClose={() => setShowHoursReport(false)}
          t={t}
        />,
        document.body
      )}

      {/* Employee Audit Modal - Rendered via Portal */}
      {ReactDOM.createPortal(
        <EmployeeAuditModal
          show={showEmployeeAudit}
          selectedEmployee={selectedEmployeeForAudit}
          auditEntries={auditEntries}
          onClose={() => setShowEmployeeAudit(false)}
          t={t}
        />,
        document.body
      )}
    </div>
  );
};

export default AdminLiveView;
