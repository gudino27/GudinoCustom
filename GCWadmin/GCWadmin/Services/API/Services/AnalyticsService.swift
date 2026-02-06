//
//  AnalyticsService.swift
//  GCWadmin
//
//  API service for Analytics endpoints
//

import Foundation

class AnalyticsService {
    static let shared = AnalyticsService()
    private let apiClient = APIClient.shared

    private init() {}

    // MARK: - Dashboard

    func getDashboard(range: String = "30d") async throws -> AnalyticsDashboardData {
        return try await apiClient.get("/api/analytics/dashboard?range=\(range)")
    }
}
