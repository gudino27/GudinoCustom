//
//  EmployeeManagementView.swift
//  GCWadmin
//
//  Employee Management UI - matches webapp EmployeeManager.js
//

import SwiftUI
import PhotosUI

struct EmployeeManagementView: View {
    @StateObject private var viewModel = EmployeeManagementViewModel()
    @State private var showDeleteConfirmation = false
    @State private var employeeToDelete: Employee?

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.lg) {
                // Header bar
                headerBar

                // Add form
                if viewModel.isAddingNew {
                    addEmployeeForm
                }

                // Employee list or empty state
                if viewModel.isLoading && viewModel.employees.isEmpty {
                    loadingState
                } else if viewModel.employees.isEmpty && !viewModel.isAddingNew {
                    emptyState
                } else {
                    employeeCards
                }
            }
            .padding(AppSpacing.lg)
        }
        .background(AppColors.background)
        .navigationTitle("Employee Management")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.loadEmployees()
        }
        .alert("Delete Employee", isPresented: $showDeleteConfirmation, presenting: employeeToDelete) { employee in
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive) {
                Task { await viewModel.deleteEmployee(employee) }
            }
        } message: { employee in
            Text("Are you sure you want to delete \(employee.name)?")
        }
        .overlay(alignment: .top) {
            notificationOverlay
        }
        .onChange(of: viewModel.selectedPhotoItem) { _, _ in
            Task { await viewModel.loadPhotoFromPicker() }
        }
    }

    // MARK: - Header Bar

    private var headerBar: some View {
        HStack {
            Text("\(viewModel.employees.count) team members")
                .font(.subheadline)
                .foregroundColor(AppColors.textGray)

            Spacer()

            if viewModel.isReordering {
                Button(action: {
                    Task { await viewModel.saveEmployeeOrder() }
                }) {
                    HStack(spacing: 4) {
                        Image(systemName: "checkmark")
                            .font(.system(size: 12))
                        Text("Save Order")
                            .font(.subheadline)
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(AppColors.success)
                    .cornerRadius(8)
                }
                .disabled(viewModel.isSaving || !viewModel.hasOrderChanges)

                Button(action: {
                    Task { await viewModel.cancelReordering() }
                }) {
                    Text("Cancel")
                        .font(.subheadline)
                        .foregroundColor(.white)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(AppColors.gray500)
                        .cornerRadius(8)
                }
            } else {
                if !viewModel.employees.isEmpty {
                    Button(action: {
                        viewModel.isReordering = true
                    }) {
                        HStack(spacing: 4) {
                            Image(systemName: "line.3.horizontal")
                                .font(.system(size: 12))
                            Text("Reorder")
                                .font(.subheadline)
                        }
                        .foregroundColor(AppColors.textMedium)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(AppColors.gray200)
                        .cornerRadius(8)
                    }
                }

                Button(action: {
                    viewModel.prepareNewEmployee()
                }) {
                    HStack(spacing: 4) {
                        Image(systemName: "plus")
                            .font(.system(size: 14, weight: .medium))
                        Text("Add")
                            .font(.subheadline)
                            .fontWeight(.medium)
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(AppColors.blue)
                    .cornerRadius(8)
                }
            }
        }
    }

    // MARK: - Add Employee Form

    private var addEmployeeForm: some View {
        VStack(alignment: .leading, spacing: AppSpacing.lg) {
            Text("Add New Team Member")
                .font(.headline)
                .foregroundColor(AppColors.text)

            // Name, Position
            HStack(spacing: 12) {
                formField(label: "Name *", placeholder: "John Doe", text: $viewModel.newEmployeeName)
                formField(label: "Position *", placeholder: "Senior Designer", text: $viewModel.newEmployeePosition)
            }

            // Email, Phone
            HStack(spacing: 12) {
                formField(label: "Email", placeholder: "john@company.com", text: $viewModel.newEmployeeEmail, keyboard: .emailAddress)
                formField(label: "Phone", placeholder: "(555) 123-4567", text: $viewModel.newEmployeePhone, keyboard: .phonePad)
            }

            // Joined Date + Photo
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Joined Date")
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundColor(AppColors.text)

                    DatePicker("", selection: $viewModel.newEmployeeJoinedDate, displayedComponents: .date)
                        .labelsHidden()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Color.white)
                        .cornerRadius(8)
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(AppColors.border, lineWidth: 1)
                        )
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text("Photo")
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundColor(AppColors.text)

                    let hasPhoto = viewModel.newEmployeePhoto != nil
                    PhotosPicker(selection: $viewModel.selectedPhotoItem, matching: .images) {
                        HStack {
                            Image(systemName: "photo")
                                .font(.system(size: 12))
                            Text(hasPhoto ? "Photo Selected" : "Choose File")
                                .font(.subheadline)
                        }
                        .foregroundColor(AppColors.textMedium)
                        .frame(maxWidth: .infinity)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .background(Color.white)
                        .cornerRadius(8)
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(AppColors.border, lineWidth: 1)
                        )
                    }
                }
            }

            // Bio
            VStack(alignment: .leading, spacing: 4) {
                Text("Bio")
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(AppColors.text)

                TextEditor(text: $viewModel.newEmployeeBio)
                    .font(.subheadline)
                    .frame(height: 70)
                    .padding(8)
                    .background(Color.white)
                    .cornerRadius(8)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(AppColors.border, lineWidth: 1)
                    )
            }

            // Action buttons
            HStack(spacing: 8) {
                Button(action: {
                    Task { await viewModel.addEmployee() }
                }) {
                    Text(viewModel.isSaving ? "Adding..." : "Add Employee")
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(.white)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(AppColors.blue)
                        .cornerRadius(8)
                }
                .disabled(viewModel.newEmployeeName.isEmpty || viewModel.newEmployeePosition.isEmpty || viewModel.isSaving)
                .opacity((viewModel.newEmployeeName.isEmpty || viewModel.newEmployeePosition.isEmpty) ? 0.5 : 1)

                Button(action: {
                    viewModel.cancelNewEmployee()
                }) {
                    Text("Cancel")
                        .font(.subheadline)
                        .foregroundColor(.white)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(AppColors.gray500)
                        .cornerRadius(8)
                }
            }
        }
        .padding(AppSpacing.lg)
        .background(AppColors.gray50)
        .cornerRadius(8)
    }

    // MARK: - Employee Cards

    private var employeeCards: some View {
        VStack(spacing: AppSpacing.md) {
            ForEach(viewModel.sortedEmployees) { employee in
                if viewModel.editingEmployeeId == employee.id {
                    EmployeeEditCard(
                        employee: employee,
                        editingName: $viewModel.editingName,
                        editingPosition: $viewModel.editingPosition,
                        editingBio: $viewModel.editingBio,
                        editingEmail: $viewModel.editingEmail,
                        editingPhone: $viewModel.editingPhone,
                        editingPhoto: $viewModel.editingPhoto,
                        selectedPhotoItem: $viewModel.selectedPhotoItem,
                        isSaving: viewModel.isSaving,
                        onSave: { Task { await viewModel.saveEmployee() } },
                        onCancel: { viewModel.cancelEditingEmployee() }
                    )
                } else {
                    EmployeeCard(
                        employee: employee,
                        isReordering: viewModel.isReordering,
                        onEdit: { viewModel.startEditingEmployee(employee) },
                        onDelete: {
                            employeeToDelete = employee
                            showDeleteConfirmation = true
                        },
                        onToggleActive: {
                            Task { await viewModel.toggleActiveStatus(employee) }
                        }
                    )
                }
            }
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "person.fill")
                .font(.system(size: 48))
                .foregroundColor(AppColors.gray400)

            Text("No employees yet")
                .font(.subheadline)
                .foregroundColor(AppColors.textGray)

            Button(action: {
                viewModel.prepareNewEmployee()
            }) {
                Text("Add Your First Employee")
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(AppColors.blue)
                    .cornerRadius(8)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 48)
        .background(AppColors.gray50)
        .cornerRadius(8)
    }

    // MARK: - Loading State

    private var loadingState: some View {
        VStack(spacing: 12) {
            ProgressView()
            Text("Loading employees...")
                .font(.subheadline)
                .foregroundColor(AppColors.textGray)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 48)
    }

    // MARK: - Notification

    @ViewBuilder
    private var notificationOverlay: some View {
        if let msg = viewModel.successMessage {
            notificationBanner(msg, isError: false)
        } else if let msg = viewModel.errorMessage {
            notificationBanner(msg, isError: true)
        }
    }

    private func notificationBanner(_ message: String, isError: Bool) -> some View {
        Text(message)
            .font(.subheadline)
            .foregroundColor(.white)
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
            .background(isError ? AppColors.error : AppColors.success)
            .cornerRadius(8)
            .shadow(radius: 8)
            .padding(.top, 8)
            .transition(.move(edge: .top).combined(with: .opacity))
            .onAppear {
                DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                    withAnimation {
                        if isError {
                            viewModel.errorMessage = nil
                        } else {
                            viewModel.successMessage = nil
                        }
                    }
                }
            }
    }

    // MARK: - Form Field Helper

    private func formField(label: String, placeholder: String, text: Binding<String>, keyboard: UIKeyboardType = .default) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption)
                .fontWeight(.medium)
                .foregroundColor(AppColors.text)

            TextField(placeholder, text: text)
                .font(.subheadline)
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(Color.white)
                .cornerRadius(8)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(AppColors.border, lineWidth: 1)
                )
                .keyboardType(keyboard)
                .textInputAutocapitalization(keyboard == .emailAddress ? .never : .words)
        }
    }
}

// MARK: - Employee Card (View Mode)

struct EmployeeCard: View {
    let employee: Employee
    let isReordering: Bool
    let onEdit: () -> Void
    let onDelete: () -> Void
    let onToggleActive: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            if isReordering {
                Image(systemName: "line.3.horizontal")
                    .foregroundColor(AppColors.gray400)
                    .padding(.top, 12)
            }

            // Photo (w-24 h-24 = 96pt)
            employeePhoto

            // Info
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(employee.name)
                            .font(.headline)
                            .foregroundColor(AppColors.text)

                        Text(employee.position)
                            .font(.subheadline)
                            .foregroundColor(AppColors.textGray)
                    }

                    Spacer()

                    if !isReordering {
                        HStack(spacing: 4) {
                            Button(action: onEdit) {
                                Image(systemName: "pencil")
                                    .font(.system(size: 16))
                                    .foregroundColor(AppColors.blue)
                                    .frame(width: 36, height: 36)
                                    .background(AppColors.infoBg)
                                    .cornerRadius(8)
                            }

                            Button(action: onDelete) {
                                Image(systemName: "trash")
                                    .font(.system(size: 16))
                                    .foregroundColor(AppColors.error)
                                    .frame(width: 36, height: 36)
                                    .background(AppColors.errorBg)
                                    .cornerRadius(8)
                            }
                        }
                    }
                }

                if let bio = employee.bio, !bio.isEmpty {
                    Text(bio)
                        .font(.caption)
                        .foregroundColor(AppColors.textMedium)
                        .lineLimit(2)
                        .padding(.top, 4)
                }

                // Contact info
                contactInfoRow
                    .padding(.top, 4)
            }
        }
        .padding(16)
        .background(Color.white)
        .cornerRadius(8)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(AppColors.border, lineWidth: 1)
        )
        .opacity(employee.isActive ? 1.0 : 0.6)
    }

    private var contactInfoRow: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let email = employee.email, !email.isEmpty {
                HStack(spacing: 4) {
                    Image(systemName: "envelope")
                        .font(.system(size: 12))
                    Text(email)
                        .font(.caption)
                        .lineLimit(1)
                }
                .foregroundColor(AppColors.textGray)
            }

            HStack(spacing: 16) {
                if let phone = employee.phone, !phone.isEmpty {
                    HStack(spacing: 4) {
                        Image(systemName: "phone")
                            .font(.system(size: 12))
                        Text(phone)
                            .font(.caption)
                    }
                    .foregroundColor(AppColors.textGray)
                }

                if let joinedDate = employee.joinedDate, !joinedDate.isEmpty {
                    HStack(spacing: 4) {
                        Image(systemName: "calendar")
                            .font(.system(size: 12))
                        Text("Joined \(joinedDate)")
                            .font(.caption)
                    }
                    .foregroundColor(AppColors.textGray)
                }
            }
        }
    }

    @ViewBuilder
    private var employeePhoto: some View {
        if let photoUrl = employee.photoUrl {
            AsyncImage(url: URL(string: "\(APIConfig.baseURL)\(photoUrl)")) { phase in
                switch phase {
                case .empty:
                    placeholderView.overlay(ProgressView())
                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: 96, height: 96)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                case .failure:
                    placeholderView
                @unknown default:
                    placeholderView
                }
            }
        } else {
            placeholderView
        }
    }

    private var placeholderView: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 8)
                .fill(AppColors.gray200)
                .frame(width: 96, height: 96)
            Image(systemName: "person.fill")
                .font(.system(size: 36))
                .foregroundColor(AppColors.gray400)
        }
    }
}

// MARK: - Employee Edit Card

struct EmployeeEditCard: View {
    let employee: Employee
    @Binding var editingName: String
    @Binding var editingPosition: String
    @Binding var editingBio: String
    @Binding var editingEmail: String
    @Binding var editingPhone: String
    @Binding var editingPhoto: UIImage?
    @Binding var selectedPhotoItem: PhotosPickerItem?
    let isSaving: Bool
    let onSave: () -> Void
    let onCancel: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 16) {
                editPhotoSection

                VStack(spacing: 8) {
                    editField("Name", text: $editingName)
                    editField("Position", text: $editingPosition)
                }
            }

            HStack(spacing: 8) {
                editField("Email", text: $editingEmail, keyboard: .emailAddress)
                editField("Phone", text: $editingPhone, keyboard: .phonePad)
            }

            TextEditor(text: $editingBio)
                .font(.subheadline)
                .frame(height: 50)
                .padding(8)
                .overlay(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(AppColors.border, lineWidth: 1)
                )

            PhotosPicker(selection: $selectedPhotoItem, matching: .images) {
                HStack(spacing: 4) {
                    Image(systemName: "photo")
                        .font(.system(size: 12))
                    Text(editingPhoto == nil ? "Change Photo" : "New Photo Selected")
                        .font(.caption)
                }
                .foregroundColor(AppColors.textMedium)
            }

            HStack(spacing: 8) {
                Button(action: onSave) {
                    Text(isSaving ? "Saving..." : "Save")
                        .font(.subheadline)
                        .foregroundColor(.white)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(AppColors.success)
                        .cornerRadius(6)
                }
                .disabled(isSaving || editingName.isEmpty || editingPosition.isEmpty)

                Button(action: onCancel) {
                    Text("Cancel")
                        .font(.subheadline)
                        .foregroundColor(.white)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(AppColors.gray500)
                        .cornerRadius(6)
                }
            }
        }
        .padding(16)
        .background(Color.white)
        .cornerRadius(8)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(AppColors.blue.opacity(0.5), lineWidth: 2)
        )
    }

    @ViewBuilder
    private var editPhotoSection: some View {
        if let photo = editingPhoto {
            Image(uiImage: photo)
                .resizable()
                .aspectRatio(contentMode: .fill)
                .frame(width: 96, height: 96)
                .clipShape(RoundedRectangle(cornerRadius: 8))
        } else if let photoUrl = employee.photoUrl {
            AsyncImage(url: URL(string: "\(APIConfig.baseURL)\(photoUrl)")) { image in
                image.resizable().aspectRatio(contentMode: .fill)
            } placeholder: {
                ProgressView()
            }
            .frame(width: 96, height: 96)
            .clipShape(RoundedRectangle(cornerRadius: 8))
        } else {
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(AppColors.gray200)
                    .frame(width: 96, height: 96)
                Image(systemName: "person.fill")
                    .font(.system(size: 36))
                    .foregroundColor(AppColors.gray400)
            }
        }
    }

    private func editField(_ placeholder: String, text: Binding<String>, keyboard: UIKeyboardType = .default) -> some View {
        TextField(placeholder, text: text)
            .font(.subheadline)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .overlay(
                RoundedRectangle(cornerRadius: 6)
                    .stroke(AppColors.border, lineWidth: 1)
            )
            .keyboardType(keyboard)
            .textInputAutocapitalization(keyboard == .emailAddress ? .never : .words)
    }
}

#Preview {
    NavigationStack {
        EmployeeManagementView()
    }
}
