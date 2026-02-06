//
//  TimelinesManagerViewModel.swift
//  GCWadmin
//
//  ViewModel for Project Timeline Manager
//  Matches webapp ProjectTimelineManager.js
//

import Foundation
import SwiftUI
import Combine

@MainActor
class TimelinesManagerViewModel: ObservableObject {
    private let timelinesService = TimelinesService.shared
    
    // MARK: - Published Properties - Data
    
    @Published var timelines: [Timeline] = []
    @Published var selectedTimeline: TimelineDetail?
    @Published var invoices: [TimelineInvoice] = []
    
    // MARK: - Published Properties - View State
    
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var successMessage: String?
    
    // MARK: - Published Properties - Modals
    
    @Published var showCreateModal = false
    @Published var showSendLinkModal = false
    @Published var showDeleteConfirmation = false
    @Published var createMode: CreateMode = .invoice
    
    // MARK: - Published Properties - Create Form
    
    @Published var selectedInvoiceId: Int?
    @Published var createLanguage = "en"
    @Published var standaloneClientName = ""
    @Published var standaloneClientEmail = ""
    @Published var standaloneClientPhone = ""
    @Published var standaloneLanguage = "en"
    
    // MARK: - Published Properties - Phase Edit
    
    @Published var editingPhaseId: Int?
    @Published var editFormStatus = "pending"
    @Published var editFormEstimatedCompletion = ""
    @Published var editFormNotes = ""
    
    // MARK: - Enums
    
    enum CreateMode: String, CaseIterable {
        case invoice = "invoice"
        case standalone = "standalone"
        
        var label: String {
            switch self {
            case .invoice: return "With Invoice"
            case .standalone: return "Standalone"
            }
        }
    }
    
    // MARK: - Computed Properties
    
    var availableInvoices: [TimelineInvoice] {
        invoices.filter { !$0.hasTimeline }
    }
    
    // MARK: - Load All Data
    
    func loadAll() async {
        isLoading = true
        errorMessage = nil
        
        async let timelinesTask: () = loadTimelines()
        async let invoicesTask: () = loadInvoices()
        
        _ = await (timelinesTask, invoicesTask)
        
        isLoading = false
    }
    
    // MARK: - Load Timelines
    
    func loadTimelines() async {
        do {
            timelines = try await timelinesService.getAllTimelines()
        } catch {
            print("Failed to load timelines: \(error)")
            errorMessage = "Failed to load timelines"
        }
    }
    
    // MARK: - Load Invoices
    
    func loadInvoices() async {
        do {
            let apiClient = APIClient.shared
            invoices = try await apiClient.get("/api/admin/invoices")
        } catch {
            print("Failed to load invoices: \(error)")
        }
    }
    
    // MARK: - Load Timeline Details
    
    func loadTimelineDetails(id: Int, isInvoiceBased: Bool) async {
        do {
            if isInvoiceBased {
                selectedTimeline = try await timelinesService.getTimelineByInvoiceId(id)
            } else {
                selectedTimeline = try await timelinesService.getTimeline(id)
            }
        } catch {
            print("Failed to load timeline details: \(error)")
            errorMessage = "Failed to load timeline details"
        }
    }
    
    // MARK: - Select Timeline
    
    func selectTimeline(_ timeline: Timeline) async {
        await loadTimelineDetails(id: timeline.isInvoiceBased ? (timeline.invoiceId ?? timeline.id) : timeline.id, isInvoiceBased: timeline.isInvoiceBased)
    }
    
    // MARK: - Create Timeline (from Invoice)
    
    func createTimelineFromInvoice() async {
        guard let invoiceId = selectedInvoiceId else {
            errorMessage = "Please select an invoice"
            return
        }
        
        do {
            let _ = try await timelinesService.createTimeline(invoiceId: invoiceId, language: createLanguage)
            successMessage = "Timeline created successfully"
            showCreateModal = false
            resetCreateForm()
            await loadTimelines()
        } catch {
            errorMessage = "Failed to create timeline: \(error.localizedDescription)"
        }
    }
    
    // MARK: - Create Standalone Timeline
    
    func createStandaloneTimeline() async {
        guard !standaloneClientName.isEmpty, !standaloneClientEmail.isEmpty else {
            errorMessage = "Client name and email are required"
            return
        }
        
        do {
            let response = try await timelinesService.createStandaloneTimeline(
                clientName: standaloneClientName,
                clientEmail: standaloneClientEmail,
                clientPhone: standaloneClientPhone.isEmpty ? nil : standaloneClientPhone,
                language: standaloneLanguage
            )
            successMessage = "Standalone timeline created"
            showCreateModal = false
            resetCreateForm()
            await loadTimelines()
            
            // Load the newly created timeline details
            selectedTimeline = try? await timelinesService.getTimeline(response.timeline.id)
            
            // Prompt to send link
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                self.showSendLinkModal = true
            }
        } catch {
            errorMessage = "Failed to create timeline: \(error.localizedDescription)"
        }
    }
    
    // MARK: - Update Timeline Language
    
    func updateLanguage(_ language: String) async {
        guard let timeline = selectedTimeline else { return }
        
        do {
            try await timelinesService.updateTimeline(timeline.id, language: language)
            selectedTimeline?.clientLanguage = language
            successMessage = "Language updated to \(language == "es" ? "Español" : "English")"
            await loadTimelines()
        } catch {
            errorMessage = "Failed to update language: \(error.localizedDescription)"
        }
    }
    
    // MARK: - Delete Timeline
    
    func deleteTimeline() async {
        guard let timeline = selectedTimeline else { return }
        
        do {
            try await timelinesService.deleteTimeline(timeline.id)
            selectedTimeline = nil
            successMessage = "Timeline deleted"
            await loadTimelines()
        } catch {
            errorMessage = "Failed to delete timeline: \(error.localizedDescription)"
        }
    }
    
    // MARK: - Send Timeline Link
    
    func sendLink(method: String) async {
        guard let timeline = selectedTimeline else { return }
        
        do {
            let response = try await timelinesService.sendLink(
                timelineId: timeline.id,
                method: method,
                language: timeline.clientLanguage
            )
            
            var message = ""
            if method == "email" {
                message = response.results?.email == "sent" ? "Email sent successfully!" : "Failed to send email"
            } else if method == "sms" {
                message = response.results?.sms == "sent" ? "SMS sent successfully!" : "Failed to send SMS"
            } else if method == "both" {
                let emailStatus = response.results?.email == "sent" ? "✓ Email sent" : "✗ Email failed"
                let smsStatus = response.results?.sms == "sent" ? "✓ SMS sent" : "✗ SMS failed"
                message = "\(emailStatus)\n\(smsStatus)"
            }
            
            successMessage = message.isEmpty ? "Link sent!" : message
            showSendLinkModal = false
        } catch {
            errorMessage = "Failed to send link: \(error.localizedDescription)"
        }
    }
    
    // MARK: - Phase Management
    
    func startEditingPhase(_ phase: TimelinePhase) {
        editingPhaseId = phase.id
        editFormStatus = phase.status
        editFormEstimatedCompletion = phase.estimatedCompletion ?? ""
        editFormNotes = phase.notes ?? ""
    }
    
    func cancelEditingPhase() {
        editingPhaseId = nil
        editFormStatus = "pending"
        editFormEstimatedCompletion = ""
        editFormNotes = ""
    }
    
    func savePhaseChanges() async {
        guard let phaseId = editingPhaseId else { return }
        
        do {
            try await timelinesService.updatePhase(
                phaseId,
                status: editFormStatus,
                startDate: nil,
                estimatedCompletion: editFormEstimatedCompletion.isEmpty ? nil : editFormEstimatedCompletion,
                actualCompletion: editFormStatus == "completed" ? ISO8601DateFormatter().string(from: Date()) : nil,
                notes: editFormNotes.isEmpty ? nil : editFormNotes
            )
            
            editingPhaseId = nil
            successMessage = "Phase updated"
            
            // Reload details
            if let timeline = selectedTimeline {
                await loadTimelineDetails(id: timeline.isInvoiceBased ? (timeline.invoiceId ?? timeline.id) : timeline.id, isInvoiceBased: timeline.isInvoiceBased)
            }
            await loadTimelines()
        } catch {
            errorMessage = "Failed to update phase: \(error.localizedDescription)"
        }
    }
    
    // MARK: - Reset Form
    
    private func resetCreateForm() {
        selectedInvoiceId = nil
        createLanguage = "en"
        standaloneClientName = ""
        standaloneClientEmail = ""
        standaloneClientPhone = ""
        standaloneLanguage = "en"
        createMode = .invoice
    }
}

// MARK: - Timeline Invoice Model (for listing invoices without timelines)

struct TimelineInvoice: Codable, Identifiable {
    let id: Int
    let invoiceNumber: String?
    let clientName: String?
    let hasTimeline: Bool
    
    enum CodingKeys: String, CodingKey {
        case id, invoiceNumber, clientName, hasTimeline
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(Int.self, forKey: .id)
        invoiceNumber = try container.decodeIfPresent(String.self, forKey: .invoiceNumber)
        clientName = try container.decodeIfPresent(String.self, forKey: .clientName)
        hasTimeline = (try? container.decode(Bool.self, forKey: .hasTimeline)) ?? false
    }
}
