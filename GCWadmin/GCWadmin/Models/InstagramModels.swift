//
//  InstagramModels.swift
//  GCWadmin
//
//  Models for Instagram Feed Manager
//  Matches webapp InstagramManager.js API responses
//

import Foundation

// MARK: - Instagram Post (API token-based)

struct InstagramPost: Codable, Identifiable {
    let id: Int
    let instagramId: String?
    let mediaUrl: String?
    let permalink: String?
    let caption: String?
    let mediaType: String?
    let timestamp: String?
    var approved: Bool
    var displayOrder: Int
    
    enum CodingKeys: String, CodingKey {
        case id, instagramId, mediaUrl, permalink, caption
        case mediaType, timestamp, approved, displayOrder
    }
}

// MARK: - Instagram Settings

struct InstagramSettings: Codable {
    var tokenConfigured: Bool
    var lastFetchAt: String?
    
    enum CodingKeys: String, CodingKey {
        case tokenConfigured, lastFetchAt
    }
}

// MARK: - oEmbed Post (saved for display)

struct OEmbedPost: Codable, Identifiable {
    let id: Int
    let postId: String?
    let permalink: String?
    let mediaUrl: String?
    let caption: String?
    let timestamp: String?
    var displayOrder: Int
    
    enum CodingKeys: String, CodingKey {
        case id, postId, permalink, mediaUrl, caption
        case timestamp, displayOrder
    }
}

// MARK: - Available Post (for oEmbed selection)

struct AvailablePost: Codable, Identifiable {
    var id: String { postId }
    let postId: String
    let permalink: String?
    let mediaUrl: String?
    let caption: String?
    let timestamp: String?
    let alreadySaved: Bool
    
    enum CodingKeys: String, CodingKey {
        case postId, permalink, mediaUrl, caption
        case timestamp, alreadySaved
    }
}

// MARK: - API Response Types

struct InstagramFetchResponse: Codable {
    let success: Bool?
    let message: String?
    let error: String?
}

struct InstagramPostUpdateResponse: Codable {
    let success: Bool?
    let message: String?
}

struct OEmbedSaveResponse: Codable {
    let success: Bool?
    let message: String?
    let error: String?
}

struct OEmbedAddUrlResponse: Codable {
    let success: Bool?
    let message: String?
    let error: String?
}
