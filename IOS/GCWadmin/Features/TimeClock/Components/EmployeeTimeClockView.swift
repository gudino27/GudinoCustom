//
//  EmployeeTimeClockView.swift
//  GCWadmin
//
//  Employee TimeClock interface
//

import SwiftUI

struct EmployeeTimeClockView: View {
    @ObservedObject var viewModel: TimeClockViewModel

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.xl) {
                // Loading state
                if viewModel.isLoading {
                    loadingView
                } else {
                    // Error banner
                    if let error = viewModel.errorMessage {
                        errorBanner(message: error)
                    }

                    // Enter Time section (matching webapp)
                    enterTimeSection

                    // Clock actions
                    clockActionsSection

                    // Current status
                    if let status = viewModel.status, status.isClockedIn {
                        currentStatusSection
                    }

                    // Payroll info
                    if viewModel.payrollInfo != nil {
                        payrollInfoSection
                    }
                }
            }
            .padding(AppSpacing.base)
        }
        .sheet(isPresented: $viewModel.showCalendar) {
            CalendarView(viewModel: viewModel)
        }
        .sheet(isPresented: $viewModel.showManualEntry) {
            EmployeeManualEntryModal(
                viewModel: viewModel,
                isPresented: $viewModel.showManualEntry
            )
        }
        .sheet(isPresented: $viewModel.showDateEntries) {
            DateEntriesSheet(viewModel: viewModel)
        }
    }

    // MARK: - Loading View
    private var loadingView: some View {
        VStack(spacing: AppSpacing.lg) {
            ProgressView()
                .scaleEffect(1.5)
            Text("Loading...")
                .font(AppTypography.caption())
                .foregroundColor(AppColors.textGray)
        }
        .frame(maxWidth: .infinity)
        .padding(AppSpacing.xxxxl)
    }

    // MARK: - Error Banner
    private func errorBanner(message: String) -> some View {
        HStack(spacing: AppSpacing.sm) {
            Image(systemName: "exclamationmark.circle.fill")
                .foregroundColor(AppColors.errorMedium)

            Text(message)
                .font(AppTypography.caption())
                .foregroundColor(AppColors.errorMedium)

            Spacer()

            Button(action: { viewModel.clearError() }) {
                Image(systemName: "xmark.circle.fill")
                    .foregroundColor(AppColors.errorMedium.opacity(0.6))
            }
        }
        .padding(AppSpacing.md)
        .background(AppColors.errorMedium.opacity(0.15))
        .cornerRadius(AppRadius.lg)
    }

    // MARK: - Enter Time Section
    private var enterTimeSection: some View {
        VStack(spacing: AppSpacing.lg) {
            Text("Enter Time")
                .font(AppTypography.headline())
                .foregroundColor(AppColors.text)
                .frame(maxWidth: .infinity, alignment: .leading)

            VStack(spacing: AppSpacing.md) {
                // This Week button
                Button(action: {
                    viewModel.calendarViewType = .week
                    viewModel.goToToday()
                    Task {
                        await viewModel.loadCalendarEntries()
                    }
                    viewModel.showCalendar = true
                }) {
                    HStack {
                        Text("This Week")
                            .font(AppTypography.body())
                        Spacer()
                        if let summary = viewModel.hoursSummary {
                            Text(String(format: "(%.2f Hours)", summary.thisWeek))
                                .font(AppTypography.caption())
                                .foregroundColor(AppColors.textGray)
                        } else {
                            Text("(0.00 Hours)")
                                .font(AppTypography.caption())
                                .foregroundColor(AppColors.textGray)
                        }
                        Image(systemName: "chevron.right")
                            .font(.system(size: 14))
                            .foregroundColor(AppColors.textGray)
                    }
                    .foregroundColor(AppColors.text)
                    .padding(AppSpacing.base)
                    .background(Color.white)
                    .cornerRadius(AppRadius.lg)
                }
                .buttonStyle(.plain)

                // Last Week button
                Button(action: {
                    viewModel.calendarViewType = .week
                    let calendar = Calendar.current
                    if let lastWeek = calendar.date(byAdding: .day, value: -7, to: Date()) {
                        viewModel.selectedMonth = lastWeek
                        viewModel.updateCalendarDays()
                    }
                    Task {
                        await viewModel.loadCalendarEntries()
                    }
                    viewModel.showCalendar = true
                }) {
                    HStack {
                        Text("Last Week")
                            .font(AppTypography.body())
                        Spacer()
                        if let summary = viewModel.hoursSummary {
                            Text(String(format: "(%.2f Hours)", summary.lastWeek))
                                .font(AppTypography.caption())
                                .foregroundColor(AppColors.textGray)
                        } else {
                            Text("(0.00 Hours)")
                                .font(AppTypography.caption())
                                .foregroundColor(AppColors.textGray)
                        }
                        Image(systemName: "chevron.right")
                            .font(.system(size: 14))
                            .foregroundColor(AppColors.textGray)
                    }
                    .foregroundColor(AppColors.text)
                    .padding(AppSpacing.base)
                    .background(Color.white)
                    .cornerRadius(AppRadius.lg)
                }
                .buttonStyle(.plain)

                // Select Week button
                Button(action: {
                    Task {
                        await viewModel.loadCalendarEntries()
                    }
                    viewModel.showCalendar = true
                }) {
                    HStack {
                        Text("Select Week")
                            .font(AppTypography.body())
                        Spacer()
                        Image(systemName: "calendar")
                            .font(.system(size: 14))
                        Image(systemName: "chevron.right")
                            .font(.system(size: 14))
                            .foregroundColor(AppColors.textGray)
                    }
                    .foregroundColor(AppColors.text)
                    .padding(AppSpacing.base)
                    .background(Color.white)
                    .cornerRadius(AppRadius.lg)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(AppSpacing.xl)
        .background(Color.white)
        .cornerRadius(AppRadius.xl)
        .shadow(color: Color.black.opacity(0.05), radius: 4, x: 0, y: 2)
    }

    // MARK: - Clock Actions Section
    private var clockActionsSection: some View {
        VStack(spacing: AppSpacing.lg) {
            Text("Time Clock")
                .font(AppTypography.headline())
                .foregroundColor(AppColors.text)
                .frame(maxWidth: .infinity, alignment: .leading)

            VStack(spacing: AppSpacing.md) {
                if let status = viewModel.status {
                    if !status.isClockedIn {
                        // Clock In button
                        clockInButton
                    } else {
                        // Clock Out and Break buttons
                        HStack(spacing: AppSpacing.md) {
                            clockOutButton
                            if status.isOnBreak {
                                endBreakButton
                            } else {
                                startBreakButton
                            }
                        }
                    }
                } else {
                    clockInButton
                }

                // Manual entry link
                Button(action: { viewModel.showManualEntry = true }) {
                    HStack {
                        Image(systemName: "plus.circle")
                        Text("Forgot to clock in? Add an entry")
                            .font(AppTypography.caption())
                    }
                    .foregroundColor(AppColors.blue)
                }
            }
        }
        .padding(AppSpacing.xl)
        .background(Color.white)
        .cornerRadius(AppRadius.xl)
        .shadow(color: Color.black.opacity(0.05), radius: 4, x: 0, y: 2)
    }

    // MARK: - Clock Buttons
    private var clockInButton: some View {
        Button(action: {
            Task {
                await viewModel.clockIn()
            }
        }) {
            HStack {
                Image(systemName: "clock.arrow.circlepath")
                    .font(.system(size: 20))
                Text("Clock In")
                    .font(AppTypography.bodyBold())
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, AppSpacing.base)
            .background(
                LinearGradient(
                    colors: [Color(hex: "10b981"), Color(hex: "059669")],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .cornerRadius(AppRadius.lg)
        }
        .disabled(viewModel.actionInProgress)
        .opacity(viewModel.actionInProgress ? 0.6 : 1.0)
    }

    private var clockOutButton: some View {
        Button(action: {
            Task {
                await viewModel.clockOut()
            }
        }) {
            HStack {
                Image(systemName: "clock.badge.checkmark")
                    .font(.system(size: 18))
                Text("Clock Out")
                    .font(AppTypography.bodyBold())
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, AppSpacing.base)
            .background(
                LinearGradient(
                    colors: [Color(hex: "ef4444"), Color(hex: "dc2626")],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .cornerRadius(AppRadius.lg)
        }
        .disabled(viewModel.actionInProgress)
        .opacity(viewModel.actionInProgress ? 0.6 : 1.0)
    }

    private var startBreakButton: some View {
        Button(action: {
            Task {
                await viewModel.startBreak()
            }
        }) {
            HStack {
                Image(systemName: "cup.and.saucer")
                    .font(.system(size: 18))
                Text("Break")
                    .font(AppTypography.bodyBold())
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, AppSpacing.base)
            .background(
                LinearGradient(
                    colors: [Color(hex: "f59e0b"), Color(hex: "d97706")],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .cornerRadius(AppRadius.lg)
        }
        .disabled(viewModel.actionInProgress)
        .opacity(viewModel.actionInProgress ? 0.6 : 1.0)
    }

    private var endBreakButton: some View {
        Button(action: {
            Task {
                await viewModel.endBreak()
            }
        }) {
            HStack {
                Image(systemName: "arrow.uturn.left.circle")
                    .font(.system(size: 18))
                Text("End Break")
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
        .disabled(viewModel.actionInProgress)
        .opacity(viewModel.actionInProgress ? 0.6 : 1.0)
    }

    // MARK: - Current Status Section
    private var currentStatusSection: some View {
        VStack(spacing: AppSpacing.lg) {
            Text("Current Status")
                .font(AppTypography.headline())
                .foregroundColor(AppColors.text)
                .frame(maxWidth: .infinity, alignment: .leading)

            if let status = viewModel.status {
                VStack(spacing: AppSpacing.md) {
                    statusRow(
                        icon: "clock.fill",
                        label: "Status",
                        value: status.isOnBreak ? "On Break" : "Clocked In",
                        color: status.isOnBreak ? AppColors.accent : AppColors.success
                    )

                    if let clockInTime = status.clockInTime {
                        statusRow(
                            icon: "clock.arrow.circlepath",
                            label: "Clock In Time",
                            value: formatTime(clockInTime),
                            color: AppColors.blue
                        )
                    }

                    statusRow(
                        icon: "hourglass",
                        label: "Hours Worked",
                        value: status.currentHours ?? "0:00",
                        color: AppColors.text
                    )

                    if let breakMinutes = status.breakMinutes, breakMinutes > 0 {
                        statusRow(
                            icon: "cup.and.saucer.fill",
                            label: "Break Time",
                            value: "\(breakMinutes) min",
                            color: AppColors.accent
                        )
                    }
                }
            }
        }
        .padding(AppSpacing.xl)
        .background(Color.white)
        .cornerRadius(AppRadius.xl)
        .shadow(color: Color.black.opacity(0.05), radius: 4, x: 0, y: 2)
    }

    private func statusRow(icon: String, label: String, value: String, color: Color) -> some View {
        HStack {
            Image(systemName: icon)
                .foregroundColor(color)
                .frame(width: 24)

            Text(label)
                .font(AppTypography.caption())
                .foregroundColor(AppColors.textGray)

            Spacer()

            Text(value)
                .font(AppTypography.bodyBold())
                .foregroundColor(color)
        }
    }

    // MARK: - Payroll Info Section
    private var payrollInfoSection: some View {
        VStack(spacing: AppSpacing.lg) {
            HStack {
                Text("Payroll Information")
                    .font(AppTypography.headline())
                    .foregroundColor(AppColors.text)

                Spacer()

                Button(action: { viewModel.showTaxCalculator = true }) {
                    HStack(spacing: AppSpacing.xs) {
                        Image(systemName: "calculator")
                        Text("Calculator")
                    }
                    .font(AppTypography.caption())
                    .foregroundColor(AppColors.blue)
                }
            }

            if let earnings = viewModel.calculatePayPeriodEarnings() {
                VStack(spacing: AppSpacing.md) {
                    payrollRow(
                        label: "Gross Pay (Period)",
                        value: formatCurrency(earnings),
                        highlight: false
                    )

                    if viewModel.taxRate > 0 {
                        payrollRow(
                            label: "Tax Rate",
                            value: String(format: "%.1f%%", viewModel.taxRate),
                            highlight: false
                        )

                        payrollRow(
                            label: "Estimated Take-Home",
                            value: formatCurrency(viewModel.calculateNetPay(grossPay: earnings)),
                            highlight: true
                        )
                    }
                }
            }
        }
        .padding(AppSpacing.xl)
        .background(Color.white)
        .cornerRadius(AppRadius.xl)
        .shadow(color: Color.black.opacity(0.05), radius: 4, x: 0, y: 2)
    }

    private func payrollRow(label: String, value: String, highlight: Bool) -> some View {
        HStack {
            Text(label)
                .font(AppTypography.caption())
                .foregroundColor(AppColors.textGray)

            Spacer()

            Text(value)
                .font(highlight ? AppTypography.bodyBold() : AppTypography.body())
                .foregroundColor(highlight ? AppColors.success : AppColors.text)
        }
        .padding(AppSpacing.md)
        .background(highlight ? AppColors.successBg : Color.clear)
        .cornerRadius(AppRadius.lg)
    }

    // MARK: - Helpers
    private func formatTime(_ timestamp: String) -> String {
        // Extract time from "YYYY-MM-DD HH:MM:SS" format
        let components = timestamp.components(separatedBy: " ")
        guard components.count > 1 else { return timestamp }

        let time = components[1]
        let timeParts = time.components(separatedBy: ":")
        guard timeParts.count >= 2,
              let hour = Int(timeParts[0]),
              let minute = Int(timeParts[1]) else {
            return time
        }

        // Convert to 12-hour format
        let period = hour >= 12 ? "PM" : "AM"
        let displayHour = hour == 0 ? 12 : (hour > 12 ? hour - 12 : hour)
        return String(format: "%d:%02d %@", displayHour, minute, period)
    }

    private func formatCurrency(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        return formatter.string(from: NSNumber(value: amount)) ?? "$0.00"
    }
}

// MARK: - Preview
#Preview {
    EmployeeTimeClockView(viewModel: TimeClockViewModel())
}
