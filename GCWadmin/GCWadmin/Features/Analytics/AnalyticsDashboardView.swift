//
//  AnalyticsDashboardView.swift
//  GCWadmin
//
//  Analytics Dashboard with Swift Charts
//

import SwiftUI
import Charts

struct AnalyticsDashboardView: View {
    @StateObject private var viewModel = AnalyticsDashboardViewModel()

    var body: some View {
        ZStack {
            AppColors.background
                .ignoresSafeArea()

            if viewModel.isLoading {
                ProgressView()
            } else {
                ScrollView {
                    VStack(spacing: AppSpacing.lg) {
                        headerSection

                        if let data = viewModel.dashboardData {
                            overviewSection(data: data.overview)
                            pageViewsChart(data: data.pageViews)
                            funnelChart(data: data.conversionFunnel)
                            deviceBreakdownChart(data: data.deviceBreakdown)
                            leadSourcesSection(data: data.leadSources)
                        } else if let error = viewModel.errorMessage {
                            errorView(error)
                        }
                    }
                    .padding(AppSpacing.lg)
                }
            }

            // Notification overlay
            if let error = viewModel.errorMessage {
                VStack {
                    Spacer()
                    notificationBanner(message: error, isError: true)
                }
                .transition(.move(edge: .bottom))
            }
        }
        .navigationTitle("Analytics")
        .navigationBarTitleDisplayMode(.large)
        .task {
            await viewModel.loadDashboard()
        }
    }

    // MARK: - Header Section

    private var headerSection: some View {
        HStack {
            Text("Dashboard")
                .font(AppTypography.title2())
                .foregroundColor(AppColors.text)

            Spacer()

            // Range Picker
            Menu {
                ForEach(viewModel.rangeOptions, id: \.value) { option in
                    Button(action: {
                        viewModel.selectedRange = option.value
                        Task {
                            await viewModel.onRangeChanged()
                        }
                    }) {
                        HStack {
                            Text(option.label)
                            if viewModel.selectedRange == option.value {
                                Image(systemName: "checkmark")
                            }
                        }
                    }
                }
            } label: {
                HStack(spacing: AppSpacing.xs) {
                    Text(viewModel.rangeOptions.first(where: { $0.value == viewModel.selectedRange })?.label ?? "30d")
                        .font(AppTypography.body())
                    Image(systemName: "chevron.down")
                        .font(.system(size: 12))
                }
                .foregroundColor(AppColors.primary)
                .padding(.horizontal, AppSpacing.md)
                .padding(.vertical, AppSpacing.sm)
                .background(
                    RoundedRectangle(cornerRadius: AppRadius.md)
                        .fill(AppColors.primary.opacity(0.1))
                )
            }
        }
    }

    // MARK: - Overview Section

    private func overviewSection(data: AnalyticsOverview) -> some View {
        VStack(spacing: AppSpacing.md) {
            Text("Overview")
                .font(AppTypography.headline())
                .foregroundColor(AppColors.text)
                .frame(maxWidth: .infinity, alignment: .leading)

            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: AppSpacing.md) {
                statCard(title: "Visitors", value: "\(data.totalVisitors)", icon: "person.2.fill")
                statCard(title: "Page Views", value: "\(data.totalPageViews)", icon: "eye.fill")
                statCard(title: "Designs", value: "\(data.designsCreated)", icon: "square.grid.3x3.fill")
                statCard(title: "Quotes", value: "\(data.quotesRequested)", icon: "doc.text.fill")
            }

            // Conversion Rate Card
            GlassCard {
                HStack {
                    Image(systemName: "chart.line.uptrend.xyaxis")
                        .font(.system(size: 24))
                        .foregroundColor(AppColors.primary)

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Conversion Rate")
                            .font(AppTypography.caption())
                            .foregroundColor(AppColors.textGray)
                        Text(String(format: "%.2f%%", data.conversionRate))
                            .font(.system(size: 28, weight: .bold))
                            .foregroundColor(AppColors.text)
                    }
                    Spacer()
                }
                .padding(AppSpacing.md)
            }
        }
    }

    private func statCard(title: String, value: String, icon: String) -> some View {
        GlassCard {
            VStack(alignment: .leading, spacing: AppSpacing.sm) {
                HStack {
                    Image(systemName: icon)
                        .foregroundColor(AppColors.primary)
                    Spacer()
                }
                Text(value)
                    .font(.system(size: 28, weight: .bold))
                    .foregroundColor(AppColors.text)
                Text(title)
                    .font(AppTypography.caption())
                    .foregroundColor(AppColors.textGray)
            }
            .padding(AppSpacing.md)
        }
    }

    // MARK: - Page Views Chart

    private func pageViewsChart(data: [PageViewEntry]) -> some View {
        GlassCard {
            VStack(alignment: .leading, spacing: AppSpacing.md) {
                Text("Page Views Over Time")
                    .font(AppTypography.headline())
                    .foregroundColor(AppColors.text)

                if data.isEmpty {
                    Text("No data available")
                        .font(AppTypography.caption())
                        .foregroundColor(AppColors.textGray)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, AppSpacing.xl)
                } else {
                    Chart(data) { entry in
                        LineMark(
                            x: .value("Date", entry.date),
                            y: .value("Views", entry.views)
                        )
                        .foregroundStyle(AppColors.primary)
                        .interpolationMethod(.catmullRom)
                    }
                    .frame(height: 200)
                    .chartXAxis {
                        AxisMarks(values: .automatic) { _ in
                            AxisValueLabel()
                                .foregroundStyle(AppColors.textGray)
                        }
                    }
                    .chartYAxis {
                        AxisMarks { _ in
                            AxisValueLabel()
                                .foregroundStyle(AppColors.textGray)
                        }
                    }
                }
            }
            .padding(AppSpacing.md)
        }
    }

    // MARK: - Funnel Chart

    private func funnelChart(data: [FunnelStage]) -> some View {
        GlassCard {
            VStack(alignment: .leading, spacing: AppSpacing.md) {
                Text("Conversion Funnel")
                    .font(AppTypography.headline())
                    .foregroundColor(AppColors.text)

                if data.isEmpty {
                    Text("No data available")
                        .font(AppTypography.caption())
                        .foregroundColor(AppColors.textGray)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, AppSpacing.xl)
                } else {
                    // Horizontal bars with stacked label + count for better mobile spacing
                    VStack(spacing: AppSpacing.sm) {
                        let maxCount = data.map(\.count).max() ?? 1
                        ForEach(data) { stage in
                            VStack(alignment: .leading, spacing: 4) {
                                HStack {
                                    Text(stage.stage)
                                        .font(AppTypography.caption())
                                        .foregroundColor(AppColors.text)
                                    Spacer()
                                    Text("\(stage.count)")
                                        .font(AppTypography.captionBold())
                                        .foregroundColor(AppColors.primary)
                                }
                                GeometryReader { geo in
                                    RoundedRectangle(cornerRadius: 4)
                                        .fill(AppColors.primary.gradient)
                                        .frame(width: geo.size.width * CGFloat(stage.count) / CGFloat(max(maxCount, 1)))
                                }
                                .frame(height: 24)
                            }
                        }
                    }
                }
            }
            .padding(AppSpacing.md)
        }
    }

    // MARK: - Device Breakdown Chart

    private func deviceBreakdownChart(data: [DeviceEntry]) -> some View {
        GlassCard {
            VStack(alignment: .leading, spacing: AppSpacing.md) {
                Text("Device Breakdown")
                    .font(AppTypography.headline())
                    .foregroundColor(AppColors.text)

                if data.isEmpty {
                    Text("No data available")
                        .font(AppTypography.caption())
                        .foregroundColor(AppColors.textGray)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, AppSpacing.xl)
                } else {
                    Chart(data) { entry in
                        SectorMark(
                            angle: .value("Count", entry.count),
                            innerRadius: .ratio(0.5),
                            angularInset: 2
                        )
                        .foregroundStyle(by: .value("Device", entry.device))
                    }
                    .frame(height: 200)
                    .chartLegend(position: .bottom, spacing: AppSpacing.sm) {
                        VStack(alignment: .leading, spacing: AppSpacing.xs) {
                            ForEach(data) { entry in
                                HStack(spacing: AppSpacing.xs) {
                                    Circle()
                                        .fill(Color.blue)
                                        .frame(width: 8, height: 8)
                                    Text("\(entry.device): \(entry.count)")
                                        .font(AppTypography.caption())
                                        .foregroundColor(AppColors.textLight)
                                }
                            }
                        }
                    }
                }
            }
            .padding(AppSpacing.md)
        }
    }

    // MARK: - Lead Sources Section

    private func leadSourcesSection(data: [LeadSource]) -> some View {
        GlassCard {
            VStack(alignment: .leading, spacing: AppSpacing.md) {
                Text("Lead Sources")
                    .font(AppTypography.headline())
                    .foregroundColor(AppColors.text)

                if data.isEmpty {
                    Text("No data available")
                        .font(AppTypography.caption())
                        .foregroundColor(AppColors.textGray)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, AppSpacing.xl)
                } else {
                    VStack(spacing: AppSpacing.sm) {
                        ForEach(data) { source in
                            HStack {
                                Text(source.source.capitalized)
                                    .font(AppTypography.body())
                                    .foregroundColor(AppColors.text)
                                Spacer()
                                Text("\(source.count)")
                                    .font(AppTypography.bodyBold())
                                    .foregroundColor(AppColors.primary)
                            }
                            .padding(.vertical, AppSpacing.xs)

                            if source.id != data.last?.id {
                                Divider()
                                    .background(AppColors.textGray.opacity(0.3))
                            }
                        }
                    }
                }
            }
            .padding(AppSpacing.md)
        }
    }

    // MARK: - Realtime Section

    private func realtimeSection(data: RealtimeStats) -> some View {
        GlassCard {
            VStack(alignment: .leading, spacing: AppSpacing.md) {
                HStack {
                    Image(systemName: "dot.radiowaves.left.and.right")
                        .foregroundColor(AppColors.primary)
                    Text("Real-time Stats")
                        .font(AppTypography.headline())
                        .foregroundColor(AppColors.text)
                }

                HStack(spacing: AppSpacing.lg) {
                    if let activeUsers = data.activeUsers {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Active Users")
                                .font(AppTypography.caption())
                                .foregroundColor(AppColors.textGray)
                            Text("\(activeUsers)")
                                .font(.system(size: 28, weight: .bold))
                                .foregroundColor(AppColors.primary)
                        }
                    }

                    if let recentViews = data.recentPageViews {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Recent Views (1h)")
                                .font(AppTypography.caption())
                                .foregroundColor(AppColors.textGray)
                            Text("\(recentViews)")
                                .font(.system(size: 28, weight: .bold))
                                .foregroundColor(AppColors.primary)
                        }
                    }

                    Spacer()
                }
            }
            .padding(AppSpacing.md)
        }
    }

    // MARK: - Error View

    private func errorView(_ message: String) -> some View {
        GlassCard {
            VStack(spacing: AppSpacing.md) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 48))
                    .foregroundColor(AppColors.error)
                Text("Error")
                    .font(AppTypography.headline())
                    .foregroundColor(AppColors.text)
                Text(message)
                    .font(AppTypography.body())
                    .foregroundColor(AppColors.textGray)
                    .multilineTextAlignment(.center)
                Button("Retry") {
                    Task {
                        await viewModel.loadDashboard()
                    }
                }
                .padding(.horizontal, AppSpacing.lg)
                .padding(.vertical, AppSpacing.sm)
                .background(AppColors.primary)
                .foregroundColor(.white)
                .cornerRadius(AppRadius.md)
            }
            .padding(AppSpacing.xl)
        }
        .padding(AppSpacing.lg)
    }

    // MARK: - Notification Banner

    private func notificationBanner(message: String, isError: Bool) -> some View {
        HStack {
            Image(systemName: isError ? "xmark.circle.fill" : "checkmark.circle.fill")
                .foregroundColor(.white)
            Text(message)
                .font(AppTypography.body())
                .foregroundColor(.white)
            Spacer()
        }
        .padding(AppSpacing.md)
        .background(isError ? AppColors.error : AppColors.success)
        .cornerRadius(AppRadius.md)
        .padding(AppSpacing.md)
        .shadow(radius: 10)
    }
}
