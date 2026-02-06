//
//  AppointmentDetailSheet.swift
//  GCWadmin
//
//  Modal sheet for viewing and managing appointment details
//

import SwiftUI

struct AppointmentDetailSheet: View {
    let appointment: Appointment
    @ObservedObject var viewModel: AppointmentsViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var showDeleteConfirmation = false
    @State private var showRescheduleModal = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: AppSpacing.lg) {
                    // Status badge and ID
                    HStack(spacing: AppSpacing.sm) {
                        StatusBadge.appointmentStatus(appointment.status)
                        Text("#\(appointment.id)")
                            .font(AppTypography.small())
                            .foregroundColor(AppColors.textGray)
                        Spacer()
                    }

                    // Date & Time
                    infoSection(title: "Date & Time") {
                        VStack(alignment: .leading, spacing: AppSpacing.xs) {
                            Text(appointment.formattedDate)
                                .font(AppTypography.body())
                                .fontWeight(.medium)
                                .foregroundColor(AppColors.text)
                            Text(appointment.formattedTime)
                                .font(AppTypography.caption())
                                .foregroundColor(AppColors.textGray)
                            Text("Duration: \(appointment.duration) minutes")
                                .font(AppTypography.caption())
                                .foregroundColor(AppColors.textGray)
                        }
                    }

                    // Type
                    infoSection(title: "Appointment Type") {
                        Text(appointment.appointmentTypeLabel)
                            .font(AppTypography.body())
                            .fontWeight(.medium)
                            .foregroundColor(AppColors.text)
                    }

                    // Client Information
                    infoSection(title: "Client Information") {
                        VStack(alignment: .leading, spacing: AppSpacing.xs) {
                            HStack {
                                Text("Name:")
                                    .foregroundColor(AppColors.textGray)
                                Text(appointment.clientName)
                                    .fontWeight(.medium)
                            }
                            .font(AppTypography.caption())

                            HStack {
                                Text("Email:")
                                    .foregroundColor(AppColors.textGray)
                                Text(appointment.clientEmail)
                                    .fontWeight(.medium)
                            }
                            .font(AppTypography.caption())

                            HStack {
                                Text("Phone:")
                                    .foregroundColor(AppColors.textGray)
                                Text(appointment.clientPhone)
                                    .fontWeight(.medium)
                            }
                            .font(AppTypography.caption())

                            if let address = appointment.locationAddress {
                                HStack(alignment: .top) {
                                    Text("Address:")
                                        .foregroundColor(AppColors.textGray)
                                    Text(address)
                                        .fontWeight(.medium)
                                }
                                .font(AppTypography.caption())
                            }
                        }
                    }

                    // Notes
                    if let notes = appointment.notes, !notes.isEmpty {
                        infoSection(title: "Notes") {
                            Text(notes)
                                .font(AppTypography.caption())
                                .foregroundColor(AppColors.textGray)
                        }
                    }

                    // Status Management
                    infoSection(title: "Status") {
                        Picker("Status", selection: Binding(
                            get: { appointment.status },
                            set: { newStatus in
                                Task {
                                    await viewModel.updateStatus(appointmentId: appointment.id, status: newStatus)
                                }
                            }
                        )) {
                            Text("Pending").tag("pending")
                            Text("Confirmed").tag("confirmed")
                            Text("Completed").tag("completed")
                            Text("Cancelled").tag("cancelled")
                            Text("No Show").tag("no_show")
                            Text("Needs Reschedule").tag("needs_reschedule")
                        }
                        .pickerStyle(.menu)
                    }

                    // Employee Assignment
                    infoSection(title: "Assigned Employee") {
                        Picker("Employee", selection: Binding(
                            get: { appointment.assignedEmployeeId ?? -1 },
                            set: { newEmployeeId in
                                Task {
                                    await viewModel.assignEmployee(
                                        appointmentId: appointment.id,
                                        employeeId: newEmployeeId == -1 ? nil : newEmployeeId
                                    )
                                }
                            }
                        )) {
                            Text("Unassigned").tag(-1)
                            ForEach(viewModel.employees) { emp in
                                Text(emp.name).tag(emp.id)
                            }
                        }
                        .pickerStyle(.menu)
                    }

                    // Action Buttons
                    VStack(spacing: AppSpacing.md) {
                        if appointment.status == "pending" {
                            Button {
                                Task {
                                    await viewModel.updateStatus(appointmentId: appointment.id, status: "confirmed")
                                }
                            } label: {
                                HStack {
                                    Image(systemName: "checkmark.circle")
                                    Text("Confirm Appointment")
                                }
                                .frame(maxWidth: .infinity)
                                .font(AppTypography.caption())
                                .foregroundColor(.white)
                                .padding(.vertical, AppSpacing.sm)
                                .background(AppColors.success)
                                .cornerRadius(AppRadius.md)
                            }

                            Button {
                                showRescheduleModal = true
                            } label: {
                                HStack {
                                    Image(systemName: "calendar.badge.clock")
                                    Text("Request Different Time")
                                }
                                .frame(maxWidth: .infinity)
                                .font(AppTypography.caption())
                                .foregroundColor(.white)
                                .padding(.vertical, AppSpacing.sm)
                                .background(AppColors.warning)
                                .cornerRadius(AppRadius.md)
                            }
                        }

                        if appointment.status == "confirmed" {
                            Button {
                                Task {
                                    await viewModel.updateStatus(appointmentId: appointment.id, status: "completed")
                                }
                            } label: {
                                HStack {
                                    Image(systemName: "checkmark.circle.fill")
                                    Text("Mark as Completed")
                                }
                                .frame(maxWidth: .infinity)
                                .font(AppTypography.caption())
                                .foregroundColor(.white)
                                .padding(.vertical, AppSpacing.sm)
                                .background(AppColors.blue)
                                .cornerRadius(AppRadius.md)
                            }
                        }

                        Button(role: .destructive) {
                            showDeleteConfirmation = true
                        } label: {
                            HStack {
                                Image(systemName: "trash")
                                Text("Delete Appointment")
                            }
                            .frame(maxWidth: .infinity)
                            .font(AppTypography.caption())
                            .foregroundColor(.white)
                            .padding(.vertical, AppSpacing.sm)
                            .background(AppColors.error)
                            .cornerRadius(AppRadius.md)
                        }
                    }
                }
                .padding(AppSpacing.lg)
            }
            .background(AppColors.background)
            .navigationTitle("Appointment Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") {
                        dismiss()
                    }
                }
            }
            .alert("Delete Appointment", isPresented: $showDeleteConfirmation) {
                Button("Cancel", role: .cancel) { }
                Button("Delete", role: .destructive) {
                    Task {
                        await viewModel.deleteAppointment(id: appointment.id)
                        dismiss()
                    }
                }
            } message: {
                Text("Are you sure you want to delete this appointment? This action cannot be undone.")
            }
            .sheet(isPresented: $showRescheduleModal) {
                RescheduleRequestModal(appointment: appointment, viewModel: viewModel)
            }
        }
    }

    private func infoSection<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: AppSpacing.xs) {
            Text(title)
                .font(AppTypography.small())
                .fontWeight(.semibold)
                .foregroundColor(AppColors.textMedium)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(AppSpacing.md)
        .background(
            RoundedRectangle(cornerRadius: AppRadius.md)
                .fill(Color.white)
                .shadow(color: Color.black.opacity(0.05), radius: 2, x: 0, y: 1)
        )
    }
}
