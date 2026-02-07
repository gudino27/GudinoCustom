//
//  ShowroomService.swift
//  GCWadmin
//
//  API service for Virtual Showroom endpoints
//  Matches webapp ShowroomManager.js API calls
//

import Foundation

class ShowroomService {
    static let shared = ShowroomService()
    private let apiClient = APIClient.shared
    
    private init() {}
    
    // MARK: - Rooms
    
    /// Get all showroom rooms
    func getRooms() async throws -> [ShowroomRoom] {
        return try await apiClient.get("/api/showroom/admin/rooms")
    }
    
    /// Create a new room (without file upload - text fields only)
    func createRoom(_ body: [String: Any]) async throws -> ShowroomMessageResponse {
        return try await apiClient.post("/api/showroom/admin/rooms", body: body)
    }
    
    /// Update room
    func updateRoom(_ id: Int, body: [String: Any]) async throws -> ShowroomMessageResponse {
        return try await apiClient.put("/api/showroom/admin/rooms/\(id)", body: body)
    }
    
    /// Delete room
    func deleteRoom(_ id: Int) async throws {
        let _: ShowroomMessageResponse = try await apiClient.delete("/api/showroom/admin/rooms/\(id)")
    }
    
    // MARK: - Settings
    
    /// Get showroom settings
    func getSettings() async throws -> ShowroomSettings {
        return try await apiClient.get("/api/showroom/admin/settings")
    }
    
    /// Update showroom settings
    func updateSettings(_ settings: ShowroomSettings) async throws -> ShowroomMessageResponse {
        let body: [String: Any] = [
            "showroom_visible": settings.showroomVisible,
            "welcome_message_en": settings.welcomeMessageEn ?? "",
            "welcome_message_es": settings.welcomeMessageEs ?? "",
            "navigation_style": settings.navigationStyle ?? "dropdown",
            "vr_mode_enabled": settings.vrModeEnabled,
            "auto_rotate_enabled": settings.autoRotateEnabled,
            "show_compass": settings.showCompass,
            "show_zoom_controls": settings.showZoomControls
        ]
        return try await apiClient.put("/api/showroom/admin/settings", body: body)
    }
    
    // MARK: - Demo Data
    
    /// Seed demo data
    func seedDemo() async throws -> ShowroomSeedResponse {
        return try await apiClient.post("/api/showroom/admin/seed-demo", body: [:])
    }
    
    /// Clear all showroom data
    func clearDemo() async throws -> ShowroomMessageResponse {
        return try await apiClient.delete("/api/showroom/admin/clear-demo")
    }
}
