//
//  SmsRoutingService.swift
//  GCWadmin
//
//  API service for SMS Routing endpoints
//

import Foundation

class SmsRoutingService {
    static let shared = SmsRoutingService()
    private let apiClient = APIClient.shared

    private init() {}

    // MARK: - Settings

    func getSettings() async throws -> [SmsRoutingSetting] {
        return try await apiClient.get("/api/admin/sms-routing/settings")
    }

    func updateSetting(messageType: String, isEnabled: Int, routingMode: String) async throws -> MessageResponse {
        let body: [String: Any] = [
            "is_enabled": isEnabled,
            "routing_mode": routingMode
        ]
        return try await apiClient.put("/api/admin/sms-routing/settings/\(messageType)", body: body)
    }

    // MARK: - Recipients

    func getRecipients(messageType: String? = nil) async throws -> [SmsRecipient] {
        var endpoint = "/api/admin/sms-routing/recipients"
        if let messageType = messageType {
            let encoded = messageType.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? messageType
            endpoint += "?messageType=\(encoded)"
        }
        return try await apiClient.get(endpoint)
    }

    func addRecipient(messageType: String, employeeId: Int?, phoneNumber: String, name: String, priorityOrder: Int) async throws -> MessageResponse {
        var body: [String: Any] = [
            "message_type": messageType,
            "phone_number": phoneNumber,
            "name": name,
            "priority_order": priorityOrder
        ]
        if let employeeId = employeeId {
            body["employee_id"] = employeeId
        }
        return try await apiClient.post("/api/admin/sms-routing/recipients", body: body)
    }

    func updateRecipient(id: Int, name: String, phoneNumber: String, priorityOrder: Int, isActive: Int) async throws -> MessageResponse {
        let body: [String: Any] = [
            "name": name,
            "phone_number": phoneNumber,
            "priority_order": priorityOrder,
            "is_active": isActive
        ]
        return try await apiClient.put("/api/admin/sms-routing/recipients/\(id)", body: body)
    }

    func deleteRecipient(id: Int) async throws -> MessageResponse {
        return try await apiClient.delete("/api/admin/sms-routing/recipients/\(id)")
    }

    // MARK: - History

    func getHistory(messageType: String? = nil, limit: Int = 50) async throws -> [SmsHistoryEntry] {
        var endpoint = "/api/admin/sms-routing/history?limit=\(limit)"
        if let messageType = messageType {
            let encoded = messageType.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? messageType
            endpoint += "&messageType=\(encoded)"
        }
        return try await apiClient.get(endpoint)
    }

    // MARK: - Test

    func testRouting(messageType: String, message: String) async throws -> SmsTestResponse {
        let body: [String: Any] = ["message": message]
        return try await apiClient.post("/api/admin/sms-routing/test/\(messageType)", body: body)
    }
}
