//
//  TimeClockService.swift
//  GCWadmin
//
//  API service for TimeClock endpoints
//

import Foundation

class TimeClockService {
    static let shared = TimeClockService()
    private let apiClient = APIClient.shared

    private init() {}

    // MARK: - Helper Types

    /// Backend returns camelCase for /my-entries and /admin/entries endpoints
    private struct CamelCaseTimeEntry: Decodable {
        let id: Int
        let userId: Int?
        let clockInTime: String
        let clockOutTime: String?
        let breakMinutes: Int
        let totalHours: Double?
        let regularHours: Double?
        let overtimeHours: Double?
        let notes: String?
        let status: String?
        let entryMethod: String?
        let manuallyEnteredBy: Int?
        let manualEntryReason: String?
        let modificationCount: Int?
        let originalClockIn: String?
        let originalClockOut: String?
        let editedAt: String?
        let location: String?
        let ipAddress: String?
        let isDeleted: Bool?
        let createdBy: Int?
        let modifiedBy: Int?
        let createdAt: String?
        let modifiedAt: String?
        let employeeName: String?

        enum CodingKeys: String, CodingKey {
            case id, userId, employeeId, clockInTime, clockOutTime, breakMinutes, totalHours
            case regularHours, overtimeHours, notes, status, entryMethod
            case manuallyEnteredBy, manualEntryReason, modificationCount
            case originalClockIn, originalClockOut, editedAt, location
            case ipAddress, isDeleted, createdBy, modifiedBy, createdAt
            case modifiedAt, employeeName
        }

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            id = try container.decode(Int.self, forKey: .id)

            // Try userId first (for /my-entries), then employeeId (for /admin/entries)
            if let uid = try? container.decode(Int.self, forKey: .userId) {
                userId = uid
            } else if let empId = try? container.decode(Int.self, forKey: .employeeId) {
                userId = empId
            } else {
                userId = nil
            }
            clockInTime = try container.decode(String.self, forKey: .clockInTime)
            clockOutTime = try? container.decode(String.self, forKey: .clockOutTime)
            breakMinutes = try container.decode(Int.self, forKey: .breakMinutes)
            totalHours = try? container.decode(Double.self, forKey: .totalHours)
            regularHours = try? container.decode(Double.self, forKey: .regularHours)
            overtimeHours = try? container.decode(Double.self, forKey: .overtimeHours)
            notes = try? container.decode(String.self, forKey: .notes)
            status = try? container.decode(String.self, forKey: .status)
            entryMethod = try? container.decode(String.self, forKey: .entryMethod)
            manuallyEnteredBy = try? container.decode(Int.self, forKey: .manuallyEnteredBy)
            manualEntryReason = try? container.decode(String.self, forKey: .manualEntryReason)
            modificationCount = try? container.decode(Int.self, forKey: .modificationCount)
            originalClockIn = try? container.decode(String.self, forKey: .originalClockIn)
            originalClockOut = try? container.decode(String.self, forKey: .originalClockOut)
            editedAt = try? container.decode(String.self, forKey: .editedAt)
            location = try? container.decode(String.self, forKey: .location)
            ipAddress = try? container.decode(String.self, forKey: .ipAddress)

            // Handle isDeleted which can be Bool or Int (0/1)
            if let boolValue = try? container.decode(Bool.self, forKey: .isDeleted) {
                isDeleted = boolValue
            } else if let intValue = try? container.decode(Int.self, forKey: .isDeleted) {
                isDeleted = intValue != 0
            } else {
                isDeleted = nil
            }

            createdBy = try? container.decode(Int.self, forKey: .createdBy)
            modifiedBy = try? container.decode(Int.self, forKey: .modifiedBy)
            createdAt = try? container.decode(String.self, forKey: .createdAt)
            modifiedAt = try? container.decode(String.self, forKey: .modifiedAt)
            employeeName = try? container.decode(String.self, forKey: .employeeName)
        }

        func toTimeEntry() -> TimeEntry {
            return TimeEntry(
                id: id,
                userId: userId,
                clockInTime: clockInTime,
                clockOutTime: clockOutTime,
                breakMinutes: breakMinutes,
                totalHours: totalHours,
                regularHours: regularHours,
                overtimeHours: overtimeHours,
                notes: notes,
                status: status,
                entryMethod: entryMethod,
                manuallyEnteredBy: manuallyEnteredBy,
                manualEntryReason: manualEntryReason,
                modificationCount: modificationCount,
                originalClockIn: originalClockIn,
                originalClockOut: originalClockOut,
                editedAt: editedAt,
                location: location,
                ipAddress: ipAddress,
                isDeleted: isDeleted,
                createdBy: createdBy,
                modifiedBy: modifiedBy,
                createdAt: createdAt,
                modifiedAt: modifiedAt,
                employeeName: employeeName
            )
        }
    }

    // MARK: - Employee Endpoints

    /// Get current clock status
    func getCurrentStatus() async throws -> TimeClockStatus {
        return try await apiClient.get("/api/timeclock/current-status")
    }

    /// Clock in
    func clockIn() async throws -> ClockActionResponse {
        return try await apiClient.post("/api/timeclock/clock-in", body: [:])
    }

    /// Clock out
    func clockOut() async throws -> ClockActionResponse {
        return try await apiClient.post("/api/timeclock/clock-out", body: [:])
    }

    /// Start break
    func startBreak() async throws -> ClockActionResponse {
        return try await apiClient.post("/api/timeclock/start-break", body: [:])
    }

    /// End break
    func endBreak() async throws -> ClockActionResponse {
        return try await apiClient.post("/api/timeclock/end-break", body: [:])
    }

    /// Get my time entries for a date range
    func getMyEntries(startDate: String, endDate: String) async throws -> [TimeEntry] {
        struct EntriesResponse: Decodable {
            let success: Bool
            let entries: [CamelCaseTimeEntry]
        }

        let response: EntriesResponse = try await apiClient.get(
            "/api/timeclock/my-entries",
            queryItems: [
                URLQueryItem(name: "startDate", value: startDate),
                URLQueryItem(name: "endDate", value: endDate),
                URLQueryItem(name: "limit", value: "100")
            ]
        )

        return response.entries.map { $0.toTimeEntry() }
    }

    /// Get current pay period info
    func getCurrentPeriod() async throws -> PayPeriod? {
        struct BackendPayPeriod: Codable {
            let id: Int
            let startDate: String
            let endDate: String
            let payDate: String?
            let periodType: String?
        }

        struct PayPeriodResponse: Codable {
            let success: Bool
            let hasPayPeriod: Bool?
            let payPeriod: BackendPayPeriod?
            let summary: PayPeriodSummary?
            let message: String?
        }

        let response: PayPeriodResponse = try await apiClient.get("/api/timeclock/current-period")

        // Combine payPeriod and summary into a single PayPeriod object
        guard let backendPeriod = response.payPeriod,
              let summary = response.summary,
              let hours = Double(summary.totalHours),
              let earnings = Double(summary.estimatedGrossPay) else {
            return nil
        }

        return PayPeriod(
            id: backendPeriod.id,
            startDate: backendPeriod.startDate,
            endDate: backendPeriod.endDate,
            payDate: backendPeriod.payDate,
            periodType: backendPeriod.periodType,
            hours: hours,
            earnings: earnings
        )
    }

    /// Get my payroll info
    func getMyPayrollInfo() async throws -> PayrollInfo? {
        struct PayrollResponse: Codable {
            let success: Bool
            let payrollInfo: PayrollInfo?
        }

        let response: PayrollResponse = try await apiClient.get("/api/timeclock/my-payroll-info")
        return response.payrollInfo
    }

    /// Get my tax rate
    func getMyTaxRate() async throws -> EmployeeTaxRate? {
        struct TaxRateResponse: Codable {
            let taxRate: Double?
            enum CodingKeys: String, CodingKey {
                case taxRate = "tax_rate"
            }
        }

        let response: TaxRateResponse = try await apiClient.get("/api/timeclock/my-tax-rate")
        guard let rate = response.taxRate else { return nil }

        return EmployeeTaxRate(
            userId: 0, // Will be set from context
            taxRate: rate,
            updatedAt: nil
        )
    }

    /// Save tax rate
    func saveTaxRate(taxRate: Double) async throws {
        struct SaveTaxRateRequest: Codable {
            let taxRate: Double
            enum CodingKeys: String, CodingKey {
                case taxRate = "tax_rate"
            }
        }

        struct MessageResponse: Codable {
            let message: String
        }

        let _: MessageResponse = try await apiClient.post(
            "/api/timeclock/save-tax-rate",
            body: SaveTaxRateRequest(taxRate: taxRate)
        )
    }

    /// Calculate weekly hours from entries
    func calculateWeeklyHours() async throws -> HoursSummary {
        let calendar = Calendar.current
        let today = Date()

        // This week (Sunday to Saturday)
        let startOfWeek = calendar.date(from: calendar.dateComponents([.yearForWeekOfYear, .weekOfYear], from: today))!
        let endOfWeek = calendar.date(byAdding: .day, value: 6, to: startOfWeek)!

        // Last week
        let lastWeekStart = calendar.date(byAdding: .day, value: -7, to: startOfWeek)!
        let lastWeekEnd = calendar.date(byAdding: .day, value: -7, to: endOfWeek)!

        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"

        // Fetch this week's entries
        let thisWeekEntries = try await getMyEntries(
            startDate: dateFormatter.string(from: startOfWeek),
            endDate: dateFormatter.string(from: endOfWeek)
        )
        let thisWeekHours = thisWeekEntries.reduce(0) { $0 + ($1.totalHours ?? 0) }

        // Fetch last week's entries
        let lastWeekEntries = try await getMyEntries(
            startDate: dateFormatter.string(from: lastWeekStart),
            endDate: dateFormatter.string(from: lastWeekEnd)
        )
        let lastWeekHours = lastWeekEntries.reduce(0) { $0 + ($1.totalHours ?? 0) }

        // Pay period hours come from getCurrentPeriod
        let payPeriod = try? await getCurrentPeriod()
        let payPeriodHours = payPeriod?.hours ?? 0

        return HoursSummary(
            thisWeek: thisWeekHours,
            lastWeek: lastWeekHours,
            payPeriod: payPeriodHours
        )
    }

    // MARK: - Admin Endpoints

    /// Get live status of all employees (admin only)
    func getLiveStatus() async throws -> [LiveEmployeeStatus] {
        struct BackendLiveStatus: Codable {
            let id: Int
            let employeeId: Int
            let employeeName: String
            let clockInTime: String
            let clockOutTime: String?
            let totalHours: Double?
            let regularHours: Double?
            let overtimeHours: Double?
            let breakMinutes: Int
            let status: String
            let entryMethod: String?
            let manuallyEnteredBy: Int?
            let manualEntryReason: String?
            let originalClockIn: String?
            let originalClockOut: String?
            let modificationCount: Int?
            let editedAt: String?
            let notes: String?
            let location: String?
            let ipAddress: String?
            let isDeleted: Int?  // Backend sends 0/1, not Bool
            let createdAt: String?
            let updatedAt: String?
            let currentHours: String
            let isOnBreak: Bool
            let currentBreak: String?
        }

        struct LiveStatusResponse: Codable {
            let success: Bool
            let activeEmployees: Int
            let entries: [BackendLiveStatus]
        }

        let response: LiveStatusResponse = try await apiClient.get("/api/timeclock/admin/live-status")

        // Convert backend format to app format
        return response.entries.map { backend in
            LiveEmployeeStatus(
                id: backend.id,
                employeeId: backend.employeeId,
                employeeName: backend.employeeName,
                clockInTime: backend.clockInTime,
                clockOutTime: backend.clockOutTime,
                totalHours: backend.totalHours,
                regularHours: backend.regularHours,
                overtimeHours: backend.overtimeHours,
                breakMinutes: backend.breakMinutes,
                status: backend.status,
                entryMethod: backend.entryMethod,
                manuallyEnteredBy: backend.manuallyEnteredBy,
                manualEntryReason: backend.manualEntryReason,
                originalClockIn: backend.originalClockIn,
                originalClockOut: backend.originalClockOut,
                modificationCount: backend.modificationCount,
                editedAt: backend.editedAt,
                notes: backend.notes,
                location: backend.location,
                ipAddress: backend.ipAddress,
                isDeleted: backend.isDeleted.map { $0 != 0 },  // Convert Int to Bool
                createdAt: backend.createdAt,
                updatedAt: backend.updatedAt,
                currentHours: backend.currentHours,
                isOnBreak: backend.isOnBreak,
                currentBreak: backend.currentBreak
            )
        }
    }

    /// Get payroll info for specific employee (admin only)
    func getEmployeePayrollInfo(employeeId: Int) async throws -> PayrollInfo? {
        struct BackendPayrollInfo: Codable {
            let id: Int
            let employeeId: Int
            let employmentType: String
            let hourlyRate: Double?
            let overtimeRate: Double?
            let salary: Double?
            let payPeriodType: String
            let saveTaxRate: Double?
            let isActive: Int?
        }

        struct PayrollResponse: Codable {
            let success: Bool
            let payrollInfo: BackendPayrollInfo?
        }

        let response: PayrollResponse = try await apiClient.get("/api/timeclock/admin/payroll-info/\(employeeId)")

        guard let backendInfo = response.payrollInfo else { return nil }

        // Convert backend format to app format
        return PayrollInfo(
            id: backendInfo.id,
            userId: backendInfo.employeeId,
            employmentType: EmploymentType(rawValue: backendInfo.employmentType) ?? .hourly,
            hourlyRate: backendInfo.hourlyRate,
            overtimeRate: backendInfo.overtimeRate,
            annualSalary: backendInfo.salary,
            payPeriodType: PayPeriodType(rawValue: backendInfo.payPeriodType) ?? .biweekly,
            saveTaxRate: backendInfo.saveTaxRate,
            effectiveDate: nil,
            isActive: backendInfo.isActive == 1
        )
    }

    /// Add manual entry (admin only)
    func addManualEntry(request: ManualEntryRequest) async throws {
        struct WebappManualEntryRequest: Codable {
            let employeeId: String
            let employeeName: String
            let clockInTime: String
            let clockOutTime: String
            let breakMinutes: Int
            let reason: String
            let notes: String
        }

        struct ManualEntryResponse: Codable {
            let success: Bool
            let entry: TimeEntry?
            let message: String?
        }

        // Convert to webapp format
        let webappRequest = WebappManualEntryRequest(
            employeeId: String(request.userId),
            employeeName: "", // Will be filled by backend
            clockInTime: "\(request.date) \(request.timeIn):00",
            clockOutTime: "\(request.date) \(request.timeOut):00",
            breakMinutes: request.breakMinutes,
            reason: "Employee forgot to clock in/out",
            notes: request.notes ?? "[Manual Entry] Added via mobile app"
        )

        let _: ManualEntryResponse = try await apiClient.post(
            "/api/timeclock/admin/add-manual-entry",
            body: webappRequest
        )
    }

    /// Edit time entry (admin only)
    func editEntry(entryId: Int, request: EditEntryRequest) async throws {
        struct MessageResponse: Codable {
            let message: String
        }

        let _: MessageResponse = try await apiClient.put(
            "/api/timeclock/admin/edit-entry/\(entryId)",
            body: request
        )
    }

    /// Delete time entry (admin only)
    func deleteEntry(entryId: Int) async throws {
        struct MessageResponse: Codable {
            let message: String
        }

        let _: MessageResponse = try await apiClient.delete(
            "/api/timeclock/admin/delete-entry/\(entryId)"
        )
    }

    /// Get entry audit log (admin only)
    func getEntryAuditLog(entryId: Int) async throws -> [EntryAuditLog] {
        return try await apiClient.get("/api/timeclock/admin/entry-audit/\(entryId)")
    }

    /// Get all admin entries (admin only)
    func getAllAdminEntries() async throws -> [TimeEntry] {
        // Backend returns camelCase, same as /my-entries endpoint
        struct AdminEntriesResponse: Decodable {
            let success: Bool
            let entries: [CamelCaseTimeEntry]
        }

        let response: AdminEntriesResponse = try await apiClient.get("/api/timeclock/admin/entries")
        return response.entries.map { $0.toTimeEntry() }
    }

    /// Get employee entries (admin only)
    func getEmployeeEntries(employeeId: Int, startDate: String, endDate: String) async throws -> [TimeEntry] {
        return try await apiClient.get(
            "/api/timeclock/admin/employee-entries/\(employeeId)",
            queryItems: [
                URLQueryItem(name: "start_date", value: startDate),
                URLQueryItem(name: "end_date", value: endDate)
            ]
        )
    }

    /// Update payroll info (admin only)
    func updatePayrollInfo(
        employeeId: Int,
        employmentType: EmploymentType,
        hourlyRate: Double?,
        overtimeRate: Double?,
        annualSalary: Double?,
        payPeriodType: PayPeriodType
    ) async throws {
        struct UpdatePayrollRequest: Codable {
            let employeeId: String
            let employmentType: String
            let hourlyRate: Double?
            let overtimeRate: Double?
            let salary: Double?
            let payPeriodType: String

            enum CodingKeys: String, CodingKey {
                case employeeId = "employeeId"
                case employmentType = "employmentType"
                case hourlyRate = "hourlyRate"
                case overtimeRate = "overtimeRate"
                case salary = "salary"
                case payPeriodType = "payPeriodType"
            }
        }

        struct PayrollResponse: Codable {
            let success: Bool
            let message: String?
        }

        // Build request body as dictionary to avoid snake_case conversion
        var bodyDict: [String: Any] = [
            "employeeId": String(employeeId),
            "employmentType": employmentType.rawValue,
            "payPeriodType": payPeriodType.rawValue
        ]

        // Add optional values
        if let hourlyRate = hourlyRate {
            bodyDict["hourlyRate"] = hourlyRate
        }
        if let overtimeRate = overtimeRate {
            bodyDict["overtimeRate"] = overtimeRate
        }
        if let annualSalary = annualSalary {
            bodyDict["salary"] = annualSalary
        }

        print("📤 Payroll request body: \(bodyDict)")

        let _: PayrollResponse = try await apiClient.post(
            "/api/timeclock/admin/payroll-info",
            body: bodyDict
        )
    }

    // MARK: - Utility Methods

    /// Calculate earnings for current pay period
    func calculatePayPeriodEarnings(payrollInfo: PayrollInfo, hours: Double) -> Double {
        switch payrollInfo.employmentType {
        case .hourly:
            guard let hourlyRate = payrollInfo.hourlyRate else { return 0 }
            let overtimeRate = payrollInfo.overtimeRate ?? (hourlyRate * 1.5)

            let regularHours = min(hours, 40)
            let overtimeHours = max(hours - 40, 0)

            return (regularHours * hourlyRate) + (overtimeHours * overtimeRate)

        case .salary:
            guard let annualSalary = payrollInfo.annualSalary else { return 0 }
            return annualSalary / Double(payrollInfo.payPeriodType.periodsPerYear)
        }
    }

    /// Calculate net pay after taxes
    func calculateNetPay(grossPay: Double, taxRate: Double) -> Double {
        return grossPay * (1 - taxRate / 100)
    }
}
