const moment = require("moment-timezone");

// Overtime is anything past 40 hours in a Sunday-Saturday workweek
const WEEKLY_REGULAR_HOURS = 40;

function workweek(time) {
  const start = moment(time).day(0).startOf("day");
  return {
    start: start.format("YYYY-MM-DD HH:mm:ss"),
    end: start.clone().add(7, "days").format("YYYY-MM-DD HH:mm:ss"),
  };
}

// Earliest shifts use up the regular hours first; expects entries in time order
function splitWeek(entries) {
  let remaining = WEEKLY_REGULAR_HOURS;
  return entries.map((entry) => {
    const regularHours = Math.min(entry.total_hours, Math.max(remaining, 0));
    remaining -= regularHours;
    return {
      id: entry.id,
      regularHours,
      overtimeHours: entry.total_hours - regularHours,
    };
  });
}

// Re-splits the workweek containing the given time for one employee
async function recalcWeek(db, employeeId, time) {
  const { start, end } = workweek(time);
  const entries = await db.all(
    `SELECT id, total_hours FROM time_clock_entries
     WHERE employee_id = ? AND is_deleted = 0 AND total_hours IS NOT NULL
     AND datetime(clock_in_time) >= datetime(?) AND datetime(clock_in_time) < datetime(?)
     ORDER BY datetime(clock_in_time)`,
    [employeeId, start, end]
  );

  for (const { id, regularHours, overtimeHours } of splitWeek(entries)) {
    await db.run(
      `UPDATE time_clock_entries SET regular_hours = ?, overtime_hours = ? WHERE id = ?`,
      [regularHours, overtimeHours, id]
    );
  }
}

// Re-splits every week on record; total_hours is left as it was
async function recalcAllWeeks(db) {
  const entries = await db.all(
    `SELECT employee_id, clock_in_time FROM time_clock_entries
     WHERE is_deleted = 0 AND total_hours IS NOT NULL`
  );

  const weeks = new Map();
  for (const entry of entries) {
    weeks.set(`${entry.employee_id}|${workweek(entry.clock_in_time).start}`, entry);
  }

  for (const entry of weeks.values()) {
    await recalcWeek(db, entry.employee_id, entry.clock_in_time);
  }
}

module.exports = { workweek, splitWeek, recalcWeek, recalcAllWeeks };
