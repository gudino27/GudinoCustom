import React from 'react';
import { Plus, FileEdit, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatTimePST, formatDatePST } from '../utils/timezoneUtils';

const CalendarView = ({
  currentMonth,
  onChangeMonth,
  days,
  onSelectDate,
  selectedDate,
  onEditEntry,
  calendarView,
  onViewChange,
  onGoToToday,
  openManualEntryForDate,
  t,
}) => {
  const monthNames = [
    t("timeclock.month_january"),
    t("timeclock.month_february"),
    t("timeclock.month_march"),
    t("timeclock.month_april"),
    t("timeclock.month_may"),
    t("timeclock.month_june"),
    t("timeclock.month_july"),
    t("timeclock.month_august"),
    t("timeclock.month_september"),
    t("timeclock.month_october"),
    t("timeclock.month_november"),
    t("timeclock.month_december"),
  ];

  const dayNames = [
    t("timeclock.day_sun"),
    t("timeclock.day_mon"),
    t("timeclock.day_tue"),
    t("timeclock.day_wed"),
    t("timeclock.day_thu"),
    t("timeclock.day_fri"),
    t("timeclock.day_sat"),
  ];

  const dayNamesShort = [
    t("timeclock.day_sun_short"),
    t("timeclock.day_mon_short"),
    t("timeclock.day_tue_short"),
    t("timeclock.day_wed_short"),
    t("timeclock.day_thu_short"),
    t("timeclock.day_fri_short"),
    t("timeclock.day_sat_short"),
  ];

  const monthSummary = days
    .filter((d) => d && d.hasEntries)
    .reduce(
      (acc, day) => ({
        totalHours: acc.totalHours + parseFloat(day.totalHours || 0),
        daysWorked: acc.daysWorked + 1,
      }),
      { totalHours: 0, daysWorked: 0 }
    );

  return (
    <div className="calendar-view">
      <div className="calendar-header">
        <button className="btn-nav" onClick={() => onChangeMonth(-1)}>
          <ChevronLeft size={16} style={{ verticalAlign: "-3px" }} /> {calendarView === "month" ? t("timeclock.previous") : t("timeclock.prev_week")}
        </button>
        <h3>
          {calendarView === "month"
            ? `${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`
            : `Week of ${monthNames[currentMonth.getMonth()]} ${currentMonth.getDate()}, ${currentMonth.getFullYear()}`}
        </h3>
        <button className="btn-nav" onClick={() => onChangeMonth(1)}>
          {calendarView === "month" ? t("timeclock.next") : t("timeclock.next_week")} <ChevronRight size={16} style={{ verticalAlign: "-3px" }} />
        </button>
      </div>

      <div className="calendar-controls">
        <div className="view-toggle-group">
          <button
            className={`btn-view-toggle ${calendarView === "week" ? "active" : ""}`}
            onClick={() => onViewChange("week")}
          >
            {t("timeclock.week_view")}
          </button>
          <button
            className={`btn-view-toggle ${calendarView === "month" ? "active" : ""}`}
            onClick={() => onViewChange("month")}
          >
            {t("timeclock.month_view")}
          </button>
        </div>
        <button className="btn-today" onClick={onGoToToday}>
          <Calendar size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />
          {t("timeclock.today_button")}
        </button>
      </div>

      <div className="calendar-summary">
        <div className="summary-item">
          <span className="summary-label">
            {calendarView === "month" ? t("timeclock.days_worked") : t("timeclock.this_week")}:
          </span>
          <span className="summary-value">{monthSummary.daysWorked}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">{t("timeclock.total_hours")}:</span>
          <span className="summary-value">{monthSummary.totalHours.toFixed(2)}</span>
        </div>
      </div>

      <div className="calendar-grid">
        {dayNamesShort.map((day, index) => (
          <div key={day} className="calendar-day-name" title={dayNames[index]}>
            <span className="day-name-short">{day}</span>
          </div>
        ))}

        {days.map((day, index) => (
          <div
            key={index}
            className={`calendar-day ${!day ? "empty" : ""} ${day?.isToday ? "today" : ""} ${
              day?.hasEntries ? "has-entries" : ""
            } ${selectedDate === day?.date ? "selected" : ""}`}
            onClick={() => day && onSelectDate(day.date)}
          >
            {day && (
              <>
                <div className="day-number">{day.day}</div>
                {day.hasEntries && (
                  <div className="day-hours">
                    {parseFloat(day.totalHours).toFixed(4)}h
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {selectedDate && (
        <div className="date-details">
          <h4>{formatDatePST(selectedDate)}</h4>
          {(() => {
            const dayData = days.find((d) => d && d.date === selectedDate);

            if (!dayData || !dayData.hasEntries) {
              return (
                <>
                  <p className="no-entries">{t("timeclock.no_time_entries")}</p>
                  <button
                    className="btn-secondary"
                    onClick={() => openManualEntryForDate(selectedDate)}
                    style={{
                      marginTop: "1rem",
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <FileEdit size={16} />
                    {t("timeclock.add_time_entry_for_day")}
                  </button>
                </>
              );
            }
            return (
              <>
                <div className="entries-list">
                  {dayData.entries.map((entry, idx) => (
                    <div
                      key={idx}
                      className="entry-item"
                      onClick={() => onEditEntry(entry)}
                      title="Click to edit or delete this entry"
                    >
                      <div className="entry-time">
                        {formatTimePST(entry.clock_in_time)}
                        {" - "}
                        {entry.clock_out_time
                          ? formatTimePST(entry.clock_out_time)
                          : "In Progress"}
                      </div>
                      <div className="entry-hours-badge">
                        {entry.total_hours ? `${entry.total_hours.toFixed(2)} hrs` : "-"}
                      </div>
                      {entry.break_minutes > 0 && (
                        <div className="entry-break">Break: {entry.break_minutes} min</div>
                      )}
                      {(entry.status === "pending" || entry.pending_changes) && (
                        <div className="entry-break">{t("timeclock.waiting_for_approval")}</div>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  className="btn-secondary"
                  onClick={() => openManualEntryForDate(selectedDate)}
                  style={{
                    marginTop: "1rem",
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                    fontSize: "0.875rem",
                  }}
                >
                  <Plus size={16} />
                  {t("timeclock.add_another_entry_for_day")}
                </button>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default CalendarView;
