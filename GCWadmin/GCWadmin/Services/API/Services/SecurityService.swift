//
//  SecurityService.swift
//  GCWadmin
//
//  API service for Security Monitor endpoints
//

import Foundation

class SecurityService {
    static let shared = SecurityService()
    private let apiClient = APIClient.shared

    private init() {}

    // MARK: - Failed Logins

    func getFailedLogins(hours: Int = 24) async throws -> [ActivityLog] {
        return try await apiClient.get("/api/admin/security/failed-logins?hours=\(hours)")
    }

    // MARK: - Locked Accounts

    func getLockedAccounts() async throws -> [LockedAccount] {
        return try await apiClient.get("/api/admin/security/locked-accounts")
    }

    // MARK: - Activity Logs

    func getActivityLogs(limit: Int = 100, action: String? = nil) async throws -> [ActivityLog] {
        var endpoint = "/api/admin/security/activity-logs?limit=\(limit)"
        if let action = action, action != "all" {
            let encoded = action.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? action
            endpoint += "&action=\(encoded)"
        }
        return try await apiClient.get(endpoint)
    }

    // MARK: - Unlock Account

    func unlockAccount(userId: Int) async throws -> MessageResponse {
        return try await apiClient.post("/api/admin/security/unlock-account/\(userId)")
    }
}
