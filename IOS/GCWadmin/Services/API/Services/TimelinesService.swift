//
//  TimelinesService.swift
//  GCWadmin
//
//  API service for Timeline endpoints
//

import Foundation

class TimelinesService {
    static let shared = TimelinesService()
    private let apiClient = APIClient.shared

    private init() {}

    // MARK: - Timeline CRUD

    /// Get all timelines (admin only)
    func getAllTimelines() async throws -> [Timeline] {
        return try await apiClient.get("/api/admin/timelines")
    }

    /// Get timeline by ID with phases (admin only)
    func getTimeline(_ id: Int) async throws -> TimelineDetail {
        return try await apiClient.get("/api/admin/timeline/\(id)")
    }

    /// Get timeline by invoice ID (admin only)
    func getTimelineByInvoiceId(_ invoiceId: Int) async throws -> TimelineDetail {
        return try await apiClient.get("/api/admin/timeline/invoice/\(invoiceId)")
    }

    /// Create timeline from invoice
    func createTimeline(invoiceId: Int, language: String) async throws -> TimelineCreateResponse {
        let body: [String: Any] = [
            "invoice_id": invoiceId,
            "client_language": language
        ]
        return try await apiClient.post("/api/admin/timeline", body: body)
    }

    /// Create standalone timeline (without invoice)
    func createStandaloneTimeline(
        clientName: String,
        clientEmail: String,
        clientPhone: String?,
        language: String
    ) async throws -> TimelineStandaloneCreateResponse {
        var body: [String: Any] = [
            "client_name": clientName,
            "client_email": clientEmail,
            "client_language": language,
            "send_email": false // Don't auto-send email, admin will manually send link
        ]
        if let phone = clientPhone, !phone.isEmpty {
            body["client_phone"] = phone
        }
        return try await apiClient.post("/api/admin/timeline/standalone", body: body)
    }

    /// Update timeline settings
    func updateTimeline(_ id: Int, language: String) async throws {
        let body: [String: Any] = [
            "client_language": language
        ]
        let _: TimelineMessageResponse = try await apiClient.put("/api/admin/timeline/\(id)", body: body)
    }

    /// Delete timeline
    func deleteTimeline(_ id: Int) async throws {
        let _: TimelineMessageResponse = try await apiClient.delete("/api/admin/timeline/\(id)")
    }

    // MARK: - Phase Management

    /// Add phase to timeline
    func addPhase(
        timelineId: Int,
        phaseNameKey: String,
        status: String,
        startDate: String?,
        estimatedCompletion: String?,
        notes: String?,
        sendNotification: Bool = false
    ) async throws -> TimelinePhaseCreateResponse {
        var body: [String: Any] = [
            "phase_name_key": phaseNameKey,
            "status": status,
            "sendNotification": sendNotification
        ]
        if let startDate = startDate, !startDate.isEmpty {
            body["start_date"] = startDate
        }
        if let estDate = estimatedCompletion, !estDate.isEmpty {
            body["estimated_completion"] = estDate
        }
        if let notes = notes, !notes.isEmpty {
            body["notes"] = notes
        }
        return try await apiClient.post("/api/admin/timeline/\(timelineId)/phase", body: body)
    }

    /// Update phase
    func updatePhase(
        _ phaseId: Int,
        status: String?,
        startDate: String?,
        estimatedCompletion: String?,
        actualCompletion: String?,
        notes: String?
    ) async throws {
        var body: [String: Any] = [:]
        if let status = status {
            body["status"] = status
        }
        if let startDate = startDate {
            body["start_date"] = startDate.isEmpty ? NSNull() : startDate
        }
        if let estDate = estimatedCompletion {
            body["estimated_completion"] = estDate.isEmpty ? NSNull() : estDate
        }
        if let actualDate = actualCompletion {
            body["actual_completion"] = actualDate.isEmpty ? NSNull() : actualDate
        }
        if let notes = notes {
            body["notes"] = notes.isEmpty ? NSNull() : notes
        }
        let _: TimelineMessageResponse = try await apiClient.put("/api/admin/timeline/phase/\(phaseId)", body: body)
    }

    /// Delete phase
    func deletePhase(_ phaseId: Int) async throws {
        let _: TimelineMessageResponse = try await apiClient.delete("/api/admin/timeline/phase/\(phaseId)")
    }

    // MARK: - Send Link

    /// Send timeline link to client
    func sendLink(timelineId: Int, method: String, language: String) async throws -> TimelineSendLinkResponse {
        let body: [String: Any] = [
            "method": method,
            "language": language
        ]
        return try await apiClient.post("/api/admin/timeline/\(timelineId)/send-link", body: body)
    }
}
