//
//  UserModels.swift
//  GCWadmin
//
//  Models for User Management
//

import Foundation

// MARK: - User Management Extension
extension User {
    var isActive: Bool {
        // Will be populated from backend response
        true
    }

    var lastLogin: String? {
        // Will be populated from backend response
        nil
    }

    var createdAt: String? {
        // Will be populated from backend response
        nil
    }

    var statusText: String {
        isActive ? "Active" : "Inactive"
    }

    var lastLoginDisplay: String {
        guard let lastLogin = lastLogin else { return "Never" }
        // Format timestamp for display
        let formatter = ISO8601DateFormatter()
        if let date = formatter.date(from: lastLogin) {
            let displayFormatter = DateFormatter()
            displayFormatter.dateStyle = .medium
            displayFormatter.timeStyle = .short
            return displayFormatter.string(from: date)
        }
        return lastLogin
    }
}

// MARK: - User Role Extension
extension UserRole {
    var badgeColor: String {
        switch self {
        case .employee: return "4CAF50"  // Green
        case .admin: return "2196F3"     // Blue
        case .superAdmin: return "9C27B0" // Purple
        }
    }
}

// MARK: - Admin User (for User Management)
struct AdminUser: Identifiable {
    let id: Int
    let username: String
    let email: String?
    let fullName: String?
    let role: UserRole
    let isActive: Bool
    let lastLogin: String?
    let createdAt: String?
    let mustChangePassword: Bool?

    var displayName: String {
        fullName ?? username
    }

    var statusText: String {
        isActive ? "Active" : "Inactive"
    }

    var lastLoginDisplay: String {
        guard let lastLogin = lastLogin else { return "Never" }
        let formatter = ISO8601DateFormatter()
        if let date = formatter.date(from: lastLogin) {
            let displayFormatter = DateFormatter()
            displayFormatter.dateStyle = .medium
            displayFormatter.timeStyle = .short
            displayFormatter.timeZone = TimeZone(identifier: "America/Los_Angeles") // PST/PDT
            return displayFormatter.string(from: date)
        }
        return lastLogin
    }
}

// MARK: - Invitation
struct Invitation: Identifiable {
    let id: Int
    let email: String?
    let phone: String?
    let fullName: String
    let role: UserRole
    let language: String?
    let token: String?  // Optional - not returned in list for security
    let expiresAt: String
    let createdBy: Int?  // Optional - may not be returned
    let createdByUsername: String?
    let createdByName: String?
    let usedAt: String?
    let createdAt: String?

    var deliveryMethod: String {
        if email != nil && phone != nil {
            return "Email & SMS"
        } else if email != nil {
            return "Email"
        } else if phone != nil {
            return "SMS"
        }
        return "Unknown"
    }

    var status: InvitationStatus {
        if let _ = usedAt {
            return .completed
        }

        let formatter = ISO8601DateFormatter()
        if let expiryDate = formatter.date(from: expiresAt),
           expiryDate < Date() {
            return .expired
        }

        return .pending
    }

    var recipientDisplay: String {
        var parts: [String] = [fullName]
        if let email = email {
            parts.append(email)
        }
        if let phone = phone {
            parts.append(phone)
        }
        return parts.joined(separator: "\n")
    }
}

enum InvitationStatus: String {
    case pending = "Pending"
    case completed = "Completed"
    case expired = "Expired"

    var color: String {
        switch self {
        case .pending: return "FFC107"    // Amber
        case .completed: return "4CAF50"  // Green
        case .expired: return "9E9E9E"    // Gray
        }
    }
}

// MARK: - Request/Response Models

struct CreateUserRequest: Codable {
    let username: String
    let email: String?
    let password: String
    let fullName: String?
    let role: String
}

struct UpdateUserRequest: Codable {
    let email: String?
    let fullName: String?
    let role: String
}

struct SendInviteRequest: Codable {
    let fullName: String
    let role: String
    let email: String?
    let phone: String?
    let deliveryMethod: String
    let language: String?
}
