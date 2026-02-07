//
//  AnalyticsDashboardViewModel.swift
//  GCWadmin
//
//  ViewModel for Analytics Dashboard
//

import Foundation
import SwiftUI
import Combine

@MainActor
class AnalyticsDashboardViewModel: ObservableObject {
    private let analyticsService = AnalyticsService.shared

    // MARK: - Published Properties - Data

    @Published var dashboardData: AnalyticsDashboardData?

    // MARK: - Published Properties - View State

    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var selectedRange: String = "30d"

    // MARK: - Range Options

    let rangeOptions: [(label: String, value: String)] = [
        ("Last 7 Days", "7d"),
        ("Last 30 Days", "30d"),
        ("Last 90 Days", "90d"),
        ("Last Year", "1y")
    ]

    // MARK: - Load Dashboard

    func loadDashboard() async {
        isLoading = true
        errorMessage = nil

        do {
            dashboardData = try await analyticsService.getDashboard(range: selectedRange)
        } catch {
            print("Failed to load analytics dashboard: \(error)")
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    // MARK: - On Range Changed

    func onRangeChanged() async {
        await loadDashboard()
    }
}
