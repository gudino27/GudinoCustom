//
//  SecurityModels.swift
//  GCWadmin
//
//  Models for Security Monitor
//

import Foundation
import SwiftUI

// MARK: - Activity Log

struct ActivityLog: Codable, Identifiable {
    let id: Int
    let userId: Int?
    let userName: String?
    let action: String
    let resourceType: String?
    let resourceId: String?
    let details: String?
    let ipAddress: String?
    let userAgent: String?
    let createdAt: String?

    // APIClient uses .convertFromSnakeCase, so no explicit raw values needed
    enum CodingKeys: String, CodingKey {
        case id, userId, userName, action, resourceType, resourceId
        case details, ipAddress, userAgent, createdAt
    }

    // MARK: - Computed Properties

    var displayName: String {
        userName ?? "System"
    }

    var formattedDate: String {
        guard let dateStr = createdAt else { return "N/A" }
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = isoFormatter.date(from: dateStr) {
            let formatter = DateFormatter()
            formatter.dateStyle = .short
            formatter.timeStyle = .short
            return formatter.string(from: date)
        }
        // Try without fractional seconds
        isoFormatter.formatOptions = [.withInternetDateTime]
        if let date = isoFormatter.date(from: dateStr) {
            let formatter = DateFormatter()
            formatter.dateStyle = .short
            formatter.timeStyle = .short
            return formatter.string(from: date)
        }
        return dateStr
    }

    var actionColor: Color {
        switch action {
        case "login_success": return AppColors.success
        case "login_failed": return AppColors.warning
        case "account_locked": return AppColors.error
        case "account_unlocked": return AppColors.blue
        case "logout": return AppColors.textGray
        default: return AppColors.textGray
        }
    }
}

// MARK: - Locked Account

struct LockedAccount: Codable, Identifiable {
    let id: Int
    let username: String
    let email: String
    let fullName: String?
    let failedLoginAttempts: Int?
    let accountLockedUntil: String?

    // APIClient uses .convertFromSnakeCase, so no explicit raw values needed
    enum CodingKeys: String, CodingKey {
        case id, username, email, fullName, failedLoginAttempts, accountLockedUntil
    }

    var displayName: String {
        fullName ?? username
    }

    var formattedLockedUntil: String {
        guard let dateStr = accountLockedUntil else { return "N/A" }
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

// MARK: - Simple Message Response

struct MessageResponse: Codable {
    let success: Bool?
    let message: String?
}
