//
//  PaycheckCalculatorModal.swift
//  GCWadmin
//
//  Modal for calculating take-home pay with tax deductions
//

import SwiftUI

struct PaycheckCalculatorModal: View {
    @ObservedObject var viewModel: TimeClockViewModel
    @Environment(\.dismiss) var dismiss

    @State private var grossPay: String = ""
    @State private var taxRate: String = ""
    @State private var additionalDeductions: String = "0"
    @State private var showResults = false

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: AppSpacing.xl) {
                    // Input Section
                    inputSection

                    // Calculate Button
                    calculateButton

                    // Results Section
                    if showResults {
                        resultsSection
                    }

                    // Tax Rate Helper
                    taxRateHelper
                }
                .padding(AppSpacing.xl)
            }
            .navigationTitle("Paycheck Calculator")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") {
                        dismiss()
                    }
                }
            }
        }
        .onAppear {
            loadInitialValues()
        }
    }

    // MARK: - Input Section

    private var inputSection: some View {
        VStack(spacing: AppSpacing.lg) {
            Text("Calculate Your Take-Home Pay")
                .font(AppTypography.headline())
                .foregroundColor(AppColors.text)
                .frame(maxWidth: .infinity, alignment: .leading)

            VStack(spacing: AppSpacing.md) {
                // Gross Pay
                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    Text("Gross Pay")
                        .font(AppTypography.caption())
                        .foregroundColor(AppColors.textGray)

                    HStack {
                        Text("$")
                            .font(AppTypography.bodyBold())
                            .foregroundColor(AppColors.text)

                        TextField("0.00", text: $grossPay)
                            .keyboardType(.decimalPad)
                            .font(AppTypography.title3())
                            .fontWeight(.bold)
                    }
                    .padding(AppSpacing.base)
                    .background(Color.white)
                    .cornerRadius(AppRadius.lg)
                    .overlay(
                        RoundedRectangle(cornerRadius: AppRadius.lg)
                            .stroke(AppColors.border, lineWidth: 1)
                    )
                }

                // Tax Rate
                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    Text("Tax Rate (%)")
                        .font(AppTypography.caption())
                        .foregroundColor(AppColors.textGray)

                    HStack {
                        TextField("0.0", text: $taxRate)
                            .keyboardType(.decimalPad)
                            .font(AppTypography.title3())
                            .fontWeight(.bold)

                        Text("%")
                            .font(AppTypography.bodyBold())
                            .foregroundColor(AppColors.text)
                    }
                    .padding(AppSpacing.base)
                    .background(Color.white)
                    .cornerRadius(AppRadius.lg)
                    .overlay(
                        RoundedRectangle(cornerRadius: AppRadius.lg)
                            .stroke(AppColors.border, lineWidth: 1)
                    )
                }

                // Additional Deductions
                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    Text("Additional Deductions (Optional)")
                        .font(AppTypography.caption())
                        .foregroundColor(AppColors.textGray)

                    HStack {
                        Text("$")
                            .font(AppTypography.bodyBold())
                            .foregroundColor(AppColors.text)

                        TextField("0.00", text: $additionalDeductions)
                            .keyboardType(.decimalPad)
                            .font(AppTypography.body())
                    }
                    .padding(AppSpacing.base)
                    .background(Color.white)
                    .cornerRadius(AppRadius.lg)
                    .overlay(
                        RoundedRectangle(cornerRadius: AppRadius.lg)
                            .stroke(AppColors.border, lineWidth: 1)
                    )

                    Text("Insurance, 401(k), etc.")
                        .font(AppTypography.small())
                        .foregroundColor(AppColors.textGray)
                }
            }
        }
    }

    // MARK: - Calculate Button

    private var calculateButton: some View {
        Button(action: { calculate() }) {
            HStack {
                Image(systemName: "calculator.fill")
                    .font(.system(size: 18))
                Text("Calculate")
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
        .disabled(!isValid)
        .opacity(isValid ? 1.0 : 0.6)
    }

    // MARK: - Results Section

    private var resultsSection: some View {
        VStack(spacing: AppSpacing.lg) {
            Text("Results")
                .font(AppTypography.headline())
                .foregroundColor(AppColors.text)
                .frame(maxWidth: .infinity, alignment: .leading)

            VStack(spacing: AppSpacing.md) {
                // Gross Pay
                resultCard(
                    label: "Gross Pay",
                    value: formatCurrency(grossPayAmount),
                    icon: "dollarsign.circle",
                    color: AppColors.blue
                )

                // Tax Deduction
                resultCard(
                    label: "Tax Deduction (\(String(format: "%.1f", taxRateAmount))%)",
                    value: "-" + formatCurrency(taxDeduction),
                    icon: "minus.circle",
                    color: AppColors.errorMedium
                )

                // Additional Deductions
                if additionalDeductionsAmount > 0 {
                    resultCard(
                        label: "Additional Deductions",
                        value: "-" + formatCurrency(additionalDeductionsAmount),
                        icon: "minus.circle",
                        color: AppColors.errorMedium
                    )
                }

                Divider()
                    .padding(.vertical, AppSpacing.sm)

                // Net Pay (Take-Home)
                VStack(spacing: AppSpacing.sm) {
                    Text("Take-Home Pay")
                        .font(AppTypography.caption())
                        .foregroundColor(AppColors.textGray)

                    Text(formatCurrency(netPay))
                        .font(.system(size: 36, weight: .bold))
                        .foregroundColor(AppColors.success)
                }
                .frame(maxWidth: .infinity)
                .padding(AppSpacing.xl)
                .background(
                    LinearGradient(
                        colors: [Color(hex: "d1fae5"), Color(hex: "a7f3d0")],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .cornerRadius(AppRadius.lg)
                .overlay(
                    RoundedRectangle(cornerRadius: AppRadius.lg)
                        .stroke(AppColors.success, lineWidth: 2)
                )
            }

            // Save Tax Rate Button
            if viewModel.payrollInfo != nil {
                Button(action: { saveTaxRate() }) {
                    HStack {
                        Image(systemName: "checkmark.circle")
                        Text("Save Tax Rate")
                            .font(AppTypography.caption())
                    }
                    .foregroundColor(AppColors.blue)
                    .padding(.horizontal, AppSpacing.base)
                    .padding(.vertical, AppSpacing.sm)
                    .background(AppColors.blue.opacity(0.1))
                    .cornerRadius(AppRadius.md)
                }
            }
        }
    }

    private func resultCard(label: String, value: String, icon: String, color: Color) -> some View {
        HStack {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundColor(color)
                .frame(width: 32)

            Text(label)
                .font(AppTypography.body())
                .foregroundColor(AppColors.text)

            Spacer()

            Text(value)
                .font(AppTypography.bodyBold())
                .foregroundColor(color)
        }
        .padding(AppSpacing.base)
        .background(Color.white)
        .cornerRadius(AppRadius.lg)
        .overlay(
            RoundedRectangle(cornerRadius: AppRadius.lg)
                .stroke(color.opacity(0.3), lineWidth: 1)
        )
    }

    // MARK: - Tax Rate Helper

    private var taxRateHelper: some View {
        VStack(alignment: .leading, spacing: AppSpacing.md) {
            HStack {
                Image(systemName: "info.circle.fill")
                    .foregroundColor(AppColors.blue)

                Text("Tax Rate Guide")
                    .font(AppTypography.bodyBold())
                    .foregroundColor(AppColors.text)
            }

            VStack(alignment: .leading, spacing: AppSpacing.sm) {
                Text("Typical tax withholding rates:")
                    .font(AppTypography.small())
                    .foregroundColor(AppColors.textGray)

                taxRateRow("Single, 0 dependents", "12-22%")
                taxRateRow("Single, 1+ dependents", "10-15%")
                taxRateRow("Married, 0 dependents", "10-15%")
                taxRateRow("Married, 1+ dependents", "8-12%")

                Text("These are estimates. Check your actual withholding with your employer.")
                    .font(AppTypography.small())
                    .foregroundColor(AppColors.textGray)
                    .italic()
            }
        }
        .padding(AppSpacing.base)
        .background(AppColors.blue.opacity(0.1))
        .cornerRadius(AppRadius.lg)
    }

    private func taxRateRow(_ label: String, _ rate: String) -> some View {
        HStack {
            Text("•")
                .foregroundColor(AppColors.blue)
            Text(label)
                .font(AppTypography.small())
                .foregroundColor(AppColors.text)
            Spacer()
            Text(rate)
                .font(AppTypography.small())
                .fontWeight(.medium)
                .foregroundColor(AppColors.blue)
        }
    }

    // MARK: - Calculations

    private var isValid: Bool {
        !grossPay.isEmpty && !taxRate.isEmpty
    }

    private var grossPayAmount: Double {
        Double(grossPay) ?? 0
    }

    private var taxRateAmount: Double {
        Double(taxRate) ?? 0
    }

    private var additionalDeductionsAmount: Double {
        Double(additionalDeductions) ?? 0
    }

    private var taxDeduction: Double {
        grossPayAmount * (taxRateAmount / 100)
    }

    private var netPay: Double {
        grossPayAmount - taxDeduction - additionalDeductionsAmount
    }

    // MARK: - Actions

    private func loadInitialValues() {
        // Load tax rate if saved
        if viewModel.taxRate > 0 {
            taxRate = String(format: "%.1f", viewModel.taxRate)
        }

        // Load gross pay from pay period if available
        if let earnings = viewModel.calculatePayPeriodEarnings() {
            grossPay = String(format: "%.2f", earnings)
        }
    }

    private func calculate() {
        showResults = true
    }

    private func saveTaxRate() {
        viewModel.taxRate = taxRateAmount

        // Save to backend if payroll info exists
        Task {
            // Note: This would require a backend endpoint to save tax rate
            // For now, just save locally
            print("💾 Tax rate saved: \(taxRateAmount)%")
        }
    }

    // MARK: - Helpers

    private func formatCurrency(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        return formatter.string(from: NSNumber(value: amount)) ?? "$0.00"
    }
}
