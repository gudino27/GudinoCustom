//
//  TimeClockModels.swift
//  GCWadmin
//
//  TimeClock data models matching backend API
//

import Foundation

// MARK: - Time Entry
struct TimeEntry: Codable, Identifiable {
    let id: Int
    let userId: Int?  // Optional - not always returned by backend
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
    // Optional computed field from backend joins
    let employeeName: String?

    // APIClient uses .convertFromSnakeCase, so no explicit snake_case raw values needed
    enum CodingKeys: String, CodingKey {
        case id, userId, clockInTime, clockOutTime, breakMinutes
        case totalHours, regularHours, overtimeHours
        case notes, status, entryMethod
        case manuallyEnteredBy, manualEntryReason
        case modificationCount, originalClockIn, originalClockOut
        case editedAt, location, ipAddress, isDeleted
        case createdBy, modifiedBy, createdAt, modifiedAt
        case employeeName
    }

    var isActive: Bool {
        clockOutTime == nil
    }

    var displayDate: String {
        // Extract date from "YYYY-MM-DD HH:MM:SS" format
        String(clockInTime.prefix(10))
    }
}

// MARK: - Time Clock Status
struct TimeClockStatus: Codable {
    let isClockedIn: Bool
    let isOnBreak: Bool
    let clockInTime: String?
    let currentHours: String?
    let breakMinutes: Int?
    // Backend returns camelCase, no CodingKeys needed
}

// MARK: - Payroll Info
struct PayrollInfo: Codable, Identifiable {
    let id: Int
    let userId: Int
    let employmentType: EmploymentType
    let hourlyRate: Double?
    let overtimeRate: Double?
    let annualSalary: Double?
    let payPeriodType: PayPeriodType
    let saveTaxRate: Double?
    let effectiveDate: String?
    let isActive: Bool?

    // APIClient uses .convertFromSnakeCase
    // userId maps to "employee_id" in JSON → convertFromSnakeCase makes it "employeeId"
    enum CodingKeys: String, CodingKey {
        case id
        case userId = "employeeId"  // JSON: employee_id → employeeId
        case employmentType, hourlyRate, overtimeRate
        case annualSalary = "salary"  // JSON key is just "salary" (no conversion needed)
        case payPeriodType, saveTaxRate, effectiveDate, isActive
    }
}

// MARK: - Employment Type
enum EmploymentType: String, Codable {
    case hourly
    case salary

    var displayName: String {
        switch self {
        case .hourly: return "Hourly"
        case .salary: return "Salary"
        }
    }
}

// MARK: - Pay Period Type
enum PayPeriodType: String, Codable {
    case weekly
    case biweekly
    case semimonthly
    case monthly

    var displayName: String {
        switch self {
        case .weekly: return "Weekly"
        case .biweekly: return "Bi-weekly"
        case .semimonthly: return "Semi-monthly"
        case .monthly: return "Monthly"
        }
    }

    var periodsPerYear: Int {
        switch self {
        case .weekly: return 52
        case .biweekly: return 26
        case .semimonthly: return 24
        case .monthly: return 12
        }
    }
}

// MARK: - Pay Period
struct PayPeriod: Codable {
    let id: Int?
    let startDate: String
    let endDate: String
    let payDate: String?
    let periodType: String?
    let hours: Double
    let earnings: Double?

    enum CodingKeys: String, CodingKey {
        case id, startDate, endDate, payDate, periodType, hours, earnings
    }
}

// MARK: - Pay Period Summary
struct PayPeriodSummary: Codable {
    let totalHours: String
    let regularHours: String
    let overtimeHours: String
    let daysWorked: Int
    let estimatedGrossPay: String

    // No explicit CodingKeys needed - convertFromSnakeCase handles conversion

}

// MARK: - Employee Tax Rate
struct EmployeeTaxRate: Codable {
    let userId: Int
    let taxRate: Double
    let updatedAt: String?
}

// MARK: - Break Record
struct BreakRecord: Codable, Identifiable {
    let id: Int
    let entryId: Int
    let startTime: String
    let endTime: String?
    let duration: Int?
}

// MARK: - Live Employee Status (Admin)
struct LiveEmployeeStatus: Codable, Identifiable {
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
    let isDeleted: Bool?
    let createdAt: String?
    let updatedAt: String?
    // Computed fields added by backend
    let currentHours: String
    let isOnBreak: Bool
    let currentBreak: String? // from subquery

    // APIClient uses .convertFromSnakeCase - no explicit snake_case raw values
    enum CodingKeys: String, CodingKey {
        case id, employeeId, employeeName, clockInTime, clockOutTime
        case totalHours, regularHours, overtimeHours, breakMinutes
        case status, entryMethod, manuallyEnteredBy, manualEntryReason
        case originalClockIn, originalClockOut, modificationCount
        case editedAt, notes, location, ipAddress, isDeleted
        case createdAt, updatedAt, currentHours, isOnBreak, currentBreak
    }

    var displayName: String {
        employeeName
    }

    var isClockedIn: Bool {
        status == "active"
    }

    var username: String {
        employeeName // Backend doesn't return username separately
    }
}

// MARK: - Hours Summary
struct HoursSummary: Codable {
    let thisWeek: Double
    let lastWeek: Double
    let payPeriod: Double
}

// MARK: - Manual Entry Request
struct ManualEntryRequest: Codable {
    let userId: Int
    let date: String
    let timeIn: String
    let timeOut: String
    let breakMinutes: Int
    let notes: String?
}

// MARK: - Edit Entry Request
struct EditEntryRequest: Codable {
    let clockInTime: String
    let clockOutTime: String?
    let breakMinutes: Int
    let notes: String?
}

// MARK: - Entry Audit Log
struct EntryAuditLog: Codable, Identifiable {
    let id: Int
    let entryId: Int
    let modifiedBy: Int
    let modifiedByName: String?
    let changeType: String
    let oldValue: String?
    let newValue: String?
    let modifiedAt: String
}

// MARK: - API Response Wrappers
struct TimeClockResponse<T: Codable>: Codable {
    let success: Bool?
    let data: T?
    let message: String?
}

struct ClockActionResponse: Codable {
    let message: String
    let entry: TimeEntry?
    let status: TimeClockStatus?
}

// MARK: - Hours Report
struct EmployeeHoursReport: Identifiable {
    let id = UUID()
    let employeeId: Int
    let employeeName: String
    let totalHours: Double
    let regularHours: Double
    let overtimeHours: Double
    let estimatedPay: Double
}
