//
//  AddUserModal.swift
//  GCWadmin
//
//  Unified modal for creating users - Manual or Invitation
//

import SwiftUI

struct AddUserModal: View {
    @ObservedObject var viewModel: UserManagementViewModel
    @Environment(\.dismiss) var dismiss

    @State private var creationMode: CreationMode = .invite
    @State private var showPassword = false
    @State private var showConfirmPassword = false

    enum CreationMode {
        case manual
        case invite
    }

    private var isManualFormValid: Bool {
        guard !viewModel.username.isEmpty,
              !viewModel.password.isEmpty,
              !viewModel.confirmPassword.isEmpty else {
            return false
        }

        guard viewModel.password == viewModel.confirmPassword else {
            return false
        }

        return PasswordValidator.validate(viewModel.password).isValid
    }

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Mode Selector (Manual / Invite)
                Picker("Creation Mode", selection: $creationMode) {
                    Text("Manual").tag(CreationMode.manual)
                    Text("Invite").tag(CreationMode.invite)
                }
                .pickerStyle(.segmented)
                .padding()

                // Form Content
                if creationMode == .manual {
                    manualCreationForm
                } else {
                    inviteCreationForm
                }
            }
            .navigationTitle("Add New User")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        viewModel.resetForm()
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    if creationMode == .manual {
                        Button("Create User") {
                            Task {
                                await viewModel.createUser()
                                if viewModel.errorMessage == nil {
                                    dismiss()
                                }
                            }
                        }
                        .disabled(viewModel.isLoading || !isManualFormValid)
                    } else {
                        Button("Send Invitation") {
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

    // MARK: - Manual Creation Form

    private var manualCreationForm: some View {
        Form {
            Section {
                TextField("Username", text: $viewModel.username)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()

                TextField("Email", text: $viewModel.email)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()

                TextField("Full Name", text: $viewModel.fullName)
            }

            Section("Password") {
                HStack {
                    if showPassword {
                        TextField("Password", text: $viewModel.password)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                    } else {
                        SecureField("Password", text: $viewModel.password)
                    }

                    Button(action: { showPassword.toggle() }) {
                        Image(systemName: showPassword ? "eye.slash" : "eye")
                            .foregroundColor(.gray)
                    }
                }

                HStack {
                    if showConfirmPassword {
                        TextField("Confirm Password", text: $viewModel.confirmPassword)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                    } else {
                        SecureField("Confirm Password", text: $viewModel.confirmPassword)
                    }

                    Button(action: { showConfirmPassword.toggle() }) {
                        Image(systemName: showConfirmPassword ? "eye.slash" : "eye")
                            .foregroundColor(.gray)
                    }
                }

                // Password match indicator
                if !viewModel.password.isEmpty && !viewModel.confirmPassword.isEmpty {
                    if viewModel.password != viewModel.confirmPassword {
                        HStack(spacing: AppSpacing.xs) {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundColor(.red)
                            Text("Passwords do not match")
                                .font(AppTypography.small())
                                .foregroundColor(.red)
                        }
                    } else {
                        HStack(spacing: AppSpacing.xs) {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(.green)
                            Text("Passwords match")
                                .font(AppTypography.small())
                                .foregroundColor(.green)
                        }
                    }
                }
            }

            // Password Requirements Section
            if !viewModel.password.isEmpty {
                Section("Password Requirements") {
                    let requirements = PasswordValidator.getRequirements()
                    let checks = PasswordValidator.checkRequirements(viewModel.password)

                    ForEach(Array(zip(requirements.indices, requirements)), id: \.0) { index, requirement in
                        HStack(spacing: AppSpacing.sm) {
                            Image(systemName: checks[index] ? "checkmark.circle.fill" : "circle")
                                .foregroundColor(checks[index] ? .green : .gray)
                            Text(requirement)
                                .font(AppTypography.small())
                                .foregroundColor(checks[index] ? .primary : .gray)
                        }
                    }
                }
            }

            Section("Role") {
                Picker("Role", selection: $viewModel.selectedRole) {
                    ForEach(UserRole.allCases, id: \.self) { role in
                        Text(role.displayName).tag(role)
                    }
                }
                .pickerStyle(.menu)
            }
        }
    }

    // MARK: - Invite Creation Form

    private var inviteCreationForm: some View {
        Form {
            Section {
                TextField("Full Name", text: $viewModel.fullName)
            }

            Section("Role") {
                Picker("Role", selection: $viewModel.selectedRole) {
                    ForEach(UserRole.allCases, id: \.self) { role in
                        Text(role.displayName).tag(role)
                    }
                }
                .pickerStyle(.menu)
            }

            Section {
                TextField("Email", text: $viewModel.email)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()

                TextField("Phone Number", text: $viewModel.phone)
                    .keyboardType(.phonePad)
            }

            Section("Delivery Method") {
                Picker("Method", selection: $viewModel.deliveryMethod) {
                    Text("Email Only").tag("email")
                    Text("SMS Only").tag("sms")
                    Text("Both").tag("both")
                }
                .pickerStyle(.menu)
            }

            Section("Language") {
                Picker("Language", selection: $viewModel.language) {
                    Text("English").tag("en")
                    Text("Spanish").tag("es")
                }
                .pickerStyle(.segmented)
            }

            Section {
                HStack(spacing: AppSpacing.sm) {
                    Image(systemName: "info.circle")
                        .foregroundColor(AppColors.blue)
                    Text("The recipient will receive a secure link valid for 7 days. They can choose their own username and password.")
                        .font(AppTypography.small())
                        .foregroundColor(AppColors.textGray)
                }
            }
        }
    }
}
