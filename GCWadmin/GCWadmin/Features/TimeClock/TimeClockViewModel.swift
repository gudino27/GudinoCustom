//
//  TimeClockViewModel.swift
//  GCWadmin
//
//  ViewModel for Employee TimeClock features
//

import SwiftUI
import Combine

@MainActor
class TimeClockViewModel: ObservableObject {
    // MARK: - Published Properties

    // Status
    @Published var status: TimeClockStatus?
    @Published var isLoading = false
    @Published var errorMessage: String?

    // Hours Summary
    @Published var hoursSummary: HoursSummary?
    @Published var payPeriod: PayPeriod?

    // Payroll
    @Published var payrollInfo: PayrollInfo?
    @Published var taxRate: Double = 0

    // Entries
    @Published var currentMonthEntries: [TimeEntry] = []
    @Published var selectedDateEntries: [TimeEntry] = []

    // Calendar
    @Published var selectedMonth = Date()
    @Published var calendarDays: [Date?] = []
    @Published var calendarViewType: CalendarViewType = .month

    // UI State
    @Published var showManualEntry = false
    @Published var showTaxCalculator = false
    @Published var showCalendar = false
    @Published var showDateEntries = false
    @Published var actionInProgress = false

    // Calendar View Type
    enum CalendarViewType {
        case month
        case week
    }

    // Manual Entry Form
    var manualEntryForm = ManualEntryFormData()

    // MARK: - Private Properties

    private let service = TimeClockService.shared
    private var refreshTimer: Timer?

    // MARK: - Initialization

    init() {
        Task {
            await loadInitialData()
            startAutoRefresh()
        }
    }

    deinit {
        refreshTimer?.invalidate()
    }

    // MARK: - Data Loading

    func loadInitialData() async {
        isLoading = true
        errorMessage = nil

        await withTaskGroup(of: Void.self) { group in
            group.addTask { await self.fetchStatus() }
            group.addTask { await self.fetchPayPeriod() }
            group.addTask { await self.fetchPayrollInfo() }
            group.addTask { await self.fetchHoursSummary() }
        }

        isLoading = false
    }

    func refresh() async {
        await loadInitialData()
    }

    // MARK: - Status

    func fetchStatus() async {
        do {
            status = try await service.getCurrentStatus()
            print("✅ Fetched clock status")
        } catch {
            print("❌ Error fetching status: \(error)")
            errorMessage = "Failed to load clock status"
        }
    }

    func fetchHoursSummary() async {
        do {
            hoursSummary = try await service.calculateWeeklyHours()
            print("✅ Calculated hours summary: This Week: \(hoursSummary?.thisWeek ?? 0), Last Week: \(hoursSummary?.lastWeek ?? 0)")
        } catch {
            print("❌ Error calculating hours summary: \(error)")
        }
    }

    func fetchPayPeriod() async {
        do {
            payPeriod = try await service.getCurrentPeriod()
            print("✅ Fetched pay period")
        } catch {
            print("❌ Error fetching pay period: \(error)")
        }
    }

    func fetchPayrollInfo() async {
        do {
            payrollInfo = try await service.getMyPayrollInfo()

            // Extract tax rate from payroll info if available
            if let savedTaxRate = payrollInfo?.saveTaxRate {
                taxRate = savedTaxRate
                print("✅ Fetched payroll info with tax rate: \(savedTaxRate)%")
            } else {
                print("✅ Fetched payroll info (no tax rate set)")
            }
        } catch {
            print("❌ Error fetching payroll info: \(error)")
        }
    }

    func fetchTaxRate() async {
        do {
            if let rate = try await service.getMyTaxRate() {
                taxRate = rate.taxRate
                print("✅ Fetched tax rate: \(rate.taxRate)%")
            }
        } catch {
            print("❌ Error fetching tax rate: \(error)")
        }
    }

    // MARK: - Clock Actions

    func clockIn() async {
        guard !actionInProgress else { return }

        actionInProgress = true
        errorMessage = nil

        do {
            let response = try await service.clockIn()
            print("✅ Clocked in: \(response.message)")

            // Update status
            if let newStatus = response.status {
                status = newStatus
            } else {
                await fetchStatus()
            }

            // Show success message
            errorMessage = nil

        } catch {
            print("❌ Clock in failed: \(error)")
            errorMessage = "Failed to clock in. Please try again."
        }

        actionInProgress = false
    }

    func clockOut() async {
        guard !actionInProgress else { return }

        actionInProgress = true
        errorMessage = nil

        do {
            let response = try await service.clockOut()
            print("✅ Clocked out: \(response.message)")

            // Update status
            if let newStatus = response.status {
                status = newStatus
            } else {
                await fetchStatus()
            }

            // Refresh pay period
            await fetchPayPeriod()

        } catch {
            print("❌ Clock out failed: \(error)")
            errorMessage = "Failed to clock out. Please try again."
        }

        actionInProgress = false
    }

    func startBreak() async {
        guard !actionInProgress else { return }

        actionInProgress = true
        errorMessage = nil

        do {
            let response = try await service.startBreak()
            print("✅ Started break: \(response.message)")

            // Update status
            if let newStatus = response.status {
                status = newStatus
            } else {
                await fetchStatus()
            }

        } catch {
            print("❌ Start break failed: \(error)")
            errorMessage = "Failed to start break. Please try again."
        }

        actionInProgress = false
    }

    func endBreak() async {
        guard !actionInProgress else { return }

        actionInProgress = true
        errorMessage = nil

        do {
            let response = try await service.endBreak()
            print("✅ Ended break: \(response.message)")

            // Update status
            if let newStatus = response.status {
                status = newStatus
            } else {
                await fetchStatus()
            }

        } catch {
            print("❌ End break failed: \(error)")
            errorMessage = "Failed to end break. Please try again."
        }

        actionInProgress = false
    }

    // MARK: - Payroll Calculations

    func calculatePayPeriodEarnings() -> Double? {
        guard let payrollInfo = payrollInfo,
              let hours = payPeriod?.hours else {
            return nil
        }

        return service.calculatePayPeriodEarnings(payrollInfo: payrollInfo, hours: hours)
    }

    func calculateNetPay(grossPay: Double) -> Double {
        return service.calculateNetPay(grossPay: grossPay, taxRate: taxRate)
    }

    func saveTaxRate(_ newRate: Double) async {
        do {
            try await service.saveTaxRate(taxRate: newRate)
            taxRate = newRate
            print("✅ Tax rate saved: \(newRate)%")
        } catch {
            print("❌ Failed to save tax rate: \(error)")
            errorMessage = "Failed to save tax rate"
        }
    }

    // MARK: - Manual Entry

    func submitManualEntry() async {
        guard manualEntryForm.isValid else {
            errorMessage = "Please fill in all required fields"
            return
        }

        actionInProgress = true
        errorMessage = nil

        do {
            let request = ManualEntryRequest(
                userId: 0, // Will be set from auth context in service
                date: manualEntryForm.date,
                timeIn: manualEntryForm.timeIn,
                timeOut: manualEntryForm.timeOut,
                breakMinutes: manualEntryForm.breakMinutes,
                notes: manualEntryForm.notes.isEmpty ? "[Manual Entry] Employee added missed time" : manualEntryForm.notes
            )

            try await service.addManualEntry(request: request)
            print("✅ Manual entry added")

            // Refresh status and calendar
            await fetchStatus()
            await loadCalendarEntries()

            // Reset form
            manualEntryForm.reset()

        } catch {
            print("❌ Failed to add manual entry: \(error)")
            errorMessage = "Failed to add manual entry. Please try again."
        }

        actionInProgress = false
    }

    func deleteEntry(entryId: Int) async {
        actionInProgress = true
        errorMessage = nil

        do {
            try await service.deleteEntry(entryId: entryId)
            print("✅ Entry deleted")

            // Refresh calendar and selected date entries
            await loadCalendarEntries()

            // Update selected date entries if they're being viewed
            if !selectedDateEntries.isEmpty {
                selectedDateEntries.removeAll { $0.id == entryId }
            }

        } catch {
            print("❌ Failed to delete entry: \(error)")
            errorMessage = "Failed to delete entry. Please try again."
        }

        actionInProgress = false
    }

    // MARK: - Calendar

    func fetchEntriesForMonth(year: Int, month: Int) async {
        let startDate = String(format: "%04d-%02d-01", year, month)
        let endDate = String(format: "%04d-%02d-31", year, month)

        do {
            currentMonthEntries = try await service.getMyEntries(startDate: startDate, endDate: endDate)
            print("✅ Fetched \(currentMonthEntries.count) entries for \(year)-\(month)")
        } catch {
            print("❌ Error fetching month entries: \(error)")
            errorMessage = "Failed to load calendar entries"
        }
    }

    func getEntriesForDate(_ date: String) -> [TimeEntry] {
        return currentMonthEntries.filter { $0.displayDate == date }
    }

    // MARK: - Calendar Navigation

    var selectedMonthString: String {
        let formatter = DateFormatter()

        switch calendarViewType {
        case .month:
            formatter.dateFormat = "MMMM yyyy"
            return formatter.string(from: selectedMonth)
        case .week:
            formatter.dateFormat = "MMMM d, yyyy"
            return "Week of \(formatter.string(from: selectedMonth))"
        }
    }

    func previousMonth() {
        let calendar = Calendar.current
        let component: Calendar.Component = calendarViewType == .week ? .day : .month
        let value = calendarViewType == .week ? -7 : -1

        guard let newDate = calendar.date(byAdding: component, value: value, to: selectedMonth) else {
            return
        }
        selectedMonth = newDate
        updateCalendarDays()
        Task {
            await loadCalendarEntries()
        }
    }

    func nextMonth() {
        let calendar = Calendar.current
        let component: Calendar.Component = calendarViewType == .week ? .day : .month
        let value = calendarViewType == .week ? 7 : 1

        guard let newDate = calendar.date(byAdding: component, value: value, to: selectedMonth) else {
            return
        }
        selectedMonth = newDate
        updateCalendarDays()
        Task {
            await loadCalendarEntries()
        }
    }

    func goToToday() {
        selectedMonth = Date()
        updateCalendarDays()
        Task {
            await loadCalendarEntries()
        }
    }

    func loadCalendarEntries() async {
        let year = Calendar.current.component(.year, from: selectedMonth)
        let month = Calendar.current.component(.month, from: selectedMonth)
        await fetchEntriesForMonth(year: year, month: month)
        updateCalendarDays()
    }

    func updateCalendarDays() {
        switch calendarViewType {
        case .month:
            updateMonthCalendarDays()
        case .week:
            updateWeekCalendarDays()
        }
    }

    private func updateMonthCalendarDays() {
        let calendar = Calendar.current
        let year = calendar.component(.year, from: selectedMonth)
        let month = calendar.component(.month, from: selectedMonth)

        // Get first day of month
        guard let firstDayOfMonth = calendar.date(from: DateComponents(year: year, month: month, day: 1)) else {
            calendarDays = []
            return
        }

        // Get weekday of first day (0 = Sunday, 6 = Saturday)
        let firstWeekday = calendar.component(.weekday, from: firstDayOfMonth) - 1

        // Get number of days in month
        guard let range = calendar.range(of: .day, in: .month, for: firstDayOfMonth) else {
            calendarDays = []
            return
        }
        let numberOfDays = range.count

        // Build calendar array
        var days: [Date?] = []

        // Add empty cells for days before month starts
        for _ in 0..<firstWeekday {
            days.append(nil)
        }

        // Add all days in month
        for day in 1...numberOfDays {
            if let date = calendar.date(from: DateComponents(year: year, month: month, day: day)) {
                days.append(date)
            }
        }

        calendarDays = days
    }

    private func updateWeekCalendarDays() {
        let calendar = Calendar.current

        // Get the start of the week (Sunday)
        let weekday = calendar.component(.weekday, from: selectedMonth) - 1
        guard let startOfWeek = calendar.date(byAdding: .day, value: -weekday, to: selectedMonth) else {
            calendarDays = []
            return
        }

        // Generate 7 days starting from Sunday
        var days: [Date?] = []
        for i in 0..<7 {
            if let date = calendar.date(byAdding: .day, value: i, to: startOfWeek) {
                days.append(date)
            }
        }

        calendarDays = days
    }

    func hasEntry(for date: Date) -> Bool {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let dateString = formatter.string(from: date)

        return currentMonthEntries.contains { entry in
            entry.clockInTime.starts(with: dateString)
        }
    }

    func showEntriesForDate(_ date: Date) {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let dateString = formatter.string(from: date)

        selectedDateEntries = currentMonthEntries.filter { entry in
            entry.clockInTime.starts(with: dateString)
        }

        showDateEntries = true
    }

    // MARK: - Auto Refresh

    private func startAutoRefresh() {
        // Refresh status every 30 seconds
        refreshTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.fetchStatus()
            }
        }
    }

    // MARK: - Helpers

    func clearError() {
        errorMessage = nil
    }
}

// MARK: - Manual Entry Form Data

struct ManualEntryFormData {
    var date: String = ""
    var timeIn: String = ""
    var timeOut: String = ""
    var breakMinutes: Int = 0
    var notes: String = ""

    var isValid: Bool {
        !date.isEmpty && !timeIn.isEmpty && !timeOut.isEmpty
    }

    mutating func reset() {
        date = getCurrentDate()
        timeIn = ""
        timeOut = ""
        breakMinutes = 0
        notes = ""
    }

    private func getCurrentDate() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }
}
