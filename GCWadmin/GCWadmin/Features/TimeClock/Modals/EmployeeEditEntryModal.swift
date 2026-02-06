//
//  EmployeeEditEntryModal.swift
//  GCWadmin
//
//  Modal for employees to edit their own time entries
//

import SwiftUI

struct EmployeeEditEntryModal: View {
    @ObservedObject var viewModel: TimeClockViewModel
    @Binding var isPresented: Bool
    let entry: TimeEntry

    @Environment(\.dismiss) var dismiss

    @State private var clockInDate = Date()
    @State private var clockInTime = Date()
    @State private var clockOutDate = Date()
    @State private var clockOutTime = Date()
    @State private var breakMinutes = "0"
    @State private var notes = ""

    var body: some View {
        NavigationView {
            Form {
                // Entry Info
                Section("Entry Information") {
                    HStack {
                        Text("Date")
                        Spacer()
                        Text(formatDate(entry.clockInTime))
                            .foregroundColor(AppColors.textGray)
                    }

                    if let method = entry.entryMethod {
                        HStack {
                            Image(systemName: method == "manual" ? "hand.raised.fill" : "clock.fill")
                                .foregroundColor(method == "manual" ? AppColors.accent : AppColors.blue)
                            Text(method == "manual" ? "Manual Entry" : "Clock Entry")
                                .foregroundColor(AppColors.textGray)
                        }
                    }
                }

                // Time Section
                Section("Time") {
                    DatePicker(
                        "Clock In",
                        selection: $clockInTime,
                        displayedComponents: .hourAndMinute
                    )

                    if entry.clockOutTime != nil {
                        DatePicker(
                            "Clock Out",
                            selection: $clockOutTime,
                            displayedComponents: .hourAndMinute
                        )
                    }

                    Text("Times are displayed in 12-hour format")
                        .font(AppTypography.small())
                        .foregroundColor(AppColors.textGray)
                }

                // Break Section
                Section("Break Time") {
                    HStack {
                        Text("Break Minutes")
                        Spacer()
                        TextField("0", text: $breakMinutes)
                            .keyboardType(.numberPad)
                            .multilineTextAlignment(.trailing)
                            .frame(width: 60)
                        Text("min")
                            .foregroundColor(AppColors.textGray)
                    }
                }

                // Notes Section
                Section("Notes") {
                    TextEditor(text: $notes)
                        .frame(minHeight: 60)
                        .font(AppTypography.body())
                }

                // Preview Section
                if isValid {
                    Section("Preview") {
                        previewSection
                    }
                }
            }
            .navigationTitle("Edit Entry")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task {
                            await saveChanges()
                        }
                    }
                    .disabled(!isValid || viewModel.actionInProgress)
                }
            }
        }
        .onAppear {
            loadEntry()
        }
    }

    // MARK: - Preview Section

    private var previewSection: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            previewRow(label: "Clock In", value: formatTimeDisplay(clockInTime), icon: "clock.arrow.circlepath")

            if entry.clockOutTime != nil {
                previewRow(label: "Clock Out", value: formatTimeDisplay(clockOutTime), icon: "clock.badge.checkmark")
            }

            if let breakMins = Int(breakMinutes), breakMins > 0 {
                previewRow(label: "Break", value: "\(breakMins) minutes", icon: "cup.and.saucer.fill")
            }

            if let totalHours = calculateTotalHours() {
                Divider()
                previewRow(
                    label: "Total Hours",
                    value: String(format: "%.2f hours", totalHours),
                    icon: "hourglass",
                    highlight: true
                )
            }
        }
    }

    private func previewRow(label: String, value: String, icon: String, highlight: Bool = false) -> some View {
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

    // MARK: - Validation

    private var isValid: Bool {
        if entry.clockOutTime != nil {
            guard clockOutTime > clockInTime else { return false }
        }
        return true
    }

    // MARK: - Actions

    private func loadEntry() {
        // Parse clock in time
        if let parsedClockIn = parseTimestamp(entry.clockInTime) {
            clockInDate = parsedClockIn
            clockInTime = parsedClockIn
        }

        // Parse clock out time if exists
        if let clockOut = entry.clockOutTime,
           let parsedClockOut = parseTimestamp(clockOut) {
            clockOutDate = parsedClockOut
            clockOutTime = parsedClockOut
        }

        breakMinutes = "\(entry.breakMinutes)"
        notes = entry.notes ?? ""
    }

    private func saveChanges() async {
        // Format times
        let timeFormatter = DateFormatter()
        timeFormatter.dateFormat = "HH:mm"

        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"
        let dateString = formatDate(entry.clockInTime)

        let clockInString = timeFormatter.string(from: clockInTime)
        let clockInFull = "\(dateString) \(clockInString):00"

        var clockOutFull: String? = nil
        if entry.clockOutTime != nil {
            let clockOutString = timeFormatter.string(from: clockOutTime)
            clockOutFull = "\(dateString) \(clockOutString):00"
        }

        // Update via admin endpoint (employees can edit their own entries)
        do {
            let request = EditEntryRequest(
                clockInTime: clockInFull,
                clockOutTime: clockOutFull,
                breakMinutes: Int(breakMinutes) ?? 0,
                notes: notes.isEmpty ? nil : notes
            )

            try await TimeClockService.shared.editEntry(entryId: entry.id, request: request)

            // Refresh calendar entries
            await viewModel.loadCalendarEntries()

            // Refresh selected date entries if viewing them
            if !viewModel.selectedDateEntries.isEmpty {
                // Refresh to get updated entry
                await viewModel.fetchStatus()
            }

            dismiss()
        } catch {
            print("❌ Failed to edit entry: \(error)")
            viewModel.errorMessage = "Failed to update entry. Please try again."
        }
    }

    // MARK: - Helpers

    private func parseTimestamp(_ timestamp: String) -> Date? {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
        formatter.timeZone = TimeZone(identifier: "America/Los_Angeles")
        return formatter.date(from: timestamp)
    }

    private func formatDate(_ timestamp: String) -> String {
        let components = timestamp.components(separatedBy: " ")
        return components.first ?? timestamp
    }

    private func formatTimeDisplay(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    private func calculateTotalHours() -> Double? {
        guard entry.clockOutTime != nil else { return nil }

        let timeInterval = clockOutTime.timeIntervalSince(clockInTime)
        let breakMins = Double(breakMinutes) ?? 0
        let totalMinutes = (timeInterval / 60) - breakMins
        return totalMinutes / 60.0
    }
}
