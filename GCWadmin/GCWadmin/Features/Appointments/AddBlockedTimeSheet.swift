//
//  AddBlockedTimeSheet.swift
//  GCWadmin
//
//  Modal sheet for adding blocked time periods
//

import SwiftUI

struct AddBlockedTimeSheet: View {
    @ObservedObject var viewModel: AppointmentsViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var selectedEmployeeId: Int?
    @State private var startDate = Date()
    @State private var startTime = "09:00"
    @State private var endDate = Date()
    @State private var endTime = "17:00"
    @State private var reason = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Employee") {
                    Picker("Employee", selection: $selectedEmployeeId) {
                        Text("Select employee...").tag(nil as Int?)
                        ForEach(viewModel.employees) { emp in
                            Text(emp.name).tag(emp.id as Int?)
                        }
                    }
                }

                Section("Start Date & Time") {
                    DatePicker("Date", selection: $startDate, displayedComponents: .date)
                    TextField("Time (HH:MM)", text: $startTime)
                        .keyboardType(.numbersAndPunctuation)
                }

                Section("End Date & Time") {
                    DatePicker("Date", selection: $endDate, displayedComponents: .date)
                    TextField("Time (HH:MM)", text: $endTime)
                        .keyboardType(.numbersAndPunctuation)
                }

                Section("Reason") {
                    TextField("E.g., Vacation, Meeting, etc.", text: $reason)
                }
            }
            .navigationTitle("Add Blocked Time")
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
                            await saveBlockedTime()
                        }
                    }
                    .disabled(!isValid)
                }
            }
        }
    }

    private var isValid: Bool {
        selectedEmployeeId != nil && !reason.isEmpty
    }

    private func saveBlockedTime() async {
        guard let employeeId = selectedEmployeeId else { return }

        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"

        let startDateStr = dateFormatter.string(from: startDate)
        let endDateStr = dateFormatter.string(from: endDate)

        await viewModel.createBlockedTime(
            employeeId: employeeId,
            startDate: startDateStr,
            startTime: startTime,
            endDate: endDateStr,
            endTime: endTime,
            reason: reason
        )

        dismiss()
    }
}
