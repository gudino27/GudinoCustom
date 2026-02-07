//
//  EmployeeManualEntryModal.swift
//  GCWadmin
//
//  Employee modal for adding manual time entries (no employee dropdown)
//

import SwiftUI

struct EmployeeManualEntryModal: View {
    @ObservedObject var viewModel: TimeClockViewModel
    @Binding var isPresented: Bool
    var preselectedDate: Date?

    @Environment(\.dismiss) var dismiss

    @State private var date = Date()
    @State private var clockInTime = Date()
    @State private var clockOutTime = Date()
    @State private var breakMinutes = "0"

    init(viewModel: TimeClockViewModel, isPresented: Binding<Bool>, preselectedDate: Date? = nil) {
        self.viewModel = viewModel
        self._isPresented = isPresented
        self.preselectedDate = preselectedDate
        self._date = State(initialValue: preselectedDate ?? Date())
    }

    var body: some View {
        NavigationView {
            Form {
                // Date Section
                Section("Date") {
                    DatePicker(
                        "Select Date",
                        selection: $date,
                        in: ...Date(),
                        displayedComponents: .date
                    )
                    .datePickerStyle(.compact)
                }

                // Time Section
                Section("Time") {
                    DatePicker(
                        "Clock In",
                        selection: $clockInTime,
                        displayedComponents: .hourAndMinute
                    )

                    DatePicker(
                        "Clock Out",
                        selection: $clockOutTime,
                        displayedComponents: .hourAndMinute
                    )

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

                // Preview Section
                if isValid {
                    Section("Preview") {
                        previewSection
                    }
                }
            }
            .navigationTitle("Add Missed Time")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Submit") {
                        Task {
                            await submitEntry()
                        }
                    }
                    .disabled(!isValid || viewModel.actionInProgress)
                }
            }
        }
    }

    // MARK: - Preview Section

    private var previewSection: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            previewRow(label: "Date", value: formatDate(date), icon: "calendar")

            previewRow(label: "Clock In", value: formatTime(clockInTime), icon: "clock.arrow.circlepath")

            previewRow(label: "Clock Out", value: formatTime(clockOutTime), icon: "clock.badge.checkmark")

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
        guard clockOutTime > clockInTime else { return false }
        guard date <= Date() else { return false }
        return true
    }

    // MARK: - Actions

    private func submitEntry() async {
        // Format date as "YYYY-MM-DD"
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"
        let dateString = dateFormatter.string(from: date)

        // Format times as "HH:MM"
        let timeFormatter = DateFormatter()
        timeFormatter.dateFormat = "HH:mm"
        let clockInString = timeFormatter.string(from: clockInTime)
        let clockOutString = timeFormatter.string(from: clockOutTime)

        // Create request (userId will be filled from auth context)
        viewModel.manualEntryForm.date = dateString
        viewModel.manualEntryForm.timeIn = clockInString
        viewModel.manualEntryForm.timeOut = clockOutString
        viewModel.manualEntryForm.breakMinutes = Int(breakMinutes) ?? 0
        viewModel.manualEntryForm.notes = "[Manual Entry] Employee added missed time"

        await viewModel.submitManualEntry()

        if viewModel.errorMessage == nil {
            dismiss()
        }
    }

    // MARK: - Helpers

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: date)
    }

    private func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    private func calculateTotalHours() -> Double? {
        let timeInterval = clockOutTime.timeIntervalSince(clockInTime)
        let breakMins = Double(breakMinutes) ?? 0
        let totalMinutes = (timeInterval / 60) - breakMins
        return totalMinutes / 60.0
    }
}
