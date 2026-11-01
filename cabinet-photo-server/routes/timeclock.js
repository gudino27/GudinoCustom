const express = require("express");
const router = express.Router();
const { authenticateUser, isSuperAdmin, isAdminOrSuperAdmin } = require("../middleware/auth");
const { getDb } = require("../db-helpers");
const moment = require("moment-timezone");
const { recalcWeek } = require("../utils/weekly-overtime");
const { notifyUser, notifyRoles } = require("../utils/notifications");
const { reportBlockedAttempt } = require("../utils/security-alerts");

// Timezone constant
const TIMEZONE = "America/Los_Angeles"; // PST/PDT

// Helper to run database operations with automatic connection management
async function withDb(operation) {
  const db = await getDb();
  try {
    return await operation(db);
  } finally {
    await db.close();
  }
}

// Helper function to calculate hours between two times
function calculateHours(clockIn, clockOut, breakMinutes = 0) {
  const start = moment(clockIn);
  const end = moment(clockOut);
  const totalMinutes = end.diff(start, "minutes") - breakMinutes;
  return totalMinutes / 60;
}

// Stored times are Pacific wall-clock strings, always in this format
const ENTRY_TIME_FORMAT = "YYYY-MM-DD HH:mm:ss";
const ENTRY_INPUT_FORMATS = [
  ENTRY_TIME_FORMAT,
  "YYYY-MM-DD HH:mm",
  "YYYY-MM-DDTHH:mm:ss",
  "YYYY-MM-DDTHH:mm",
];

function isAdminUser(user) {
  return user.role === "admin" || user.role === "super_admin";
}

function canManageEntry(user, entry) {
  return isAdminUser(user) || Number(entry.employee_id) === Number(user.id);
}

// Validates entered times; returns { error } or the cleaned-up values
function checkEntryTimes(clockInTime, clockOutTime, breakMinutes) {
  const clockIn = moment(clockInTime, ENTRY_INPUT_FORMATS, true);
  if (!clockIn.isValid()) {
    return { error: "Clock in time is not valid" };
  }

  const clockOut = clockOutTime ? moment(clockOutTime, ENTRY_INPUT_FORMATS, true) : null;
  if (clockOut && !clockOut.isValid()) {
    return { error: "Clock out time is not valid" };
  }
  // The forms pick one date, so an earlier clock out means it ran past midnight
  if (clockOut && clockOut.isBefore(clockIn) && clockOut.isSame(clockIn, "day")) {
    clockOut.add(1, "day");
  }
  if (clockOut && !clockOut.isAfter(clockIn)) {
    return { error: "Clock out must be after clock in" };
  }

  const minutes = Number(breakMinutes || 0);
  if (!Number.isInteger(minutes) || minutes < 0) {
    return { error: "Break minutes must be a whole number" };
  }
  if (clockOut && minutes >= clockOut.diff(clockIn, "minutes")) {
    return { error: "Break must be shorter than the shift" };
  }

  return {
    clockIn: clockIn.format(ENTRY_TIME_FORMAT),
    clockOut: clockOut ? clockOut.format(ENTRY_TIME_FORMAT) : null,
    breakMinutes: minutes,
  };
}

// Finds another entry for this employee that shares any time with the given shift
async function findOverlap(db, employeeId, clockIn, clockOut, excludeId = 0) {
  const now = moment().tz(TIMEZONE).format(ENTRY_TIME_FORMAT);
  return db.get(
    `SELECT clock_in_time, clock_out_time FROM time_clock_entries
     WHERE employee_id = ? AND is_deleted = 0 AND id != ?
     AND datetime(clock_in_time) < datetime(?)
     AND datetime(COALESCE(clock_out_time, ?)) > datetime(?)
     LIMIT 1`,
    [employeeId, excludeId, clockOut || now, now, clockIn]
  );
}

function overlapMessage(entry) {
  const start = moment(entry.clock_in_time).format("MMM D, h:mm A");
  const end = entry.clock_out_time
    ? moment(entry.clock_out_time).format("h:mm A")
    : "still clocked in";
  return `This overlaps an existing entry (${start} - ${end})`;
}

// "Oct 30, 7:00 AM - 3:30 PM (30 min break)"
function shiftText(clockIn, clockOut, breakMinutes) {
  const start = moment(clockIn).format("MMM D, h:mm A");
  const end = clockOut ? moment(clockOut).format("h:mm A") : "still clocked in";
  return `${start} - ${end}${breakMinutes > 0 ? ` (${breakMinutes} min break)` : ""}`;
}

function managers(db, entry, title, body) {
  return notifyRoles(db, ["admin", "super_admin"], {
    type: "approval",
    title: `${entry.employee_name} ${title}`,
    body,
    entryId: entry.id,
  });
}

// The employee's own record of what a manager did to their time
async function tellEmployee(db, req, entry, title, body) {
  if (Number(entry.employee_id) === Number(req.user.id)) return;

  await notifyUser(db, entry.employee_id, { type: "timeclock", title, body, entryId: entry.id });
}

async function managerName(db, user) {
  const person = await db.get(`SELECT full_name, username FROM users WHERE id = ?`, [user.id]);
  return person?.full_name || person?.username || "A manager";
}

// Runs entry changes one at a time, so two requests can't both pass the overlap check
let entryQueue = Promise.resolve();

function oneAtATime(operation) {
  const run = entryQueue.then(operation, operation);
  entryQueue = run.catch(() => {});
  return run;
}

async function logEntryChange(db, entryId, user, type, reason, before = {}, after = {}) {
  const person = await db.get(`SELECT full_name FROM users WHERE id = ?`, [user.id]);
  await db.run(
    `INSERT INTO time_entry_modifications (
      time_entry_id, modified_by, modified_by_name, modification_type, reason,
      old_clock_in, old_clock_out, old_total_hours,
      new_clock_in, new_clock_out, new_total_hours
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entryId, user.id, person?.full_name || "Unknown", type, reason,
      before.clockIn, before.clockOut, before.totalHours,
      after.clockIn, after.clockOut, after.totalHours,
    ]
  );
}

// ==================== EMPLOYEE ENDPOINTS ====================

// POST /api/timeclock/clock-in - Employee clocks in
router.post("/clock-in", authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { location, notes } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    await withDb(async (db) => {
      // Check if already clocked in
      const activeEntry = await db.get(
        `SELECT * FROM time_clock_entries 
         WHERE employee_id = ? AND status = 'active' AND is_deleted = 0`,
        [userId]
      );

      if (activeEntry) {
        return res.status(400).json({
          success: false,
          message: "Already clocked in",
          clockInTime: activeEntry.clock_in_time,
        });
      }

      // Get employee name
      const user = await db.get(`SELECT full_name FROM users WHERE id = ?`, [
        userId,
      ]);

      // Create new time entry with PST timezone
      const clockInTime = moment().tz(TIMEZONE).format("YYYY-MM-DD HH:mm:ss");
      const result = await db.run(
        `INSERT INTO time_clock_entries (
          employee_id, employee_name, clock_in_time, status, 
          location, notes, ip_address, entry_method
        ) VALUES (?, ?, ?, 'active', ?, ?, ?, 'automatic')`,
        [userId, user.full_name, clockInTime, location, notes, ipAddress]
      );

      res.json({
        success: true,
        message: "Clocked in successfully",
        entryId: result.lastID,
        clockInTime,
      });
    });
  } catch (error) {
    console.error("Clock-in error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to clock in", error: error.message });
  }
});

// POST /api/timeclock/clock-out - Employee clocks out
router.post("/clock-out", authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { notes } = req.body;

    await withDb(async (db) => {
      // Find active entry
      const activeEntry = await db.get(
        `SELECT * FROM time_clock_entries 
         WHERE employee_id = ? AND status = 'active' AND is_deleted = 0`,
        [userId]
      );

      if (!activeEntry) {
        return res.status(400).json({
          success: false,
          message: "Not currently clocked in",
        });
      }

      // Calculate hours with PST timezone
      const clockOutTime = moment().tz(TIMEZONE).format("YYYY-MM-DD HH:mm:ss");
      const totalHours = calculateHours(
        activeEntry.clock_in_time,
        clockOutTime,
        activeEntry.break_minutes
      );

      // Update entry
      await db.run(
        `UPDATE time_clock_entries 
         SET clock_out_time = ?, total_hours = ?, status = 'completed', notes = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [clockOutTime, totalHours, notes, activeEntry.id]
      );

      await recalcWeek(db, userId, activeEntry.clock_in_time);
      const { regular_hours: regularHours, overtime_hours: overtimeHours } = await db.get(
        `SELECT regular_hours, overtime_hours FROM time_clock_entries WHERE id = ?`,
        [activeEntry.id]
      );

      res.json({
        success: true,
        message: "Clocked out successfully",
        clockOutTime,
        totalHours: totalHours.toFixed(2),
        regularHours: regularHours.toFixed(2),
        overtimeHours: overtimeHours.toFixed(2),
      });
    });
  } catch (error) {
    console.error("Clock-out error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to clock out", error: error.message });
  }
});

// POST /api/timeclock/start-break - Start a break
router.post("/start-break", authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { breakType } = req.body;

    await withDb(async (db) => {
      // Find active entry
      const activeEntry = await db.get(
        `SELECT * FROM time_clock_entries 
         WHERE employee_id = ? AND status = 'active' AND is_deleted = 0`,
        [userId]
      );

      if (!activeEntry) {
        return res.status(400).json({
          success: false,
          message: "Not currently clocked in",
        });
      }

      // Check if already on break
      const activeBreak = await db.get(
        `SELECT * FROM time_clock_breaks 
         WHERE time_entry_id = ? AND break_end IS NULL`,
        [activeEntry.id]
      );

      if (activeBreak) {
        return res.status(400).json({
          success: false,
          message: "Already on break",
        });
      }

      // Create break entry with PST timezone
      const breakStart = moment().tz(TIMEZONE).format("YYYY-MM-DD HH:mm:ss");
      const result = await db.run(
        `INSERT INTO time_clock_breaks (time_entry_id, break_start, break_type)
         VALUES (?, ?, ?)`,
        [activeEntry.id, breakStart, breakType || "regular"]
      );

      res.json({
        success: true,
        message: "Break started",
        breakId: result.lastID,
        breakStart,
      });
    });
  } catch (error) {
    console.error("Start break error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to start break",
      error: error.message,
    });
  }
});

// POST /api/timeclock/end-break - End a break
router.post("/end-break", authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;

    await withDb(async (db) => {
      // Find active entry
      const activeEntry = await db.get(
        `SELECT * FROM time_clock_entries 
         WHERE employee_id = ? AND status = 'active' AND is_deleted = 0`,
        [userId]
      );

      if (!activeEntry) {
        return res.status(400).json({
          success: false,
          message: "Not currently clocked in",
        });
      }

      // Find active break
      const activeBreak = await db.get(
        `SELECT * FROM time_clock_breaks 
         WHERE time_entry_id = ? AND break_end IS NULL`,
        [activeEntry.id]
      );

      if (!activeBreak) {
        return res.status(400).json({
          success: false,
          message: "Not currently on break",
        });
      }

      // End break and calculate duration with PST timezone
      const breakEnd = moment().tz(TIMEZONE).format("YYYY-MM-DD HH:mm:ss");
      const durationMinutes = moment(breakEnd).diff(
        moment(activeBreak.break_start),
        "minutes"
      );

      await db.run(
        `UPDATE time_clock_breaks 
         SET break_end = ?, duration_minutes = ?
         WHERE id = ?`,
        [breakEnd, durationMinutes, activeBreak.id]
      );

      // Update total break minutes on time entry
      const totalBreakMinutes = await db.get(
        `SELECT SUM(duration_minutes) as total FROM time_clock_breaks 
         WHERE time_entry_id = ? AND break_end IS NOT NULL`,
        [activeEntry.id]
      );

      await db.run(
        `UPDATE time_clock_entries 
         SET break_minutes = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [totalBreakMinutes.total || 0, activeEntry.id]
      );

      res.json({
        success: true,
        message: "Break ended",
        breakEnd,
        durationMinutes,
        totalBreakMinutes: totalBreakMinutes.total || 0,
      });
    });
  } catch (error) {
    console.error("End break error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to end break",
      error: error.message,
    });
  }
});

// GET /api/timeclock/current-status - Get employee's current clock status
router.get("/current-status", authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;

    await withDb(async (db) => {
      // Find active entry
      const activeEntry = await db.get(
        `SELECT * FROM time_clock_entries 
         WHERE employee_id = ? AND status = 'active' AND is_deleted = 0`,
        [userId]
      );

      if (!activeEntry) {
        return res.json({
          success: true,
          isClockedIn: false,
          isOnBreak: false,
        });
      }

      // Check if on break
      const activeBreak = await db.get(
        `SELECT * FROM time_clock_breaks 
         WHERE time_entry_id = ? AND break_end IS NULL`,
        [activeEntry.id]
      );

      // Calculate current hours worked
      const currentTime = moment();
      const hoursWorked = calculateHours(
        activeEntry.clock_in_time,
        currentTime.format("YYYY-MM-DD HH:mm:ss"),
        activeEntry.break_minutes
      );

      res.json({
        success: true,
        isClockedIn: true,
        isOnBreak: !!activeBreak,
        clockInTime: activeEntry.clock_in_time,
        currentHours: hoursWorked.toFixed(2),
        breakMinutes: activeEntry.break_minutes,
        location: activeEntry.location,
        notes: activeEntry.notes,
        breakStartTime: activeBreak ? activeBreak.break_start : null,
      });
    });
  } catch (error) {
    console.error("Get status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get status",
      error: error.message,
    });
  }
});

// GET /api/timeclock/my-entries - Get employee's time entries
router.get("/my-entries", authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate, limit = 50 } = req.query;

    await withDb(async (db) => {
      let query = `
        SELECT * FROM time_clock_entries 
        WHERE employee_id = ? AND is_deleted = 0
      `;
      const params = [userId];

      if (startDate) {
        query += ` AND date(clock_in_time) >= date(?)`;
        params.push(startDate);
      }

      if (endDate) {
        query += ` AND date(clock_in_time) <= date(?)`;
        params.push(endDate);
      }

      query += ` ORDER BY clock_in_time DESC LIMIT ?`;
      params.push(parseInt(limit));

      const entries = await db.all(query, params);

      // Get breaks for each entry
      for (let entry of entries) {
        entry.breaks = await db.all(
          `SELECT * FROM time_clock_breaks WHERE time_entry_id = ?`,
          [entry.id]
        );
      }

      res.json({
        success: true,
        entries,
      });
    });
  } catch (error) {
    console.error("Get entries error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get entries",
      error: error.message,
    });
  }
});

// GET /api/timeclock/current-period - Get current pay period summary
router.get("/current-period", authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = moment().format("YYYY-MM-DD");

    await withDb(async (db) => {
      // Find current pay period
      const payPeriod = await db.get(
        `SELECT * FROM pay_periods 
         WHERE date(?) BETWEEN date(start_date) AND date(end_date)
         ORDER BY start_date DESC LIMIT 1`,
        [today]
      );

      if (!payPeriod) {
        return res.json({
          success: true,
          hasPayPeriod: false,
          message: "No active pay period",
        });
      }

      // Get entries for this pay period
      const entries = await db.all(
        `SELECT * FROM time_clock_entries 
         WHERE employee_id = ? AND is_deleted = 0
         AND date(clock_in_time) BETWEEN date(?) AND date(?)`,
        [userId, payPeriod.start_date, payPeriod.end_date]
      );

      // Calculate totals
      let totalHours = 0;
      let totalRegularHours = 0;
      let totalOvertimeHours = 0;

      entries.forEach((entry) => {
        if (entry.total_hours) {
          totalHours += entry.total_hours;
          totalRegularHours += entry.regular_hours || 0;
          totalOvertimeHours += entry.overtime_hours || 0;
        }
      });

      // Get payroll info for estimation
      const payrollInfo = await db.get(
        `SELECT * FROM employee_payroll_info WHERE employee_id = ? AND is_active = 1`,
        [userId]
      );

      let estimatedGrossPay = 0;
      if (payrollInfo) {
        if (payrollInfo.employment_type === "hourly") {
          estimatedGrossPay =
            totalRegularHours * (payrollInfo.hourly_rate || 0) +
            totalOvertimeHours * (payrollInfo.overtime_rate || 0);
        }
      }

      res.json({
        success: true,
        hasPayPeriod: true,
        payPeriod: {
          id: payPeriod.id,
          startDate: payPeriod.start_date,
          endDate: payPeriod.end_date,
          payDate: payPeriod.pay_date,
          periodType: payPeriod.period_type,
        },
        summary: {
          totalHours: totalHours.toFixed(2),
          regularHours: totalRegularHours.toFixed(2),
          overtimeHours: totalOvertimeHours.toFixed(2),
          daysWorked: entries.length,
          estimatedGrossPay: estimatedGrossPay.toFixed(2),
        },
      });
    });
  } catch (error) {
    console.error("Get current period error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get current period",
      error: error.message,
    });
  }
});

// POST /api/timeclock/save-tax-rate - Save employee's tax rate for estimation
router.post("/save-tax-rate", authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { taxRate } = req.body;

    if (!taxRate || taxRate < 0 || taxRate > 100) {
      return res.status(400).json({
        success: false,
        message: "Invalid tax rate (must be 0-100)",
      });
    }

    await withDb(async (db) => {
      // Update or create payroll info
      const existing = await db.get(
        `SELECT * FROM employee_payroll_info WHERE employee_id = ?`,
        [userId]
      );

      if (existing) {
        await db.run(
          `UPDATE employee_payroll_info SET save_tax_rate = ? WHERE employee_id = ?`,
          [taxRate, userId]
        );
      } else {
        await db.run(
          `INSERT INTO employee_payroll_info (employee_id, save_tax_rate, is_active)
           VALUES (?, ?, 1)`,
          [userId, taxRate]
        );
      }

      res.json({
        success: true,
        message: "Tax rate saved",
        taxRate,
      });
    });
  } catch (error) {
    console.error("Save tax rate error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save tax rate",
      error: error.message,
    });
  }
});

// ==================== ADMIN ENDPOINTS ====================

// GET /api/admin/timeclock/live-status - Get all currently clocked in employees
router.get("/admin/live-status", authenticateUser, isAdminOrSuperAdmin, async (req, res) => {
  try {
    await withDb(async (db) => {
      const activeEntries = await db.all(
        `SELECT tce.*, 
          (SELECT break_start FROM time_clock_breaks 
           WHERE time_entry_id = tce.id AND break_end IS NULL LIMIT 1) as current_break
         FROM time_clock_entries tce
         WHERE tce.status = 'active' AND tce.is_deleted = 0
         ORDER BY tce.clock_in_time DESC`
      );

      // Calculate current hours for each
      const currentTime = moment();
      activeEntries.forEach((entry) => {
        const hoursWorked = calculateHours(
          entry.clock_in_time,
          currentTime.format("YYYY-MM-DD HH:mm:ss"),
          entry.break_minutes
        );
        entry.currentHours = hoursWorked.toFixed(2);
        entry.isOnBreak = !!entry.current_break;
      });

      res.json({
        success: true,
        activeEmployees: activeEntries.length,
        entries: activeEntries,
      });
    });
  } catch (error) {
    console.error("Get live status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get live status",
      error: error.message,
    });
  }
});

// GET /api/admin/timeclock/entries - Get all time entries (with filters)
router.get("/admin/entries", authenticateUser, isAdminOrSuperAdmin, async (req, res) => {
  try {
    const { employeeId, startDate, endDate, status, limit = 100 } = req.query;

    await withDb(async (db) => {
      let query = `SELECT * FROM time_clock_entries WHERE is_deleted = 0`;
      const params = [];

      if (employeeId) {
        query += ` AND employee_id = ?`;
        params.push(employeeId);
      }

      if (startDate) {
        query += ` AND date(clock_in_time) >= date(?)`;
        params.push(startDate);
      }

      if (endDate) {
        query += ` AND date(clock_in_time) <= date(?)`;
        params.push(endDate);
      }

      if (status) {
        query += ` AND status = ?`;
        params.push(status);
      }

      query += ` ORDER BY clock_in_time DESC LIMIT ?`;
      params.push(parseInt(limit));

      const entries = await db.all(query, params);

      res.json({
        success: true,
        count: entries.length,
        entries,
      });
    });
  } catch (error) {
    console.error("Get entries error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get entries",
      error: error.message,
    });
  }
});

// POST /api/admin/timeclock/add-manual-entry - Create manual time entry
// Admins can add time for anyone. Employees add their own, which waits for approval
// with no hours on it, so nothing counts toward pay until a manager approves it
router.post("/admin/add-manual-entry", authenticateUser, async (req, res) => {
  try {
    const adminId = req.user.id;
    const {
      employeeId,
      employeeName,
      clockInTime,
      clockOutTime,
      breakMinutes,
      reason,
      notes,
      location,
    } = req.body;

    // Validate required fields
    if (!clockInTime || !clockOutTime) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    const times = checkEntryTimes(clockInTime, clockOutTime, breakMinutes);
    if (times.error) {
      return res.status(400).json({ success: false, message: times.error });
    }

    // The iOS employee screen sends employeeId 0 and no name, meaning "me"
    const targetId = isAdminUser(req.user) && Number(employeeId) ? Number(employeeId) : req.user.id;

    if (!isAdminUser(req.user) && Number(employeeId) && Number(employeeId) !== Number(req.user.id)) {
      reportBlockedAttempt(req, "Tried to add time for another employee");
      return res.status(403).json({
        success: false,
        message: "You can only add your own time",
      });
    }

    await oneAtATime(() => withDb(async (db) => {
      const employee = await db.get(`SELECT full_name FROM users WHERE id = ?`, [targetId]);
      const targetName = employee?.full_name || employeeName;

      if (!targetName) {
        return res.status(400).json({
          success: false,
          message: "Employee not found",
        });
      }

      const overlap = await findOverlap(db, targetId, times.clockIn, times.clockOut);
      if (overlap) {
        return res.status(400).json({ success: false, message: overlapMessage(overlap) });
      }

      // Calculate hours
      const pendingApproval = !isAdminUser(req.user);
      const totalHours = pendingApproval
        ? null
        : calculateHours(times.clockIn, times.clockOut, times.breakMinutes);

      // Insert manual entry
      const result = await db.run(
        `INSERT INTO time_clock_entries (
          employee_id, employee_name, clock_in_time, clock_out_time,
          total_hours, break_minutes,
          status, entry_method, manually_entered_by, manual_entry_reason,
          notes, location
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?, ?, ?)`,
        [
          targetId,
          targetName,
          times.clockIn,
          times.clockOut,
          totalHours,
          times.breakMinutes,
          pendingApproval ? "pending" : "completed",
          adminId,
          reason || (pendingApproval ? "Forgot to clock in/out" : "Added by a manager"),
          notes,
          location,
        ]
      );

      const entry = { id: result.lastID, employee_id: targetId, employee_name: targetName };
      const shift = shiftText(times.clockIn, times.clockOut, times.breakMinutes);

      if (pendingApproval) {
        await managers(db, entry, "added time", shift);
      } else {
        await recalcWeek(db, targetId, times.clockIn);
        await logEntryChange(
          db, entry.id, req.user, "manual_add", reason || "Added by a manager", {},
          { clockIn: times.clockIn, clockOut: times.clockOut, totalHours }
        );
        await tellEmployee(
          db, req, entry, `${await managerName(db, req.user)} added time for you`,
          `${shift}${reason ? `. Reason: ${reason}` : ""}`
        );
      }

      res.json({
        success: true,
        message: pendingApproval ? "Sent for approval" : "Manual entry created",
        entryId: result.lastID,
        pendingApproval,
        totalHours: pendingApproval ? null : totalHours.toFixed(2),
      });
    }));
  } catch (error) {
    console.error("Add manual entry error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create manual entry",
      error: error.message,
    });
  }
});

// PUT /api/admin/timeclock/edit-entry/:id - Edit time entry
// Admins can edit any entry. Employees can change their own, including approved
// ones, but the entry stays as it is until a manager approves the change
router.put("/admin/edit-entry/:id", authenticateUser, async (req, res) => {
  try {
    const entryId = req.params.id;
    const { clockInTime, clockOutTime, breakMinutes, reason, notes } = req.body;

    const times = checkEntryTimes(clockInTime, clockOutTime, breakMinutes);
    if (times.error) {
      return res.status(400).json({ success: false, message: times.error });
    }

    await oneAtATime(() => withDb(async (db) => {
      // Get original entry
      const original = await db.get(
        `SELECT * FROM time_clock_entries WHERE id = ? AND is_deleted = 0`,
        [entryId]
      );

      if (!original) {
        return res.status(404).json({
          success: false,
          message: "Entry not found",
        });
      }

      if (!canManageEntry(req.user, original)) {
        reportBlockedAttempt(req, `Tried to change ${original.employee_name}'s time`);
        return res.status(403).json({
          success: false,
          message: "You can only change your own time entries",
        });
      }

      // Only a shift still in progress may be saved without a clock out
      const stillClockedIn = original.status === "active" && !times.clockOut;
      if (!times.clockOut && !stillClockedIn) {
        return res.status(400).json({
          success: false,
          message: "Clock out time is required",
        });
      }

      const overlap = await findOverlap(db, original.employee_id, times.clockIn, times.clockOut, original.id);
      if (overlap) {
        return res.status(400).json({ success: false, message: overlapMessage(overlap) });
      }

      if (!isAdminUser(req.user)) {
        if (original.status === "pending") {
          await db.run(
            `UPDATE time_clock_entries
             SET clock_in_time = ?, clock_out_time = ?, break_minutes = ?, notes = ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [times.clockIn, times.clockOut, times.breakMinutes, notes, entryId]
          );
        } else {
          await db.run(
            `UPDATE time_clock_entries SET pending_changes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [JSON.stringify({ action: "edit", ...times, notes }), entryId]
          );
          await logEntryChange(db, entryId, req.user, "edit_request", reason || "Time correction");
          await managers(
            db, original, "changed an entry",
            `${shiftText(original.clock_in_time, original.clock_out_time, original.break_minutes)} to ${shiftText(times.clockIn, times.clockOut, times.breakMinutes)}`
          );
        }

        return res.json({ success: true, message: "Sent for approval", pendingApproval: true });
      }

      // Calculate new hours
      const totalHours = stillClockedIn
        ? null
        : calculateHours(times.clockIn, times.clockOut, times.breakMinutes);

      // Store original values if first edit
      const originalClockIn = original.original_clock_in || original.clock_in_time;
      const originalClockOut = original.original_clock_out || original.clock_out_time;

      // Update entry
      await db.run(
        `UPDATE time_clock_entries 
         SET clock_in_time = ?, clock_out_time = ?, total_hours = ?,
             regular_hours = NULL, overtime_hours = NULL, break_minutes = ?,
             original_clock_in = ?, original_clock_out = ?,
             modification_count = modification_count + 1,
             status = ?, entry_method = 'edited', notes = ?, pending_changes = NULL,
             edited_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          times.clockIn,
          times.clockOut,
          totalHours,
          times.breakMinutes,
          originalClockIn,
          originalClockOut,
          stillClockedIn ? "active" : "edited",
          notes,
          entryId,
        ]
      );

      await recalcWeek(db, original.employee_id, original.clock_in_time);
      await recalcWeek(db, original.employee_id, times.clockIn);

      // Log modification
      await logEntryChange(
        db, entryId, req.user, "edit", reason || "Time correction",
        { clockIn: original.clock_in_time, clockOut: original.clock_out_time, totalHours: original.total_hours },
        { clockIn: times.clockIn, clockOut: times.clockOut, totalHours }
      );

      await tellEmployee(
        db, req, original, `${await managerName(db, req.user)} changed your time`,
        `${shiftText(original.clock_in_time, original.clock_out_time, original.break_minutes)} is now ${shiftText(times.clockIn, times.clockOut, times.breakMinutes)}${reason ? `. Reason: ${reason}` : ""}`
      );

      res.json({
        success: true,
        message: "Entry updated",
        totalHours: stillClockedIn ? null : totalHours.toFixed(2),
      });
    }));
  } catch (error) {
    console.error("Edit entry error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to edit entry",
      error: error.message,
    });
  }
});

// GET /api/admin/timeclock/pending-entries - Employee entries and changes waiting on a manager
router.get("/admin/pending-entries", authenticateUser, isAdminOrSuperAdmin, async (req, res) => {
  try {
    await withDb(async (db) => {
      const rows = await db.all(
        `SELECT * FROM time_clock_entries
         WHERE is_deleted = 0 AND (status = 'pending' OR pending_changes IS NOT NULL)
         ORDER BY clock_in_time DESC`
      );

      const entries = rows.map((row) => {
        const changes = row.pending_changes ? JSON.parse(row.pending_changes) : null;
        return { ...row, pending_changes: changes, action: changes?.action || "new" };
      });

      res.json({ success: true, entries });
    });
  } catch (error) {
    console.error("Get pending entries error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get pending entries",
      error: error.message,
    });
  }
});

// POST /api/admin/timeclock/approve-entry/:id - Approve an entry and apply any waiting change
router.post("/admin/approve-entry/:id", authenticateUser, isAdminOrSuperAdmin, async (req, res) => {
  try {
    const entryId = req.params.id;

    await oneAtATime(() => withDb(async (db) => {
      const entry = await db.get(
        `SELECT * FROM time_clock_entries WHERE id = ? AND is_deleted = 0`,
        [entryId]
      );

      if (!entry) {
        return res.status(404).json({
          success: false,
          message: "Entry not found",
        });
      }

      const changes = entry.pending_changes ? JSON.parse(entry.pending_changes) : null;
      const before = {
        clockIn: entry.clock_in_time,
        clockOut: entry.clock_out_time,
        totalHours: entry.total_hours,
      };

      if (changes?.action === "delete") {
        await db.run(
          `UPDATE time_clock_entries
           SET is_deleted = 1, pending_changes = NULL, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [entryId]
        );
        await recalcWeek(db, entry.employee_id, entry.clock_in_time);
        await logEntryChange(db, entryId, req.user, "delete", "Approved employee's delete request", before);
        await tellEmployee(
          db, req, entry, "Your delete request was approved",
          shiftText(entry.clock_in_time, entry.clock_out_time, entry.break_minutes)
        );
        return res.json({ success: true, message: "Entry deleted" });
      }

      const clockIn = changes?.clockIn || entry.clock_in_time;
      const clockOut = changes?.clockOut || entry.clock_out_time;
      const breakMinutes = changes ? changes.breakMinutes : entry.break_minutes;

      const overlap = await findOverlap(db, entry.employee_id, clockIn, clockOut, entry.id);
      if (overlap) {
        return res.status(400).json({ success: false, message: overlapMessage(overlap) });
      }

      const totalHours = clockOut ? calculateHours(clockIn, clockOut, breakMinutes) : null;

      await db.run(
        `UPDATE time_clock_entries
         SET clock_in_time = ?, clock_out_time = ?, total_hours = ?, break_minutes = ?,
             original_clock_in = ?, original_clock_out = ?,
             modification_count = modification_count + ?,
             entry_method = ?, notes = ?, status = ?, pending_changes = NULL,
             edited_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          clockIn,
          clockOut,
          totalHours,
          breakMinutes,
          changes ? entry.original_clock_in || entry.clock_in_time : entry.original_clock_in,
          changes ? entry.original_clock_out || entry.clock_out_time : entry.original_clock_out,
          changes ? 1 : 0,
          changes ? "edited" : entry.entry_method,
          changes ? changes.notes : entry.notes,
          clockOut ? "approved" : "active",
          entryId,
        ]
      );

      await recalcWeek(db, entry.employee_id, entry.clock_in_time);
      await recalcWeek(db, entry.employee_id, clockIn);
      await logEntryChange(
        db, entryId, req.user, "approve", "Approved", before, { clockIn, clockOut, totalHours }
      );
      await tellEmployee(
        db, req, entry, "Your time was approved", shiftText(clockIn, clockOut, breakMinutes)
      );

      res.json({
        success: true,
        message: "Entry approved",
      });
    }));
  } catch (error) {
    console.error("Approve entry error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to approve entry",
      error: error.message,
    });
  }
});

// POST /api/admin/timeclock/reject-entry/:id - Turn down a waiting entry or change
router.post("/admin/reject-entry/:id", authenticateUser, isAdminOrSuperAdmin, async (req, res) => {
  try {
    const entryId = req.params.id;
    const reason = req.body?.reason || "Rejected";

    await withDb(async (db) => {
      const entry = await db.get(
        `SELECT * FROM time_clock_entries
         WHERE id = ? AND is_deleted = 0 AND (status = 'pending' OR pending_changes IS NOT NULL)`,
        [entryId]
      );

      if (!entry) {
        return res.status(404).json({
          success: false,
          message: "Nothing is waiting on this entry",
        });
      }

      await db.run(
        `UPDATE time_clock_entries
         SET is_deleted = ?, pending_changes = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [entry.status === "pending" ? 1 : 0, entryId]
      );
      await logEntryChange(db, entryId, req.user, "reject", reason);
      await tellEmployee(
        db, req, entry, "Your time was not approved",
        `${shiftText(entry.clock_in_time, entry.clock_out_time, entry.break_minutes)}${reason === "Rejected" ? "" : `. Reason: ${reason}`}`
      );

      res.json({ success: true, message: "Rejected" });
    });
  } catch (error) {
    console.error("Reject entry error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reject entry",
      error: error.message,
    });
  }
});

// DELETE /api/admin/timeclock/delete-entry/:id - Soft delete entry
// Admins can delete any entry. An employee's delete waits for approval, unless the
// entry was never approved in the first place
router.delete("/admin/delete-entry/:id", authenticateUser, async (req, res) => {
  try {
    const entryId = req.params.id;
    // Accept `reason` from the request body or as a query parameter. Some
    // clients (notably certain mobile/axios configurations) may not include a
    // body for DELETE requests, which would make `req.body` undefined and
    // cause a server error when destructuring. Use a safe fallback.
    const { reason: bodyReason } = req.body || {};
    const reason = bodyReason || req.query?.reason || 'Deleted by admin';

    await withDb(async (db) => {
      const entry = await db.get(
        `SELECT * FROM time_clock_entries WHERE id = ? AND is_deleted = 0`,
        [entryId]
      );

      if (!entry) {
        return res.status(404).json({
          success: false,
          message: "Entry not found",
        });
      }

      if (!canManageEntry(req.user, entry)) {
        reportBlockedAttempt(req, `Tried to delete ${entry.employee_name}'s time`);
        return res.status(403).json({
          success: false,
          message: "You can only change your own time entries",
        });
      }

      if (!isAdminUser(req.user) && entry.status !== "pending") {
        await db.run(
          `UPDATE time_clock_entries SET pending_changes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [JSON.stringify({ action: "delete" }), entryId]
        );
        await logEntryChange(db, entryId, req.user, "delete_request", reason);
        await managers(
          db, entry, "wants to delete an entry",
          shiftText(entry.clock_in_time, entry.clock_out_time, entry.break_minutes)
        );
        return res.json({ success: true, message: "Sent for approval", pendingApproval: true });
      }

      await db.run(
        `UPDATE time_clock_entries 
         SET is_deleted = 1, pending_changes = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [entryId]
      );

      await recalcWeek(db, entry.employee_id, entry.clock_in_time);

      // Log deletion
      await logEntryChange(db, entryId, req.user, "delete", reason);
      await tellEmployee(
        db, req, entry, `${await managerName(db, req.user)} removed your time`,
        `${shiftText(entry.clock_in_time, entry.clock_out_time, entry.break_minutes)}. Reason: ${reason}`
      );

      res.json({
        success: true,
        message: "Entry deleted",
      });
    });
  } catch (error) {
    console.error("Delete entry error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete entry",
      error: error.message,
    });
  }
});

// GET /api/admin/timeclock/entries/month - Get calendar month data
router.get("/admin/entries/month", authenticateUser, isAdminOrSuperAdmin, async (req, res) => {
  try {
    const { employeeId, year, month } = req.query;

    if (!employeeId || !year || !month) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameters",
      });
    }

    await withDb(async (db) => {
      const startDate = moment(`${year}-${month}-01`).startOf("month").format("YYYY-MM-DD");
      const endDate = moment(`${year}-${month}-01`).endOf("month").format("YYYY-MM-DD");

      const entries = await db.all(
        `SELECT date(clock_in_time) as date, 
                SUM(total_hours) as total_hours,
                COUNT(*) as shift_count,
                GROUP_CONCAT(id) as entry_ids
         FROM time_clock_entries 
         WHERE employee_id = ? AND is_deleted = 0
         AND date(clock_in_time) BETWEEN date(?) AND date(?)
         GROUP BY date(clock_in_time)
         ORDER BY date(clock_in_time)`,
        [employeeId, startDate, endDate]
      );

      res.json({
        success: true,
        month: `${year}-${month}`,
        entries,
      });
    });
  } catch (error) {
    console.error("Get month entries error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get month entries",
      error: error.message,
    });
  }
});

// GET /api/timeclock/admin/entry-audit/:id - Get audit log for an entry
router.get("/admin/entry-audit/:id", authenticateUser, async (req, res) => {
  try {
    const entryId = req.params.id;

    await withDb(async (db) => {
      const entry = await db.get(
        `SELECT employee_id, employee_name FROM time_clock_entries WHERE id = ?`,
        [entryId]
      );

      if (entry && !canManageEntry(req.user, entry)) {
        reportBlockedAttempt(req, `Tried to read ${entry.employee_name}'s time history`);
        return res.status(403).json({
          success: false,
          message: "You can only view your own time entries",
        });
      }

      const modifications = await db.all(
        `SELECT * FROM time_entry_modifications 
         WHERE time_entry_id = ? 
         ORDER BY created_at DESC`,
        [entryId]
      );

      res.json({
        success: true,
        modifications: modifications || [],
      });
    });
  } catch (error) {
    console.error("Get audit log error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get audit log",
      error: error.message,
    });
  }
});

// ==================== PAYROLL INFO ENDPOINTS ====================

// GET /api/timeclock/my-payroll-info - Get current user's payroll info (employee endpoint)
router.get("/my-payroll-info", authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;

    await withDb(async (db) => {
      const payrollInfo = await db.get(
        `SELECT * FROM employee_payroll_info WHERE employee_id = ? AND is_active = 1`,
        [userId]
      );

      res.json({
        success: true,
        payrollInfo: payrollInfo || null,
      });
    });
  } catch (error) {
    console.error("Get my payroll info error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get payroll info",
      error: error.message,
    });
  }
});

// GET /api/admin/timeclock/payroll-info/:employeeId - Get employee payroll info (admin endpoint)
router.get("/admin/payroll-info/:employeeId", authenticateUser, isAdminOrSuperAdmin, async (req, res) => {
  try {
    const employeeId = req.params.employeeId;

    await withDb(async (db) => {
      const payrollInfo = await db.get(
        `SELECT * FROM employee_payroll_info WHERE employee_id = ? AND is_active = 1`,
        [employeeId]
      );

      res.json({
        success: true,
        payrollInfo: payrollInfo || null,
      });
    });
  } catch (error) {
    console.error("Get payroll info error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get payroll info",
      error: error.message,
    });
  }
});

// POST /api/admin/timeclock/payroll-info - Create or update employee payroll info
router.post("/admin/payroll-info", authenticateUser, isAdminOrSuperAdmin, async (req, res) => {
  try {
    const {
      employeeId,
      employmentType,
      hourlyRate,
      overtimeRate,
      salary,
      payPeriodType,
    } = req.body;

    // Validate required fields
    if (!employeeId || !employmentType) {
      return res.status(400).json({
        success: false,
        message: "Employee ID and employment type are required",
      });
    }

    // Validate employment type
    if (!["hourly", "salary"].includes(employmentType)) {
      return res.status(400).json({
        success: false,
        message: "Employment type must be 'hourly' or 'salary'",
      });
    }

    // Validate hourly rates
    if (employmentType === "hourly") {
      if (!hourlyRate || hourlyRate <= 0) {
        return res.status(400).json({
          success: false,
          message: "Valid hourly rate is required for hourly employees",
        });
      }
    }

    await withDb(async (db) => {
      // Check if payroll info already exists
      const existing = await db.get(
        `SELECT * FROM employee_payroll_info WHERE employee_id = ?`,
        [employeeId]
      );

      if (existing) {
        // Update existing record
        await db.run(
          `UPDATE employee_payroll_info 
           SET employment_type = ?, hourly_rate = ?, overtime_rate = ?, 
               salary = ?, pay_period_type = ?, is_active = 1,
               updated_at = CURRENT_TIMESTAMP
           WHERE employee_id = ?`,
          [
            employmentType,
            hourlyRate || null,
            overtimeRate || null,
            salary || null,
            payPeriodType || "biweekly",
            employeeId,
          ]
        );
      } else {
        // Insert new record
        await db.run(
          `INSERT INTO employee_payroll_info (
            employee_id, employment_type, hourly_rate, overtime_rate,
            salary, pay_period_type, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, 1)`,
          [
            employeeId,
            employmentType,
            hourlyRate || null,
            overtimeRate || null,
            salary || null,
            payPeriodType || "biweekly",
          ]
        );
      }

      res.json({
        success: true,
        message: "Payroll info saved successfully",
      });
    });
  } catch (error) {
    console.error("Save payroll info error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save payroll info",
      error: error.message,
    });
  }
});

// DELETE /api/admin/timeclock/payroll-info/:employeeId - Deactivate payroll info
router.delete("/admin/payroll-info/:employeeId", authenticateUser, isAdminOrSuperAdmin, async (req, res) => {
  try {
    const employeeId = req.params.employeeId;

    await withDb(async (db) => {
      await db.run(
        `UPDATE employee_payroll_info 
         SET is_active = 0, updated_at = CURRENT_TIMESTAMP
         WHERE employee_id = ?`,
        [employeeId]
      );

      res.json({
        success: true,
        message: "Payroll info deactivated",
      });
    });
  } catch (error) {
    console.error("Delete payroll info error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to deactivate payroll info",
      error: error.message,
    });
  }
});

module.exports = router;


