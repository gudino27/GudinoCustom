//
//  EmployeeTimeEditorSection.swift
//  GCWadmin
//
//  Lets a manager add or edit another employee's time. The employee gets a notification.
//

import SwiftUI

struct EmployeeTimeEditorSection: View {
    @ObservedObject var viewModel: TimeClockAdminViewModel

    @State private var selectedEmployee: User?
    @State private var entries: [TimeEntry] = []

    private let service = TimeClockService.shared

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            Text("Add or edit employee time")
                .font(AppTypography.bodyBold())
                .foregroundColor(AppColors.text)

            Picker("Employee", selection: $selectedEmployee) {
                Text("Choose an employee").tag(nil as User?)
                ForEach(viewModel.allEmployees) { employee in
                    Text(employee.displayName).tag(employee as User?)
                }
            }

            if let employee = selectedEmployee {
                Button(action: { openAdd(for: employee) }) {
                    Label("Add time", systemImage: "plus")
                        .font(AppTypography.bodyBold())
                }

                if entries.isEmpty {
                    Text("No time in the last 30 days.")
                        .font(AppTypography.small())
                        .foregroundColor(AppColors.textGray)
                }

                ForEach(entries) { entry in
                    Button(action: { viewModel.openEditEntry(entry) }) {
                        entryRow(entry)
                    }
                }
            }
        }
        .padding(AppSpacing.base)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white.opacity(0.7))
        .cornerRadius(AppRadius.lg)
        .task(id: selectedEmployee?.id) { await loadEntries() }
        .onChange(of: viewModel.showManualEntry) { _, showing in
            if !showing { Task { await loadEntries() } }
        }
        .onChange(of: viewModel.showEditEntry) { _, showing in
            if !showing { Task { await loadEntries() } }
        }
    }

    private func entryRow(_ entry: TimeEntry) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.clockInTime.prefix(10))
                    .font(AppTypography.bodyBold())
                    .foregroundColor(AppColors.text)
                Text("\(timeOf(entry.clockInTime)) - \(entry.clockOutTime.map(timeOf) ?? "still clocked in")")
                    .font(AppTypography.small())
                    .foregroundColor(AppColors.textGray)
            }

            Spacer()

            if let hours = entry.totalHours {
                Text(String(format: "%.2f hrs", hours))
                    .font(AppTypography.small())
                    .foregroundColor(AppColors.textGray)
            } else if entry.status == "pending" {
                Text("Waiting for approval")
                    .font(AppTypography.small())
                    .foregroundColor(AppColors.accent)
            }
        }
    }

    private func timeOf(_ timestamp: String) -> String {
        String(timestamp.dropFirst(11).prefix(5))
    }

    private func openAdd(for employee: User) {
        viewModel.manualEntryForm.userId = employee.id
        viewModel.manualEntryForm.employeeName = employee.displayName
        viewModel.showManualEntry = true
    }

    private func loadEntries() async {
        guard let employee = selectedEmployee else {
            entries = []
            return
        }

        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let today = Date()
        let start = Calendar.current.date(byAdding: .day, value: -30, to: today) ?? today

        do {
            entries = try await service.getEmployeeEntries(
                employeeId: employee.id,
                startDate: formatter.string(from: start),
                endDate: formatter.string(from: today)
            )
        } catch {
            viewModel.errorMessage = error.localizedDescription
        }
    }
}
