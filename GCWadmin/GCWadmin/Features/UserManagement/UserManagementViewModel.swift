//
//  UserManagementViewModel.swift
//  GCWadmin
//
//  ViewModel for User Management
//

import Foundation
import SwiftUI
import Combine

@MainActor
class UserManagementViewModel: ObservableObject {
    @Published var users: [AdminUser] = []
    @Published var invitations: [Invitation] = []
    @Published var selectedTab = 0  // 0 = Users, 1 = Invitations
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var successMessage: String?

    // User creation/editing
    @Published var showCreateUser = false
    @Published var showEditUser = false
    @Published var editingUser: AdminUser?
    @Published var showSendInvite = false
    @Published var showAddUser = false  // Unified modal for both manual and invite

    // Form state
    @Published var username = ""
    @Published var email = ""
    @Published var password = ""
    @Published var confirmPassword = ""
    @Published var fullName = ""
    @Published var selectedRole: UserRole = .employee
    @Published var phone = ""
    @Published var deliveryMethod = "email"
    @Published var language = "en"

    private let service = UserService.shared

    // MARK: - Data Loading

    func loadUsers() async {
        isLoading = true
        errorMessage = nil

        do {
            users = try await service.getAllUsers()
            print("✅ Loaded \(users.count) users")
        } catch {
            print("❌ Error loading users: \(error)")
            errorMessage = "Failed to load users"
        }

        isLoading = false
    }

    func loadInvitations() async {
        isLoading = true
        errorMessage = nil

        do {
            invitations = try await service.getInvitations()
            print("✅ Loaded \(invitations.count) invitations")
        } catch {
            print("❌ Error loading invitations: \(error)")
            errorMessage = "Failed to load invitations"
        }

        isLoading = false
    }

    // MARK: - User Actions

    func createUser() async {
        guard validateUserForm() else { return }

        isLoading = true
        errorMessage = nil

        do {
            let request = CreateUserRequest(
                username: username,
                email: email.isEmpty ? nil : email,
                password: password,
                fullName: fullName.isEmpty ? nil : fullName,
                role: selectedRole.rawValue
            )

            try await service.createUser(request: request)
            successMessage = "User created successfully"
            showCreateUser = false
            resetForm()
            await loadUsers()
        } catch {
            print("❌ Error creating user: \(error)")
            errorMessage = "Failed to create user"
        }

        isLoading = false
    }

    func updateUser() async {
        guard let user = editingUser else { return }

        isLoading = true
        errorMessage = nil

        do {
            let request = UpdateUserRequest(
                email: email.isEmpty ? nil : email,
                fullName: fullName.isEmpty ? nil : fullName,
                role: selectedRole.rawValue
            )

            try await service.updateUser(userId: user.id, request: request)
            successMessage = "User updated successfully"
            showEditUser = false
            editingUser = nil
            resetForm()
            await loadUsers()
        } catch {
            print("❌ Error updating user: \(error)")
            errorMessage = "Failed to update user"
        }

        isLoading = false
    }

    func deleteUser(_ user: AdminUser) async {
        isLoading = true
        errorMessage = nil

        do {
            try await service.deleteUser(userId: user.id)
            successMessage = "User deactivated successfully"
            await loadUsers()
        } catch {
            print("❌ Error deleting user: \(error)")
            errorMessage = "Failed to deactivate user"
        }

        isLoading = false
    }

    func openEditUser(_ user: AdminUser) {
        editingUser = user
        username = user.username
        email = user.email ?? ""
        fullName = user.fullName ?? ""
        selectedRole = user.role
        showEditUser = true
    }

    // MARK: - Invitation Actions

    func sendInvite() async {
        guard validateInviteForm() else { return }

        isLoading = true
        errorMessage = nil

        do {
            let request = SendInviteRequest(
                fullName: fullName,
                role: selectedRole.rawValue,
                email: deliveryMethod == "email" || deliveryMethod == "both" ? email : nil,
                phone: deliveryMethod == "sms" || deliveryMethod == "both" ? phone : nil,
                deliveryMethod: deliveryMethod,
                language: language
            )

            try await service.sendInvite(request: request)
            successMessage = "Invitation sent successfully"
            showSendInvite = false
            resetForm()
            await loadInvitations()
        } catch {
            print("❌ Error sending invite: \(error)")
            errorMessage = "Failed to send invitation"
        }

        isLoading = false
    }

    func resendInvite(_ invitation: Invitation) async {
        isLoading = true
        errorMessage = nil

        do {
            try await service.resendInvite(invitationId: invitation.id)
            successMessage = "Invitation resent successfully"
            await loadInvitations()
        } catch {
            print("❌ Error resending invite: \(error)")
            errorMessage = "Failed to resend invitation"
        }

        isLoading = false
    }

    func cancelInvite(_ invitation: Invitation) async {
        isLoading = true
        errorMessage = nil

        do {
            try await service.cancelInvite(invitationId: invitation.id)
            successMessage = "Invitation cancelled successfully"
            await loadInvitations()
        } catch {
            print("❌ Error cancelling invite: \(error)")
            errorMessage = "Failed to cancel invitation"
        }

        isLoading = false
    }

    // MARK: - Form Helpers

    private func validateUserForm() -> Bool {
        if username.isEmpty {
            errorMessage = "Username is required"
            return false
        }

        if password.isEmpty {
            errorMessage = "Password is required"
            return false
        }

        if password != confirmPassword {
            errorMessage = "Passwords do not match"
            return false
        }

        return true
    }

    private func validateInviteForm() -> Bool {
        if fullName.isEmpty {
            errorMessage = "Full name is required"
            return false
        }

        if deliveryMethod == "email" || deliveryMethod == "both" {
            if email.isEmpty {
                errorMessage = "Email is required for email delivery"
                return false
            }
        }

        if deliveryMethod == "sms" || deliveryMethod == "both" {
            if phone.isEmpty {
                errorMessage = "Phone is required for SMS delivery"
                return false
            }
        }

        return true
    }

    func resetForm() {
        username = ""
        email = ""
        password = ""
        confirmPassword = ""
        fullName = ""
        selectedRole = .employee
        phone = ""
        deliveryMethod = "email"
        language = "en"
    }
}
