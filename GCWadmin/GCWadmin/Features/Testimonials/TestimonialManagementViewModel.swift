//
//  TestimonialManagementViewModel.swift
//  GCWadmin
//
//  ViewModel for Testimonial Management
//

import Foundation
import SwiftUI
import Combine

// MARK: - ViewModel

@MainActor
class TestimonialManagementViewModel: ObservableObject {
    private let testimonialsService = TestimonialsService.shared

    // MARK: - Published Properties - Data

    @Published var testimonials: [Testimonial] = []
    @Published var tokens: [TestimonialToken] = []
    @Published var analytics: TestimonialAnalytics?
    @Published var trackingData: [String: TestimonialTrackingResponse] = [:]

    // MARK: - Published Properties - View State

    @Published var isLoading = false
    @Published var isSaving = false
    @Published var errorMessage: String?
    @Published var successMessage: String?
    @Published var statusFilter: String = "all"
    @Published var selectedTestimonial: Testimonial?
    @Published var showingTestimonialDetail = false
    @Published var showingDeleteConfirmation = false
    @Published var testimonialToDelete: Testimonial?
    @Published var expandedTokenId: String?

    // MARK: - Published Properties - Send Link Form

    @Published var linkClientName: String = ""
    @Published var linkClientEmail: String = ""
    @Published var linkClientPhone: String = ""
    @Published var linkProjectType: String = ""
    @Published var linkSendVia: String = "email"
    @Published var linkCustomProjectType: String = ""

    // MARK: - Computed Properties

    var filteredTokens: [TestimonialToken] {
        guard statusFilter != "all" else { return tokens }
        return tokens.filter { $0.status.lowercased() == statusFilter.lowercased() }
    }

    var averageRating: Double {
        guard !testimonials.isEmpty else { return 0 }
        let total = testimonials.reduce(0) { $0 + $1.rating }
        return Double(total) / Double(testimonials.count)
    }

    var visibleCount: Int {
        testimonials.filter { $0.isVisible }.count
    }

    // MARK: - Load All Data

    func loadAll() async {
        isLoading = true
        errorMessage = nil

        async let testimonialsTask: () = loadTestimonials()
        async let tokensTask: () = loadTokens()
        async let analyticsTask: () = loadAnalytics()

        _ = await (testimonialsTask, tokensTask, analyticsTask)

        isLoading = false
    }

    // MARK: - Load Testimonials

    func loadTestimonials() async {
        do {
            testimonials = try await testimonialsService.getAllTestimonials()
            print("[Testimonials] Loaded \(testimonials.count) testimonials")
        } catch {
            print("[Testimonials] Error loading: \(error)")
        }
    }

    // MARK: - Load Tokens

    func loadTokens() async {
        do {
            tokens = try await testimonialsService.getTokens(status: "all")
            print("[Testimonials] Loaded \(tokens.count) tokens")
        } catch {
            print("[Testimonials] Error loading tokens: \(error)")
        }
    }

    // MARK: - Load Analytics

    func loadAnalytics() async {
        do {
            analytics = try await testimonialsService.getAnalytics(days: 30)
            print("[Testimonials] Analytics loaded")
        } catch {
            print("[Testimonials] Error loading analytics: \(error)")
        }
    }

    // MARK: - Toggle Visibility

    func toggleVisibility(_ testimonial: Testimonial) async {
        isSaving = true
        errorMessage = nil

        do {
            let newVisibility = !testimonial.isVisible
            try await testimonialsService.toggleVisibility(id: testimonial.id, isVisible: newVisibility)

            if let index = testimonials.firstIndex(where: { $0.id == testimonial.id }) {
                testimonials[index].isVisible = newVisibility
            }

            successMessage = newVisibility ? "Testimonial is now visible" : "Testimonial is now hidden"
        } catch {
            errorMessage = "Failed to update visibility: \(error.localizedDescription)"
        }

        isSaving = false
    }

    // MARK: - Delete Testimonial

    func deleteTestimonial(_ testimonial: Testimonial) async {
        do {
            try await testimonialsService.deleteTestimonial(id: testimonial.id)
            testimonials.removeAll { $0.id == testimonial.id }
            showingTestimonialDetail = false
            selectedTestimonial = nil
            successMessage = "Testimonial deleted"
        } catch {
            errorMessage = "Failed to delete testimonial: \(error.localizedDescription)"
        }
    }

    // MARK: - Send Link

    func sendLink() async {
        guard !linkClientName.isEmpty else {
            errorMessage = "Client name is required"
            return
        }
        guard !linkClientEmail.isEmpty else {
            errorMessage = "Client email is required"
            return
        }

        isSaving = true
        errorMessage = nil

        let projectType = linkProjectType == "Other" ? linkCustomProjectType : linkProjectType

        do {
            let response = try await testimonialsService.sendTestimonialLink(
                clientName: linkClientName,
                clientEmail: linkClientEmail,
                clientPhone: linkClientPhone.isEmpty ? nil : linkClientPhone,
                projectType: projectType.isEmpty ? nil : projectType,
                sendVia: linkSendVia
            )

            if response.success {
                successMessage = "Testimonial link sent successfully"
                resetLinkForm()
                await loadTokens()
            } else {
                errorMessage = "Failed to send testimonial link"
            }
        } catch {
            errorMessage = "Failed to send link: \(error.localizedDescription)"
        }

        isSaving = false
    }

    // MARK: - Load Tracking

    func loadTracking(for token: String) async {
        do {
            let response = try await testimonialsService.getTokenTracking(token: token)
            trackingData[token] = response
            print("[Testimonials] Loaded \(response.records.count) tracking records for token")
        } catch {
            print("[Testimonials] Error loading tracking: \(error)")
        }
    }

    // MARK: - Delete Token

    func deleteToken(_ token: TestimonialToken) async {
        do {
            try await testimonialsService.deleteToken(token: token.token)
            tokens.removeAll { $0.id == token.id }
            trackingData.removeValue(forKey: token.token)
            successMessage = "Token deleted"
        } catch {
            errorMessage = "Failed to delete token: \(error.localizedDescription)"
        }
    }

    // MARK: - Form Helpers

    func resetLinkForm() {
        linkClientName = ""
        linkClientEmail = ""
        linkClientPhone = ""
        linkProjectType = ""
        linkSendVia = "email"
        linkCustomProjectType = ""
    }

    // MARK: - Format Date

    func formatDate(_ dateString: String?) -> String {
        guard let dateString = dateString else { return "N/A" }

        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        let displayFormatter = DateFormatter()
        displayFormatter.dateStyle = .medium
        displayFormatter.timeStyle = .short

        if let date = isoFormatter.date(from: dateString) {
            return displayFormatter.string(from: date)
        }

        let altFormatter = DateFormatter()
        altFormatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSZ"
        if let date = altFormatter.date(from: dateString) {
            return displayFormatter.string(from: date)
        }

        altFormatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
        if let date = altFormatter.date(from: dateString) {
            return displayFormatter.string(from: date)
        }

        altFormatter.dateFormat = "yyyy-MM-dd"
        if let date = altFormatter.date(from: dateString) {
            displayFormatter.timeStyle = .none
            return displayFormatter.string(from: date)
        }

        return dateString
    }
}
