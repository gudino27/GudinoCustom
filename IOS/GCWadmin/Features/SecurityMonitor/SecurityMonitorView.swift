//
//  SecurityMonitorView.swift
//  GCWadmin
//
//  Security Monitor UI - Failed Logins, Locked Accounts, Audit Logs
//  Matches webapp SecurityMonitor.js
//

import SwiftUI

struct SecurityMonitorView: View {
    @StateObject private var viewModel = SecurityMonitorViewModel()
    @State private var showUnlockConfirmation = false
    @State private var accountToUnlock: LockedAccount?

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.lg) {
                // Tab bar
                SubTabBar(
                    tabs: [
                        SubTab(id: "overview", label: "Overview", icon: "chart.bar"),
                        SubTab(id: "failed-logins", label: "Failed Logins", icon: "exclamationmark.triangle"),
                        SubTab(id: "locked-accounts", label: "Locked", icon: "lock.fill"),
                        SubTab(id: "audit-logs", label: "Audit Logs", icon: "list.bullet")
                    ],
                    selection: $viewModel.selectedTab
                )

                // Content based on tab
                switch viewModel.selectedTab {
                case "overview":
                    overviewSection
                case "failed-logins":
                    failedLoginsSection
                case "locked-accounts":
                    lockedAccountsSection
                case "audit-logs":
                    auditLogsSection
                default:
                    overviewSection
                }
            }
            .padding(AppSpacing.lg)
        }
        .background(AppColors.background)
        .navigationTitle("Security")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.loadAll()
        }
        .alert("Unlock Account", isPresented: $showUnlockConfirmation, presenting: accountToUnlock) { account in
            Button("Cancel", role: .cancel) { }
            Button("Unlock", role: .destructive) {
                Task { await viewModel.unlockAccount(account) }
            }
        } message: { account in
            Text("Are you sure you want to unlock \(account.displayName)'s account?")
        }
        .overlay(alignment: .top) {
            notificationOverlay
        }
    }

    // MARK: - Notification Overlay

    private var notificationOverlay: some View {
        VStack {
            if let success = viewModel.successMessage {
                HStack {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.white)
                    Text(success)
                        .font(AppTypography.caption())
                        .foregroundColor(.white)
                }
                .padding(AppSpacing.md)
                .background(AppColors.success)
                .cornerRadius(AppRadius.md)
                .padding(.top, AppSpacing.sm)
                .onAppear {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                        viewModel.successMessage = nil
                    }
                }
            }

            if let error = viewModel.errorMessage {
                HStack {
                    Image(systemName: "exclamationmark.circle.fill")
                        .foregroundColor(.white)
                    Text(error)
                        .font(AppTypography.caption())
                        .foregroundColor(.white)
                }
                .padding(AppSpacing.md)
                .background(AppColors.error)
                .cornerRadius(AppRadius.md)
                .padding(.top, AppSpacing.sm)
                .onAppear {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 5) {
                        viewModel.errorMessage = nil
                    }
                }
            }
        }
    }

    // MARK: - Overview Section

    private var overviewSection: some View {
        VStack(spacing: AppSpacing.lg) {
            // Stats cards - horizontal scrolling stack matching webapp
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: AppSpacing.md) {
                    statCard(
                        title: "Failed Attempts (24h)",
                        value: "\(viewModel.failedAttemptCount)",
                        icon: "exclamationmark.triangle",
                        color: AppColors.warning
                    )
                    .frame(width: 200)
                    statCard(
                        title: "Locked Accounts",
                        value: "\(viewModel.lockedAccountCount)",
                        icon: "lock.fill",
                        color: AppColors.error
                    )
                    .frame(width: 200)
                    statCard(
                        title: "Recent Activity",
                        value: "\(viewModel.recentActivityCount)",
                        icon: "chart.line.uptrend.xyaxis",
                        color: AppColors.blue
                    )
                    .frame(width: 200)
                }
            }

            // Recent Failed Logins
            GlassCard(intensity: .light, style: .light) {
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    HStack {
                        Image(systemName: "exclamationmark.triangle")
                            .foregroundColor(AppColors.warning)
                        Text("Recent Failed Logins")
                            .font(AppTypography.headline())
                            .foregroundColor(AppColors.text)
                        Spacer()
                        refreshButton {
                            Task { await viewModel.loadFailedLogins() }
                        }
                    }

                    if viewModel.failedLogins.isEmpty {
                        emptyState(message: "No failed logins found", icon: "shield.checkered")
                    } else {
                        ForEach(viewModel.failedLogins.prefix(10)) { log in
                            failedLoginRow(log)
                        }
                    }
                }
            }

            // Locked Accounts (only show if there are some)
            if !viewModel.lockedAccounts.isEmpty {
                GlassCard(intensity: .light, style: .light) {
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        HStack {
                            Image(systemName: "lock.fill")
                                .foregroundColor(AppColors.error)
                            Text("Currently Locked Accounts")
                                .font(AppTypography.headline())
                                .foregroundColor(AppColors.text)
                            Spacer()
                        }

                        ForEach(viewModel.lockedAccounts) { account in
                            lockedAccountRow(account)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Failed Logins Section

    private var failedLoginsSection: some View {
        VStack(spacing: AppSpacing.lg) {
            // Filters
            HStack {
                Text("Failed Login Attempts")
                    .font(AppTypography.headline())
                    .foregroundColor(AppColors.text)
                Spacer()

                Picker("Time Range", selection: $viewModel.timeFilter) {
                    ForEach(viewModel.timeFilterOptions, id: \.hours) { option in
                        Text(option.label).tag(option.hours)
                    }
                }
                .pickerStyle(.menu)
                .onChange(of: viewModel.timeFilter) {
                    Task { await viewModel.onTimeFilterChanged() }
                }

                refreshButton {
                    Task { await viewModel.loadFailedLogins() }
                }
            }

            GlassCard(intensity: .light, style: .light) {
                ScrollView(.horizontal, showsIndicators: true) {
                    VStack(spacing: 0) {
                        // Header row - matches webapp exactly
                        HStack(spacing: AppSpacing.md) {
                            Text("User")
                                .frame(width: 120, alignment: .leading)
                            Text("Details")
                                .frame(width: 200, alignment: .leading)
                            Text("IP Address")
                                .frame(width: 100, alignment: .leading)
                            Text("Date & Time")
                                .frame(width: 130, alignment: .leading)
                            Text("Status")
                                .frame(width: 80, alignment: .center)
                        }
                        .font(AppTypography.small())
                        .fontWeight(.semibold)
                        .foregroundColor(AppColors.textMedium)
                        .padding(.vertical, AppSpacing.sm)
                        .padding(.horizontal, AppSpacing.md)
                        .background(AppColors.gray50)

                        Divider()

                        if viewModel.failedLogins.isEmpty {
                            emptyState(message: "No failed logins in this time period", icon: "shield.checkered")
                        } else {
                            ForEach(viewModel.failedLogins) { log in
                                VStack(spacing: 0) {
                                    HStack(spacing: AppSpacing.md) {
                                        // User column
                                        HStack(spacing: AppSpacing.xs) {
                                            Image(systemName: "person.fill")
                                                .font(.system(size: 10))
                                                .foregroundColor(AppColors.textLight)
                                            Text(log.displayName)
                                                .font(AppTypography.caption())
                                                .fontWeight(.medium)
                                                .foregroundColor(AppColors.text)
                                        }
                                        .frame(width: 120, alignment: .leading)

                                        // Details column
                                        Text(log.details ?? "Failed login attempt")
                                            .font(AppTypography.caption())
                                            .foregroundColor(AppColors.textGray)
                                            .frame(width: 200, alignment: .leading)
                                            .lineLimit(1)

                                        // IP Address column
                                        HStack(spacing: 2) {
                                            Image(systemName: "mappin")
                                                .font(.system(size: 8))
                                                .foregroundColor(AppColors.textGray)
                                            Text(log.ipAddress ?? "N/A")
                                                .font(AppTypography.caption())
                                                .foregroundColor(AppColors.textGray)
                                        }
                                        .frame(width: 100, alignment: .leading)

                                        // Date & Time column
                                        Text(log.formattedDate)
                                            .font(AppTypography.caption())
                                            .foregroundColor(AppColors.textGray)
                                            .frame(width: 130, alignment: .leading)

                                        // Status column
                                        StatusBadge.securityAction(log.action)
                                            .frame(width: 80, alignment: .center)
                                    }
                                    .padding(.vertical, AppSpacing.sm)
                                    .padding(.horizontal, AppSpacing.md)

                                    Divider()
                                }
                            }
                        }
                    }
                    .frame(minWidth: 630) // Minimum width for all columns
                }
            }
        }
    }

    // MARK: - Locked Accounts Section

    private var lockedAccountsSection: some View {
        VStack(spacing: AppSpacing.lg) {
            HStack {
                Text("Locked Accounts")
                    .font(AppTypography.headline())
                    .foregroundColor(AppColors.text)
                Spacer()
                refreshButton {
                    Task { await viewModel.loadLockedAccounts() }
                }
            }

            if viewModel.lockedAccounts.isEmpty {
                GlassCard(intensity: .light, style: .light) {
                    VStack(spacing: AppSpacing.lg) {
                        Image(systemName: "shield.checkered")
                            .font(.system(size: 48))
                            .foregroundColor(AppColors.successMedium)
                            .opacity(0.5)
                        Text("No Locked Accounts")
                            .font(AppTypography.headline())
                            .foregroundColor(AppColors.textGray)
                        Text("All accounts are currently accessible")
                            .font(AppTypography.caption())
                            .foregroundColor(AppColors.textLight)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, AppSpacing.xxxxl)
                }
            } else {
                ForEach(viewModel.lockedAccounts) { account in
                    lockedAccountCard(account)
                }
            }
        }
    }

    // MARK: - Audit Logs Section

    private var auditLogsSection: some View {
        VStack(spacing: AppSpacing.lg) {
            // Filters
            HStack {
                Text("Activity Audit Logs")
                    .font(AppTypography.headline())
                    .foregroundColor(AppColors.text)
                Spacer()

                Picker("Action", selection: $viewModel.actionFilter) {
                    ForEach(viewModel.actionFilterOptions, id: \.value) { option in
                        Text(option.label).tag(option.value)
                    }
                }
                .pickerStyle(.menu)
                .onChange(of: viewModel.actionFilter) {
                    Task { await viewModel.onActionFilterChanged() }
                }

                refreshButton {
                    Task { await viewModel.loadActivityLogs() }
                }
            }

            GlassCard(intensity: .light, style: .light) {
                ScrollView(.horizontal, showsIndicators: true) {
                    VStack(spacing: 0) {
                        // Header row - matches webapp exactly
                        HStack(spacing: AppSpacing.md) {
                            Text("User")
                                .frame(width: 120, alignment: .leading)
                            Text("Action")
                                .frame(width: 120, alignment: .center)
                            Text("Details")
                                .frame(width: 200, alignment: .leading)
                            Text("IP Address")
                                .frame(width: 100, alignment: .leading)
                            Text("Date & Time")
                                .frame(width: 130, alignment: .leading)
                        }
                        .font(AppTypography.small())
                        .fontWeight(.semibold)
                        .foregroundColor(AppColors.textMedium)
                        .padding(.vertical, AppSpacing.sm)
                        .padding(.horizontal, AppSpacing.md)
                        .background(AppColors.gray50)

                        Divider()

                        if viewModel.activityLogs.isEmpty {
                            emptyState(message: "No activity logs found", icon: "doc.text.magnifyingglass")
                        } else {
                            ForEach(viewModel.activityLogs) { log in
                                VStack(spacing: 0) {
                                    HStack(spacing: AppSpacing.md) {
                                        // User column
                                        HStack(spacing: AppSpacing.xs) {
                                            Image(systemName: "person.fill")
                                                .font(.system(size: 10))
                                                .foregroundColor(AppColors.textLight)
                                            Text(log.displayName)
                                                .font(AppTypography.caption())
                                                .fontWeight(.medium)
                                                .foregroundColor(AppColors.text)
                                        }
                                        .frame(width: 120, alignment: .leading)

                                        // Action column
                                        StatusBadge.securityAction(log.action)
                                            .frame(width: 120, alignment: .center)

                                        // Details column
                                        Text(log.details ?? "-")
                                            .font(AppTypography.caption())
                                            .foregroundColor(AppColors.textGray)
                                            .frame(width: 200, alignment: .leading)
                                            .lineLimit(1)

                                        // IP Address column
                                        HStack(spacing: 2) {
                                            Image(systemName: "mappin")
                                                .font(.system(size: 8))
                                                .foregroundColor(AppColors.textGray)
                                            Text(log.ipAddress ?? "N/A")
                                                .font(AppTypography.caption())
                                                .foregroundColor(AppColors.textGray)
                                        }
                                        .frame(width: 100, alignment: .leading)

                                        // Date & Time column
                                        Text(log.formattedDate)
                                            .font(AppTypography.caption())
                                            .foregroundColor(AppColors.textGray)
                                            .frame(width: 130, alignment: .leading)
                                    }
                                    .padding(.vertical, AppSpacing.sm)
                                    .padding(.horizontal, AppSpacing.md)

                                    Divider()
                                }
                            }
                        }
                    }
                    .frame(minWidth: 670) // Minimum width for all columns
                }
            }
        }
    }

    // MARK: - Reusable Components

    private func statCard(title: String, value: String, icon: String, color: Color) -> some View {
        GlassCard(intensity: .light, style: .light) {
            HStack {
                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    Text(title)
                        .font(AppTypography.caption())
                        .foregroundColor(AppColors.textGray)
                    Text(value)
                        .font(.system(size: 28, weight: .bold))
                        .foregroundColor(color)
                }
                Spacer()
                Image(systemName: icon)
                    .font(.system(size: 36))
                    .foregroundColor(color.opacity(0.2))
            }
            .padding(AppSpacing.md)
        }
    }

    private func failedLoginRow(_ log: ActivityLog) -> some View {
        HStack {
            HStack(spacing: AppSpacing.sm) {
                Image(systemName: "person.fill")
                    .font(.system(size: 12))
                    .foregroundColor(AppColors.warning)
                VStack(alignment: .leading, spacing: 2) {
                    Text(log.displayName)
                        .font(AppTypography.caption())
                        .fontWeight(.medium)
                        .foregroundColor(AppColors.text)
                    if let details = log.details {
                        Text(details)
                            .font(AppTypography.small())
                            .foregroundColor(AppColors.textGray)
                            .lineLimit(1)
                    }
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(log.formattedDate)
                    .font(AppTypography.small())
                    .foregroundColor(AppColors.textGray)
                if let ip = log.ipAddress {
                    HStack(spacing: 2) {
                        Image(systemName: "mappin")
                            .font(.system(size: 8))
                        Text(ip)
                            .font(AppTypography.small())
                    }
                    .foregroundColor(AppColors.textLight)
                }
            }
        }
        .padding(AppSpacing.sm)
        .background(AppColors.warningBg)
        .cornerRadius(AppRadius.sm)
        .overlay(
            RoundedRectangle(cornerRadius: AppRadius.sm)
                .stroke(AppColors.warningBorder, lineWidth: 1)
        )
    }

    private func lockedAccountRow(_ account: LockedAccount) -> some View {
        HStack {
            HStack(spacing: AppSpacing.sm) {
                Image(systemName: "lock.fill")
                    .font(.system(size: 12))
                    .foregroundColor(AppColors.error)
                VStack(alignment: .leading, spacing: 2) {
                    Text(account.displayName)
                        .font(AppTypography.caption())
                        .fontWeight(.medium)
                        .foregroundColor(AppColors.text)
                    Text(account.email)
                        .font(AppTypography.small())
                        .foregroundColor(AppColors.textGray)
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text("Until \(account.formattedLockedUntil)")
                    .font(AppTypography.small())
                    .foregroundColor(AppColors.textGray)
                Text("\(account.failedLoginAttempts ?? 0) failed attempts")
                    .font(AppTypography.small())
                    .foregroundColor(AppColors.textLight)
            }
            Button {
                accountToUnlock = account
                showUnlockConfirmation = true
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "lock.open")
                        .font(.system(size: 10))
                    Text("Unlock")
                        .font(AppTypography.small())
                }
                .foregroundColor(.white)
                .padding(.horizontal, AppSpacing.sm)
                .padding(.vertical, AppSpacing.xs)
                .background(AppColors.blue)
                .cornerRadius(AppRadius.sm)
            }
        }
        .padding(AppSpacing.sm)
        .background(AppColors.errorBg)
        .cornerRadius(AppRadius.sm)
        .overlay(
            RoundedRectangle(cornerRadius: AppRadius.sm)
                .stroke(AppColors.errorBorder, lineWidth: 1)
        )
    }

    private func lockedAccountCard(_ account: LockedAccount) -> some View {
        GlassCard(intensity: .light, style: .light) {
            HStack {
                HStack(spacing: AppSpacing.md) {
                    Image(systemName: "lock.fill")
                        .font(.system(size: 20))
                        .foregroundColor(AppColors.error)

                    VStack(alignment: .leading, spacing: AppSpacing.xs) {
                        Text(account.displayName)
                            .font(AppTypography.body())
                            .fontWeight(.semibold)
                            .foregroundColor(AppColors.text)
                        Text(account.email)
                            .font(AppTypography.caption())
                            .foregroundColor(AppColors.textGray)
                        Text("\(account.failedLoginAttempts ?? 0) failed attempts · Locked until \(account.formattedLockedUntil)")
                            .font(AppTypography.small())
                            .foregroundColor(AppColors.textLight)
                    }
                }

                Spacer()

                Button {
                    accountToUnlock = account
                    showUnlockConfirmation = true
                } label: {
                    HStack(spacing: AppSpacing.xs) {
                        Image(systemName: "lock.open")
                        Text("Unlock Account")
                    }
                    .font(AppTypography.caption())
                    .foregroundColor(.white)
                    .padding(.horizontal, AppSpacing.md)
                    .padding(.vertical, AppSpacing.sm)
                    .background(AppColors.blue)
                    .cornerRadius(AppRadius.md)
                }
            }
        }
    }

    private func refreshButton(action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: "arrow.clockwise")
                .font(.system(size: 14))
                .foregroundColor(AppColors.textGray)
                .padding(AppSpacing.xs)
        }
    }

    private func emptyState(message: String, icon: String) -> some View {
        VStack(spacing: AppSpacing.md) {
            Image(systemName: icon)
                .font(.system(size: 36))
                .foregroundColor(AppColors.textLight)
            Text(message)
                .font(AppTypography.caption())
                .foregroundColor(AppColors.textGray)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, AppSpacing.xxl)
    }
}
