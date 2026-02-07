//
//  AppointmentModels.swift
//  GCWadmin
//
//  Appointment models for scheduling and availability management
//

import Foundation

// MARK: - Appointment Model

struct Appointment: Codable, Identifiable {
    let id: Int
    let clientName: String
    let clientEmail: String
    let clientPhone: String
    let clientLanguage: String?
    let appointmentType: String
    let appointmentDate: String // ISO8601 date string
    let duration: Int // minutes
    var status: String
    let locationAddress: String?
    let notes: String?
    let assignedEmployeeId: Int?
    let assignedEmployeeName: String?
    let cancellationToken: String?
    let createdAt: String?
    let updatedAt: String?

    // APIClient uses .convertFromSnakeCase, so no explicit raw values needed
    enum CodingKeys: String, CodingKey {
        case id, clientName, clientEmail, clientPhone, clientLanguage
        case appointmentType, appointmentDate, duration, status
        case locationAddress, notes, assignedEmployeeId, assignedEmployeeName
        case cancellationToken, createdAt, updatedAt
    }

    var formattedDate: String {
        guard let date = ISO8601DateFormatter().date(from: appointmentDate) else {
            return appointmentDate
        }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: date)
    }

    var formattedTime: String {
        guard let date = ISO8601DateFormatter().date(from: appointmentDate) else {
            return ""
        }
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    var formattedDateTime: String {
        "\(formattedDate) at \(formattedTime)"
    }

    var appointmentTypeLabel: String {
        switch appointmentType.lowercased() {
        case "consultation":
            return "Consultation"
        case "measurement":
            return "Measurement"
        case "estimate":
            return "Estimate"
        case "followup":
            return "Follow-up"
        default:
            return appointmentType.capitalized
        }
    }
}

// MARK: - Employee Availability Model

struct EmployeeAvailability: Codable, Identifiable {
    let id: Int
    let employeeId: Int
    let employeeName: String?
    let dayOfWeek: Int // 0=Sunday, 1=Monday, ..., 6=Saturday
    let startTime: String // "HH:MM" format
    let endTime: String // "HH:MM" format
    let isAvailable: Bool

    enum CodingKeys: String, CodingKey {
        case id, employeeId, employeeName, dayOfWeek
        case startTime, endTime, isAvailable
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(Int.self, forKey: .id)
        employeeId = try container.decode(Int.self, forKey: .employeeId)
        employeeName = try container.decodeIfPresent(String.self, forKey: .employeeName)
        dayOfWeek = try container.decode(Int.self, forKey: .dayOfWeek)
        startTime = try container.decode(String.self, forKey: .startTime)
        endTime = try container.decode(String.self, forKey: .endTime)
        // SQLite returns 1/0 integers instead of true/false
        if let boolVal = try? container.decode(Bool.self, forKey: .isAvailable) {
            isAvailable = boolVal
        } else if let intVal = try? container.decode(Int.self, forKey: .isAvailable) {
            isAvailable = intVal != 0
        } else {
            isAvailable = true
        }
    }

    var dayName: String {
        let days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        return days[safe: dayOfWeek] ?? "Unknown"
    }

    var timeRange: String {
        "\(startTime) - \(endTime)"
    }
}

// Helper for safe array access
extension Array {
    subscript(safe index: Int) -> Element? {
        return indices.contains(index) ? self[index] : nil
    }
}

// MARK: - Blocked Time Model

struct BlockedTime: Codable, Identifiable {
    let id: Int
    let employeeId: Int
    let employeeName: String?
    let startDatetime: String // ISO8601 date string
    let endDatetime: String // ISO8601 date string
    let reason: String
    let notes: String?
    let createdBy: Int?
    let createdAt: String?

    // APIClient uses .convertFromSnakeCase, so no explicit raw values needed
    enum CodingKeys: String, CodingKey {
        case id, employeeId, employeeName, startDatetime, endDatetime
        case reason, notes, createdBy, createdAt
    }

    var formattedStartDate: String {
        guard let date = ISO8601DateFormatter().date(from: startDatetime) else {
            return startDatetime
        }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    var formattedEndDate: String {
        guard let date = ISO8601DateFormatter().date(from: endDatetime) else {
            return endDatetime
        }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    var dateRange: String {
        // Check if same day
        let start = ISO8601DateFormatter().date(from: startDatetime)
        let end = ISO8601DateFormatter().date(from: endDatetime)

        if let start = start, let end = end {
            let calendar = Calendar.current
            if calendar.isDate(start, inSameDayAs: end) {
                let dateFormatter = DateFormatter()
                dateFormatter.dateStyle = .medium
                let timeFormatter = DateFormatter()
                timeFormatter.timeStyle = .short
                return "\(dateFormatter.string(from: start)) • \(timeFormatter.string(from: start)) - \(timeFormatter.string(from: end))"
            }
        }

        return "\(formattedStartDate) - \(formattedEndDate)"
    }
}

// MARK: - Response Models

struct AppointmentsResponse: Codable {
    let appointments: [Appointment]
}

struct AvailabilityResponse: Codable {
    let availability: [EmployeeAvailability]
}

struct BlockedTimesResponse: Codable {
    let blockedTimes: [BlockedTime]
}

struct AppointmentUpdateResponse: Codable {
    let success: Bool
    let appointment: Appointment?
}

struct AvailabilityUpdateResponse: Codable {
    let success: Bool
    let availability: EmployeeAvailability?
}

struct BlockedTimeUpdateResponse: Codable {
    let success: Bool
    let blockedTime: BlockedTime?
}

// MARK: - Request Models

struct AppointmentStatusUpdate: Codable {
    let status: String
}

struct AppointmentAssignmentUpdate: Codable {
    let assignedEmployeeId: Int?

    enum CodingKeys: String, CodingKey {
        case assignedEmployeeId
    }
}

struct RescheduleRequest: Codable {
    let message: String
}

struct CreateAvailabilityRequest: Codable {
    let employeeId: Int
    let dayOfWeek: Int
    let startTime: String
    let endTime: String

    enum CodingKeys: String, CodingKey {
        case employeeId = "employee_id"
        case dayOfWeek = "day_of_week"
        case startTime = "start_time"
        case endTime = "end_time"
    }
}

struct CreateBlockedTimeRequest: Codable {
    let employeeId: Int
    let startDatetime: String
    let endDatetime: String
    let reason: String

    enum CodingKeys: String, CodingKey {
        case employeeId = "employee_id"
        case startDatetime = "start_datetime"
        case endDatetime = "end_datetime"
        case reason
    }
}
