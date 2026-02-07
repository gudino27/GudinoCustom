//
//  ManageAvailabilitySheet.swift
//  GCWadmin
//
//  Modal sheet for managing employee availability schedules
//

import SwiftUI

struct ManageAvailabilitySheet: View {
    let employee: Employee
    @ObservedObject var viewModel: AppointmentsViewModel
    @Environment(\.dismiss) private var dismiss

    // Form state for adding new schedule
    @State private var selectedDay = 1 // Monday
    @State private var startTime = "09:00"
    @State private var endTime = "17:00"
    @State private var deleteConfirmation: EmployeeAvailability?

    private let dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: AppSpacing.lg) {
                    // Add new schedule form
                    GlassCard(intensity: .light, style: .light) {
                        VStack(alignment: .leading, spacing: AppSpacing.md) {
                            Text("Add Schedule")
                                .font(AppTypography.headline())
                                .foregroundColor(AppColors.text)

                        VStack(spacing: AppSpacing.md) {
                            // Day picker - own row
                            VStack(alignment: .leading, spacing: AppSpacing.xs) {
                                Text("Day")
                                    .font(AppTypography.small())
                                    .foregroundColor(AppColors.textGray)
                                Picker("Day", selection: $selectedDay) {
                                    ForEach(0..<7) { day in
                                        Text(dayNames[day]).tag(day)
                                    }
                                }
                                .pickerStyle(.menu)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            }

                            // Times + Add button row
                            HStack(spacing: AppSpacing.md) {
                                // Start time
                                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                                    Text("Start Time")
                                        .font(AppTypography.small())
                                        .foregroundColor(AppColors.textGray)
                                    TextField("HH:MM", text: $startTime)
                                        .textFieldStyle(.roundedBorder)
                                        .frame(width: 80)
                                }

                                // End time
                                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                                    Text("End Time")
                                        .font(AppTypography.small())
                                        .foregroundColor(AppColors.textGray)
                                    TextField("HH:MM", text: $endTime)
                                        .textFieldStyle(.roundedBorder)
                                        .frame(width: 80)
                                }

                                Spacer()

                                // Add button
                                VStack {
                                    Spacer()
                                    Button {
                                        Task {
                                            await viewModel.createAvailability(
                                                employeeId: employee.id,
                                                dayOfWeek: selectedDay,
                                                startTime: startTime,
                                                endTime: endTime
                                            )
                                        }
                                    } label: {
                                        HStack(spacing: 4) {
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
                            }
                        }
                        }
                        .padding(AppSpacing.md)
                    }

                    // Current schedules
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        Text("Current Schedules")
                            .font(AppTypography.headline())
                            .foregroundColor(AppColors.text)

                        if viewModel.availability.isEmpty {
                            emptyState
                        } else {
                            ForEach(viewModel.availability) { slot in
                                availabilitySlotCard(slot)
                            }
                        }
                    }

                    // Info card
                    GlassCard(intensity: .light, style: .light) {
                        HStack(spacing: AppSpacing.sm) {
                            Image(systemName: "info.circle.fill")
                                .foregroundColor(AppColors.blue)
                            Text("Customers can only book appointments during the times configured here.")
                                .font(AppTypography.caption())
                                .foregroundColor(AppColors.text)
                        }
                        .padding(AppSpacing.md)
                    }
                }
                .padding(AppSpacing.lg)
            }
            .background(AppColors.background)
            .navigationTitle("Manage Availability - \(employee.name)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") {
                        dismiss()
                    }
                }
            }
            .task {
                await viewModel.fetchAvailability(employeeId: employee.id)
            }
            .alert("Delete Schedule", isPresented: Binding(
                get: { deleteConfirmation != nil },
                set: { if !$0 { deleteConfirmation = nil } }
            ), presenting: deleteConfirmation) { slot in
                Button("Cancel", role: .cancel) { }
                Button("Delete", role: .destructive) {
                    Task {
                        await viewModel.deleteAvailability(id: slot.id, employeeId: employee.id)
                    }
                }
            } message: { slot in
                Text("Are you sure you want to delete this schedule for \(slot.dayName)?")
            }
        }
    }

    private func availabilitySlotCard(_ slot: EmployeeAvailability) -> some View {
        GlassCard(intensity: .light, style: .light) {
            HStack(spacing: AppSpacing.md) {
                // Day indicator
                Circle()
                    .fill(AppColors.blue.opacity(0.2))
                    .frame(width: 32, height: 32)
                    .overlay(
                        Text(String(slot.dayName.prefix(1)))
                            .font(AppTypography.small())
                            .fontWeight(.semibold)
                            .foregroundColor(AppColors.blue)
                    )

                // Day and time info
                VStack(alignment: .leading, spacing: 2) {
                    Text(slot.dayName)
                        .font(AppTypography.caption())
                        .fontWeight(.medium)
                        .foregroundColor(AppColors.text)
                    Text(slot.timeRange)
                        .font(AppTypography.small())
                        .foregroundColor(AppColors.textGray)
                }

                Spacer()

                // Status badge
                StatusBadge(
                    label: slot.isAvailable ? "Available" : "Unavailable",
                    color: slot.isAvailable ? AppColors.success : AppColors.error,
                    bgColor: slot.isAvailable ? AppColors.successBg : AppColors.errorBg
                )

                // Delete button
                Button {
                    deleteConfirmation = slot
                } label: {
                    Image(systemName: "trash")
                        .font(.system(size: 12))
                        .foregroundColor(AppColors.error)
                        .frame(width: 28, height: 28)
                        .background(AppColors.error.opacity(0.1))
                        .cornerRadius(AppRadius.sm)
                }
            }
            .padding(AppSpacing.sm)
        }
    }

    private var emptyState: some View {
        GlassCard(intensity: .light, style: .light) {
            VStack(spacing: AppSpacing.md) {
                Image(systemName: "clock")
                    .font(.system(size: 36))
                    .foregroundColor(AppColors.textLight)
                Text("No Schedule Configured")
                    .font(AppTypography.caption())
                    .foregroundColor(AppColors.textGray)
                Text("Use the form above to add schedules.")
                    .font(AppTypography.small())
                    .foregroundColor(AppColors.textLight)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, AppSpacing.xl)
        }
    }
}
