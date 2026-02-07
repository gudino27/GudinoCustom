//
//  AppointmentsService.swift
//  GCWadmin
//
//  Service for managing appointments, availability, and blocked times
//

import Foundation

class AppointmentsService {
    static let shared = AppointmentsService()
    private let apiClient = APIClient.shared

    private init() {}

    // MARK: - Appointments

    /// Fetch all appointments with optional filters
    func fetchAppointments(status: String = "all", filter: String = "upcoming") async throws -> [Appointment] {
        let endpoint = "/api/admin/appointments?status=\(status)&filter=\(filter)"
        let response: AppointmentsResponse = try await apiClient.get(endpoint)
        return response.appointments
    }

    /// Update appointment status
    func updateAppointmentStatus(id: Int, status: String) async throws -> Appointment {
        let endpoint = "/api/admin/appointments/\(id)/status"
        let body = AppointmentStatusUpdate(status: status)
        let response: AppointmentUpdateResponse = try await apiClient.patch(endpoint, body: body)
        guard let appointment = response.appointment else {
            throw APIError.serverError("No appointment returned from server")
        }
        return appointment
    }

    /// Assign employee to appointment
    func assignEmployee(appointmentId: Int, employeeId: Int?) async throws -> Appointment {
        let endpoint = "/api/admin/appointments/\(appointmentId)"
        let body = AppointmentAssignmentUpdate(assignedEmployeeId: employeeId)
        let response: AppointmentUpdateResponse = try await apiClient.patch(endpoint, body: body)
        guard let appointment = response.appointment else {
            throw APIError.serverError("No appointment returned from server")
        }
        return appointment
    }

    /// Request client to reschedule appointment
    func requestReschedule(appointmentId: Int, message: String) async throws {
        let endpoint = "/api/admin/appointments/\(appointmentId)/request-reschedule"
        let body = RescheduleRequest(message: message)
        let _: AppointmentUpdateResponse = try await apiClient.post(endpoint, body: body)
    }

    /// Delete appointment
    func deleteAppointment(id: Int) async throws {
        let endpoint = "/api/admin/appointments/\(id)"
        struct DeleteResponse: Codable { let success: Bool }
        let _: DeleteResponse = try await apiClient.delete(endpoint)
    }

    // MARK: - Employee Availability

    /// Fetch availability for a specific employee
    func fetchAvailability(employeeId: Int) async throws -> [EmployeeAvailability] {
        let endpoint = "/api/admin/employees/\(employeeId)/availability"
        let response: AvailabilityResponse = try await apiClient.get(endpoint)
        return response.availability
    }

    /// Create employee availability
    func createAvailability(
        employeeId: Int,
        dayOfWeek: Int,
        startTime: String,
        endTime: String
    ) async throws -> EmployeeAvailability {
        let endpoint = "/api/admin/employee-availability"
        let body = CreateAvailabilityRequest(
            employeeId: employeeId,
            dayOfWeek: dayOfWeek,
            startTime: startTime,
            endTime: endTime
        )
        let response: AvailabilityUpdateResponse = try await apiClient.post(endpoint, body: body)
        guard let availability = response.availability else {
            throw APIError.serverError("No availability returned from server")
        }
        return availability
    }

    /// Delete employee availability
    func deleteAvailability(id: Int) async throws {
        let endpoint = "/api/admin/employee-availability/\(id)"
        struct DeleteResponse: Codable { let success: Bool }
        let _: DeleteResponse = try await apiClient.delete(endpoint)
    }

    // MARK: - Blocked Times

    /// Fetch all blocked times
    func fetchBlockedTimes() async throws -> [BlockedTime] {
        let endpoint = "/api/admin/blocked-times"
        let response: BlockedTimesResponse = try await apiClient.get(endpoint)
        return response.blockedTimes
    }

    /// Create blocked time
    func createBlockedTime(
        employeeId: Int,
        startDatetime: String,
        endDatetime: String,
        reason: String
    ) async throws -> BlockedTime {
        let endpoint = "/api/admin/blocked-times"
        let body = CreateBlockedTimeRequest(
            employeeId: employeeId,
            startDatetime: startDatetime,
            endDatetime: endDatetime,
            reason: reason
        )
        let response: BlockedTimeUpdateResponse = try await apiClient.post(endpoint, body: body)
        guard let blockedTime = response.blockedTime else {
            throw APIError.serverError("No blocked time returned from server")
        }
        return blockedTime
    }

    /// Delete blocked time
    func deleteBlockedTime(id: Int) async throws {
        let endpoint = "/api/admin/blocked-times/\(id)"
        struct DeleteResponse: Codable { let success: Bool }
        let _: DeleteResponse = try await apiClient.delete(endpoint)
    }
}
