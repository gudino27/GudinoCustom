//
//  RescheduleRequestModal.swift
//  GCWadmin
//
//  Modal for requesting client to reschedule an appointment
//

import SwiftUI

struct RescheduleRequestModal: View {
    let appointment: Appointment
    @ObservedObject var viewModel: AppointmentsViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var message = ""

    var body: some View {
        NavigationStack {
            VStack(spacing: AppSpacing.lg) {
                // Info message
                GlassCard(intensity: .light, style: .light) {
                    VStack(alignment: .leading, spacing: AppSpacing.sm) {
                        HStack(spacing: AppSpacing.sm) {
                            Image(systemName: "envelope")
                                .foregroundColor(AppColors.blue)
                            Text("Reschedule Request")
                                .font(AppTypography.headline())
                                .foregroundColor(AppColors.text)
                        }

                        Text("An email will be sent to \(appointment.clientName) asking them to choose a new time.")
                            .font(AppTypography.caption())
                            .foregroundColor(AppColors.textGray)
                    }
                    .padding(AppSpacing.md)
                }

                // Message field
                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    Text("Message (optional)")
                        .font(AppTypography.small())
                        .fontWeight(.medium)
                        .foregroundColor(AppColors.textMedium)

                    TextEditor(text: $message)
                        .frame(height: 100)
                        .padding(AppSpacing.xs)
                        .background(Color.white)
                        .cornerRadius(AppRadius.sm)
                        .overlay(
                            RoundedRectangle(cornerRadius: AppRadius.sm)
                                .stroke(AppColors.border, lineWidth: 1)
                        )
                }
                .padding(.horizontal, AppSpacing.lg)

                Spacer()

                // Action buttons
                VStack(spacing: AppSpacing.sm) {
                    Button {
                        Task {
                            await viewModel.requestReschedule(
                                appointmentId: appointment.id,
                                message: message
                            )
                            dismiss()
                        }
                    } label: {
                        HStack {
                            if viewModel.isLoading {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                    .scaleEffect(0.8)
                            } else {
                                Image(systemName: "paperplane")
                            }
                            Text("Send Request")
                        }
                        .frame(maxWidth: .infinity)
                        .font(AppTypography.caption())
                        .foregroundColor(.white)
                        .padding(.vertical, AppSpacing.sm)
                        .background(AppColors.warning)
                        .cornerRadius(AppRadius.md)
                    }
                    .disabled(viewModel.isLoading)

                    Button("Cancel") {
                        dismiss()
                    }
                    .frame(maxWidth: .infinity)
                    .font(AppTypography.caption())
                    .foregroundColor(AppColors.textGray)
                    .padding(.vertical, AppSpacing.sm)
                    .background(AppColors.gray50)
                    .cornerRadius(AppRadius.md)
                }
                .padding(.horizontal, AppSpacing.lg)
            }
            .padding(.vertical, AppSpacing.lg)
            .background(AppColors.background)
            .navigationTitle("Request Reschedule")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
        }
    }
}
