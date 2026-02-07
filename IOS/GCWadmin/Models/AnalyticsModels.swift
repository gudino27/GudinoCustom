//
//  AnalyticsModels.swift
//  GCWadmin
//
//  Models for Analytics Dashboard
//

import Foundation

// MARK: - Dashboard Response

struct AnalyticsDashboardData: Codable {
    let overview: AnalyticsOverview
    let conversionFunnel: [FunnelStage]
    let leadSources: [LeadSource]
    let deviceBreakdown: [DeviceEntry]
    let pageViews: [PageViewEntry]
    let realTime: RealtimeStats

    // APIClient uses .convertFromSnakeCase, so no explicit raw values needed
    enum CodingKeys: String, CodingKey {
        case overview, conversionFunnel, leadSources, deviceBreakdown, pageViews, realTime
    }
}

// MARK: - Overview

struct AnalyticsOverview: Codable {
    let totalVisitors: Int
    let totalPageViews: Int
    let designsCreated: Int
    let quotesRequested: Int
    let conversionRate: Double

    // APIClient uses .convertFromSnakeCase, so no explicit raw values needed
    enum CodingKeys: String, CodingKey {
        case totalVisitors, totalPageViews, designsCreated, quotesRequested, conversionRate
    }

    // Custom decoder to handle conversionRate as String or Double
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        totalVisitors = try container.decode(Int.self, forKey: .totalVisitors)
        totalPageViews = try container.decode(Int.self, forKey: .totalPageViews)
        designsCreated = try container.decode(Int.self, forKey: .designsCreated)
        quotesRequested = try container.decode(Int.self, forKey: .quotesRequested)

        // conversionRate may come as String (e.g. "3.45") or Double from backend
        if let doubleValue = try? container.decode(Double.self, forKey: .conversionRate) {
            conversionRate = doubleValue
        } else if let stringValue = try? container.decode(String.self, forKey: .conversionRate),
                  let parsed = Double(stringValue) {
            conversionRate = parsed
        } else {
            conversionRate = 0.0
        }
    }
}

// MARK: - Funnel Stage

struct FunnelStage: Codable, Identifiable {
    var id: String { stage }
    let stage: String
    let count: Int

    enum CodingKeys: String, CodingKey {
        case stage, count
    }
}

// MARK: - Lead Source

struct LeadSource: Codable, Identifiable {
    var id: String { source }
    let source: String
    let count: Int

    enum CodingKeys: String, CodingKey {
        case source, count
    }
}

// MARK: - Device Entry

struct DeviceEntry: Codable, Identifiable {
    var id: String { device }
    let device: String
    let count: Int

    enum CodingKeys: String, CodingKey {
        case device, count
    }
}

// MARK: - Page View Entry

struct PageViewEntry: Codable, Identifiable {
    var id: String { date }
    let date: String
    let views: Int

    enum CodingKeys: String, CodingKey {
        case date, views
    }
}

// MARK: - Realtime Stats

struct RealtimeStats: Codable {
    let activeUsers: Int?
    let recentPageViews: Int?

    enum CodingKeys: String, CodingKey {
        case activeUsers, recentPageViews
    }
}
