//
//  AppointmentsView.swift
//  GCWadmin
//
//  Main appointments view with sub-tabs for appointments, availability, and blocked times
//

import SwiftUI

struct AppointmentsView: View {
    @StateObject private var viewModel = AppointmentsViewModel()

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.lg) {
                // Sub-tab bar
                SubTabBar(
                    tabs: [
                        SubTab(id: "appointments", label: "Appointments", icon: "calendar"),
                        SubTab(id: "availability", label: "Availability", icon: "clock"),
                        SubTab(id: "blocked", label: "Blocked Times", icon: "calendar.badge.exclamationmark")
                    ],
                    selection: $viewModel.selectedTab
                )
                .onChange(of: viewModel.selectedTab) { _, newTab in
                    if newTab == "blocked" {
                        Task { await viewModel.loadBlockedTimes() }
                    }
                }

                // Content based on selected tab
                switch viewModel.selectedTab {
                case "appointments":
                    appointmentsSection
                case "availability":
                    availabilitySection
                case "blocked":
                    blockedTimesSection
                default:
                    appointmentsSection
                }
            }
            .padding(AppSpacing.lg)
        }
        .background(AppColors.background)
        .navigationTitle("Appointments")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.loadAll()
        }
        .sheet(isPresented: $viewModel.showAppointmentDetail) {
            if let appointment = viewModel.selectedAppointment {
                AppointmentDetailSheet(appointment: appointment, viewModel: viewModel)
            }
        }
        .sheet(isPresented: $viewModel.showAddBlockedTime) {
            AddBlockedTimeSheet(viewModel: viewModel)
        }
        .overlay(alignment: .top) {
            notificationOverlay
        }
    }

    // MARK: - Notification Overlay

    private var notificationOverlay: some View {
        VStack {
            if let success = viewModel.successMessage {
                HStack {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.white)
                    Text(success)
                        .font(AppTypography.caption())
                        .foregroundColor(.white)
                }
                .padding(AppSpacing.md)
                .background(AppColors.success)
                .cornerRadius(AppRadius.md)
                .padding(.top, AppSpacing.sm)
                .onAppear {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                        viewModel.successMessage = nil
                    }
                }
            }

            if let error = viewModel.errorMessage {
                HStack {
                    Image(systemName: "exclamationmark.circle.fill")
                        .foregroundColor(.white)
                    Text(error)
                        .font(AppTypography.caption())
                        .foregroundColor(.white)
                }
                .padding(AppSpacing.md)
                .background(AppColors.error)
                .cornerRadius(AppRadius.md)
                .padding(.top, AppSpacing.sm)
                .onAppear {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 5) {
                        viewModel.errorMessage = nil
                    }
                }
            }
        }
    }

    // MARK: - Appointments Section

    private var appointmentsSection: some View {
        VStack(spacing: AppSpacing.lg) {
            // Filters
            GlassCard(intensity: .light, style: .light) {
                VStack(spacing: AppSpacing.sm) {
                    HStack {
                        // Status filter
                        VStack(alignment: .leading, spacing: AppSpacing.xs) {
                            Text("Status")
                                .font(AppTypography.small())
                                .fontWeight(.medium)
                                .foregroundColor(AppColors.textMedium)
                            Picker("Status", selection: $viewModel.statusFilter) {
                                Text("All").tag("all")
                                Text("Pending").tag("pending")
                                Text("Confirmed").tag("confirmed")
                                Text("Completed").tag("completed")
                                Text("Cancelled").tag("cancelled")
                            }
                            .pickerStyle(.menu)
                        }

                        Spacer()

                        Button {
                            Task { await viewModel.loadAppointments() }
                        } label: {
                            Image(systemName: "arrow.clockwise")
                                .font(.system(size: 14))
                                .foregroundColor(AppColors.textGray)
                                .padding(AppSpacing.xs)
                        }
                    }

                    HStack {
                        // Date filter - full width row
                        VStack(alignment: .leading, spacing: AppSpacing.xs) {
                            Text("Date Range")
                                .font(AppTypography.small())
                                .fontWeight(.medium)
                                .foregroundColor(AppColors.textMedium)
                            Picker("Date Range", selection: $viewModel.dateFilter) {
                                Text("Upcoming").tag("upcoming")
                                Text("Today").tag("today")
                                Text("This Week").tag("week")
                                Text("Past").tag("past")
                                Text("All").tag("all")
                            }
                            .pickerStyle(.menu)
                        }
                        Spacer()
                    }
                }
                .padding(AppSpacing.md)
            }

            // Appointments list
            if viewModel.isLoading && viewModel.appointments.isEmpty {
                loadingState
            } else if viewModel.appointments.isEmpty {
                emptyAppointmentsState
            } else {
                appointmentsList
            }
        }
    }

    private var appointmentsList: some View {
        GlassCard(intensity: .light, style: .light) {
            VStack(spacing: 0) {
                ForEach(Array(viewModel.appointments.enumerated()), id: \.element.id) { index, appointment in
                    VStack(spacing: 0) {
                        appointmentRow(appointment)
                        if index < viewModel.appointments.count - 1 {
                            Divider()
                        }
                    }
                }
            }
        }
    }

    private func appointmentRow(_ appointment: Appointment) -> some View {
        Button {
            viewModel.selectAppointment(appointment)
        } label: {
            HStack(spacing: AppSpacing.md) {
                // Date/Time column
                VStack(alignment: .leading, spacing: 2) {
                    Text(appointment.formattedDate)
                        .font(AppTypography.caption())
                        .fontWeight(.medium)
                        .foregroundColor(AppColors.text)
                    Text(appointment.formattedTime)
                        .font(AppTypography.small())
                        .foregroundColor(AppColors.textGray)
                    Text("\(appointment.duration) min")
                        .font(AppTypography.small())
                        .foregroundColor(AppColors.textLight)
                }
                .frame(width: 100, alignment: .leading)

                // Client info column
                VStack(alignment: .leading, spacing: 2) {
                    Text(appointment.clientName)
                        .font(AppTypography.caption())
                        .fontWeight(.medium)
                        .foregroundColor(AppColors.text)
                    Text(appointment.clientEmail)
                        .font(AppTypography.small())
                        .foregroundColor(AppColors.textGray)
                        .lineLimit(1)
                    Text(appointment.clientPhone)
                        .font(AppTypography.small())
                        .foregroundColor(AppColors.textGray)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                // Type & Status column
                VStack(alignment: .trailing, spacing: AppSpacing.xs) {
                    Text(appointment.appointmentTypeLabel)
                        .font(AppTypography.small())
                        .foregroundColor(AppColors.textGray)
                    StatusBadge.appointmentStatus(appointment.status)
                }

                // Assigned employee
                VStack(alignment: .trailing, spacing: 2) {
                    if let empName = appointment.assignedEmployeeName {
                        Text(empName)
                            .font(AppTypography.small())
                            .foregroundColor(AppColors.textGray)
                            .lineLimit(1)
                    } else {
                        Text("Unassigned")
                            .font(AppTypography.small())
                            .foregroundColor(AppColors.textLight)
                            .italic()
                    }
                }
                .frame(width: 80, alignment: .trailing)

                Image(systemName: "chevron.right")
                    .font(.system(size: 12))
                    .foregroundColor(AppColors.textLight)
            }
            .padding(AppSpacing.md)
        }
        .buttonStyle(.plain)
    }

    private var emptyAppointmentsState: some View {
        GlassCard(intensity: .light, style: .light) {
            VStack(spacing: AppSpacing.lg) {
                Image(systemName: "calendar")
                    .font(.system(size: 48))
                    .foregroundColor(AppColors.textLight)
                Text("No Appointments")
                    .font(AppTypography.headline())
                    .foregroundColor(AppColors.textGray)
                Text("No appointments found for the selected filters")
                    .font(AppTypography.caption())
                    .foregroundColor(AppColors.textLight)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, AppSpacing.xxxxl)
        }
    }

    // MARK: - Availability Section

    private var availabilitySection: some View {
        VStack(spacing: AppSpacing.lg) {
            // Info card
            GlassCard(intensity: .light, style: .light) {
                HStack(spacing: AppSpacing.sm) {
                    Image(systemName: "info.circle.fill")
                        .foregroundColor(AppColors.blue)
                    Text("Configure availability schedules for each employee. These schedules will be used for the appointment booking system.")
                        .font(AppTypography.caption())
                        .foregroundColor(AppColors.text)
                }
                .padding(AppSpacing.md)
            }

            // Employees list
            if viewModel.employees.isEmpty {
                emptyEmployeesState
            } else {
                ForEach(viewModel.employees) { employee in
                    AvailabilityEmployeeCard(employee: employee, viewModel: viewModel)
                }
            }
        }
    }

    private var emptyEmployeesState: some View {
        GlassCard(intensity: .light, style: .light) {
            VStack(spacing: AppSpacing.lg) {
                Image(systemName: "person.2.slash")
                    .font(.system(size: 48))
                    .foregroundColor(AppColors.textLight)
                Text("No Employees")
                    .font(AppTypography.headline())
                    .foregroundColor(AppColors.textGray)
                Text("Add employees first before configuring availability")
                    .font(AppTypography.caption())
                    .foregroundColor(AppColors.textLight)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, AppSpacing.xxxxl)
        }
    }

    // MARK: - Blocked Times Section

    private var blockedTimesSection: some View {
        VStack(spacing: AppSpacing.lg) {
            // Header with add button
            HStack {
                GlassCard(intensity: .light, style: .light) {
                    HStack(spacing: AppSpacing.sm) {
                        Image(systemName: "info.circle.fill")
                            .foregroundColor(AppColors.warning)
                        Text("Block times for vacations, meetings, or other events. Customers will not be able to book during these periods.")
                            .font(AppTypography.caption())
                            .foregroundColor(AppColors.text)
                    }
                    .padding(AppSpacing.md)
                }

                Button {
                    viewModel.showAddBlockedTime = true
                } label: {
                    HStack(spacing: AppSpacing.xs) {
                        Image(systemName: "plus")
                        Text("Add")
                    }
                    .font(AppTypography.caption())
                    .foregroundColor(.white)
                    .padding(.horizontal, AppSpacing.md)
                    .padding(.vertical, AppSpacing.sm)
                    .background(AppColors.blue)
                    .cornerRadius(AppRadius.md)
                }
            }

            // Blocked times list
            if viewModel.blockedTimes.isEmpty {
                emptyBlockedTimesState
            } else {
                ForEach(viewModel.blockedTimes) { blockedTime in
                    blockedTimeCard(blockedTime)
                }
            }
        }
    }

    private func blockedTimeCard(_ blockedTime: BlockedTime) -> some View {
        GlassCard(intensity: .light, style: .light) {
            HStack(spacing: AppSpacing.md) {
                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    Text(blockedTime.reason)
                        .font(AppTypography.body())
                        .fontWeight(.medium)
                        .foregroundColor(AppColors.text)
                    Text(blockedTime.dateRange)
                        .font(AppTypography.small())
                        .foregroundColor(AppColors.textGray)
                    Text(blockedTime.employeeName ?? "All Employees")
                        .font(AppTypography.small())
                        .foregroundColor(AppColors.textLight)
                }

                Spacer()

                Button {
                    Task { await viewModel.deleteBlockedTime(id: blockedTime.id) }
                } label: {
                    Image(systemName: "trash")
                        .font(.system(size: 14))
                        .foregroundColor(AppColors.error)
                        .frame(width: 32, height: 32)
                        .background(AppColors.error.opacity(0.1))
                        .cornerRadius(AppRadius.sm)
                }
            }
            .padding(AppSpacing.md)
        }
    }

    private var emptyBlockedTimesState: some View {
        GlassCard(intensity: .light, style: .light) {
            VStack(spacing: AppSpacing.lg) {
                Image(systemName: "calendar.badge.clock")
                    .font(.system(size: 48))
                    .foregroundColor(AppColors.textLight)
                Text("No Blocked Times")
                    .font(AppTypography.headline())
                    .foregroundColor(AppColors.textGray)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, AppSpacing.xxxxl)
        }
    }

    // MARK: - Loading State

    private var loadingState: some View {
        GlassCard(intensity: .light, style: .light) {
            VStack(spacing: AppSpacing.md) {
                ProgressView()
                Text("Loading...")
                    .font(AppTypography.caption())
                    .foregroundColor(AppColors.textGray)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, AppSpacing.xxl)
        }
    }
}

// MARK: - Availability Employee Card

struct AvailabilityEmployeeCard: View {
    let employee: Employee
    @ObservedObject var viewModel: AppointmentsViewModel
    @State private var showManageSheet = false

    var body: some View {
        GlassCard(intensity: .light, style: .light) {
            HStack(spacing: AppSpacing.md) {
                // Employee info
                HStack(spacing: AppSpacing.sm) {
                    Circle()
                        .fill(AppColors.blue.opacity(0.2))
                        .frame(width: 40, height: 40)
                        .overlay(
                            Text(employee.initials)
                                .font(AppTypography.caption())
                                .fontWeight(.semibold)
                                .foregroundColor(AppColors.blue)
                        )

                    VStack(alignment: .leading, spacing: 2) {
                        Text(employee.name)
                            .font(AppTypography.body())
                            .fontWeight(.medium)
                            .foregroundColor(AppColors.text)
                        Text(employee.position)
                            .font(AppTypography.small())
                            .foregroundColor(AppColors.textGray)
                    }
                }

                Spacer()

                Button {
                    showManageSheet = true
                } label: {
                    Text("Manage Schedule")
                        .font(AppTypography.caption())
                        .foregroundColor(.white)
                        .padding(.horizontal, AppSpacing.md)
                        .padding(.vertical, AppSpacing.sm)
                        .background(AppColors.blue)
                        .cornerRadius(AppRadius.md)
                }
            }
            .padding(AppSpacing.md)
        }
        .sheet(isPresented: $showManageSheet) {
            ManageAvailabilitySheet(employee: employee, viewModel: viewModel)
        }
    }
}
