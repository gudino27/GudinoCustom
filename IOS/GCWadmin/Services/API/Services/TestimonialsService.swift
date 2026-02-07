//
//  TestimonialsService.swift
//  GCWadmin
//
//  API service for Testimonials endpoints
//

import Foundation

class TestimonialsService {
    static let shared = TestimonialsService()
    private let apiClient = APIClient.shared

    private init() {}

    // MARK: - Testimonials

    func getAllTestimonials() async throws -> [Testimonial] {
        return try await apiClient.get("/api/admin/testimonials")
    }

    func toggleVisibility(id: Int, isVisible: Bool) async throws {
        let body: [String: Any] = ["is_visible": isVisible]
        let _: TestimonialMessageResponse = try await apiClient.put(
            "/api/admin/testimonials/\(id)/visibility",
            body: body
        )
    }

    func deleteTestimonial(id: Int) async throws {
        let _: TestimonialMessageResponse = try await apiClient.delete("/api/admin/testimonials/\(id)")
    }

    // MARK: - Send Testimonial Link

    func sendTestimonialLink(
        clientName: String,
        clientEmail: String,
        clientPhone: String? = nil,
        projectType: String? = nil,
        sendVia: String = "email"
    ) async throws -> SendTestimonialLinkResponse {
        var body: [String: Any] = [
            "client_name": clientName,
            "client_email": clientEmail,
            "send_via": sendVia
        ]
        if let clientPhone = clientPhone, !clientPhone.isEmpty {
            body["client_phone"] = clientPhone
        }
        if let projectType = projectType, !projectType.isEmpty {
            body["project_type"] = projectType
        }

        return try await apiClient.post("/api/admin/send-testimonial-link", body: body)
    }

    // MARK: - Tokens

    func getTokens(status: String = "all") async throws -> [TestimonialToken] {
        let encoded = status.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? status
        return try await apiClient.get("/api/admin/testimonial-tokens?status=\(encoded)")
    }

    func getTokenTracking(token: String, limit: Int = 20, offset: Int = 0) async throws -> TestimonialTrackingResponse {
        return try await apiClient.get("/api/admin/testimonial-tokens/\(token)/tracking?limit=\(limit)&offset=\(offset)")
    }

    func deleteToken(token: String) async throws {
        let _: TestimonialMessageResponse = try await apiClient.delete("/api/admin/testimonial-tokens/\(token)")
    }

    // MARK: - Analytics

    func getAnalytics(days: Int = 30) async throws -> TestimonialAnalytics {
        return try await apiClient.get("/api/admin/testimonial-analytics?days=\(days)")
    }
}
