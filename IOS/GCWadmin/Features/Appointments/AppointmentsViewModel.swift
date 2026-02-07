//
//  AppointmentsViewModel.swift
//  GCWadmin
//
//  ViewModel for appointments, availability, and blocked times management
//

import Foundation
import SwiftUI
import Combine

@MainActor
class AppointmentsViewModel: ObservableObject {
    // MARK: - Published Properties

    @Published var selectedTab = "appointments"

    // Data
    @Published var appointments: [Appointment] = []
    @Published var employees: [Employee] = []
    @Published var availability: [EmployeeAvailability] = []
    @Published var blockedTimes: [BlockedTime] = []

    // Filters
    @Published var statusFilter = "all" {
        didSet {
            Task { await loadAppointments() }
        }
    }
    @Published var dateFilter = "upcoming" {
        didSet {
            Task { await loadAppointments() }
        }
    }

    // For availability management
    @Published var selectedEmployeeId: Int?

    // Modal states
    @Published var showAppointmentDetail = false
    @Published var selectedAppointment: Appointment?
    @Published var showAddAvailability = false
    @Published var showAddBlockedTime = false
    @Published var showRescheduleRequest = false

    // Loading & Error states
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var successMessage: String?

    // Services
    private let appointmentsService = AppointmentsService.shared
    private let employeesService = EmployeesService.shared

    // MARK: - Initialization

    init() {}

    // MARK: - Data Loading

    func loadAll() async {
        await loadAppointments()
        await loadEmployees()
        await loadBlockedTimes()
    }

    func loadAppointments() async {
        isLoading = true
        errorMessage = nil

        do {
            appointments = try await appointmentsService.fetchAppointments(
                status: statusFilter,
                filter: dateFilter
            )
        } catch {
            errorMessage = "Failed to load appointments: \(error.localizedDescription)"
            print("Error loading appointments: \(error)")
        }

        isLoading = false
    }

    func loadEmployees() async {
        do {
            employees = try await employeesService.getAllEmployees()
        } catch {
            errorMessage = "Failed to load employees: \(error.localizedDescription)"
            print("Error loading employees: \(error)")
        }
    }

    func loadBlockedTimes() async {
        do {
            blockedTimes = try await appointmentsService.fetchBlockedTimes()
        } catch {
            errorMessage = "Failed to load blocked times: \(error.localizedDescription)"
            print("Error loading blocked times: \(error)")
        }
    }

    // MARK: - Appointment Actions

    func updateStatus(appointmentId: Int, status: String) async {
        isLoading = true
        errorMessage = nil

        do {
            let updatedAppointment = try await appointmentsService.updateAppointmentStatus(
                id: appointmentId,
                status: status
            )

            // Update in list
            if let index = appointments.firstIndex(where: { $0.id == appointmentId }) {
                appointments[index] = updatedAppointment
            }

            // Update selected appointment if viewing detail
            if selectedAppointment?.id == appointmentId {
                selectedAppointment = updatedAppointment
            }

            successMessage = "Appointment status updated to \(status)"
        } catch {
            errorMessage = "Failed to update status: \(error.localizedDescription)"
            print("Error updating appointment status: \(error)")
        }

        isLoading = false
    }

    func assignEmployee(appointmentId: Int, employeeId: Int?) async {
        isLoading = true
        errorMessage = nil

        do {
            let updatedAppointment = try await appointmentsService.assignEmployee(
                appointmentId: appointmentId,
                employeeId: employeeId
            )

            // Update in list
            if let index = appointments.firstIndex(where: { $0.id == appointmentId }) {
                appointments[index] = updatedAppointment
            }

            // Update selected appointment if viewing detail
            if selectedAppointment?.id == appointmentId {
                selectedAppointment = updatedAppointment
            }

            if let empId = employeeId, let emp = employees.first(where: { $0.id == empId }) {
                successMessage = "Assigned to \(emp.name)"
            } else {
                successMessage = "Employee assignment removed"
            }
        } catch {
            errorMessage = "Failed to assign employee: \(error.localizedDescription)"
            print("Error assigning employee: \(error)")
        }

        isLoading = false
    }

    func requestReschedule(appointmentId: Int, message: String) async {
        isLoading = true
        errorMessage = nil

        do {
            try await appointmentsService.requestReschedule(appointmentId: appointmentId, message: message)
            successMessage = "Reschedule request sent to client"
            showRescheduleRequest = false
            showAppointmentDetail = false
            await loadAppointments()
        } catch {
            errorMessage = "Failed to send reschedule request: \(error.localizedDescription)"
            print("Error requesting reschedule: \(error)")
        }

        isLoading = false
    }

    func deleteAppointment(id: Int) async {
        isLoading = true
        errorMessage = nil

        do {
            try await appointmentsService.deleteAppointment(id: id)
            appointments.removeAll { $0.id == id }
            successMessage = "Appointment deleted"
            showAppointmentDetail = false
        } catch {
            errorMessage = "Failed to delete appointment: \(error.localizedDescription)"
            print("Error deleting appointment: \(error)")
        }

        isLoading = false
    }

    // MARK: - Availability Actions

    func fetchAvailability(employeeId: Int) async {
        isLoading = true
        errorMessage = nil

        do {
            availability = try await appointmentsService.fetchAvailability(employeeId: employeeId)
        } catch {
            errorMessage = "Failed to load availability: \(error.localizedDescription)"
            print("Error loading availability: \(error)")
        }

        isLoading = false
    }

    func createAvailability(
        employeeId: Int,
        dayOfWeek: Int,
        startTime: String,
        endTime: String
    ) async {
        isLoading = true
        errorMessage = nil

        do {
            let newAvailability = try await appointmentsService.createAvailability(
                employeeId: employeeId,
                dayOfWeek: dayOfWeek,
                startTime: startTime,
                endTime: endTime
            )
            availability.append(newAvailability)
            successMessage = "Availability added"
            showAddAvailability = false
        } catch {
            errorMessage = "Failed to create availability: \(error.localizedDescription)"
            print("Error creating availability: \(error)")
        }

        isLoading = false
    }

    func deleteAvailability(id: Int, employeeId: Int) async {
        isLoading = true
        errorMessage = nil

        do {
            try await appointmentsService.deleteAvailability(id: id)
            availability.removeAll { $0.id == id }
            successMessage = "Availability deleted"
        } catch {
            errorMessage = "Failed to delete availability: \(error.localizedDescription)"
            print("Error deleting availability: \(error)")
        }

        isLoading = false
    }

    // MARK: - Blocked Times Actions

    func createBlockedTime(
        employeeId: Int,
        startDate: String,
        startTime: String,
        endDate: String,
        endTime: String,
        reason: String
    ) async {
        isLoading = true
        errorMessage = nil

        do {
            // Format datetime strings in ISO8601 format
            let startDatetime = "\(startDate)T\(startTime):00"
            let endDatetime = "\(endDate)T\(endTime):00"

            let newBlockedTime = try await appointmentsService.createBlockedTime(
                employeeId: employeeId,
                startDatetime: startDatetime,
                endDatetime: endDatetime,
                reason: reason
            )
            blockedTimes.append(newBlockedTime)
            successMessage = "Blocked time created"
            showAddBlockedTime = false
        } catch {
            errorMessage = "Failed to create blocked time: \(error.localizedDescription)"
            print("Error creating blocked time: \(error)")
        }

        isLoading = false
    }

    func deleteBlockedTime(id: Int) async {
        isLoading = true
        errorMessage = nil

        do {
            try await appointmentsService.deleteBlockedTime(id: id)
            blockedTimes.removeAll { $0.id == id }
            successMessage = "Blocked time deleted"
        } catch {
            errorMessage = "Failed to delete blocked time: \(error.localizedDescription)"
            print("Error deleting blocked time: \(error)")
        }

        isLoading = false
    }

    // MARK: - Helper Methods

    func selectAppointment(_ appointment: Appointment) {
        selectedAppointment = appointment
        showAppointmentDetail = true
    }

    func getEmployee(id: Int?) -> Employee? {
        guard let id = id else { return nil }
        return employees.first { $0.id == id }
    }
}
