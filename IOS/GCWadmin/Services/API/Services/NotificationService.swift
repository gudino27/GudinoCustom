//
//  NotificationService.swift
//  GCWadmin
//
//  API service for in-app notifications
//

import Foundation

class NotificationService {
    static let shared = NotificationService()
    private let apiClient = APIClient.shared

    private init() {}

    private struct MessageResponse: Decodable {
        let message: String
    }

    func getNotifications() async throws -> NotificationsResponse {
        return try await apiClient.get("/api/notifications")
    }

    func markRead(id: Int) async throws {
        let _: MessageResponse = try await apiClient.post("/api/notifications/\(id)/read")
    }

    func markAllRead() async throws {
        let _: MessageResponse = try await apiClient.post("/api/notifications/read-all")
    }
}
