//
//  ManualEntryModal.swift
//  GCWadmin
//
//  Modal for adding manual time entries
//

import SwiftUI

struct ManualEntryModal: View {
    @ObservedObject var viewModel: TimeClockAdminViewModel
    @Environment(\.dismiss) var dismiss

    @State private var selectedEmployee: User?
    @State private var date = Date()
    @State private var timeIn = ""
    @State private var timeOut = ""
    @State private var breakMinutes = "0"
    @State private var notes = "[Manual Entry] "

    var body: some View {
        NavigationView {
            Form {
                // Employee Selection
                Section("Employee") {
                    if viewModel.allEmployees.isEmpty {
                        HStack {
                            ProgressView()
                            Text("Loading employees...")
                                .font(AppTypography.caption())
                                .foregroundColor(AppColors.textGray)
                        }
                    } else {
                        Picker("Select Employee", selection: $selectedEmployee) {
                            Text("Select...").tag(nil as User?)
                            ForEach(viewModel.allEmployees) { employee in
                                Text(employee.displayName).tag(employee as User?)
                            }
                        }
                    }
                }

                // Date Selection
                Section("Date") {
                    DatePicker(
                        "Date",
                        selection: $date,
                        displayedComponents: .date
                    )
                    .datePickerStyle(.compact)
                }

                // Time Entry
                Section("Time") {
                    HStack {
                        Text("Clock In")
                        Spacer()
                        TextField("09:00:00", text: $timeIn)
                            .keyboardType(.numbersAndPunctuation)
                            .multilineTextAlignment(.trailing)
                            .autocapitalization(.none)
                            .autocorrectionDisabled()
                    }

                    HStack {
                        Text("Clock Out")
                        Spacer()
                        TextField("17:00:00", text: $timeOut)
                            .keyboardType(.numbersAndPunctuation)
                            .multilineTextAlignment(.trailing)
                            .autocapitalization(.none)
                            .autocorrectionDisabled()
                    }

                    Text("Use 24-hour format: HH:MM:SS (e.g., 09:00:00)")
                        .font(AppTypography.small())
                        .foregroundColor(AppColors.textGray)
                }

                // Break Minutes
                Section("Break Time") {
                    HStack {
                        Text("Break Minutes")
                        Spacer()
                        TextField("0", text: $breakMinutes)
                            .keyboardType(.numberPad)
                            .multilineTextAlignment(.trailing)
                        Text("min")
                            .foregroundColor(AppColors.textGray)
                    }
                }

                // Notes
                Section("Notes") {
                    TextEditor(text: $notes)
                        .frame(minHeight: 100)
                        .font(AppTypography.body())
                }

                // Preview
                if isValid {
                    Section("Preview") {
                        previewSection
                    }
                }
            }
            .navigationTitle("Add Manual Entry")
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
        .onAppear {
            // Pre-select employee if set in form
            if viewModel.manualEntryForm.userId > 0 {
                selectedEmployee = viewModel.allEmployees.first { $0.id == viewModel.manualEntryForm.userId }
            }
        }
    }

    // MARK: - Preview Section

    private var previewSection: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            if let employee = selectedEmployee {
                previewRow(label: "Employee", value: employee.displayName, icon: "person.fill")
            }

            previewRow(label: "Date", value: formatDate(date), icon: "calendar")

            previewRow(label: "Clock In", value: timeIn, icon: "clock.arrow.circlepath")

            previewRow(label: "Clock Out", value: timeOut, icon: "clock.badge.checkmark")

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
        guard selectedEmployee != nil else { return false }
        guard !timeIn.isEmpty, !timeOut.isEmpty else { return false }
        guard timeIn.matches(pattern: "^\\d{2}:\\d{2}:\\d{2}$") else { return false }
        guard timeOut.matches(pattern: "^\\d{2}:\\d{2}:\\d{2}$") else { return false }
        return true
    }

    // MARK: - Actions

    private func submitEntry() async {
        guard let employee = selectedEmployee else { return }

        viewModel.manualEntryForm.userId = employee.id
        viewModel.manualEntryForm.employeeName = employee.displayName
        viewModel.manualEntryForm.date = formatDate(date)
        viewModel.manualEntryForm.timeIn = timeIn
        viewModel.manualEntryForm.timeOut = timeOut
        viewModel.manualEntryForm.breakMinutes = Int(breakMinutes) ?? 0
        viewModel.manualEntryForm.notes = notes

        await viewModel.submitManualEntry()

        if viewModel.errorMessage == nil {
            dismiss()
        }
    }

    // MARK: - Helpers

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    private func calculateTotalHours() -> Double? {
        guard let inTime = parseTime(timeIn),
              let outTime = parseTime(timeOut) else {
            return nil
        }

        let breakMins = Double(breakMinutes) ?? 0
        let totalMinutes = outTime - inTime - breakMins
        return totalMinutes / 60.0
    }

    private func parseTime(_ time: String) -> Double? {
        let components = time.components(separatedBy: ":")
        guard components.count == 3,
              let hours = Double(components[0]),
              let minutes = Double(components[1]),
              let seconds = Double(components[2]) else {
            return nil
        }
        return hours * 60 + minutes + seconds / 60
    }
}

// MARK: - String Extension

extension String {
    func matches(pattern: String) -> Bool {
        guard let regex = try? NSRegularExpression(pattern: pattern) else {
            return false
        }
        let range = NSRange(location: 0, length: self.utf16.count)
        return regex.firstMatch(in: self, range: range) != nil
    }
}
