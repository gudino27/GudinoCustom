//
//  AdminTimeClockView.swift
//  GCWadmin
//
//  Admin TimeClock interface matching webapp exactly
//

import SwiftUI

struct AdminTimeClockView: View {
    @ObservedObject var viewModel: TimeClockAdminViewModel

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.xl) {
                // Messages
                if let error = viewModel.errorMessage {
                    messageBanner(message: error, isError: true)
                }

                if let success = viewModel.successMessage {
                    messageBanner(message: success, isError: false)
                }

                // Manual Entries Log (if any)
                if !viewModel.recentManualEntries.isEmpty && viewModel.showManualEntriesLog {
                    manualEntriesLogBanner
                }

                // Hours Report Button
                hoursReportButton

                // Currently Clocked In Section
                currentlyClockedInSection

                // Employee Payroll Management Section
                payrollManagementSection
            }
            .padding(AppSpacing.xl)
        }
        .refreshable {
            await viewModel.refresh()
        }
    }

    // MARK: - Manual Entries Log Banner

    private var manualEntriesLogBanner: some View {
        VStack(alignment: .leading, spacing: AppSpacing.md) {
            HStack {
                Image(systemName: "doc.text.fill")
                    .font(.system(size: 24))
                    .foregroundColor(AppColors.blue)

                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    Text("\(viewModel.recentManualEntries.count) Manual Time \(viewModel.recentManualEntries.count == 1 ? "Entry" : "Entries") (Last 24 Hours)")
                        .font(AppTypography.bodyBold())
                        .foregroundColor(AppColors.blue)

                    Text("Employees have added these missed clock-in/out entries:")
                        .font(AppTypography.small())
                        .foregroundColor(AppColors.text)
                }

                Spacer()

                Button(action: { viewModel.dismissManualEntriesLog() }) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(AppColors.blue.opacity(0.6))
                }
            }

            // Entry list
            VStack(spacing: AppSpacing.xs) {
                ForEach(viewModel.recentManualEntries.prefix(5)) { entry in
                    HStack {
                        Text(entry.notes ?? "Manual Entry")
                            .font(AppTypography.caption())
                            .foregroundColor(AppColors.text)
                        Spacer()
                        Text("\(entry.totalHours ?? 0, specifier: "%.2f") hrs")
                            .font(AppTypography.caption())
                            .foregroundColor(AppColors.textGray)
                    }
                    .padding(AppSpacing.sm)
                    .background(Color.white.opacity(0.7))
                    .cornerRadius(AppRadius.md)
                }
            }
        }
        .padding(AppSpacing.xl)
        .background(
            LinearGradient(
                colors: [Color(hex: "dbeafe"), Color(hex: "bfdbfe")],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .cornerRadius(AppRadius.xl)
        .overlay(
            RoundedRectangle(cornerRadius: AppRadius.xl)
                .stroke(AppColors.blue, lineWidth: 2)
        )
    }

    // MARK: - Hours Report Button

    private var hoursReportButton: some View {
        Button(action: { viewModel.showHoursReport = true }) {
            HStack {
                Image(systemName: "chart.bar.fill")
                    .font(.system(size: 16))
                Text("View Hours Report & Export")
                    .font(AppTypography.bodyBold())
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, AppSpacing.base)
            .background(
                LinearGradient(
                    colors: [Color(hex: "3b82f6"), Color(hex: "2563eb")],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .cornerRadius(AppRadius.lg)
        }
    }

    // MARK: - Currently Clocked In Section

    private var currentlyClockedInSection: some View {
        VStack(spacing: AppSpacing.lg) {
            HStack {
                Text("Currently Clocked In")
                    .font(AppTypography.headline())
                    .foregroundColor(AppColors.text)

                Spacer()

                HStack(spacing: AppSpacing.xs) {
                    Image(systemName: "person.2.fill")
                        .font(.system(size: 12))
                    Text("\(viewModel.clockedInEmployees.count) \(viewModel.clockedInEmployees.count == 1 ? "Employee" : "Employees")")
                        .font(AppTypography.small())
                        .fontWeight(.semibold)
                }
                .foregroundColor(AppColors.success)
                .padding(.horizontal, AppSpacing.sm)
                .padding(.vertical, AppSpacing.xs)
                .background(AppColors.successBg)
                .cornerRadius(AppRadius.full)
            }

            if viewModel.clockedInEmployees.isEmpty {
                VStack(spacing: AppSpacing.lg) {
                    Image(systemName: "clock")
                        .font(.system(size: 48))
                        .foregroundColor(AppColors.textGray)

                    Text("No employees currently clocked in")
                        .font(AppTypography.body())
                        .foregroundColor(AppColors.textGray)
                }
                .frame(maxWidth: .infinity)
                .padding(AppSpacing.xxxxl)
            } else {
                VStack(spacing: AppSpacing.md) {
                    ForEach(viewModel.clockedInEmployees) { employee in
                        employeeClockCard(employee)
                    }
                }
            }
        }
        .padding(AppSpacing.xl)
        .background(Color.white)
        .cornerRadius(AppRadius.xl)
        .shadow(color: Color.black.opacity(0.05), radius: 4, x: 0, y: 2)
    }

    private func employeeClockCard(_ employee: LiveEmployeeStatus) -> some View {
        VStack(alignment: .leading, spacing: AppSpacing.md) {
            HStack {
                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    Text(employee.employeeName)
                        .font(AppTypography.bodyBold())
                        .foregroundColor(AppColors.text)

                    HStack(spacing: AppSpacing.sm) {
                        Text("Clocked in at:")
                            .font(AppTypography.small())
                            .foregroundColor(AppColors.textGray)
                        Text(formatTime(employee.clockInTime))
                            .font(AppTypography.small())
                            .foregroundColor(AppColors.text)

                        if employee.isOnBreak {
                            HStack(spacing: AppSpacing.xs) {
                                Image(systemName: "cup.and.saucer.fill")
                                    .font(.system(size: 14))
                                Text("On Break")
                                    .font(AppTypography.small())
                            }
                            .foregroundColor(.white)
                            .padding(.horizontal, AppSpacing.sm)
                            .padding(.vertical, 2)
                            .background(AppColors.accent)
                            .cornerRadius(AppRadius.full)
                        }
                    }
                }

                Spacer()

                VStack(alignment: .trailing, spacing: AppSpacing.xs) {
                    Text(employee.currentHours)
                        .font(AppTypography.title3())
                        .fontWeight(.bold)
                        .foregroundColor(AppColors.success)
                    Text("hours today")
                        .font(AppTypography.small())
                        .foregroundColor(AppColors.textGray)
                }
            }
        }
        .padding(AppSpacing.base)
        .background(AppColors.successBg)
        .cornerRadius(AppRadius.lg)
        .overlay(
            RoundedRectangle(cornerRadius: AppRadius.lg)
                .stroke(AppColors.successBorder, lineWidth: 1)
        )
    }

    // MARK: - Payroll Management Section

    private var payrollManagementSection: some View {
        VStack(spacing: AppSpacing.lg) {
            HStack {
                Text("Employee Payroll Management")
                    .font(AppTypography.headline())
                    .foregroundColor(AppColors.text)

                Spacer()

                Button(action: { viewModel.togglePayrollSection() }) {
                    Text(viewModel.showPayrollSection ? "Hide" : "Show")
                        .font(AppTypography.caption())
                        .foregroundColor(AppColors.blue)
                        .padding(.horizontal, AppSpacing.md)
                        .padding(.vertical, AppSpacing.sm)
                        .background(AppColors.blue.opacity(0.1))
                        .cornerRadius(AppRadius.md)
                }
            }

            if viewModel.showPayrollSection {
                VStack(spacing: AppSpacing.md) {
                    Text("Set hourly rates and employment details for employees")
                        .font(AppTypography.caption())
                        .foregroundColor(AppColors.textGray)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    if viewModel.allEmployees.isEmpty {
                        VStack(spacing: AppSpacing.md) {
                            ProgressView()
                            Text("Loading employees...")
                                .font(AppTypography.caption())
                                .foregroundColor(AppColors.textGray)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(AppSpacing.xl)
                    } else {
                        VStack(spacing: AppSpacing.md) {
                            ForEach(viewModel.allEmployees) { employee in
                                employeePayrollCard(employee)
                            }
                        }
                    }
                }
            }
        }
        .padding(AppSpacing.xl)
        .background(Color.white)
        .cornerRadius(AppRadius.xl)
        .shadow(color: Color.black.opacity(0.05), radius: 4, x: 0, y: 2)
    }

    private func employeePayrollCard(_ employee: User) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: AppSpacing.sm) {
                Text(employee.displayName)
                    .font(AppTypography.bodyBold())
                    .foregroundColor(AppColors.text)

                Text(employee.role.displayName)
                    .font(AppTypography.small())
                    .foregroundColor(AppColors.textGray)

                if let payroll = viewModel.employeePayrollInfo[employee.id] {
                    payrollSummary(payroll)
                } else {
                    HStack(spacing: AppSpacing.xs) {
                        Text("⚠️")
                        Text("No payroll info set")
                            .font(AppTypography.small())
                            .foregroundColor(AppColors.errorMedium)
                    }
                }
            }

            Spacer()

            Button(action: { viewModel.openPayrollSettings(for: employee) }) {
                Text(viewModel.employeePayrollInfo[employee.id] != nil ? "Edit" : "Set")
                    .font(AppTypography.caption())
                    .foregroundColor(.white)
                    .padding(.horizontal, AppSpacing.base)
                    .padding(.vertical, AppSpacing.sm)
                    .background(AppColors.blue)
                    .cornerRadius(AppRadius.md)
            }
        }
        .padding(AppSpacing.base)
        .background(Color.white)
        .cornerRadius(AppRadius.lg)
        .overlay(
            RoundedRectangle(cornerRadius: AppRadius.lg)
                .stroke(AppColors.border, lineWidth: 1)
        )
    }

    private func payrollSummary(_ payroll: PayrollInfo) -> some View {
        VStack(alignment: .leading, spacing: AppSpacing.xs) {
            HStack(spacing: AppSpacing.sm) {
                Text("Type:")
                    .font(AppTypography.small())
                    .foregroundColor(AppColors.textGray)
                Text(payroll.employmentType == .hourly ? "💼 Hourly" : "💼 Salary")
                    .font(AppTypography.small())
                    .foregroundColor(AppColors.text)
            }

            if payroll.employmentType == .hourly {
                HStack(spacing: AppSpacing.sm) {
                    Text("Rate:")
                        .font(AppTypography.small())
                        .foregroundColor(AppColors.textGray)
                    Text("$\(payroll.hourlyRate ?? 0, specifier: "%.2f") per hour")
                        .font(AppTypography.small())
                        .foregroundColor(AppColors.text)
                }
            } else {
                HStack(spacing: AppSpacing.sm) {
                    Text("Salary:")
                        .font(AppTypography.small())
                        .foregroundColor(AppColors.textGray)
                    Text("$\(payroll.annualSalary ?? 0, specifier: "%.2f") per year")
                        .font(AppTypography.small())
                        .foregroundColor(AppColors.text)
                }
            }

            HStack(spacing: AppSpacing.sm) {
                Image(systemName: "calendar")
                    .font(.system(size: 12))
                    .foregroundColor(AppColors.textGray)
                Text(payroll.payPeriodType.displayName)
                    .font(AppTypography.small())
                    .foregroundColor(AppColors.text)
            }
        }
    }

    // MARK: - Message Banner

    private func messageBanner(message: String, isError: Bool) -> some View {
        HStack(spacing: AppSpacing.sm) {
            Image(systemName: isError ? "exclamationmark.circle.fill" : "checkmark.circle.fill")
                .foregroundColor(isError ? AppColors.errorMedium : AppColors.successMedium)

            Text(message)
                .font(AppTypography.caption())
                .foregroundColor(isError ? AppColors.errorMedium : AppColors.successMedium)

            Spacer()

            Button(action: { viewModel.clearMessages() }) {
                Image(systemName: "xmark.circle.fill")
                    .foregroundColor((isError ? AppColors.errorMedium : AppColors.successMedium).opacity(0.6))
            }
        }
        .padding(AppSpacing.md)
        .background((isError ? AppColors.errorMedium : AppColors.successMedium).opacity(0.15))
        .cornerRadius(AppRadius.lg)
    }

    // MARK: - Helpers

    private func formatTime(_ timestamp: String) -> String {
        // Extract time from "YYYY-MM-DD HH:MM:SS" format
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

// MARK: - Preview

#Preview {
    AdminTimeClockView(viewModel: TimeClockAdminViewModel())
}
