//
//  EditEntryModal.swift
//  GCWadmin
//
//  Modal for editing time entries with audit log
//

import SwiftUI

struct EditEntryModal: View {
    @ObservedObject var viewModel: TimeClockAdminViewModel
    @Environment(\.dismiss) var dismiss

    @State private var clockInTime: String = ""
    @State private var clockOutTime: String = ""
    @State private var breakMinutes: String = "0"
    @State private var notes: String = ""
    @State private var showDeleteConfirmation = false

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Edit Form
                Form {
                    if let entry = viewModel.editingEntry {
                        // Entry Info
                        Section("Entry Information") {
                            HStack {
                                Text("Employee")
                                Spacer()
                                Text(entry.employeeName ?? "Unknown")
                                    .foregroundColor(AppColors.textGray)
                            }

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

                        // Time Fields
                        Section("Time") {
                            HStack {
                                Text("Clock In")
                                Spacer()
                                TextField("HH:MM:SS", text: $clockInTime)
                                    .keyboardType(.numbersAndPunctuation)
                                    .multilineTextAlignment(.trailing)
                                    .autocapitalization(.none)
                                    .autocorrectionDisabled()
                            }

                            HStack {
                                Text("Clock Out")
                                Spacer()
                                TextField("HH:MM:SS", text: $clockOutTime)
                                    .keyboardType(.numbersAndPunctuation)
                                    .multilineTextAlignment(.trailing)
                                    .autocapitalization(.none)
                                    .autocorrectionDisabled()
                            }

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
                                .frame(minHeight: 80)
                                .font(AppTypography.body())
                        }

                        // Preview
                        if isValid {
                            Section("Preview") {
                                if let hours = calculateTotalHours() {
                                    HStack {
                                        Image(systemName: "hourglass")
                                            .foregroundColor(AppColors.success)

                                        Text("Total Hours")
                                            .font(AppTypography.body())
                                            .foregroundColor(AppColors.textGray)

                                        Spacer()

                                        Text(String(format: "%.2f hours", hours))
                                            .font(AppTypography.bodyBold())
                                            .foregroundColor(AppColors.success)
                                    }
                                }
                            }
                        }

                        // Modification History
                        if let modCount = entry.modificationCount, modCount > 0 {
                            Section("History") {
                                HStack {
                                    Image(systemName: "clock.arrow.circlepath")
                                        .foregroundColor(AppColors.accent)

                                    Text("Modified \(modCount) \(modCount == 1 ? "time" : "times")")
                                        .font(AppTypography.caption())
                                        .foregroundColor(AppColors.textGray)

                                    Spacer()

                                    Button(action: { fetchAuditLog() }) {
                                        Text("View Log")
                                            .font(AppTypography.caption())
                                            .foregroundColor(AppColors.blue)
                                    }
                                }
                            }
                        }

                        // Delete Button
                        Section {
                            Button(role: .destructive, action: { showDeleteConfirmation = true }) {
                                HStack {
                                    Image(systemName: "trash.fill")
                                    Text("Delete Entry")
                                }
                                .frame(maxWidth: .infinity)
                            }
                        }
                    }
                }

                // Audit Log Sheet
                .sheet(isPresented: $viewModel.showAuditLog) {
                    auditLogSheet
                }

                // Delete Confirmation
                .confirmationDialog(
                    "Delete Entry",
                    isPresented: $showDeleteConfirmation,
                    titleVisibility: .visible
                ) {
                    Button("Delete", role: .destructive) {
                        Task {
                            await deleteEntry()
                        }
                    }
                    Button("Cancel", role: .cancel) {}
                } message: {
                    Text("Are you sure you want to delete this time entry? This action cannot be undone.")
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

    // MARK: - Audit Log Sheet

    private var auditLogSheet: some View {
        NavigationView {
            List {
                if viewModel.auditLogs.isEmpty {
                    VStack(spacing: AppSpacing.md) {
                        ProgressView()
                        Text("Loading audit log...")
                            .font(AppTypography.caption())
                            .foregroundColor(AppColors.textGray)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(AppSpacing.xl)
                } else {
                    ForEach(viewModel.auditLogs) { log in
                        auditLogCard(log)
                    }
                }
            }
            .navigationTitle("Audit Log")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        viewModel.showAuditLog = false
                    }
                }
            }
        }
    }

    private func auditLogCard(_ log: EntryAuditLog) -> some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            HStack {
                Text(log.changeType)
                    .font(AppTypography.bodyBold())
                    .foregroundColor(AppColors.text)

                Spacer()

                Text(formatTimestamp(log.modifiedAt))
                    .font(AppTypography.small())
                    .foregroundColor(AppColors.textGray)
            }

            if let modifiedByName = log.modifiedByName {
                HStack(spacing: AppSpacing.xs) {
                    Image(systemName: "person.fill")
                        .font(.system(size: 12))
                    Text("by \(modifiedByName)")
                        .font(AppTypography.small())
                }
                .foregroundColor(AppColors.blue)
            }

            // Show old and new values
            if let oldValue = log.oldValue, let newValue = log.newValue {
                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    changeRow(field: log.changeType, oldValue: oldValue, newValue: newValue)
                }
                .padding(.top, AppSpacing.xs)
            }
        }
        .padding(AppSpacing.base)
        .background(Color.white)
        .cornerRadius(AppRadius.lg)
    }

    private func changeRow(field: String, oldValue: String, newValue: String) -> some View {
        HStack {
            Text(field.capitalized)
                .font(AppTypography.small())
                .foregroundColor(AppColors.textGray)

            Spacer()

            HStack(spacing: AppSpacing.xs) {
                Text(oldValue)
                    .font(AppTypography.small())
                    .foregroundColor(AppColors.errorMedium)
                    .strikethrough()

                Image(systemName: "arrow.right")
                    .font(.system(size: 10))
                    .foregroundColor(AppColors.textGray)

                Text(newValue)
                    .font(AppTypography.small())
                    .foregroundColor(AppColors.success)
            }
        }
    }

    // MARK: - Validation

    private var isValid: Bool {
        guard !clockInTime.isEmpty else { return false }
        guard clockInTime.matches(pattern: "^\\d{2}:\\d{2}:\\d{2}$") else { return false }

        if !clockOutTime.isEmpty {
            guard clockOutTime.matches(pattern: "^\\d{2}:\\d{2}:\\d{2}$") else { return false }
        }

        return true
    }

    // MARK: - Actions

    private func loadEntry() {
        guard let entry = viewModel.editingEntry else { return }

        clockInTime = extractTime(entry.clockInTime)
        clockOutTime = entry.clockOutTime != nil ? extractTime(entry.clockOutTime!) : ""
        breakMinutes = "\(entry.breakMinutes)"
        notes = entry.notes ?? ""
    }

    private func saveChanges() async {
        viewModel.editForm.clockInTime = formatFullTimestamp(viewModel.editingEntry!.clockInTime, time: clockInTime)
        viewModel.editForm.clockOutTime = !clockOutTime.isEmpty ? formatFullTimestamp(viewModel.editingEntry!.clockInTime, time: clockOutTime) : ""
        viewModel.editForm.breakMinutes = Int(breakMinutes) ?? 0
        viewModel.editForm.notes = notes

        await viewModel.submitEdit()

        if viewModel.errorMessage == nil {
            dismiss()
        }
    }

    private func deleteEntry() async {
        guard let entry = viewModel.editingEntry else { return }
        await viewModel.deleteEntry(entry)

        if viewModel.errorMessage == nil {
            dismiss()
        }
    }

    private func fetchAuditLog() {
        guard let entry = viewModel.editingEntry else { return }
        Task {
            await viewModel.fetchAuditLog(for: entry)
        }
    }

    // MARK: - Helpers

    private func extractTime(_ timestamp: String) -> String {
        // Extract time from "YYYY-MM-DD HH:MM:SS" format
        let components = timestamp.components(separatedBy: " ")
        return components.count > 1 ? components[1] : timestamp
    }

    private func formatDate(_ timestamp: String) -> String {
        let components = timestamp.components(separatedBy: " ")
        return components.first ?? timestamp
    }

    private func formatTimestamp(_ timestamp: String) -> String {
        let formatter = ISO8601DateFormatter()
        guard let date = formatter.date(from: timestamp) else {
            return timestamp
        }

        let displayFormatter = DateFormatter()
        displayFormatter.dateStyle = .short
        displayFormatter.timeStyle = .short
        return displayFormatter.string(from: date)
    }

    private func formatFullTimestamp(_ originalTimestamp: String, time: String) -> String {
        let dateComponent = originalTimestamp.components(separatedBy: " ").first ?? ""
        return "\(dateComponent) \(time)"
    }

    private func calculateTotalHours() -> Double? {
        guard let inTime = parseTime(clockInTime),
              !clockOutTime.isEmpty,
              let outTime = parseTime(clockOutTime) else {
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
