//
//  EditUserModal.swift
//  GCWadmin
//
//  Modal for editing existing users
//

import SwiftUI

struct EditUserModal: View {
    @ObservedObject var viewModel: UserManagementViewModel
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationView {
            Form {
                if let user = viewModel.editingUser {
                    Section("User Information") {
                        HStack {
                            Text("Username")
                            Spacer()
                            Text(user.username)
                                .foregroundColor(AppColors.textGray)
                        }

                        TextField("Email (optional)", text: $viewModel.email)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()

                        TextField("Full Name (optional)", text: $viewModel.fullName)
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
            }
            .navigationTitle("Edit User")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        viewModel.resetForm()
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task {
                            await viewModel.updateUser()
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
