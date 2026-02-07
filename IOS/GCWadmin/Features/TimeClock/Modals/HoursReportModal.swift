//
//  HoursReportModal.swift
//  GCWadmin
//
//  Modal for generating and exporting hours reports
//

import SwiftUI

struct HoursReportModal: View {
    @ObservedObject var viewModel: TimeClockAdminViewModel
    @Environment(\.dismiss) var dismiss

    @State private var startDate = Date()
    @State private var endDate = Date()

    var body: some View {
        NavigationView {
            VStack(spacing: AppSpacing.xl) {
                if viewModel.hoursReportData.isEmpty {
                    // Date selection form
                    dateSelectionSection
                } else {
                    // Report results
                    reportResultsSection
                }
            }
            .padding(AppSpacing.xl)
            .navigationTitle("Hours Report")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") {
                        dismiss()
                    }
                }

                if !viewModel.hoursReportData.isEmpty {
                    ToolbarItem(placement: .primaryAction) {
                        Button(action: { exportCSV() }) {
                            HStack(spacing: AppSpacing.xs) {
                                Image(systemName: "square.and.arrow.up")
                                Text("Export CSV")
                            }
                        }
                    }

                    ToolbarItem(placement: .secondaryAction) {
                        Button(action: { resetReport() }) {
                            HStack(spacing: AppSpacing.xs) {
                                Image(systemName: "arrow.clockwise")
                                Text("New Report")
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: - Date Selection Section

    private var dateSelectionSection: some View {
        VStack(spacing: AppSpacing.lg) {
            Text("Select Date Range")
                .font(AppTypography.headline())
                .foregroundColor(AppColors.text)
                .frame(maxWidth: .infinity, alignment: .leading)

            VStack(spacing: AppSpacing.md) {
                DatePicker(
                    "Start Date",
                    selection: $startDate,
                    displayedComponents: .date
                )
                .datePickerStyle(.compact)

                DatePicker(
                    "End Date",
                    selection: $endDate,
                    displayedComponents: .date
                )
                .datePickerStyle(.compact)
            }
            .padding(AppSpacing.base)
            .background(Color.white)
            .cornerRadius(AppRadius.lg)
            .shadow(color: Color.black.opacity(0.05), radius: 4, x: 0, y: 2)

            Button(action: { generateReport() }) {
                HStack {
                    if viewModel.actionInProgress {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                    } else {
                        Image(systemName: "chart.bar.fill")
                        Text("Generate Report")
                            .font(AppTypography.bodyBold())
                    }
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

            Spacer()
        }
    }

    // MARK: - Report Results Section

    private var reportResultsSection: some View {
        ScrollView {
            VStack(spacing: AppSpacing.lg) {
                // Summary header
                summaryHeader

                // Employee list
                VStack(spacing: AppSpacing.md) {
                    ForEach(viewModel.hoursReportData) { report in
                        employeeReportCard(report)
                    }
                }

                // Totals card
                totalsCard
            }
        }
    }

    private var summaryHeader: some View {
        VStack(spacing: AppSpacing.sm) {
            Text("Hours Report")
                .font(AppTypography.headline())
                .foregroundColor(AppColors.text)

            Text("\(formatDate(startDate)) - \(formatDate(endDate))")
                .font(AppTypography.caption())
                .foregroundColor(AppColors.textGray)

            Text("\(viewModel.hoursReportData.count) \(viewModel.hoursReportData.count == 1 ? "Employee" : "Employees")")
                .font(AppTypography.small())
                .foregroundColor(AppColors.blue)
        }
        .frame(maxWidth: .infinity)
        .padding(AppSpacing.base)
        .background(AppColors.blue.opacity(0.1))
        .cornerRadius(AppRadius.lg)
    }

    private func employeeReportCard(_ report: EmployeeHoursReport) -> some View {
        VStack(alignment: .leading, spacing: AppSpacing.md) {
            Text(report.employeeName)
                .font(AppTypography.bodyBold())
                .foregroundColor(AppColors.text)

            VStack(spacing: AppSpacing.sm) {
                reportRow(
                    label: "Total Hours",
                    value: String(format: "%.2f", report.totalHours),
                    icon: "clock.fill",
                    color: AppColors.blue
                )

                reportRow(
                    label: "Regular Hours",
                    value: String(format: "%.2f", report.regularHours),
                    icon: "clock",
                    color: AppColors.text
                )

                if report.overtimeHours > 0 {
                    reportRow(
                        label: "Overtime Hours",
                        value: String(format: "%.2f", report.overtimeHours),
                        icon: "clock.badge.exclamationmark",
                        color: AppColors.accent
                    )
                }

                if report.estimatedPay > 0 {
                    Divider()

                    reportRow(
                        label: "Estimated Pay",
                        value: formatCurrency(report.estimatedPay),
                        icon: "dollarsign.circle.fill",
                        color: AppColors.success
                    )
                }
            }
        }
        .padding(AppSpacing.base)
        .background(Color.white)
        .cornerRadius(AppRadius.lg)
        .shadow(color: Color.black.opacity(0.05), radius: 4, x: 0, y: 2)
    }

    private func reportRow(label: String, value: String, icon: String, color: Color) -> some View {
        HStack {
            Image(systemName: icon)
                .foregroundColor(color)
                .frame(width: 20)

            Text(label)
                .font(AppTypography.small())
                .foregroundColor(AppColors.textGray)

            Spacer()

            Text(value)
                .font(AppTypography.bodyBold())
                .foregroundColor(color)
        }
    }

    private var totalsCard: some View {
        VStack(alignment: .leading, spacing: AppSpacing.md) {
            Text("TOTALS")
                .font(AppTypography.bodyBold())
                .foregroundColor(AppColors.text)

            VStack(spacing: AppSpacing.sm) {
                reportRow(
                    label: "Total Hours",
                    value: String(format: "%.2f", totalHours),
                    icon: "clock.fill",
                    color: AppColors.blue
                )

                reportRow(
                    label: "Regular Hours",
                    value: String(format: "%.2f", totalRegularHours),
                    icon: "clock",
                    color: AppColors.text
                )

                if totalOvertimeHours > 0 {
                    reportRow(
                        label: "Overtime Hours",
                        value: String(format: "%.2f", totalOvertimeHours),
                        icon: "clock.badge.exclamationmark",
                        color: AppColors.accent
                    )
                }

                if totalEstimatedPay > 0 {
                    Divider()

                    reportRow(
                        label: "Total Estimated Pay",
                        value: formatCurrency(totalEstimatedPay),
                        icon: "dollarsign.circle.fill",
                        color: AppColors.success
                    )
                }
            }
        }
        .padding(AppSpacing.base)
        .background(
            LinearGradient(
                colors: [Color(hex: "dbeafe"), Color(hex: "bfdbfe")],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .cornerRadius(AppRadius.lg)
        .overlay(
            RoundedRectangle(cornerRadius: AppRadius.lg)
                .stroke(AppColors.blue, lineWidth: 2)
        )
    }

    // MARK: - Computed Properties

    private var totalHours: Double {
        viewModel.hoursReportData.reduce(0) { $0 + $1.totalHours }
    }

    private var totalRegularHours: Double {
        viewModel.hoursReportData.reduce(0) { $0 + $1.regularHours }
    }

    private var totalOvertimeHours: Double {
        viewModel.hoursReportData.reduce(0) { $0 + $1.overtimeHours }
    }

    private var totalEstimatedPay: Double {
        viewModel.hoursReportData.reduce(0) { $0 + $1.estimatedPay }
    }

    // MARK: - Actions

    private func generateReport() {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"

        viewModel.reportStartDate = formatter.string(from: startDate)
        viewModel.reportEndDate = formatter.string(from: endDate)

        Task {
            await viewModel.generateHoursReport()
        }
    }

    private func resetReport() {
        viewModel.hoursReportData = []
        startDate = Date()
        endDate = Date()
    }

    private func exportCSV() {
        let csv = viewModel.exportHoursReportCSV()

        // Create temporary file
        let fileName = "hours-report-\(formatDate(startDate))-to-\(formatDate(endDate)).csv"
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)

        do {
            try csv.write(to: tempURL, atomically: true, encoding: .utf8)

            // Share the file
            let activityVC = UIActivityViewController(
                activityItems: [tempURL],
                applicationActivities: nil
            )

            if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
               let rootVC = windowScene.windows.first?.rootViewController {
                rootVC.present(activityVC, animated: true)
            }
        } catch {
            print("❌ Failed to export CSV: \(error)")
        }
    }

    // MARK: - Helpers

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    private func formatCurrency(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        return formatter.string(from: NSNumber(value: amount)) ?? "$0.00"
    }
}
