//
//  EmployeeManagementViewModel.swift
//  GCWadmin
//
//  ViewModel for Employee Management
//

import Foundation
import SwiftUI
import Combine
import PhotosUI

@MainActor
class EmployeeManagementViewModel: ObservableObject {
    private let employeesService = EmployeesService.shared

    // MARK: - Published Properties

    @Published var employees: [Employee] = []
    @Published var includeInactive = false

    // UI state
    @Published var isLoading = false
    @Published var isSaving = false
    @Published var errorMessage: String?
    @Published var successMessage: String?

    // Add new employee
    @Published var isAddingNew = false
    @Published var newEmployeeName = ""
    @Published var newEmployeePosition = ""
    @Published var newEmployeeBio = ""
    @Published var newEmployeeEmail = ""
    @Published var newEmployeePhone = ""
    @Published var newEmployeeJoinedDate = Date()
    @Published var newEmployeePhoto: UIImage?
    @Published var showingPhotoPicker = false
    @Published var selectedPhotoItem: PhotosPickerItem?

    // Edit employee
    @Published var editingEmployeeId: Int?
    @Published var editingName = ""
    @Published var editingPosition = ""
    @Published var editingBio = ""
    @Published var editingEmail = ""
    @Published var editingPhone = ""
    @Published var editingJoinedDate = Date()
    @Published var editingPhoto: UIImage?
    @Published var editingPhotoChanged = false

    // Reordering
    @Published var isReordering = false
    @Published var hasOrderChanges = false

    // MARK: - Computed Properties

    var sortedEmployees: [Employee] {
        employees.sorted { ($0.displayOrder ?? 999) < ($1.displayOrder ?? 999) }
    }

    // MARK: - Load Employees

    func loadEmployees() async {
        isLoading = true
        errorMessage = nil

        do {
            employees = try await employeesService.getAllEmployees(includeInactive: includeInactive)
            print("✅ Loaded \(employees.count) employees")
        } catch {
            errorMessage = "Failed to load employees: \(error.localizedDescription)"
            print("❌ Error loading employees: \(error)")
        }

        isLoading = false
    }

    // MARK: - Add Employee

    func prepareNewEmployee() {
        isAddingNew = true
        newEmployeeName = ""
        newEmployeePosition = ""
        newEmployeeBio = ""
        newEmployeeEmail = ""
        newEmployeePhone = ""
        newEmployeeJoinedDate = Date()
        newEmployeePhoto = nil
        selectedPhotoItem = nil
    }

    func cancelNewEmployee() {
        isAddingNew = false
        newEmployeeName = ""
        newEmployeePosition = ""
        newEmployeeBio = ""
        newEmployeeEmail = ""
        newEmployeePhone = ""
        newEmployeeJoinedDate = Date()
        newEmployeePhoto = nil
        selectedPhotoItem = nil
    }

    func addEmployee() async {
        guard !newEmployeeName.isEmpty, !newEmployeePosition.isEmpty else {
            errorMessage = "Name and position are required"
            return
        }

        isSaving = true
        errorMessage = nil

        do {
            // Format joined date
            let dateFormatter = DateFormatter()
            dateFormatter.dateFormat = "yyyy-MM-dd"
            let joinedDateString = dateFormatter.string(from: newEmployeeJoinedDate)

            let employee = try await employeesService.createEmployee(
                name: newEmployeeName,
                position: newEmployeePosition,
                bio: newEmployeeBio,
                email: newEmployeeEmail,
                phone: newEmployeePhone,
                joinedDate: joinedDateString,
                photo: newEmployeePhoto
            )

            print("✅ Created employee: \(employee.name)")
            successMessage = "Employee added successfully"
            cancelNewEmployee()
            await loadEmployees()
        } catch {
            errorMessage = "Failed to add employee: \(error.localizedDescription)"
            print("❌ Error adding employee: \(error)")
        }

        isSaving = false
    }

    // MARK: - Edit Employee

    func startEditingEmployee(_ employee: Employee) {
        editingEmployeeId = employee.id
        editingName = employee.name
        editingPosition = employee.position
        editingBio = employee.bio ?? ""
        editingEmail = employee.email ?? ""
        editingPhone = employee.phone ?? ""

        // Parse joined date
        if let joinedDateString = employee.joinedDate {
            let dateFormatter = DateFormatter()
            dateFormatter.dateFormat = "yyyy-MM-dd"
            if let date = dateFormatter.date(from: joinedDateString) {
                editingJoinedDate = date
            }
        } else {
            editingJoinedDate = Date()
        }

        editingPhoto = nil
        editingPhotoChanged = false
    }

    func cancelEditingEmployee() {
        editingEmployeeId = nil
        editingName = ""
        editingPosition = ""
        editingBio = ""
        editingEmail = ""
        editingPhone = ""
        editingJoinedDate = Date()
        editingPhoto = nil
        editingPhotoChanged = false
    }

    func saveEmployee() async {
        guard let employeeId = editingEmployeeId else { return }

        isSaving = true
        errorMessage = nil

        do {
            // Format joined date
            let dateFormatter = DateFormatter()
            dateFormatter.dateFormat = "yyyy-MM-dd"
            let joinedDateString = dateFormatter.string(from: editingJoinedDate)

            _ = try await employeesService.updateEmployee(
                employeeId,
                name: editingName,
                position: editingPosition,
                bio: editingBio,
                email: editingEmail,
                phone: editingPhone,
                joinedDate: joinedDateString,
                isActive: nil,
                photo: editingPhotoChanged ? editingPhoto : nil
            )

            print("✅ Updated employee \(employeeId)")
            successMessage = "Employee updated successfully"
            cancelEditingEmployee()
            await loadEmployees()
        } catch {
            errorMessage = "Failed to update employee: \(error.localizedDescription)"
            print("❌ Error updating employee: \(error)")
        }

        isSaving = false
    }

    // MARK: - Delete Employee

    func deleteEmployee(_ employee: Employee) async {
        do {
            try await employeesService.deleteEmployee(employee.id)
            await loadEmployees()
            successMessage = "Employee deleted successfully"
        } catch {
            errorMessage = "Failed to delete employee: \(error.localizedDescription)"
        }
    }

    // MARK: - Toggle Active Status

    func toggleActiveStatus(_ employee: Employee) async {
        do {
            _ = try await employeesService.updateEmployee(
                employee.id,
                name: nil,
                position: nil,
                bio: nil,
                email: nil,
                phone: nil,
                joinedDate: nil,
                isActive: !employee.isActive,
                photo: nil
            )
            await loadEmployees()
            successMessage = employee.isActive ? "Employee deactivated" : "Employee activated"
        } catch {
            errorMessage = "Failed to update status: \(error.localizedDescription)"
        }
    }

    // MARK: - Reordering

    func moveEmployee(from source: IndexSet, to destination: Int) {
        var reorderedEmployees = sortedEmployees
        reorderedEmployees.move(fromOffsets: source, toOffset: destination)

        // Update display order
        for (index, employee) in reorderedEmployees.enumerated() {
            if let employeeIndex = employees.firstIndex(where: { $0.id == employee.id }) {
                employees[employeeIndex].displayOrder = index + 1
            }
        }

        hasOrderChanges = true
    }

    func saveEmployeeOrder() async {
        isSaving = true
        errorMessage = nil

        let employeeIds = sortedEmployees.map { $0.id }

        do {
            try await employeesService.reorderEmployees(employeeIds: employeeIds)
            hasOrderChanges = false
            isReordering = false
            successMessage = "Employee order saved successfully"
            await loadEmployees()
        } catch {
            errorMessage = "Failed to save employee order: \(error.localizedDescription)"
        }

        isSaving = false
    }

    func cancelReordering() async {
        isReordering = false
        hasOrderChanges = false
        await loadEmployees()
    }

    // MARK: - Photo Handling

    func loadPhotoFromPicker() async {
        guard let item = selectedPhotoItem else { return }

        do {
            if let imageData = try await item.loadTransferable(type: Data.self),
               let image = UIImage(data: imageData) {
                if isAddingNew {
                    newEmployeePhoto = image
                } else {
                    editingPhoto = image
                    editingPhotoChanged = true
                }
            }
        } catch {
            print("❌ Failed to load photo: \(error)")
        }
    }
}
