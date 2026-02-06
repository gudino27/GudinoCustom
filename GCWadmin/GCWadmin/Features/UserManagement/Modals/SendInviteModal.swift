//
//  SendInviteModal.swift
//  GCWadmin
//
//  Modal for sending user invitations
//

import SwiftUI

struct SendInviteModal: View {
    @ObservedObject var viewModel: UserManagementViewModel
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationView {
            Form {
                Section("Recipient Information") {
                    TextField("Full Name", text: $viewModel.fullName)

                    if viewModel.deliveryMethod == "email" || viewModel.deliveryMethod == "both" {
                        TextField("Email", text: $viewModel.email)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                    }

                    if viewModel.deliveryMethod == "sms" || viewModel.deliveryMethod == "both" {
                        TextField("Phone", text: $viewModel.phone)
                            .keyboardType(.phonePad)
                    }
                }

                Section("Role") {
                    Picker("Role", selection: $viewModel.selectedRole) {
                        ForEach(UserRole.allCases, id: \.self) { role in
                            Text(role.displayName).tag(role)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                Section("Delivery Method") {
                    Picker("Method", selection: $viewModel.deliveryMethod) {
                        Text("Email").tag("email")
                        Text("SMS").tag("sms")
                        Text("Both").tag("both")
                    }
                    .pickerStyle(.segmented)
                }

                Section("Language") {
                    Picker("Language", selection: $viewModel.language) {
                        Text("English").tag("en")
                        Text("Spanish").tag("es")
                    }
                    .pickerStyle(.segmented)
                }
            }
            .navigationTitle("Send Invitation")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        viewModel.resetForm()
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Send") {
                        Task {
                            await viewModel.sendInvite()
                            if viewModel.errorMessage == nil {
                                dismiss()
                            }
                        }
                    }
                    .disabled(viewModel.isLoading)
                }
            }
        }
    }
}
