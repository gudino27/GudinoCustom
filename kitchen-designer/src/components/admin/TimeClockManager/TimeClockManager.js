import React, { useState, useEffect } from "react";
import { Clock, Users, Calendar, FileEdit, LayoutDashboard } from "lucide-react";
import { useLanguage } from "../../../contexts/LanguageContext";
import {
  TIMEZONE,
  parsePSTTimestamp,
  formatTimePST,
  formatDatePST,
  formatDateTimePST,
  getTodayPST,
  toPSTDateString,
  extractPSTDate,
} from "./utils/timezoneUtils";
import { useCurrentTime } from "./hooks/useCurrentTime";
import CalendarView from "./components/CalendarView";
import AdminLiveView from "./components/AdminLiveView";
import WeekSummaryButtons from "./components/WeekSummaryButtons";
import ClockActions from "./components/ClockActions";
import CurrentStatusDisplay from "./components/CurrentStatusDisplay";
import PayrollInfoDisplay from "./components/PayrollInfoDisplay";
import PayrollSettingsModal from "./modals/PayrollSettingsModal";
import EditEntryModal from "./modals/EditEntryModal";
import ManualEntryModal from "./modals/ManualEntryModal";
import PaycheckCalculatorModal from "./modals/PaycheckCalculatorModal";
import "./TimeClockManager.css";
const TimeClockManager = ({ token, API_BASE, user }) => {
  const { t } = useLanguage();

  // Custom hooks
  const currentTime = useCurrentTime();

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [status, setStatus] = useState({
    isClockedIn: false,
    isOnBreak: false,
    clockInTime: null,
    currentHours: "0.00",
    breakMinutes: 0,
  });
  const [currentPeriod, setCurrentPeriod] = useState(null);
  const [activeView, setActiveView] = useState("employee"); // 'employee' or 'admin'
  const [showHistory, setShowHistory] = useState(false);
  const [timeHistory, setTimeHistory] = useState([]);
  const [showTaxCalculator, setShowTaxCalculator] = useState(false);
  const [taxRate, setTaxRate] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [monthEntries, setMonthEntries] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showEnterTimeModal, setShowEnterTimeModal] = useState(false);
  const [manualEntry, setManualEntry] = useState({
    date: getTodayPST(),
    timeIn: "",
    timeOut: "",
    breakMinutes: 0,
    notes: "",
  });
  const [thisWeekHours, setThisWeekHours] = useState(0);
  const [lastWeekHours, setLastWeekHours] = useState(0);
  const [payPeriodHours, setPayPeriodHours] = useState(0);
  const [payPeriodOvertime, setPayPeriodOvertime] = useState(0);
  const [editingEntry, setEditingEntry] = useState(null);
  const [editForm, setEditForm] = useState({
    clockInTime: "",
    clockOutTime: "",
    breakMinutes: 0,
    notes: "",
  });
  const [auditLog, setAuditLog] = useState([]);
  const [calendarView, setCalendarView] = useState("month"); // 'week' or 'month'

  // Payroll & Calculator states
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [payrollForm, setPayrollForm] = useState({
    employmentType: "hourly",
    hourlyRate: "",
    overtimeRate: "",
    salary: "",
    payPeriodType: "biweekly",
  });
  const [showCalculator, setShowCalculator] = useState(false);
  const [payrollInfo, setPayrollInfo] = useState(null);
  const [employeeTaxRate, setEmployeeTaxRate] = useState(0);
  const [savingTaxRate, setSavingTaxRate] = useState(false);

  // Fetch status on mount and every 30 seconds
  useEffect(() => {
    if (token) {
      fetchStatus();
      const interval = setInterval(fetchStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [token]);

  // Fetch current pay period and payroll info
  useEffect(() => {
    if (token) {
      fetchCurrentPeriod();
      fetchWeeklyHours();
      fetchPayrollInfo(); // Load employee's payroll info (includes tax rate)
    }
  }, [token]);

  const fetchWeeklyHours = async () => {
    try {
      // Get this week's hours (using PST dates)
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
      const endOfWeek = new Date(today);
      endOfWeek.setDate(today.getDate() + (6 - today.getDay())); // Saturday

      const thisWeekResponse = await fetch(
        `${API_BASE}/api/timeclock/my-entries?startDate=${toPSTDateString(
          startOfWeek,
        )}&endDate=${toPSTDateString(endOfWeek)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const thisWeekData = await thisWeekResponse.json();
      if (thisWeekData.success) {
        const totalHours = thisWeekData.entries.reduce(
          (sum, entry) => sum + (parseFloat(entry.total_hours) || 0),
          0,
        );
        setThisWeekHours(totalHours);
      }

      // Get last week's hours (using PST dates)
      const lastWeekStart = new Date(startOfWeek);
      lastWeekStart.setDate(startOfWeek.getDate() - 7);
      const lastWeekEnd = new Date(endOfWeek);
      lastWeekEnd.setDate(endOfWeek.getDate() - 7);

      const lastWeekResponse = await fetch(
        `${API_BASE}/api/timeclock/my-entries?startDate=${toPSTDateString(
          lastWeekStart,
        )}&endDate=${toPSTDateString(lastWeekEnd)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const lastWeekData = await lastWeekResponse.json();
      if (lastWeekData.success) {
        const totalHours = lastWeekData.entries.reduce(
          (sum, entry) => sum + (parseFloat(entry.total_hours) || 0),
          0,
        );
        setLastWeekHours(totalHours);
      }
    } catch (error) {
      console.error("Error fetching weekly hours:", error);
    }
  };

  const fetchPayPeriodHours = async (payPeriodType) => {
    try {
      const today = new Date();
      let startDate, endDate;

      switch (payPeriodType) {
        case "weekly":
          // Sunday to Saturday
          startDate = new Date(today);
          startDate.setDate(today.getDate() - today.getDay());
          endDate = new Date(today);
          endDate.setDate(today.getDate() + (6 - today.getDay()));
          break;

        case "biweekly":
          // Assuming pay period starts on Sunday, find current 2-week period
          const daysSinceSunday = today.getDay();
          const weekNumber = Math.floor(
            (today.getDate() + daysSinceSunday) / 14,
          );
          startDate = new Date(today);
          startDate.setDate(1 + weekNumber * 14 - daysSinceSunday);
          endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 13);
          break;

        case "semimonthly":
          // 1-15 and 16-end of month
          const dayOfMonth = today.getDate();
          if (dayOfMonth <= 15) {
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            endDate = new Date(today.getFullYear(), today.getMonth(), 15);
          } else {
            startDate = new Date(today.getFullYear(), today.getMonth(), 16);
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); // Last day of month
          }
          break;

        case "monthly":
          // First to last day of month
          startDate = new Date(today.getFullYear(), today.getMonth(), 1);
          endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          break;

        default:
          // Default to biweekly
          startDate = new Date(today);
          startDate.setDate(today.getDate() - today.getDay());
          endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 13);
      }

      const response = await fetch(
        `${API_BASE}/api/timeclock/my-entries?startDate=${toPSTDateString(
          startDate,
        )}&endDate=${toPSTDateString(endDate)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const data = await response.json();
      if (data.success) {
        const totalHours = data.entries.reduce(
          (sum, entry) => sum + (parseFloat(entry.total_hours) || 0),
          0,
        );
        setPayPeriodHours(totalHours);
        setPayPeriodOvertime(
          data.entries.reduce(
            (sum, entry) => sum + (parseFloat(entry.overtime_hours) || 0),
            0,
          ),
        );
      }
    } catch (error) {
      console.error("Error fetching pay period hours:", error);
    }
  };

  const fetchTimeHistory = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/api/timeclock/my-entries?limit=30`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const data = await response.json();
      if (data.success) {
        setTimeHistory(data.entries);
      }
    } catch (error) {
      console.error("Error fetching time history:", error);
    }
  };

  const handleSaveTaxRate = async () => {
    if (!taxRate || isNaN(taxRate) || taxRate < 0 || taxRate > 100) {
      alert(t("timeclock.invalid_tax_rate_message"));
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/timeclock/save-tax-rate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taxRate: parseFloat(taxRate),
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert(t("timeclock.tax_rate_saved_success"));
        setShowTaxCalculator(false);
        await fetchCurrentPeriod();
      } else {
        alert(data.message || t("timeclock.failed_save_tax_rate"));
      }
    } catch (error) {
      console.error("Save tax rate error:", error);
      alert(t("timeclock.error_save_tax_rate"));
    }
  };

  const fetchMonthEntries = async (date = currentMonth) => {
    try {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const startDate = `${year}-${month}-01`;
      const lastDay = new Date(year, date.getMonth() + 1, 0).getDate();
      const endDate = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;

      const response = await fetch(
        `${API_BASE}/api/timeclock/my-entries?startDate=${startDate}&endDate=${endDate}&limit=100`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();
      if (data.success) {
        // Group entries by date (extract date from PST timestamp)
        const entriesByDate = {};
        data.entries.forEach((entry) => {
          // Database stores PST timestamps like "2025-10-19 18:08:00"
          // Just extract the date portion
          const entryDate = extractPSTDate(entry.clock_in_time);

          if (!entriesByDate[entryDate]) {
            entriesByDate[entryDate] = [];
          }
          entriesByDate[entryDate].push(entry);
        });

        setMonthEntries(entriesByDate);
      }
    } catch (error) {
      console.error("Error fetching month entries:", error);
    }
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDay = firstDay.getDay(); // 0-6, Sunday-Saturday
    const days = [];
    const todayPST = getTodayPST(); // Get current date in PST

    // Add empty slots for days before month starts
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }

    // Add all days in month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(
        day,
      ).padStart(2, "0")}`;
      const entries = monthEntries[dateStr] || [];
      const totalHours = entries.reduce(
        (sum, e) => sum + (e.total_hours || 0),
        0,
      );

      days.push({
        day,
        date: dateStr,
        isToday: dateStr === todayPST, // Compare with PST date
        entries,
        totalHours: totalHours.toFixed(6),
        hasEntries: entries.length > 0,
      });
    }

    return days;
  };

  const changeMonth = (direction) => {
    const newDate = new Date(currentMonth);
    if (calendarView === "week") {
      // For week view, change by 7 days
      newDate.setDate(newDate.getDate() + direction * 7);
    } else {
      // For month view, change by 1 month
      newDate.setMonth(newDate.getMonth() + direction);
    }
    setCurrentMonth(newDate);
    fetchMonthEntries(newDate);
  };

  const getWeekDays = (date) => {
    const days = [];
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay()); // Go to Sunday

    const todayPST = getTodayPST(); // Get current date in PST

    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + i);
      const dateStr = toPSTDateString(currentDate); // Convert to PST date string
      const entries = monthEntries[dateStr] || [];
      const totalHours = entries
        .reduce((sum, e) => sum + (parseFloat(e.total_hours) || 0), 0)
        .toFixed(6);

      days.push({
        day: currentDate.getDate(),
        date: dateStr,
        isToday: dateStr === todayPST, // Compare with PST date
        entries,
        totalHours,
        hasEntries: entries.length > 0,
        fullDate: currentDate,
      });
    }

    return days;
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    fetchMonthEntries(today);
    setSelectedDate(getTodayPST()); // Use PST date
  };

  const closeManualEntryModal = () => {
    setShowEnterTimeModal(false);
    // Reset form when closing
    setManualEntry({
      date: getTodayPST(),
      timeIn: "",
      timeOut: "",
      breakMinutes: 0,
      notes: "",
    });
  };

  const openManualEntryForDate = (dateString) => {
    // Pre-fill the manual entry form with the selected date
    setManualEntry({
      date: dateString,
      timeIn: "",
      timeOut: "",
      breakMinutes: 0,
      notes: "",
    });
    setShowEnterTimeModal(true);
  };

  const handleManualEntrySubmit = async (e) => {
    e.preventDefault();

    if (!manualEntry.timeIn || !manualEntry.timeOut) {
      alert(t("timeclock.manual_entry_require_times"));
      return;
    }

    try {
      setActionLoading(true);

      // Format times as PST timestamps (YYYY-MM-DD HH:MM:SS format)
      // The input times are already in PST, so we just format them correctly
      const clockInTime = `${manualEntry.date} ${manualEntry.timeIn}:00`;
      const clockOutTime = `${manualEntry.date} ${manualEntry.timeOut}:00`;

      const response = await fetch(
        `${API_BASE}/api/timeclock/admin/add-manual-entry`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            employeeId: user.id,
            employeeName: user.full_name,
            clockInTime,
            clockOutTime,
            breakMinutes: parseInt(manualEntry.breakMinutes) || 0,
            reason: "Employee forgot to clock in/out",
            notes: "[Manual Entry] Employee added missed clock in/out",
          }),
        },
      );

      const data = await response.json();
      if (data.success) {
        alert(
          t(
            data.pendingApproval
              ? "timeclock.sent_for_approval"
              : "timeclock.time_entry_added_success",
          ),
        );
        setShowEnterTimeModal(false);
        setManualEntry({
          date: getTodayPST(), // Reset to current PST date
          timeIn: "",
          timeOut: "",
          breakMinutes: 0,
          notes: "",
        });
        // Refresh all data
        await fetchWeeklyHours();
        await fetchPayPeriodHours(payrollInfo?.pay_period_type || "biweekly");
        await fetchCurrentPeriod();
        await fetchMonthEntries(); // Always refresh calendar entries
      } else {
        alert(data.message || data.error || t("timeclock.failed_add_time_entry"));
      }
    } catch (error) {
      console.error("Error adding manual entry:", error);
      alert(t("timeclock.error_adding_time_entry"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditEntry = (entry) => {
    setEditingEntry(entry);

    // Stored times are already PST wall-clock, so only the format changes
    // The datetime-local input expects the format: "YYYY-MM-DDTHH:mm"
    const toInputValue = (time) => time.replace(" ", "T").slice(0, 16);

    // Show a change that is still waiting on a manager, not the approved times
    const waiting = entry.pending_changes ? JSON.parse(entry.pending_changes) : null;
    const edit = waiting?.action === "edit" ? waiting : null;
    const clockIn = edit ? edit.clockIn : entry.clock_in_time;
    const clockOut = edit ? edit.clockOut : entry.clock_out_time;

    setEditForm({
      clockInTime: toInputValue(clockIn),
      clockOutTime: clockOut ? toInputValue(clockOut) : "",
      breakMinutes: edit ? edit.breakMinutes : entry.break_minutes || 0,
      notes: (edit ? edit.notes : entry.notes) || "",
    });

    // Fetch audit log
    fetchAuditLog(entry.id);
  };

  const fetchAuditLog = async (entryId) => {
    try {
      const response = await fetch(
        `${API_BASE}/api/timeclock/admin/entry-audit/${entryId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const data = await response.json();
      if (data.success) {
        setAuditLog(data.modifications || []);
      }
    } catch (error) {
      console.error("Error fetching audit log:", error);
    }
  };

  const handleSaveEdit = async () => {
    if (!editForm.clockInTime) {
      alert(t("timeclock.clock_in_required"));
      return;
    }

    try {
      setActionLoading(true);
      const response = await fetch(
        `${API_BASE}/api/timeclock/admin/edit-entry/${editingEntry.id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            clockInTime: editForm.clockInTime,
            clockOutTime: editForm.clockOutTime || null,
            breakMinutes: parseInt(editForm.breakMinutes) || 0,
            notes: editForm.notes || "",
            reason: "Employee/Admin correction",
          }),
        },
      );

      const data = await response.json();
      if (data.success) {
        alert(
          t(
            data.pendingApproval
              ? "timeclock.sent_for_approval"
              : "timeclock.time_entry_updated_success",
          ),
        );
        setEditingEntry(null);
        await fetchWeeklyHours();
        await fetchCurrentPeriod();
        if (showCalendar) {
          await fetchMonthEntries();
        }
      } else {
        alert(data.message || data.error || t("timeclock.failed_update_entry"));
      }
    } catch (error) {
      console.error("Error updating entry:", error);
      alert(t("timeclock.error_updating_entry"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteEntry = async () => {
    if (!window.confirm(t("timeclock.confirm_delete_entry"))) {
      return;
    }

    try {
      setActionLoading(true);
      const response = await fetch(
        `${API_BASE}/api/timeclock/admin/delete-entry/${editingEntry.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reason: "Deleted by employee/admin",
          }),
        },
      );

      const data = await response.json();
      if (data.success) {
        alert(
          t(
            data.pendingApproval
              ? "timeclock.sent_for_approval"
              : "timeclock.time_entry_deleted_success",
          ),
        );
        setEditingEntry(null);
        await fetchWeeklyHours();
        await fetchCurrentPeriod();
        if (showCalendar) {
          await fetchMonthEntries();
        }
      } else {
        alert(data.message || data.error || t("timeclock.failed_delete_entry"));
      }
    } catch (error) {
      console.error("Error deleting entry:", error);
      alert(t("timeclock.error_deleting_entry"));
    } finally {
      setActionLoading(false);
    }
  };

  const fetchStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/timeclock/current-status`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setStatus(data);
      }
    } catch (error) {
      console.error("Error fetching status:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentPeriod = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/timeclock/current-period`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.success && data.hasPayPeriod) {
        setCurrentPeriod(data);
      }
    } catch (error) {
      console.error("Error fetching period:", error);
    }
  };

  const fetchPayrollInfo = async (employeeId = null) => {
    try {
      let response;
      if (employeeId) {
        // Admin fetching specific employee's info
        response = await fetch(
          `${API_BASE}/api/timeclock/admin/payroll-info/${employeeId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
      } else {
        // Employee fetching their own info
        response = await fetch(`${API_BASE}/api/timeclock/my-payroll-info`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }

      const data = await response.json();

      if (data.success && data.payrollInfo) {
        if (employeeId) {
          // Admin viewing employee's info for modal
          setPayrollForm({
            employmentType: data.payrollInfo.employment_type || "hourly",
            hourlyRate: data.payrollInfo.hourly_rate || "",
            overtimeRate: data.payrollInfo.overtime_rate || "",
            salary: data.payrollInfo.salary || "",
            payPeriodType: data.payrollInfo.pay_period_type || "biweekly",
          });
        } else {
          // Employee viewing their own info
          setPayrollInfo(data.payrollInfo);
          setEmployeeTaxRate(data.payrollInfo.save_tax_rate || 0);
          // Fetch pay period hours based on their pay period type
          if (data.payrollInfo.pay_period_type) {
            fetchPayPeriodHours(data.payrollInfo.pay_period_type);
          }
        }
      } else {
        // Clear payroll info if none exists
        if (!employeeId) {
          setPayrollInfo(null);
          setEmployeeTaxRate(0);
        }
      }
    } catch (error) {
      console.error("Error fetching payroll info:", error);
      // Clear on error
      if (!employeeId) {
        setPayrollInfo(null);
        setEmployeeTaxRate(0);
      }
    }
  };

  const savePayrollInfo = async (employeeId) => {
    try {
      const response = await fetch(
        `${API_BASE}/api/timeclock/admin/payroll-info`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            employeeId: employeeId,
            employmentType: payrollForm.employmentType,
            hourlyRate:
              payrollForm.employmentType === "hourly"
                ? parseFloat(payrollForm.hourlyRate)
                : null,
            overtimeRate: payrollForm.overtimeRate
              ? parseFloat(payrollForm.overtimeRate)
              : null,
            salary:
              payrollForm.employmentType === "salary"
                ? parseFloat(payrollForm.salary)
                : null,
            payPeriodType: payrollForm.payPeriodType,
          }),
        },
      );

      const data = await response.json();
      if (data.success) {
        alert(t("timeclock.payroll_info_saved"));
        setShowPayrollModal(false);
        setSelectedEmployee(null);
      } else {
        alert(
          data.message
            ? `${t("common.error")}: ${data.message}`
            : t("timeclock.failed_save_payroll_info"),
        );
      }
    } catch (error) {
      console.error("Error saving payroll info:", error);
      alert(t("timeclock.failed_save_payroll_info"));
    }
  };

  const saveTaxRate = async () => {
    setSavingTaxRate(true);
    try {
      const response = await fetch(`${API_BASE}/api/timeclock/save-tax-rate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          taxRate: parseFloat(employeeTaxRate),
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert(t("timeclock.tax_rate_saved_success"));
        await fetchPayrollInfo(); // Refresh to get updated info
      } else {
        alert(
          data.message
            ? `${t("common.error")}: ${data.message}`
            : t("timeclock.failed_save_tax_rate"),
        );
      }
    } catch (error) {
      console.error("Error saving tax rate:", error);
      alert(t("timeclock.failed_save_tax_rate"));
    } finally {
      setSavingTaxRate(false);
    }
  };

  const handleClockIn = async () => {
    if (!window.confirm(t("timeclock.confirm_clock_in"))) return;

    setActionLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/timeclock/clock-in`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          location: "Web App",
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert(t("timeclock.clocked_in_success"));
        await fetchStatus();
        await fetchCurrentPeriod();
      } else {
        alert(data.message || t("timeclock.failed_clock_in"));
      }
    } catch (error) {
      console.error("Clock-in error:", error);
      alert(t("timeclock.error_clocking_in"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!window.confirm(t("timeclock.confirm_clock_out"))) return;

    setActionLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/timeclock/clock-out`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      if (data.success) {
        alert(
          t("timeclock.clocked_out_success_with_hours", {
            hours: data.totalHours,
          }),
        );
        await fetchStatus();
        await fetchCurrentPeriod();
      } else {
        alert(data.message || t("timeclock.failed_clock_out"));
      }
    } catch (error) {
      console.error("Clock-out error:", error);
      alert(t("timeclock.error_clocking_out"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartBreak = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/timeclock/start-break`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      if (data.success) {
        alert(t("timeclock.break_started"));
        await fetchStatus();
      } else {
        alert(data.message || t("timeclock.failed_start_break"));
      }
    } catch (error) {
      console.error("Start break error:", error);
      alert(t("timeclock.error_starting_break"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndBreak = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/timeclock/end-break`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      if (data.success) {
        alert(
          t("timeclock.break_ended_with_duration", {
            minutes: data.durationMinutes,
          }),
        );
        await fetchStatus();
      } else {
        alert(data.message || t("timeclock.failed_end_break"));
      }
    } catch (error) {
      console.error("End break error:", error);
      alert(t("timeclock.error_ending_break"));
    } finally {
      setActionLoading(false);
    }
  };

  const formatTime = (dateString) => {
    return formatTimePST(dateString);
  };

  const formatDate = (dateString) => {
    return formatDatePST(dateString);
  };

  const calculateElapsedTime = () => {
    if (!status.isClockedIn || !status.clockInTime) return "0h 0m";

    // Calculate elapsed time using PST
    const clockIn = new Date(status.clockInTime);
    const now = new Date();
    const diffMs = now - clockIn;
    const diffMins = Math.floor(diffMs / 60000) - status.breakMinutes;
    const hours = Math.floor(diffMins / 60);
    const minutes = diffMins % 60;

    return `${hours}h ${minutes}m`;
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
    <div className="timeclock-manager">
      <div className="timeclock-header">
        <h2>
          <Clock size={24} />
          {t("timeclock.title")}
        </h2>
        <div className="header-actions">
          {!showCalendar && activeView === "employee" && (
            <button
              className="btn-calendar"
              onClick={() => {
                setShowCalendar(true);
                fetchMonthEntries();
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
              >
                <Calendar size={16} /> {t("timeclock.calendar")}
              </div>
            </button>
          )}
          {showCalendar && (
            <button
              className="btn-calendar"
              onClick={() => setShowCalendar(false)}
            >
              <LayoutDashboard size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />
              {t("timeclock.back_to_dashboard")}
            </button>
          )}
          {(user?.role === "super_admin" || user?.role === "admin") && (
            <div className="view-toggle">
              <button
                className={activeView === "employee" ? "active" : ""}
                onClick={() => {
                  setActiveView("employee");
                  setShowCalendar(false);
                }}
              >
                {t("timeclock.employee_view")}
              </button>
              <button
                className={activeView === "admin" ? "active" : ""}
                onClick={() => {
                  setActiveView("admin");
                  setShowCalendar(false);
                }}
              >
                <Users size={16} />
                {t("timeclock.admin_view")}
              </button>
            </div>
          )}
        </div>
      </div>

      {activeView === "employee" ? (
        showCalendar ? (
          <CalendarView
            currentMonth={currentMonth}
            onChangeMonth={changeMonth}
            days={
              calendarView === "month"
                ? getDaysInMonth(currentMonth)
                : getWeekDays(currentMonth)
            }
            onSelectDate={setSelectedDate}
            selectedDate={selectedDate}
            onEditEntry={handleEditEntry}
            calendarView={calendarView}
            onViewChange={setCalendarView}
            onGoToToday={goToToday}
            openManualEntryForDate={openManualEntryForDate}
            t={t}
          />
        ) : (
          <>
            {/* Workday-style Main Interface */}
            <div className="workday-interface">
              <div className="workday-section">
                <h3 className="section-title">{t("timeclock.enter_time")}</h3>

                {/* Week Summary Buttons */}
                <WeekSummaryButtons
                  thisWeekHours={thisWeekHours}
                  lastWeekHours={lastWeekHours}
                  onThisWeekClick={() => {
                    setShowCalendar(true);
                    fetchMonthEntries();
                  }}
                  onLastWeekClick={() => {
                    setShowCalendar(true);
                    const lastWeek = new Date();
                    lastWeek.setDate(lastWeek.getDate() - 7);
                    setCurrentMonth(lastWeek);
                    fetchMonthEntries(lastWeek);
                  }}
                  onSelectWeekClick={() => {
                    setShowCalendar(true);
                    fetchMonthEntries();
                  }}
                  t={t}
                />
              </div>

              {/* Time Clock Section */}
              <div className="workday-section">
                <h3 className="section-title">{t("timeclock.time_clock")}</h3>

                <ClockActions
                  isClockedIn={status.isClockedIn}
                  isOnBreak={status.isOnBreak}
                  onClockIn={handleClockIn}
                  onClockOut={handleClockOut}
                  onStartBreak={handleStartBreak}
                  onEndBreak={handleEndBreak}
                  actionLoading={actionLoading}
                  t={t}
                />

                {/* Manual Entry Button for Missed Clock-Ins */}
                <div style={{ marginTop: "1rem", textAlign: "center" }}>
                  <button
                    className="btn-text-link"
                    onClick={() => setShowEnterTimeModal(true)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#6b7280",
                      fontSize: "0.875rem",
                      textDecoration: "underline",
                      cursor: "pointer",
                      padding: "0.5rem",
                    }}
                  >
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.25rem",
                      }}
                    >
                      <FileEdit size={16} /> {t("timeclock.forgot_to_clock_in")}
                    </div>
                  </button>
                </div>

                {/* Current Status Display */}
                <CurrentStatusDisplay
                  isClockedIn={status.isClockedIn}
                  isOnBreak={status.isOnBreak}
                  clockInTime={status.clockInTime}
                  elapsedTime={calculateElapsedTime()}
                  breakMinutes={status.breakMinutes}
                  formatTime={formatTime}
                  t={t}
                />
              </div>

              {/* Employee's Payroll Info */}
              <PayrollInfoDisplay
                payrollInfo={payrollInfo}
                payPeriodHours={payPeriodHours}
                payPeriodOvertime={payPeriodOvertime}
                employeeTaxRate={employeeTaxRate}
                onOpenCalculator={() => setShowCalculator(true)}
                t={t}
              />
            </div>
          </>
        )
      ) : (
        /* Admin Live View */
        <AdminLiveView
          token={token}
          API_BASE={API_BASE}
          user={user}
          onSetPayroll={(employee) => {
            setSelectedEmployee(employee);
            fetchPayrollInfo(employee.id);
            setShowPayrollModal(true);
          }}
          t={t}
        />
      )}

      {/* Modals */}
      <PayrollSettingsModal
        show={showPayrollModal}
        selectedEmployee={selectedEmployee}
        payrollForm={payrollForm}
        setPayrollForm={setPayrollForm}
        onClose={() => {
          setShowPayrollModal(false);
          setSelectedEmployee(null);
        }}
        onSave={savePayrollInfo}
      />

      <EditEntryModal
        editingEntry={editingEntry}
        editForm={editForm}
        setEditForm={setEditForm}
        auditLog={auditLog}
        onSave={handleSaveEdit}
        onDelete={handleDeleteEntry}
        onClose={() => setEditingEntry(null)}
        actionLoading={actionLoading}
      />

      <ManualEntryModal
        show={showEnterTimeModal}
        manualEntry={manualEntry}
        setManualEntry={setManualEntry}
        onSubmit={handleManualEntrySubmit}
        onClose={closeManualEntryModal}
        actionLoading={actionLoading}
        t={t}
      />

      <PaycheckCalculatorModal
        show={showCalculator}
        payrollInfo={payrollInfo}
        payPeriodHours={payPeriodHours}
        payPeriodOvertime={payPeriodOvertime}
        employeeTaxRate={employeeTaxRate}
        setEmployeeTaxRate={setEmployeeTaxRate}
        onSaveTaxRate={saveTaxRate}
        savingTaxRate={savingTaxRate}
        onClose={() => setShowCalculator(false)}
        t={t}
      />
    </div>
  );
};

export default TimeClockManager;
