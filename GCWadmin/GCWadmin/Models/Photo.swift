//
//  Photo.swift
//  GCWadmin
//
//  Photo models for gallery management
//

import Foundation

// MARK: - Photo Category

enum PhotoCategory: String, CaseIterable, Codable {
    case kitchen = "kitchen"
    case bathroom = "bathroom"
    case livingroom = "livingroom"
    case bedroom = "bedroom"
    case laundryroom = "laundryroom"
    case showcase = "showcase"

    var displayName: String {
        switch self {
        case .kitchen: return "Kitchen"
        case .bathroom: return "Bathroom"
        case .livingroom: return "Living Room"
        case .bedroom: return "Bedroom"
        case .laundryroom: return "Laundry Room"
        case .showcase: return "Showcase"
        }
    }

    var icon: String {
        switch self {
        case .kitchen: return "🍳"
        case .bathroom: return "🚿"
        case .livingroom: return "🛋️"
        case .bedroom: return "🛏️"
        case .laundryroom: return "🧺"
        case .showcase: return "✨"
        }
    }
}

// MARK: - Photo Type

enum PhotoType: String, Codable {
    case regular = "regular"
    case before = "before"
    case after = "after"
}

// MARK: - Photo Model

struct Photo: Codable, Identifiable {
    let id: Int
    var title: String
    let filename: String?
    let originalName: String?
    var category: String
    let filePath: String?
    let thumbnailPath: String?
    let fileSize: Int?
    let mimeType: String?
    let width: Int?
    let height: Int?
    var featured: Bool
    var displayOrder: Int?
    var photoType: String?
    var comparisonPairId: Int?
    let uploadedAt: String?

    // Computed URLs (provided by backend)
    var url: String
    var full: String?
    var thumbnail: String?

    var isVideo: Bool {
        mimeType?.hasPrefix("video/") ?? false
    }

    var categoryEnum: PhotoCategory? {
        PhotoCategory(rawValue: category)
    }

    var photoTypeEnum: PhotoType? {
        guard let photoType = photoType else { return nil }
        return PhotoType(rawValue: photoType)
    }

    // APIClient uses .convertFromSnakeCase - no explicit snake_case raw values needed
    enum CodingKeys: String, CodingKey {
        case id, title, filename, category, featured, url, full, thumbnail, width, height
        case originalName, filePath, thumbnailPath, fileSize, mimeType
        case displayOrder, photoType, comparisonPairId, uploadedAt
    }
}

// MARK: - Photo Upload Response

struct PhotoUploadResponse: Codable {
    let success: Bool
    let photo: Photo
}
