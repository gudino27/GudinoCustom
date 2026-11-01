//
//  NotificationModels.swift
//  GCWadmin
//
//  In-app notifications
//

import Foundation

struct AppNotification: Decodable, Identifiable {
    let id: Int
    let type: String
    let title: String
    let body: String?
    let entryId: Int?
    let readAt: String?
    let createdAt: String

    var isUnread: Bool { readAt == nil }
}

struct NotificationsResponse: Decodable {
    let success: Bool
    let notifications: [AppNotification]
    let unreadCount: Int
}
