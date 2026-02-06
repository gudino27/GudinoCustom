//
//  ShowroomModels.swift
//  GCWadmin
//
//  Models for Virtual Showroom Manager
//  Matches webapp ShowroomManager.js API responses
//

import Foundation

// MARK: - Showroom Room

struct ShowroomRoom: Codable, Identifiable {
    let id: Int
    var roomNameEn: String
    var roomNameEs: String
    var roomDescriptionEn: String?
    var roomDescriptionEs: String?
    var image360Url: String?
    var thumbnailUrl: String?
    var category: String
    var isEnabled: Bool
    var isStartingRoom: Bool
    var defaultYaw: Double
    var defaultPitch: Double
    var defaultHfov: Double
    
    enum CodingKeys: String, CodingKey {
        case id, roomNameEn, roomNameEs
        case roomDescriptionEn, roomDescriptionEs
        case image360Url, thumbnailUrl, category
        case isEnabled, isStartingRoom
        case defaultYaw, defaultPitch, defaultHfov
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(Int.self, forKey: .id)
        roomNameEn = try container.decodeIfPresent(String.self, forKey: .roomNameEn) ?? ""
        roomNameEs = try container.decodeIfPresent(String.self, forKey: .roomNameEs) ?? ""
        roomDescriptionEn = try container.decodeIfPresent(String.self, forKey: .roomDescriptionEn)
        roomDescriptionEs = try container.decodeIfPresent(String.self, forKey: .roomDescriptionEs)
        image360Url = try container.decodeIfPresent(String.self, forKey: .image360Url)
        thumbnailUrl = try container.decodeIfPresent(String.self, forKey: .thumbnailUrl)
        category = try container.decodeIfPresent(String.self, forKey: .category) ?? "showroom"
        isEnabled = (try? container.decode(Bool.self, forKey: .isEnabled)) ?? true
        isStartingRoom = (try? container.decode(Bool.self, forKey: .isStartingRoom)) ?? false
        defaultYaw = (try? container.decode(Double.self, forKey: .defaultYaw)) ?? 0
        defaultPitch = (try? container.decode(Double.self, forKey: .defaultPitch)) ?? 0
        defaultHfov = (try? container.decode(Double.self, forKey: .defaultHfov)) ?? 100
    }
}

// MARK: - Showroom Settings

struct ShowroomSettings: Codable {
    var showroomVisible: Bool
    var welcomeMessageEn: String?
    var welcomeMessageEs: String?
    var navigationStyle: String?
    var vrModeEnabled: Bool
    var autoRotateEnabled: Bool
    var showCompass: Bool
    var showZoomControls: Bool
    
    enum CodingKeys: String, CodingKey {
        case showroomVisible, welcomeMessageEn, welcomeMessageEs
        case navigationStyle, vrModeEnabled, autoRotateEnabled
        case showCompass, showZoomControls
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        showroomVisible = (try? container.decode(Bool.self, forKey: .showroomVisible)) ?? false
        welcomeMessageEn = try container.decodeIfPresent(String.self, forKey: .welcomeMessageEn)
        welcomeMessageEs = try container.decodeIfPresent(String.self, forKey: .welcomeMessageEs)
        navigationStyle = try container.decodeIfPresent(String.self, forKey: .navigationStyle)
        vrModeEnabled = (try? container.decode(Bool.self, forKey: .vrModeEnabled)) ?? false
        autoRotateEnabled = (try? container.decode(Bool.self, forKey: .autoRotateEnabled)) ?? false
        showCompass = (try? container.decode(Bool.self, forKey: .showCompass)) ?? false
        showZoomControls = (try? container.decode(Bool.self, forKey: .showZoomControls)) ?? false
    }
}

// MARK: - Room Form Data

struct RoomFormData {
    var roomNameEn = ""
    var roomNameEs = ""
    var roomDescriptionEn = ""
    var roomDescriptionEs = ""
    var category = "showroom"
    var isEnabled = true
    var isStartingRoom = false
    var defaultYaw: Double = 0
    var defaultPitch: Double = 0
    var defaultHfov: Double = 100
    
    static let empty = RoomFormData()
    
    init() {}
    
    init(from room: ShowroomRoom) {
        roomNameEn = room.roomNameEn
        roomNameEs = room.roomNameEs
        roomDescriptionEn = room.roomDescriptionEn ?? ""
        roomDescriptionEs = room.roomDescriptionEs ?? ""
        category = room.category
        isEnabled = room.isEnabled
        isStartingRoom = room.isStartingRoom
        defaultYaw = room.defaultYaw
        defaultPitch = room.defaultPitch
        defaultHfov = room.defaultHfov
    }
    
    func toBody() -> [String: Any] {
        return [
            "room_name_en": roomNameEn,
            "room_name_es": roomNameEs,
            "room_description_en": roomDescriptionEn,
            "room_description_es": roomDescriptionEs,
            "category": category,
            "is_enabled": isEnabled,
            "is_starting_room": isStartingRoom,
            "default_yaw": defaultYaw,
            "default_pitch": defaultPitch,
            "default_hfov": defaultHfov
        ]
    }
}

// MARK: - API Responses

struct ShowroomMessageResponse: Codable {
    let success: Bool?
    let message: String?
    let error: String?
}

struct ShowroomSeedResponse: Codable {
    let success: Bool?
    let data: SeedData?
    let error: String?
    
    struct SeedData: Codable {
        let rooms: Int?
        let materials: Int?
        let elements: Int?
    }
}

// MARK: - Room Categories

enum RoomCategory: String, CaseIterable {
    case showroom
    case workshop
    case gallery
    
    var displayName: String {
        rawValue.capitalized
    }
}
