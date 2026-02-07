//
//  EmployeeAuditModal.swift
//  GCWadmin
//
//  Modal for viewing employee's complete time entry history
//

import SwiftUI

struct EmployeeAuditModal: View {
    @ObservedObject var viewModel: TimeClockAdminViewModel
    @Environment(\.dismiss) var dismiss

    @State private var selectedFilter: FilterType = .all
    @State private var searchText = ""

    enum FilterType: String, CaseIterable {
        case all = "All"
        case manual = "Manual"
        case clock = "Clock"
        case modified = "Modified"
    }

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Filter Bar
                filterBar

                // Entries List
                if filteredEntries.isEmpty {
                    emptyState
                } else {
                    entriesList
                }
            }
            .navigationTitle("Employee Audit")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") {
                        dismiss()
                    }
                }
            }
        }
    }

    // MARK: - Filter Bar

    private var filterBar: some View {
        VStack(spacing: AppSpacing.md) {
            // Search Bar
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(AppColors.textGray)

                TextField("Search notes...", text: $searchText)
                    .font(AppTypography.body())

                if !searchText.isEmpty {
                    Button(action: { searchText = "" }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(AppColors.textGray)
                    }
                }
            }
            .padding(AppSpacing.sm)
            .background(Color.white)
            .cornerRadius(AppRadius.lg)

            // Filter Chips
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: AppSpacing.sm) {
                    ForEach(FilterType.allCases, id: \.self) { filter in
                        filterChip(filter)
                    }
                }
            }

            // Summary Stats
            summaryStats
        }
        .padding(AppSpacing.base)
        .background(AppColors.background)
    }

    private func filterChip(_ filter: FilterType) -> some View {
        Button(action: { selectedFilter = filter }) {
            HStack(spacing: AppSpacing.xs) {
                if filter == selectedFilter {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 14))
                }
                Text(filter.rawValue)
                    .font(AppTypography.caption())
            }
            .foregroundColor(filter == selectedFilter ? .white : AppColors.text)
            .padding(.horizontal, AppSpacing.base)
            .padding(.vertical, AppSpacing.sm)
            .background(filter == selectedFilter ? AppColors.blue : Color.white)
            .cornerRadius(AppRadius.full)
            .overlay(
                RoundedRectangle(cornerRadius: AppRadius.full)
                    .stroke(filter == selectedFilter ? Color.clear : AppColors.border, lineWidth: 1)
            )
        }
    }

    private var summaryStats: some View {
        HStack(spacing: AppSpacing.lg) {
            statBadge(
                icon: "clock.fill",
                value: "\(filteredEntries.count)",
                label: "Entries"
            )

            statBadge(
                icon: "hourglass",
                value: String(format: "%.1f", totalHours),
                label: "Hours"
            )

            if manualEntryCount > 0 {
                statBadge(
                    icon: "hand.raised.fill",
                    value: "\(manualEntryCount)",
                    label: "Manual"
                )
            }

            if modifiedEntryCount > 0 {
                statBadge(
                    icon: "pencil.circle.fill",
                    value: "\(modifiedEntryCount)",
                    label: "Modified"
                )
            }
        }
    }

    private func statBadge(icon: String, value: String, label: String) -> some View {
        HStack(spacing: AppSpacing.xs) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundColor(AppColors.blue)

            VStack(alignment: .leading, spacing: 0) {
                Text(value)
                    .font(AppTypography.bodyBold())
                    .foregroundColor(AppColors.text)

                Text(label)
                    .font(AppTypography.small())
                    .foregroundColor(AppColors.textGray)
            }
        }
        .padding(.horizontal, AppSpacing.sm)
        .padding(.vertical, AppSpacing.xs)
        .background(Color.white)
        .cornerRadius(AppRadius.md)
    }

    // MARK: - Entries List

    private var entriesList: some View {
        ScrollView {
            LazyVStack(spacing: AppSpacing.md) {
                ForEach(filteredEntries) { entry in
                    entryCard(entry)
                }
            }
            .padding(AppSpacing.base)
        }
    }

    private func entryCard(_ entry: TimeEntry) -> some View {
        VStack(alignment: .leading, spacing: AppSpacing.md) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    Text(formatDate(entry.clockInTime))
                        .font(AppTypography.bodyBold())
                        .foregroundColor(AppColors.text)

                    HStack(spacing: AppSpacing.sm) {
                        // Entry method badge
                        if let method = entry.entryMethod {
                            HStack(spacing: AppSpacing.xs) {
                                Image(systemName: method == "manual" ? "hand.raised.fill" : "clock.fill")
                                    .font(.system(size: 12))
                                Text(method == "manual" ? "Manual" : "Clock")
                                    .font(AppTypography.small())
                            }
                            .foregroundColor(method == "manual" ? AppColors.accent : AppColors.blue)
                            .padding(.horizontal, AppSpacing.sm)
                            .padding(.vertical, 2)
                            .background((method == "manual" ? AppColors.accent : AppColors.blue).opacity(0.1))
                            .cornerRadius(AppRadius.full)
                        }

                        // Modified badge
                        if let modCount = entry.modificationCount, modCount > 0 {
                            HStack(spacing: AppSpacing.xs) {
                                Image(systemName: "pencil.circle.fill")
                                    .font(.system(size: 12))
                                Text("Edited \(modCount)x")
                                    .font(AppTypography.small())
                            }
                            .foregroundColor(AppColors.errorMedium)
                            .padding(.horizontal, AppSpacing.sm)
                            .padding(.vertical, 2)
                            .background(AppColors.errorMedium.opacity(0.1))
                            .cornerRadius(AppRadius.full)
                        }
                    }
                }

                Spacer()

                // Edit button
                Button(action: { openEditEntry(entry) }) {
                    Image(systemName: "pencil.circle.fill")
                        .font(.system(size: 24))
                        .foregroundColor(AppColors.blue)
                }
            }

            Divider()

            // Time details
            VStack(spacing: AppSpacing.sm) {
                timeRow(
                    icon: "clock.arrow.circlepath",
                    label: "Clock In",
                    value: formatTime(entry.clockInTime)
                )

                if let clockOut = entry.clockOutTime {
                    timeRow(
                        icon: "clock.badge.checkmark",
                        label: "Clock Out",
                        value: formatTime(clockOut)
                    )
                } else {
                    HStack {
                        Image(systemName: "clock.badge.exclamationmark")
                            .foregroundColor(AppColors.errorMedium)
                            .frame(width: 24)
                        Text("Still clocked in")
                            .font(AppTypography.small())
                            .foregroundColor(AppColors.errorMedium)
                    }
                }

                if entry.breakMinutes > 0 {
                    timeRow(
                        icon: "cup.and.saucer.fill",
                        label: "Break",
                        value: "\(entry.breakMinutes) min"
                    )
                }

                if let totalHours = entry.totalHours {
                    Divider()
                    timeRow(
                        icon: "hourglass",
                        label: "Total Hours",
                        value: String(format: "%.2f hrs", totalHours),
                        highlight: true
                    )
                }
            }

            // Notes
            if let notes = entry.notes, !notes.isEmpty {
                Divider()

                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    Text("Notes")
                        .font(AppTypography.small())
                        .foregroundColor(AppColors.textGray)

                    Text(notes)
                        .font(AppTypography.caption())
                        .foregroundColor(AppColors.text)
                }
            }
        }
        .padding(AppSpacing.base)
        .background(Color.white)
        .cornerRadius(AppRadius.lg)
        .shadow(color: Color.black.opacity(0.05), radius: 4, x: 0, y: 2)
    }

    private func timeRow(icon: String, label: String, value: String, highlight: Bool = false) -> some View {
        HStack {
            Image(systemName: icon)
                .foregroundColor(highlight ? AppColors.success : AppColors.blue)
                .frame(width: 24)

            Text(label)
                .font(AppTypography.small())
                .foregroundColor(AppColors.textGray)

            Spacer()

            Text(value)
                .font(highlight ? AppTypography.bodyBold() : AppTypography.body())
                .foregroundColor(highlight ? AppColors.success : AppColors.text)
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: AppSpacing.lg) {
            Image(systemName: "clock.badge.questionmark")
                .font(.system(size: 64))
                .foregroundColor(AppColors.textGray)

            Text("No entries found")
                .font(AppTypography.headline())
                .foregroundColor(AppColors.text)

            Text("Try adjusting your filters or search")
                .font(AppTypography.caption())
                .foregroundColor(AppColors.textGray)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(AppSpacing.xxxxl)
    }

    // MARK: - Filtered Entries

    private var filteredEntries: [TimeEntry] {
        var entries = viewModel.auditEmployeeEntries

        // Apply filter
        switch selectedFilter {
        case .all:
            break
        case .manual:
            entries = entries.filter { $0.entryMethod == "manual" }
        case .clock:
            entries = entries.filter { $0.entryMethod == "clock" || $0.entryMethod == nil }
        case .modified:
            entries = entries.filter { ($0.modificationCount ?? 0) > 0 }
        }

        // Apply search
        if !searchText.isEmpty {
            entries = entries.filter { entry in
                if let notes = entry.notes {
                    return notes.localizedCaseInsensitiveContains(searchText)
                }
                return false
            }
        }

        return entries
    }

    // MARK: - Computed Properties

    private var totalHours: Double {
        filteredEntries.compactMap { $0.totalHours }.reduce(0, +)
    }

    private var manualEntryCount: Int {
        filteredEntries.filter { $0.entryMethod == "manual" }.count
    }

    private var modifiedEntryCount: Int {
        filteredEntries.filter { ($0.modificationCount ?? 0) > 0 }.count
    }

    // MARK: - Actions

    private func openEditEntry(_ entry: TimeEntry) {
        viewModel.openEditEntry(entry)
    }

    // MARK: - Helpers

    private func formatDate(_ timestamp: String) -> String {
        let components = timestamp.components(separatedBy: " ")
        return components.first ?? timestamp
    }

    private func formatTime(_ timestamp: String) -> String {
        let components = timestamp.components(separatedBy: " ")
        guard components.count > 1 else { return timestamp }
        let time = components[1]
        // Convert to 12-hour format
        let parts = time.components(separatedBy: ":")
        guard parts.count >= 2,
              let hour = Int(parts[0]),
              let minute = Int(parts[1]) else {
            return time
        }

        let period = hour >= 12 ? "PM" : "AM"
        let displayHour = hour == 0 ? 12 : (hour > 12 ? hour - 12 : hour)
        return String(format: "%d:%02d %@", displayHour, minute, period)
    }
}
