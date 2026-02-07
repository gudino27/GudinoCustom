//
//  DateEntriesSheet.swift
//  GCWadmin
//
//  Sheet showing time entries for a selected date
//

import SwiftUI

struct DateEntriesSheet: View {
    @ObservedObject var viewModel: TimeClockViewModel
    @Environment(\.dismiss) var dismiss

    @State private var entryToDelete: TimeEntry?
    @State private var showDeleteConfirmation = false
    @State private var entryToEdit: TimeEntry?
    @State private var showEditModal = false

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                if viewModel.selectedDateEntries.isEmpty {
                    emptyState
                } else {
                    ScrollView {
                        LazyVStack(spacing: AppSpacing.md) {
                            ForEach(viewModel.selectedDateEntries) { entry in
                                entryCard(entry)
                                    .onTapGesture {
                                        entryToEdit = entry
                                        showEditModal = true
                                    }
                                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                        Button(role: .destructive) {
                                            entryToDelete = entry
                                            showDeleteConfirmation = true
                                        } label: {
                                            Label("Delete", systemImage: "trash")
                                        }
                                    }
                            }
                        }
                        .padding(AppSpacing.base)
                    }
                }
            }
            .navigationTitle("Time Entries")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .alert("Delete Entry", isPresented: $showDeleteConfirmation) {
                Button("Cancel", role: .cancel) {}
                Button("Delete", role: .destructive) {
                    if let entry = entryToDelete {
                        Task {
                            await deleteEntry(entry)
                        }
                    }
                }
            } message: {
                Text("Are you sure you want to delete this time entry? This action cannot be undone.")
            }
            .sheet(isPresented: $showEditModal) {
                if let entry = entryToEdit {
                    EmployeeEditEntryModal(
                        viewModel: viewModel,
                        isPresented: $showEditModal,
                        entry: entry
                    )
                }
            }
        }
    }

    // MARK: - Entry Card

    private func entryCard(_ entry: TimeEntry) -> some View {
        VStack(alignment: .leading, spacing: AppSpacing.md) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    Text(formatDate(entry.clockInTime))
                        .font(AppTypography.bodyBold())
                        .foregroundColor(AppColors.text)

                    if let method = entry.entryMethod {
                        HStack(spacing: AppSpacing.xs) {
                            Image(systemName: method == "manual" ? "hand.raised.fill" : "clock.fill")
                                .font(.system(size: 12))
                            Text(method == "manual" ? "Manual Entry" : "Clock Entry")
                                .font(AppTypography.small())
                        }
                        .foregroundColor(method == "manual" ? AppColors.accent : AppColors.blue)
                    }
                }

                Spacer()

                VStack(alignment: .trailing, spacing: AppSpacing.xs) {
                    if let totalHours = entry.totalHours {
                        Text(String(format: "%.2f", totalHours))
                            .font(AppTypography.title3())
                            .fontWeight(.bold)
                            .foregroundColor(AppColors.success)
                        Text("hours")
                            .font(AppTypography.small())
                            .foregroundColor(AppColors.textGray)
                    }

                    // Delete button
                    Button(action: {
                        entryToDelete = entry
                        showDeleteConfirmation = true
                    }) {
                        Image(systemName: "trash")
                            .font(.system(size: 16))
                            .foregroundColor(AppColors.errorMedium)
                    }
                    .buttonStyle(.plain)
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

    private func timeRow(icon: String, label: String, value: String) -> some View {
        HStack {
            Image(systemName: icon)
                .foregroundColor(AppColors.blue)
                .frame(width: 24)

            Text(label)
                .font(AppTypography.small())
                .foregroundColor(AppColors.textGray)

            Spacer()

            Text(value)
                .font(AppTypography.body())
                .foregroundColor(AppColors.text)
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: AppSpacing.lg) {
            Image(systemName: "clock")
                .font(.system(size: 64))
                .foregroundColor(AppColors.textGray)

            Text("No entries for this date")
                .font(AppTypography.headline())
                .foregroundColor(AppColors.text)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(AppSpacing.xxxxl)
    }

    // MARK: - Actions

    private func deleteEntry(_ entry: TimeEntry) async {
        await viewModel.deleteEntry(entryId: entry.id)
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
