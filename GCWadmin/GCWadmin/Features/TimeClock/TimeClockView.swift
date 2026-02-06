//
//  TimeClockView.swift
//  GCWadmin
//
//  Main TimeClock view with employee/admin toggle
//

import SwiftUI

struct TimeClockView: View {
    @EnvironmentObject var authManager: AuthManager
    @StateObject private var viewModel = TimeClockViewModel()
    @StateObject private var adminViewModel = TimeClockAdminViewModel()

    @State private var activeView: ViewType = .employee

    enum ViewType {
        case employee
        case admin
    }

    var body: some View {
        ZStack {
            AppColors.background
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Header with view toggle
                header

                // Content
                ScrollView {
                    if activeView == .employee {
                        EmployeeTimeClockView(viewModel: viewModel)
                            .padding(AppSpacing.lg)
                    } else {
                        AdminTimeClockView(viewModel: adminViewModel)
                            .padding(AppSpacing.lg)
                    }
                }
            }
        }
        // Employee Modals
        .sheet(isPresented: $viewModel.showManualEntry) {
            EmployeeManualEntryModal(
                viewModel: viewModel,
                isPresented: $viewModel.showManualEntry
            )
        }
        .sheet(isPresented: $viewModel.showTaxCalculator) {
            PaycheckCalculatorModal(viewModel: viewModel)
        }
        .sheet(isPresented: $viewModel.showDateEntries) {
            DateEntriesSheet(viewModel: viewModel)
        }
        // Admin Modals
        .sheet(isPresented: $adminViewModel.showManualEntry) {
            ManualEntryModal(viewModel: adminViewModel)
        }
        .sheet(isPresented: $adminViewModel.showPayrollModal) {
            PayrollSettingsModal(viewModel: adminViewModel)
        }
        .sheet(isPresented: $adminViewModel.showHoursReport) {
            HoursReportModal(viewModel: adminViewModel)
        }
        .sheet(isPresented: $adminViewModel.showEditEntry) {
            EditEntryModal(viewModel: adminViewModel)
        }
        .sheet(isPresented: $adminViewModel.showEmployeeAudit) {
            EmployeeAuditModal(viewModel: adminViewModel)
        }
    }

    // MARK: - Header
    private var header: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Time Clock")
                    .font(AppTypography.title2())
                    .foregroundColor(AppColors.text)

                Spacer()

                // View toggle (admin/super_admin only)
                if canAccessAdminView {
                    viewToggle
                }
            }
            .padding(.horizontal, AppSpacing.md)
            .padding(.vertical, AppSpacing.md)

            Divider()
        }
        .background(Color.white)
    }

    // MARK: - View Toggle
    private var viewToggle: some View {
        HStack(spacing: AppSpacing.xs) {
            toggleButton(title: "Employee", type: .employee)
            toggleButton(title: "Admin", type: .admin)
        }
        .padding(AppSpacing.xs)
        .background(Color.white.opacity(0.7))
        .background(.ultraThinMaterial)
        .cornerRadius(AppRadius.full)
        .overlay(
            RoundedRectangle(cornerRadius: AppRadius.full)
                .stroke(Color.white.opacity(0.3), lineWidth: 1)
        )
    }

    private func toggleButton(title: String, type: ViewType) -> some View {
        Button(action: {
            withAnimation(.easeInOut(duration: 0.2)) {
                activeView = type
            }
        }) {
            Text(title)
                .font(AppTypography.caption())
                .fontWeight(.semibold)
                .foregroundColor(activeView == type ? .white : AppColors.textMedium)
                .padding(.horizontal, AppSpacing.base)
                .padding(.vertical, AppSpacing.sm)
                .background(
                    activeView == type
                        ? AppColors.blue
                        : Color.clear
                )
                .cornerRadius(AppRadius.full)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Helpers
    private var canAccessAdminView: Bool {
        authManager.currentUser?.role.canAccessAdminFeatures ?? false
    }
}

// MARK: - Preview
#Preview {
    TimeClockView()
        .environmentObject(AuthManager())
}
