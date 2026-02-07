//
//  Testimonial.swift
//  GCWadmin
//
//  Models for Testimonial Management
//

import Foundation
import SwiftUI

// MARK: - Testimonial Model

struct Testimonial: Codable, Identifiable {
    let id: Int
    var clientName: String
    var clientEmail: String?
    var message: String
    var rating: Int
    var projectType: String?
    var isVisible: Bool
    var tokenId: Int?
    let createdAt: String?
    var approvedAt: String?
    var approvedBy: Int?
    var photos: [TestimonialPhoto]?

    // APIClient uses .convertFromSnakeCase, so no explicit raw values needed
    enum CodingKeys: String, CodingKey {
        case id, clientName, clientEmail, message, rating, projectType
        case isVisible, tokenId, createdAt, approvedAt, approvedBy, photos
    }

    // Custom decoder to handle SQLite 0/1 for isVisible
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(Int.self, forKey: .id)
        clientName = try container.decode(String.self, forKey: .clientName)
        clientEmail = try container.decodeIfPresent(String.self, forKey: .clientEmail)
        message = try container.decodeIfPresent(String.self, forKey: .message) ?? ""
        rating = try container.decodeIfPresent(Int.self, forKey: .rating) ?? 5
        projectType = try container.decodeIfPresent(String.self, forKey: .projectType)
        tokenId = try container.decodeIfPresent(Int.self, forKey: .tokenId)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
        approvedAt = try container.decodeIfPresent(String.self, forKey: .approvedAt)
        approvedBy = try container.decodeIfPresent(Int.self, forKey: .approvedBy)
        photos = try container.decodeIfPresent([TestimonialPhoto].self, forKey: .photos)

        // Handle isVisible as Bool or Int (SQLite returns 0/1)
        if let boolVal = try? container.decode(Bool.self, forKey: .isVisible) {
            isVisible = boolVal
        } else if let intVal = try? container.decode(Int.self, forKey: .isVisible) {
            isVisible = intVal != 0
        } else {
            isVisible = false
        }
    }

    // MARK: - Computed Properties

    var starsDisplay: String {
        String(repeating: "\u{2605}", count: rating) + String(repeating: "\u{2606}", count: 5 - rating)
    }

    var projectTypeLabel: String {
        guard let type = projectType, !type.isEmpty else { return "General" }
        switch type.lowercased() {
        case "kitchen_remodeling", "kitchen remodeling": return "Kitchen Remodeling"
        case "bathroom_remodeling", "bathroom remodeling": return "Bathroom Remodeling"
        case "cabinet_installation", "cabinet installation": return "Cabinet Installation"
        case "custom_woodwork", "custom woodwork": return "Custom Woodwork"
        case "other": return "Other"
        default: return type.capitalized
        }
    }

    var messagePreview: String {
        if message.count > 120 {
            return String(message.prefix(120)) + "..."
        }
        return message
    }
}

// MARK: - Testimonial Photo

struct TestimonialPhoto: Codable, Identifiable {
    let id: Int
    var testimonialId: Int?
    var filename: String?
    var originalName: String?
    var filePath: String?
    var thumbnailPath: String?
    var fileSize: Int?
    var mimeType: String?
    var width: Int?
    var height: Int?
    var displayOrder: Int?
    var uploadedAt: String?

    // APIClient uses .convertFromSnakeCase, so no explicit raw values needed
    enum CodingKeys: String, CodingKey {
        case id, testimonialId, filename, originalName, filePath, thumbnailPath
        case fileSize, mimeType, width, height, displayOrder, uploadedAt
    }

    // MARK: - Computed Properties

    var fullURL: URL? {
        guard let path = filePath, !path.isEmpty else { return nil }
        return URL(string: "\(APIConfig.baseURL)\(path)")
    }

    var thumbnailURL: URL? {
        guard let path = thumbnailPath, !path.isEmpty else { return nil }
        return URL(string: "\(APIConfig.baseURL)\(path)")
    }
}

// MARK: - Testimonial Token

struct TestimonialToken: Codable, Identifiable {
    let id: Int
    var token: String
    var clientName: String
    var clientEmail: String?
    var projectType: String?
    var sentBy: Int?
    var expiresAt: String?
    let createdAt: String?
    var usedAt: String?
    var openedCount: Int
    var firstOpenedAt: String?
    var lastOpenedAt: String?
    var status: String

    // APIClient uses .convertFromSnakeCase, so no explicit raw values needed
    enum CodingKeys: String, CodingKey {
        case id, token, clientName, clientEmail, projectType, sentBy
        case expiresAt, createdAt, usedAt, openedCount, firstOpenedAt
        case lastOpenedAt, status
    }

    // Custom decoder to handle openedCount as Int or String
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(Int.self, forKey: .id)
        token = try container.decode(String.self, forKey: .token)
        clientName = try container.decode(String.self, forKey: .clientName)
        clientEmail = try container.decodeIfPresent(String.self, forKey: .clientEmail)
        projectType = try container.decodeIfPresent(String.self, forKey: .projectType)
        sentBy = try container.decodeIfPresent(Int.self, forKey: .sentBy)
        expiresAt = try container.decodeIfPresent(String.self, forKey: .expiresAt)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
        usedAt = try container.decodeIfPresent(String.self, forKey: .usedAt)
        firstOpenedAt = try container.decodeIfPresent(String.self, forKey: .firstOpenedAt)
        lastOpenedAt = try container.decodeIfPresent(String.self, forKey: .lastOpenedAt)
        status = try container.decodeIfPresent(String.self, forKey: .status) ?? "sent"

        // Handle openedCount as Int or String from SQLite
        if let intVal = try? container.decode(Int.self, forKey: .openedCount) {
            openedCount = intVal
        } else if let strVal = try? container.decode(String.self, forKey: .openedCount),
                  let parsed = Int(strVal) {
            openedCount = parsed
        } else {
            openedCount = 0
        }
    }

    // MARK: - Computed Properties

    var isExpired: Bool {
        guard let expiresAt = expiresAt else { return false }
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = isoFormatter.date(from: expiresAt) {
            return date < Date()
        }
        let altFormatter = DateFormatter()
        altFormatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSZ"
        if let date = altFormatter.date(from: expiresAt) {
            return date < Date()
        }
        return false
    }

    var statusColor: Color {
        switch status.lowercased() {
        case "submitted": return AppColors.successMedium
        case "opened": return AppColors.warningMedium
        case "sent": return AppColors.gray500
        default: return AppColors.textGray
        }
    }

    var statusLabel: String {
        status.capitalized
    }

    var statusBgColor: Color {
        switch status.lowercased() {
        case "submitted": return AppColors.successBg
        case "opened": return AppColors.warningBg
        case "sent": return AppColors.gray50
        default: return AppColors.gray50
        }
    }
}

// MARK: - Testimonial Tracking Record

struct TestimonialTrackingRecord: Codable, Identifiable {
    let id: Int
    var token: String?
    var openedAt: String?
    var ipAddress: String?
    var userAgent: String?
    var referer: String?
    var city: String?
    var region: String?
    var country: String?
    var countryCode: String?

    // APIClient uses .convertFromSnakeCase, so no explicit raw values needed
    enum CodingKeys: String, CodingKey {
        case id, token, openedAt, ipAddress, userAgent, referer
        case city, region, country, countryCode
    }

    var locationDisplay: String {
        let parts = [city, region, country].compactMap { $0 }.filter { !$0.isEmpty }
        return parts.isEmpty ? "Unknown" : parts.joined(separator: ", ")
    }
}

// MARK: - Testimonial Tracking Response

struct TestimonialTrackingResponse: Codable {
    let records: [TestimonialTrackingRecord]
    let total: Int
    let hasMore: Bool

    // APIClient uses .convertFromSnakeCase, so no explicit raw values needed
    enum CodingKeys: String, CodingKey {
        case records, total, hasMore
    }
}

// MARK: - Testimonial Analytics

struct TestimonialAnalytics: Codable {
    var submissions: AnalyticsSubmissions?
    var dailyActivity: [DailyActivity]?
    var ratingDistribution: [RatingBucket]?
    var projectTypes: [ProjectTypeStat]?
    var linkActivity: LinkActivity?

    // APIClient uses .convertFromSnakeCase, so no explicit raw values needed
    enum CodingKeys: String, CodingKey {
        case submissions, dailyActivity, ratingDistribution, projectTypes, linkActivity
    }

    struct AnalyticsSubmissions: Codable {
        var total: Int?
        var visible: Int?
        var averageRating: Double?

        enum CodingKeys: String, CodingKey {
            case total, visible, averageRating
        }

        // Handle averageRating as Double or String
        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            total = try container.decodeIfPresent(Int.self, forKey: .total)
            visible = try container.decodeIfPresent(Int.self, forKey: .visible)
            if let dblVal = try? container.decodeIfPresent(Double.self, forKey: .averageRating) {
                averageRating = dblVal
            } else if let strVal = try? container.decodeIfPresent(String.self, forKey: .averageRating) {
                averageRating = Double(strVal)
            } else {
                averageRating = nil
            }
        }
    }

    struct DailyActivity: Codable, Identifiable {
        var id: String { date ?? UUID().uuidString }
        var date: String?
        var count: Int?

        enum CodingKeys: String, CodingKey {
            case date, count
        }
    }

    struct RatingBucket: Codable, Identifiable {
        var id: Int { rating ?? 0 }
        var rating: Int?
        var count: Int?

        enum CodingKeys: String, CodingKey {
            case rating, count
        }
    }

    struct ProjectTypeStat: Codable, Identifiable {
        var id: String { projectType ?? UUID().uuidString }
        var projectType: String?
        var count: Int?

        enum CodingKeys: String, CodingKey {
            case projectType, count
        }
    }

    struct LinkActivity: Codable {
        var totalSent: Int?
        var totalOpened: Int?
        var totalSubmitted: Int?
        var conversionRate: Double?

        enum CodingKeys: String, CodingKey {
            case totalSent, totalOpened, totalSubmitted, conversionRate
        }

        // Handle conversionRate as Double or String
        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            totalSent = try container.decodeIfPresent(Int.self, forKey: .totalSent)
            totalOpened = try container.decodeIfPresent(Int.self, forKey: .totalOpened)
            totalSubmitted = try container.decodeIfPresent(Int.self, forKey: .totalSubmitted)
            if let dblVal = try? container.decodeIfPresent(Double.self, forKey: .conversionRate) {
                conversionRate = dblVal
            } else if let strVal = try? container.decodeIfPresent(String.self, forKey: .conversionRate) {
                conversionRate = Double(strVal)
            } else {
                conversionRate = nil
            }
        }
    }
}

// MARK: - Send Testimonial Link Response

struct SendTestimonialLinkResponse: Codable {
    let success: Bool
    var token: String?
    var results: SendResults?

    // APIClient uses .convertFromSnakeCase, so no explicit raw values needed
    enum CodingKeys: String, CodingKey {
        case success, token, results
    }

    struct SendResults: Codable {
        var email: SendResultDetail?
        var sms: SendResultDetail?

        enum CodingKeys: String, CodingKey {
            case email, sms
        }
    }

    struct SendResultDetail: Codable {
        var success: Bool?
        var message: String?

        enum CodingKeys: String, CodingKey {
            case success, message
        }
    }
}

// MARK: - Testimonial Message Response

struct TestimonialMessageResponse: Codable {
    let success: Bool
    let message: String?
}
