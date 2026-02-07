//
//  SmsRoutingModels.swift
//  GCWadmin
//
//  Models for SMS Routing Manager
//

import Foundation
import SwiftUI

// MARK: - SMS Routing Setting

struct SmsRoutingSetting: Codable, Identifiable {
    let id: Int?
    let messageType: String
    var isEnabled: Int  // SQLite boolean (0/1)
    var routingMode: String  // "single", "all", "rotation"
    var updatedAt: String?

    // APIClient uses .convertFromSnakeCase, so no explicit raw values needed
    enum CodingKeys: String, CodingKey {
        case id, messageType, isEnabled, routingMode, updatedAt
    }

    // Custom decoder for SQLite boolean
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(Int.self, forKey: .id)
        messageType = try container.decode(String.self, forKey: .messageType)
        routingMode = try container.decodeIfPresent(String.self, forKey: .routingMode) ?? "single"
        updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt)

        // Handle isEnabled as Bool or Int
        if let boolVal = try? container.decode(Bool.self, forKey: .isEnabled) {
            isEnabled = boolVal ? 1 : 0
        } else if let intVal = try? container.decode(Int.self, forKey: .isEnabled) {
            isEnabled = intVal
        } else {
            isEnabled = 1
        }
    }

    var enabled: Bool {
        get { isEnabled != 0 }
        set { isEnabled = newValue ? 1 : 0 }
    }

    var messageTypeLabel: String {
        switch messageType {
        case "design_submission": return "Design Submissions"
        case "test_sms": return "Test SMS"
        case "appointment_booking": return "Appointment Booking"
        case "timeline_phase_update": return "Timeline Updates"
        case "invoice_notification": return "Invoice Notifications"
        case "new_design": return "New Design"
        case "payment_received": return "Payment Received"
        default: return messageType.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }

    var messageTypeDescription: String {
        switch messageType {
        case "design_submission": return "SMS sent when a new design is submitted"
        case "test_sms": return "Test messages for verifying SMS routing"
        default: return "SMS notifications for \(messageTypeLabel.lowercased())"
        }
    }

    var routingModeLabel: String {
        switch routingMode {
        case "single": return "Single Recipient"
        case "all": return "All Recipients"
        case "rotation": return "Rotation"
        default: return routingMode.capitalized
        }
    }
}

// MARK: - SMS Recipient

struct SmsRecipient: Codable, Identifiable {
    let id: Int
    let messageType: String
    var employeeId: Int?
    var phoneNumber: String
    var name: String
    var priorityOrder: Int
    var isActive: Int  // SQLite boolean
    let employeeName: String?
    let position: String?

    // APIClient uses .convertFromSnakeCase, so no explicit raw values needed
    enum CodingKeys: String, CodingKey {
        case id, messageType, employeeId, phoneNumber, name
        case priorityOrder, isActive, employeeName, position
    }

    // Custom decoder for SQLite boolean
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(Int.self, forKey: .id)
        messageType = try container.decode(String.self, forKey: .messageType)
        employeeId = try container.decodeIfPresent(Int.self, forKey: .employeeId)
        phoneNumber = try container.decode(String.self, forKey: .phoneNumber)
        name = try container.decode(String.self, forKey: .name)
        priorityOrder = try container.decodeIfPresent(Int.self, forKey: .priorityOrder) ?? 0
        employeeName = try container.decodeIfPresent(String.self, forKey: .employeeName)
        position = try container.decodeIfPresent(String.self, forKey: .position)

        if let boolVal = try? container.decode(Bool.self, forKey: .isActive) {
            isActive = boolVal ? 1 : 0
        } else if let intVal = try? container.decode(Int.self, forKey: .isActive) {
            isActive = intVal
        } else {
            isActive = 1
        }
    }

    var active: Bool {
        get { isActive != 0 }
        set { isActive = newValue ? 1 : 0 }
    }
}

// MARK: - SMS History Entry

struct SmsHistoryEntry: Codable, Identifiable {
    let id: Int
    let sentAt: String?
    let messageType: String?
    let recipientName: String?
    let recipientPhone: String?
    let deliveryStatus: String?
    let messageContent: String?
    let errorMessage: String?

    // APIClient uses .convertFromSnakeCase, so no explicit raw values needed
    enum CodingKeys: String, CodingKey {
        case id, sentAt, messageType, recipientName, recipientPhone
        case deliveryStatus, messageContent, errorMessage
    }

    var formattedDate: String {
        guard let dateStr = sentAt else { return "N/A" }
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = isoFormatter.date(from: dateStr) {
            let formatter = DateFormatter()
            formatter.dateStyle = .short
            formatter.timeStyle = .short
            return formatter.string(from: date)
        }
        isoFormatter.formatOptions = [.withInternetDateTime]
        if let date = isoFormatter.date(from: dateStr) {
            let formatter = DateFormatter()
            formatter.dateStyle = .short
            formatter.timeStyle = .short
            return formatter.string(from: date)
        }
        return dateStr
    }
}

// MARK: - SMS Test Response

struct SmsTestResponse: Codable {
    let success: Bool?
    let message: String?
    let details: SmsTestDetails?

    enum CodingKeys: String, CodingKey {
        case success, message, details
    }
}

struct SmsTestDetails: Codable {
    let totalSent: Int?
    let totalFailed: Int?

    enum CodingKeys: String, CodingKey {
        case totalSent, totalFailed
    }
}
