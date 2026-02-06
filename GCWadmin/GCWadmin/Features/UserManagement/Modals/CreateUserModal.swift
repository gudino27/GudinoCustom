//
//  CreateUserModal.swift
//  GCWadmin
//
//  Modal for creating new users manually
//

import SwiftUI

struct CreateUserModal: View {
    @ObservedObject var viewModel: UserManagementViewModel
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationView {
            Form {
                Section("User Information") {
                    TextField("Username", text: $viewModel.username)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()

                    TextField("Email (optional)", text: $viewModel.email)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()

                    TextField("Full Name (optional)", text: $viewModel.fullName)
                }

                Section("Password") {
                    SecureField("Password", text: $viewModel.password)
                    SecureField("Confirm Password", text: $viewModel.confirmPassword)
                }

                Section("Role") {
                    Picker("Role", selection: $viewModel.selectedRole) {
                        ForEach(UserRole.allCases, id: \.self) { role in
                            Text(role.displayName).tag(role)
                        }
                    }
                    .pickerStyle(.segmented)
                }
            }
            .navigationTitle("Create User")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        viewModel.resetForm()
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        Task {
                            await viewModel.createUser()
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
