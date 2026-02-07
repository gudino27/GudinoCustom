//
//  SecurityMonitorViewModel.swift
//  GCWadmin
//
//  ViewModel for Security Monitor
//

import Foundation
import SwiftUI
import Combine

@MainActor
class SecurityMonitorViewModel: ObservableObject {
    private let securityService = SecurityService.shared

    // MARK: - Published Properties - Data

    @Published var failedLogins: [ActivityLog] = []
    @Published var lockedAccounts: [LockedAccount] = []
    @Published var activityLogs: [ActivityLog] = []

    // MARK: - Published Properties - View State

    @Published var selectedTab: String = "overview"
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var successMessage: String?
    @Published var timeFilter: Int = 24 // hours
    @Published var actionFilter: String = "all"

    // MARK: - Time Filter Options

    let timeFilterOptions: [(label: String, hours: Int)] = [
        ("Last Hour", 1),
        ("Last 24 Hours", 24),
        ("Last Week", 168),
        ("Last Month", 720)
    ]

    let actionFilterOptions: [(label: String, value: String)] = [
        ("All Actions", "all"),
        ("Login Success", "login_success"),
        ("Login Failed", "login_failed"),
        ("Logout", "logout"),
        ("Account Locked", "account_locked"),
        ("Account Unlocked", "account_unlocked")
    ]

    // MARK: - Computed Properties

    var failedAttemptCount: Int {
        failedLogins.filter { $0.action == "login_failed" }.count
    }

    var lockedAccountCount: Int {
        lockedAccounts.count
    }

    var recentActivityCount: Int {
        activityLogs.count
    }

    // MARK: - Load All Data

    func loadAll() async {
        isLoading = true
        errorMessage = nil

        async let failedTask: () = loadFailedLogins()
        async let lockedTask: () = loadLockedAccounts()
        async let logsTask: () = loadActivityLogs()

        _ = await (failedTask, lockedTask, logsTask)

        isLoading = false
    }

    // MARK: - Load Failed Logins

    func loadFailedLogins() async {
        do {
            failedLogins = try await securityService.getFailedLogins(hours: timeFilter)
        } catch {
            print("Failed to load failed logins: \(error)")
            if errorMessage == nil {
                errorMessage = error.localizedDescription
            }
        }
    }

    // MARK: - Load Locked Accounts

    func loadLockedAccounts() async {
        do {
            lockedAccounts = try await securityService.getLockedAccounts()
        } catch {
            print("Failed to load locked accounts: \(error)")
            if errorMessage == nil {
                errorMessage = error.localizedDescription
            }
        }
    }

    // MARK: - Load Activity Logs

    func loadActivityLogs() async {
        do {
            activityLogs = try await securityService.getActivityLogs(
                limit: 100,
                action: actionFilter == "all" ? nil : actionFilter
            )
        } catch {
            print("Failed to load activity logs: \(error)")
            if errorMessage == nil {
                errorMessage = error.localizedDescription
            }
        }
    }

    // MARK: - Unlock Account

    func unlockAccount(_ account: LockedAccount) async {
        do {
            let _ = try await securityService.unlockAccount(userId: account.id)
            successMessage = "Account unlocked successfully"
            // Refresh data
            await loadLockedAccounts()
            await loadFailedLogins()
        } catch {
            errorMessage = "Failed to unlock account: \(error.localizedDescription)"
        }
    }

    // MARK: - Refresh on Filter Change

    func onTimeFilterChanged() async {
        await loadFailedLogins()
    }

    func onActionFilterChanged() async {
        await loadActivityLogs()
    }
}
