//
//  TimeClockAdminViewModel.swift
//  GCWadmin
//
//  ViewModel for Admin TimeClock features
//

import SwiftUI
import Combine

@MainActor
class TimeClockAdminViewModel: ObservableObject {
    // MARK: - Published Properties

    // Live Status
    @Published var liveEmployees: [LiveEmployeeStatus] = []
    @Published var isLoadingLive = false

    // Manual Entry Form
    @Published var manualEntryForm = ManualEntryForm()
    @Published var showManualEntry = false

    // Edit Entry
    @Published var editingEntry: TimeEntry?
    @Published var editForm = EditEntryForm()
    @Published var showEditEntry = false

    // Audit Log
    @Published var auditLogs: [EntryAuditLog] = []
    @Published var showAuditLog = false

    // Employee Selection
    @Published var selectedEmployee: LiveEmployeeStatus?
    @Published var employeeEntries: [TimeEntry] = []

    // Manual Entries Log (notifications)
    @Published var recentManualEntries: [TimeEntry] = []
    @Published var showManualEntriesLog = true

    // Hours Report
    @Published var showHoursReport = false
    @Published var reportStartDate = ""
    @Published var reportEndDate = ""
    @Published var hoursReportData: [EmployeeHoursReport] = []

    // Employee Audit
    @Published var showEmployeeAudit = false
    @Published var auditEmployeeEntries: [TimeEntry] = []

    // Payroll Management
    @Published var showPayrollSection = false
    @Published var allEmployees: [User] = []
    @Published var employeePayrollInfo: [Int: PayrollInfo] = [:]
    @Published var showPayrollModal = false
    @Published var payrollModalEmployee: User?

    // UI State
    @Published var errorMessage: String?
    @Published var successMessage: String?
    @Published var actionInProgress = false

    // MARK: - Private Properties

    private let service = TimeClockService.shared
    private let usersService = UsersService.shared
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

    // MARK: - Initial Data Load

    func loadInitialData() async {
        await withTaskGroup(of: Void.self) { group in
            group.addTask { await self.fetchLiveStatus() }
            group.addTask { await self.fetchAllEmployees() }
            group.addTask { await self.fetchRecentManualEntries() }
        }
    }

    // MARK: - Live Status

    func fetchLiveStatus() async {
        isLoadingLive = true

        do {
            liveEmployees = try await service.getLiveStatus()
            print("✅ Fetched live status for \(liveEmployees.count) employees")
        } catch {
            print("❌ Error fetching live status: \(error)")
            errorMessage = "Failed to load employee status"
        }

        isLoadingLive = false
    }

    func refresh() async {
        await fetchLiveStatus()
    }

    var clockedInEmployees: [LiveEmployeeStatus] {
        liveEmployees.filter { $0.isClockedIn }
    }

    var employeesOnBreak: [LiveEmployeeStatus] {
        liveEmployees.filter { $0.isOnBreak }
    }

    // MARK: - Manual Entry

    func openManualEntry(for employee: LiveEmployeeStatus? = nil) {
        if let employee = employee {
            manualEntryForm.userId = employee.id
            manualEntryForm.employeeName = employee.displayName
        }
        manualEntryForm.reset()
        showManualEntry = true
    }

    func submitManualEntry() async {
        guard manualEntryForm.isValid else {
            errorMessage = "Please fill in all required fields"
            return
        }

        actionInProgress = true
        errorMessage = nil

        do {
            let request = ManualEntryRequest(
                userId: manualEntryForm.userId,
                date: manualEntryForm.date,
                timeIn: manualEntryForm.timeIn,
                timeOut: manualEntryForm.timeOut,
                breakMinutes: manualEntryForm.breakMinutes,
                notes: manualEntryForm.notes.isEmpty ? nil : manualEntryForm.notes
            )

            try await service.addManualEntry(request: request)
            print("✅ Manual entry added")

            successMessage = "Manual entry added successfully"
            showManualEntry = false
            manualEntryForm.reset()

            await fetchLiveStatus()

        } catch {
            print("❌ Failed to add manual entry: \(error)")
            errorMessage = "Failed to add manual entry. Please try again."
        }

        actionInProgress = false
    }

    // MARK: - Edit Entry

    func openEditEntry(_ entry: TimeEntry) {
        editingEntry = entry
        editForm.populate(from: entry)
        showEditEntry = true
    }

    func submitEdit() async {
        guard let entry = editingEntry, editForm.isValid else {
            errorMessage = "Invalid entry data"
            return
        }

        actionInProgress = true
        errorMessage = nil

        do {
            let request = EditEntryRequest(
                clockInTime: editForm.clockInTime,
                clockOutTime: editForm.clockOutTime.isEmpty ? nil : editForm.clockOutTime,
                breakMinutes: editForm.breakMinutes,
                notes: editForm.notes.isEmpty ? nil : editForm.notes
            )

            try await service.editEntry(entryId: entry.id, request: request)
            print("✅ Entry edited")

            successMessage = "Entry updated successfully"
            showEditEntry = false
            editingEntry = nil

            await fetchLiveStatus()

        } catch {
            print("❌ Failed to edit entry: \(error)")
            errorMessage = "Failed to update entry. Please try again."
        }

        actionInProgress = false
    }

    func deleteEntry(_ entry: TimeEntry) async {
        actionInProgress = true
        errorMessage = nil

        do {
            try await service.deleteEntry(entryId: entry.id)
            print("✅ Entry deleted")

            successMessage = "Entry deleted successfully"
            showEditEntry = false
            editingEntry = nil

            await fetchLiveStatus()

        } catch {
            print("❌ Failed to delete entry: \(error)")
            errorMessage = "Failed to delete entry. Please try again."
        }

        actionInProgress = false
    }

    // MARK: - Audit Log

    func fetchAuditLog(for entry: TimeEntry) async {
        do {
            auditLogs = try await service.getEntryAuditLog(entryId: entry.id)
            showAuditLog = true
            print("✅ Fetched \(auditLogs.count) audit logs")
        } catch {
            print("❌ Failed to fetch audit log: \(error)")
            errorMessage = "Failed to load audit history"
        }
    }

    // MARK: - Employee Entries

    func fetchEmployeeEntries(employeeId: Int, year: Int, month: Int) async {
        let startDate = String(format: "%04d-%02d-01", year, month)
        let endDate = String(format: "%04d-%02d-31", year, month)

        do {
            employeeEntries = try await service.getEmployeeEntries(
                employeeId: employeeId,
                startDate: startDate,
                endDate: endDate
            )
            print("✅ Fetched \(employeeEntries.count) entries for employee \(employeeId)")
        } catch {
            print("❌ Failed to fetch employee entries: \(error)")
            errorMessage = "Failed to load employee entries"
        }
    }

    // MARK: - Auto Refresh

    private func startAutoRefresh() {
        // Refresh live status every 30 seconds
        refreshTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.fetchLiveStatus()
            }
        }
    }

    // MARK: - Employees Management

    func fetchAllEmployees() async {
        do {
            allEmployees = try await usersService.getAllUsers()
            print("✅ Fetched \(allEmployees.count) employees")

            // Fetch payroll info for all employees if payroll section is shown
            if showPayrollSection {
                await fetchAllPayrollInfo()
            }
        } catch {
            print("❌ Failed to fetch employees: \(error)")
            errorMessage = "Failed to load employees"
        }
    }

    func fetchAllPayrollInfo() async {
        for employee in allEmployees {
            do {
                if let payroll = try await service.getEmployeePayrollInfo(employeeId: employee.id) {
                    employeePayrollInfo[employee.id] = payroll
                } else {
                    print("⚠️ Employee \(employee.id) has no payroll info set up")
                }
            } catch {
                print("❌ Failed to fetch payroll for employee \(employee.id): \(error)")
            }
        }
    }

    func togglePayrollSection() {
        showPayrollSection.toggle()
        if showPayrollSection && employeePayrollInfo.isEmpty {
            Task {
                await fetchAllPayrollInfo()
            }
        }
    }

    // MARK: - Manual Entries Log

    func fetchRecentManualEntries() async {
        // Get all entries and filter for manual ones from last 24 hours
        let startDate = Calendar.current.date(byAdding: .day, value: -1, to: Date())!
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let _ = formatter.string(from: startDate)  // startDateString - for future use
        let _ = formatter.string(from: Date())      // endDateString - for future use

        // Note: This would need an admin endpoint to get all entries
        // For now, we'll keep the array empty until we implement this
        recentManualEntries = []
        print("✅ Fetched recent manual entries")
    }

    func dismissManualEntriesLog() {
        showManualEntriesLog = false
    }

    // MARK: - Hours Report

    func generateHoursReport() async {
        guard !reportStartDate.isEmpty, !reportEndDate.isEmpty else {
            errorMessage = "Please select start and end dates"
            return
        }

        actionInProgress = true
        errorMessage = nil

        do {
            hoursReportData = []

            // Fetch all admin entries
            let allEntries = try await service.getAllAdminEntries()

            // Parse date range
            let dateFormatter = DateFormatter()
            dateFormatter.dateFormat = "yyyy-MM-dd"
            dateFormatter.timeZone = TimeZone(identifier: "America/Los_Angeles")

            guard let startDate = dateFormatter.date(from: reportStartDate),
                  let endDate = dateFormatter.date(from: reportEndDate) else {
                errorMessage = "Invalid date format"
                actionInProgress = false
                return
            }

            // Set time bounds for filtering
            var startComponents = Calendar.current.dateComponents([.year, .month, .day], from: startDate)
            startComponents.hour = 0
            startComponents.minute = 0
            startComponents.second = 0
            let filterStart = Calendar.current.date(from: startComponents)!

            var endComponents = Calendar.current.dateComponents([.year, .month, .day], from: endDate)
            endComponents.hour = 23
            endComponents.minute = 59
            endComponents.second = 59
            let filterEnd = Calendar.current.date(from: endComponents)!

            // Filter entries by date range
            let filteredEntries = allEntries.filter { entry in
                let timestampFormatter = DateFormatter()
                timestampFormatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
                timestampFormatter.timeZone = TimeZone(identifier: "America/Los_Angeles")
                guard let clockInDate = timestampFormatter.date(from: entry.clockInTime) else { return false }
                return clockInDate >= filterStart && clockInDate <= filterEnd
            }

            print("📊 Filtered \(filteredEntries.count) entries from \(allEntries.count) total entries")

            // Aggregate by employee
            var employeeMap: [Int: (totalHours: Double, employeeName: String)] = [:]

            for entry in filteredEntries {
                guard let userId = entry.userId else { continue }

                let hours = entry.totalHours ?? 0
                let employeeName = entry.employeeName ?? allEmployees.first(where: { $0.id == userId })?.fullName ?? "Unknown"

                if var existing = employeeMap[userId] {
                    existing.totalHours += hours
                    employeeMap[userId] = existing
                } else {
                    employeeMap[userId] = (hours, employeeName)
                }
            }

            // Calculate regular/OT split and estimated pay for each employee
            for (employeeId, empData) in employeeMap {
                // Calculate regular and overtime hours
                let regularHours = min(empData.totalHours, 40)
                let overtimeHours = max(empData.totalHours - 40, 0)

                // Get payroll info to calculate estimated pay
                var estimatedPay: Double = 0
                do {
                    if let payrollInfo = try await service.getEmployeePayrollInfo(employeeId: employeeId) {
                        estimatedPay = service.calculatePayPeriodEarnings(payrollInfo: payrollInfo, hours: empData.totalHours)
                    } else {
                        print("⚠️ Employee \(employeeId) has no payroll info set up")
                    }
                } catch {
                    print("❌ Could not fetch payroll info for employee \(employeeId): \(error)")
                }

                let report = EmployeeHoursReport(
                    employeeId: employeeId,
                    employeeName: empData.employeeName,
                    totalHours: empData.totalHours,
                    regularHours: regularHours,
                    overtimeHours: overtimeHours,
                    estimatedPay: estimatedPay
                )
                hoursReportData.append(report)
            }

            // Sort by employee name
            hoursReportData.sort { $0.employeeName < $1.employeeName }

            print("✅ Generated hours report for \(hoursReportData.count) employees")
            print("   Total hours across all employees: \(hoursReportData.reduce(0) { $0 + $1.totalHours })")
        } catch {
            print("❌ Failed to generate hours report: \(error)")
            errorMessage = "Failed to generate hours report: \(error.localizedDescription)"
        }

        actionInProgress = false
    }

    func exportHoursReportCSV() -> String {
        var csv = "Employee Name,Total Hours,Regular Hours,Overtime Hours,Estimated Pay\n"

        for report in hoursReportData {
            csv += "\(report.employeeName),\(report.totalHours),\(report.regularHours),\(report.overtimeHours),\(report.estimatedPay)\n"
        }

        // Add totals row
        let totalHours = hoursReportData.reduce(0) { $0 + $1.totalHours }
        let totalRegular = hoursReportData.reduce(0) { $0 + $1.regularHours }
        let totalOvertime = hoursReportData.reduce(0) { $0 + $1.overtimeHours }
        let totalPay = hoursReportData.reduce(0) { $0 + $1.estimatedPay }
        csv += "TOTAL,\(totalHours),\(totalRegular),\(totalOvertime),\(totalPay)\n"

        return csv
    }

    // MARK: - Employee Audit

    func openEmployeeAudit(employee: User) async {
        selectedEmployee = nil // Need to convert User to LiveEmployeeStatus
        showEmployeeAudit = true

        do {
            // Fetch all entries for this employee
            let startDate = Calendar.current.date(byAdding: .month, value: -3, to: Date())!
            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy-MM-dd"
            let startDateString = formatter.string(from: startDate)
            let endDateString = formatter.string(from: Date())

            auditEmployeeEntries = try await service.getEmployeeEntries(
                employeeId: employee.id,
                startDate: startDateString,
                endDate: endDateString
            )
            print("✅ Fetched \(auditEmployeeEntries.count) entries for employee audit")
        } catch {
            print("❌ Failed to fetch employee entries: \(error)")
            errorMessage = "Failed to load employee entries"
        }
    }

    // MARK: - Payroll Settings

    func openPayrollSettings(for employee: User) {
        payrollModalEmployee = employee
        showPayrollModal = true

        // Fetch employee's current payroll info
        Task {
            do {
                if let payroll = try await service.getEmployeePayrollInfo(employeeId: employee.id) {
                    employeePayrollInfo[employee.id] = payroll
                } else {
                    print("⚠️ Employee \(employee.id) has no payroll info set up")
                }
            } catch {
                print("❌ Failed to fetch payroll info: \(error)")
            }
        }
    }

    func savePayrollSettings(
        employmentType: EmploymentType,
        hourlyRate: Double?,
        overtimeRate: Double?,
        annualSalary: Double?,
        payPeriodType: PayPeriodType
    ) async {
        guard let employee = payrollModalEmployee else { return }

        actionInProgress = true
        errorMessage = nil

        do {
            try await service.updatePayrollInfo(
                employeeId: employee.id,
                employmentType: employmentType,
                hourlyRate: hourlyRate,
                overtimeRate: overtimeRate,
                annualSalary: annualSalary,
                payPeriodType: payPeriodType
            )

            successMessage = "Payroll info saved successfully"
            showPayrollModal = false
            payrollModalEmployee = nil

            // Refresh payroll info
            await fetchAllPayrollInfo()

        } catch {
            print("❌ Failed to save payroll info: \(error)")
            errorMessage = "Failed to save payroll info"
        }

        actionInProgress = false
    }

    // MARK: - Helpers

    func clearMessages() {
        errorMessage = nil
        successMessage = nil
    }
}

// MARK: - Manual Entry Form

struct ManualEntryForm {
    var userId: Int = 0
    var employeeName: String = ""
    var date: String = ""
    var timeIn: String = ""
    var timeOut: String = ""
    var breakMinutes: Int = 0
    var notes: String = ""

    var isValid: Bool {
        !date.isEmpty && !timeIn.isEmpty && !timeOut.isEmpty && userId > 0
    }

    mutating func reset() {
        date = getCurrentDate()
        timeIn = ""
        timeOut = ""
        breakMinutes = 0
        notes = "[Manual Entry] "
    }

    private func getCurrentDate() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }
}

// MARK: - Edit Entry Form

struct EditEntryForm {
    var clockInTime: String = ""
    var clockOutTime: String = ""
    var breakMinutes: Int = 0
    var notes: String = ""

    var isValid: Bool {
        !clockInTime.isEmpty
    }

    mutating func populate(from entry: TimeEntry) {
        clockInTime = entry.clockInTime
        clockOutTime = entry.clockOutTime ?? ""
        breakMinutes = entry.breakMinutes
        notes = entry.notes ?? ""
    }
}
