//
//  NotificationsView.swift
//  GCWadmin
//
//  Time changes, approvals and security alerts in one list
//

import SwiftUI

struct NotificationsView: View {
    @State private var notifications: [AppNotification] = []
    @State private var unreadCount = 0
    @State private var errorMessage: String?
    @State private var filter = "all"

    private let service = NotificationService.shared

    var body: some View {
        List {
            if let errorMessage {
                Text(errorMessage)
                    .foregroundColor(AppColors.error)
            } else if notifications.isEmpty {
                Text("Nothing here yet.")
                    .foregroundColor(AppColors.textGray)
            } else {
                Picker("Show", selection: $filter) {
                    ForEach(filters, id: \.self) { name in
                        Text(label(for: name)).tag(name)
                    }
                }

                if visible.isEmpty {
                    Text("Nothing matches this filter.")
                        .foregroundColor(AppColors.textGray)
                }
            }

            ForEach(visible) { notification in
                row(notification)
                    .onTapGesture {
                        Task { await markRead(notification) }
                    }
            }
        }
        .navigationTitle("Notifications")
        .toolbar {
            if unreadCount > 0 {
                ToolbarItem(placement: .primaryAction) {
                    Button("Mark all read") {
                        Task { await markAllRead() }
                    }
                }
            }
        }
        .task { await load() }
        .refreshable { await load() }
    }

    // Only offer the kinds this person actually receives
    private var filters: [String] {
        ["all", "unread"] + ["timeclock", "approval", "security"].filter { type in
            notifications.contains { $0.type == type }
        }
    }

    private var visible: [AppNotification] {
        notifications.filter { notification in
            switch filter {
            case "all": return true
            case "unread": return notification.isUnread
            default: return notification.type == filter
            }
        }
    }

    private func label(for name: String) -> String {
        switch name {
        case "all": return "All"
        case "unread": return "Unread"
        case "timeclock": return "My time"
        case "approval": return "Approvals"
        default: return "Security"
        }
    }

    private func row(_ notification: AppNotification) -> some View {
        HStack(alignment: .top, spacing: AppSpacing.sm) {
            Image(systemName: icon(for: notification.type))
                .foregroundColor(notification.type == "security" ? AppColors.error : AppColors.blue)
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 4) {
                Text(notification.title)
                    .font(notification.isUnread ? AppTypography.bodyBold() : AppTypography.body())
                    .foregroundColor(AppColors.text)

                if let body = notification.body {
                    Text(body)
                        .font(AppTypography.small())
                        .foregroundColor(AppColors.textGray)
                }

                Text(formatDate(notification.createdAt))
                    .font(AppTypography.small())
                    .foregroundColor(AppColors.textGray)
            }
        }
        .opacity(notification.isUnread ? 1 : 0.6)
        .contentShape(Rectangle())
    }

    private func icon(for type: String) -> String {
        switch type {
        case "security": return "exclamationmark.shield.fill"
        case "approval": return "checklist"
        default: return "clock"
        }
    }

    private func load() async {
        do {
            let response = try await service.getNotifications()
            notifications = response.notifications
            unreadCount = response.unreadCount
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func markRead(_ notification: AppNotification) async {
        guard notification.isUnread else { return }
        try? await service.markRead(id: notification.id)
        await load()
    }

    private func markAllRead() async {
        try? await service.markAllRead()
        await load()
    }

    private func formatDate(_ timestamp: String) -> String {
        let parser = DateFormatter()
        parser.dateFormat = "yyyy-MM-dd HH:mm:ss"
        parser.timeZone = TimeZone(identifier: "UTC")
        guard let date = parser.date(from: timestamp) else { return timestamp }

        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}
