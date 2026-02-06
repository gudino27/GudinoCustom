//
//  PayrollSettingsModal.swift
//  GCWadmin
//
//  Modal for editing employee payroll settings
//

import SwiftUI

struct PayrollSettingsModal: View {
    @ObservedObject var viewModel: TimeClockAdminViewModel
    @Environment(\.dismiss) var dismiss

    @State private var employmentType: EmploymentType = .hourly
    @State private var hourlyRate: String = ""
    @State private var overtimeRate: String = ""
    @State private var annualSalary: String = ""
    @State private var payPeriodType: PayPeriodType = .biweekly

    var body: some View {
        NavigationView {
            Form {
                if let employee = viewModel.payrollModalEmployee {
                    Section {
                        Text(employee.displayName)
                            .font(AppTypography.headline())
                        Text(employee.role.displayName)
                            .font(AppTypography.caption())
                            .foregroundColor(AppColors.textGray)
                    }

                    Section("Employment Type") {
                        Picker("Type", selection: $employmentType) {
                            Text("Hourly").tag(EmploymentType.hourly)
                            Text("Salary").tag(EmploymentType.salary)
                        }
                        .pickerStyle(.segmented)
                    }

                    if employmentType == .hourly {
                        Section("Hourly Rates") {
                            HStack {
                                Text("Hourly Rate")
                                Spacer()
                                TextField("0.00", text: $hourlyRate)
                                    .keyboardType(.decimalPad)
                                    .multilineTextAlignment(.trailing)
                                Text("$/hr")
                                    .foregroundColor(AppColors.textGray)
                            }

                            HStack {
                                Text("Overtime Rate")
                                Spacer()
                                TextField("0.00", text: $overtimeRate)
                                    .keyboardType(.decimalPad)
                                    .multilineTextAlignment(.trailing)
                                Text("$/hr")
                                    .foregroundColor(AppColors.textGray)
                            }
                        }
                    } else {
                        Section("Salary") {
                            HStack {
                                Text("Annual Salary")
                                Spacer()
                                TextField("0.00", text: $annualSalary)
                                    .keyboardType(.decimalPad)
                                    .multilineTextAlignment(.trailing)
                                Text("$/year")
                                    .foregroundColor(AppColors.textGray)
                            }
                        }
                    }

                    Section("Pay Period") {
                        Picker("Pay Period Type", selection: $payPeriodType) {
                            Text("Weekly").tag(PayPeriodType.weekly)
                            Text("Bi-weekly").tag(PayPeriodType.biweekly)
                            Text("Semi-monthly").tag(PayPeriodType.semimonthly)
                            Text("Monthly").tag(PayPeriodType.monthly)
                        }
                    }
                }
            }
            .navigationTitle("Payroll Settings")
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
                            await savePayroll()
                        }
                    }
                    .disabled(viewModel.actionInProgress)
                }
            }
        }
        .onAppear {
            loadCurrentSettings()
        }
    }

    private func loadCurrentSettings() {
        guard let employee = viewModel.payrollModalEmployee,
              let payroll = viewModel.employeePayrollInfo[employee.id] else {
            return
        }

        employmentType = payroll.employmentType
        payPeriodType = payroll.payPeriodType

        if let rate = payroll.hourlyRate {
            hourlyRate = String(format: "%.2f", rate)
        }
        if let ot = payroll.overtimeRate {
            overtimeRate = String(format: "%.2f", ot)
        }
        if let salary = payroll.annualSalary {
            annualSalary = String(format: "%.2f", salary)
        }
    }

    private func savePayroll() async {
        let hourlyRateValue = Double(hourlyRate)
        let overtimeRateValue = Double(overtimeRate)
        let salaryValue = Double(annualSalary)

        await viewModel.savePayrollSettings(
            employmentType: employmentType,
            hourlyRate: hourlyRateValue,
            overtimeRate: overtimeRateValue,
            annualSalary: salaryValue,
            payPeriodType: payPeriodType
        )

        if viewModel.errorMessage == nil {
            dismiss()
        }
    }
}
