//
//  UserManagementView.swift
//  GCWadmin
//
//  Main view for User Management (super_admin only)
//

import SwiftUI

struct UserManagementView: View {
    @StateObject private var viewModel = UserManagementViewModel()

    var body: some View {
        VStack(spacing: 0) {
            // Tab Selector
            Picker("View", selection: $viewModel.selectedTab) {
                Text("Users").tag(0)
                Text("Invitations").tag(1)
            }
            .pickerStyle(.segmented)
            .padding()

            // Content
            if viewModel.isLoading && viewModel.users.isEmpty && viewModel.invitations.isEmpty {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                TabView(selection: $viewModel.selectedTab) {
                    usersTab
                        .tag(0)

                    invitationsTab
                        .tag(1)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
            }
        }
        .navigationTitle("User Management")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button(action: {
                    viewModel.showAddUser = true
                }) {
                    Image(systemName: "plus")
                        .font(.system(size: 20, weight: .medium))
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
            }
        }
        .sheet(isPresented: $viewModel.showAddUser) {
            AddUserModal(viewModel: viewModel)
        }
        .sheet(isPresented: $viewModel.showEditUser) {
            EditUserModal(viewModel: viewModel)
        }
        .alert("Error", isPresented: .constant(viewModel.errorMessage != nil)) {
            Button("OK") {
                viewModel.errorMessage = nil
            }
        } message: {
            if let error = viewModel.errorMessage {
                Text(error)
            }
        }
        .task {
            await viewModel.loadUsers()
            await viewModel.loadInvitations()
        }
    }

    // MARK: - Users Tab

    private var usersTab: some View {
        ScrollView {
            LazyVStack(spacing: AppSpacing.md) {
                ForEach(viewModel.users) { user in
                    userCard(user)
                }
            }
            .padding()
        }
        .refreshable {
            await viewModel.loadUsers()
        }
    }

    private func userCard(_ user: AdminUser) -> some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            // Name and Role
            HStack {
                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    Text(user.displayName)
                        .font(AppTypography.headline())

                    if let email = user.email {
                        Text(email)
                            .font(AppTypography.caption())
                            .foregroundColor(AppColors.textGray)
                    }
                }

                Spacer()

                // Role Badge
                Text(user.role.displayName)
                    .font(AppTypography.small())
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
                    .padding(.horizontal, AppSpacing.sm)
                    .padding(.vertical, AppSpacing.xs)
                    .background(Color(hex: user.role.badgeColor))
                    .cornerRadius(AppRadius.sm)
            }

            // Status and Last Login
            HStack {
                // Status
                HStack(spacing: AppSpacing.xs) {
                    Circle()
                        .fill(user.isActive ? Color(hex: "4CAF50") : Color(hex: "9E9E9E"))
                        .frame(width: 8, height: 8)

                    Text(user.statusText)
                        .font(AppTypography.small())
                        .foregroundColor(AppColors.textGray)
                }

                Spacer()

                // Last Login
                Text("Last login: \(user.lastLoginDisplay)")
                    .font(AppTypography.small())
                    .foregroundColor(AppColors.textGray)
            }

            // Actions
            HStack(spacing: AppSpacing.sm) {
                Button(action: {
                    viewModel.openEditUser(user)
                }) {
                    HStack {
                        Image(systemName: "pencil")
                        Text("Edit")
                    }
                    .font(AppTypography.small())
                    .foregroundColor(AppColors.blue)
                }

                if user.isActive {
                    Button(action: {
                        Task {
                            await viewModel.deleteUser(user)
                        }
                    }) {
                        HStack {
                            Image(systemName: "minus.circle")
                            Text("Deactivate")
                        }
                        .font(AppTypography.small())
                        .foregroundColor(AppColors.errorMedium)
                    }
                }
            }
        }
        .padding(AppSpacing.md)
        .background(Color.white)
        .cornerRadius(AppRadius.lg)
        .shadow(color: Color.black.opacity(0.05), radius: 4, x: 0, y: 2)
    }

    // MARK: - Invitations Tab

    private var invitationsTab: some View {
        ScrollView {
            LazyVStack(spacing: AppSpacing.md) {
                ForEach(viewModel.invitations) { invitation in
                    invitationCard(invitation)
                }
            }
            .padding()
        }
        .refreshable {
            await viewModel.loadInvitations()
        }
    }

    private func invitationCard(_ invitation: Invitation) -> some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            // Recipient and Role
            HStack {
                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    Text(invitation.fullName)
                        .font(AppTypography.headline())

                    if let email = invitation.email {
                        Text(email)
                            .font(AppTypography.caption())
                            .foregroundColor(AppColors.textGray)
                    }

                    if let phone = invitation.phone {
                        Text(phone)
                            .font(AppTypography.caption())
                            .foregroundColor(AppColors.textGray)
                    }
                }

                Spacer()

                // Role Badge
                Text(invitation.role.displayName)
                    .font(AppTypography.small())
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
                    .padding(.horizontal, AppSpacing.sm)
                    .padding(.vertical, AppSpacing.xs)
                    .background(Color(hex: invitation.role.badgeColor))
                    .cornerRadius(AppRadius.sm)
            }

            // Delivery and Status
            HStack {
                // Delivery Method
                Text(invitation.deliveryMethod)
                    .font(AppTypography.small())
                    .foregroundColor(AppColors.textGray)

                Spacer()

                // Status
                Text(invitation.status.rawValue)
                    .font(AppTypography.small())
                    .fontWeight(.semibold)
                    .foregroundColor(Color(hex: invitation.status.color))
            }

            // Created Date
            if let createdAt = invitation.createdAt {
                Text("Created: \(formatDate(createdAt))")
                    .font(AppTypography.small())
                    .foregroundColor(AppColors.textGray)
            }

            // Actions (only for pending invitations)
            if invitation.status == .pending {
                HStack(spacing: AppSpacing.sm) {
                    Button(action: {
                        Task {
                            await viewModel.resendInvite(invitation)
                        }
                    }) {
                        HStack {
                            Image(systemName: "arrow.clockwise")
                            Text("Resend")
                        }
                        .font(AppTypography.small())
                        .foregroundColor(AppColors.blue)
                    }

                    Button(action: {
                        Task {
                            await viewModel.cancelInvite(invitation)
                        }
                    }) {
                        HStack {
                            Image(systemName: "xmark.circle")
                            Text("Cancel")
                        }
                        .font(AppTypography.small())
                        .foregroundColor(AppColors.errorMedium)
                    }
                }
            }
        }
        .padding(AppSpacing.md)
        .background(Color.white)
        .cornerRadius(AppRadius.lg)
        .shadow(color: Color.black.opacity(0.05), radius: 4, x: 0, y: 2)
    }

    // MARK: - Helpers

    private func formatDate(_ timestamp: String) -> String {
        let formatter = ISO8601DateFormatter()
        if let date = formatter.date(from: timestamp) {
            let displayFormatter = DateFormatter()
            displayFormatter.dateStyle = .medium
            displayFormatter.timeStyle = .short
            return displayFormatter.string(from: date)
        }
        return timestamp
    }
}
