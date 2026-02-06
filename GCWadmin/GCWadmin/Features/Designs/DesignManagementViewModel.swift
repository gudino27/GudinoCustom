//
//  DesignManagementViewModel.swift
//  GCWadmin
//
//  ViewModel for Design Management
//

import Foundation
import SwiftUI
import Combine

@MainActor
class DesignManagementViewModel: ObservableObject {
    private let designsService = DesignsService.shared

    // MARK: - Published Properties

    @Published var designs: [Design] = []
    @Published var quickQuotes: [QuickQuote] = []
    @Published var stats: DesignStats?
    @Published var quoteStats: QuickQuoteStats?
    @Published var selectedDesign: DesignDetail?
    @Published var selectedQuote: QuickQuote?

    // View type: "designs", "quotes", "all"
    @Published var viewType: String = "all"

    // Filtering & Sorting
    @Published var statusFilter: String = "all"
    @Published var quoteStatusFilter: String = "all"
    @Published var sortKey: String = "created_at"
    @Published var sortAscending: Bool = false

    // UI State
    @Published var isLoading = false
    @Published var isSaving = false
    @Published var showingDetail = false
    @Published var showingQuoteDetail = false
    @Published var errorMessage: String?
    @Published var successMessage: String?

    // Note editing (designs)
    @Published var editingNoteId: Int?
    @Published var editingNoteText: String = ""

    // Note editing (quotes)
    @Published var editingQuoteNoteId: Int?
    @Published var editingQuoteNoteText: String = ""

    // MARK: - Computed Properties

    var filteredDesigns: [Design] {
        var result = designs

        if statusFilter != "all" {
            result = result.filter { $0.status == statusFilter }
        }

        result.sort { a, b in
            switch sortKey {
            case "client_name":
                return sortAscending
                    ? a.clientName.localizedCompare(b.clientName) == .orderedAscending
                    : a.clientName.localizedCompare(b.clientName) == .orderedDescending
            case "total_price":
                let priceA = a.totalPrice ?? 0
                let priceB = b.totalPrice ?? 0
                return sortAscending ? priceA < priceB : priceA > priceB
            case "status":
                return sortAscending
                    ? a.status.localizedCompare(b.status) == .orderedAscending
                    : a.status.localizedCompare(b.status) == .orderedDescending
            default: // created_at
                let dateA = a.createdAt ?? ""
                let dateB = b.createdAt ?? ""
                return sortAscending ? dateA < dateB : dateA > dateB
            }
        }

        return result
    }

    var filteredQuotes: [QuickQuote] {
        var result = quickQuotes

        if quoteStatusFilter != "all" {
            result = result.filter { $0.status == quoteStatusFilter }
        }

        // Sort by submitted_at descending
        result.sort { a, b in
            let dateA = a.submittedAt ?? ""
            let dateB = b.submittedAt ?? ""
            return dateA > dateB
        }

        return result
    }

    var newDesignCount: Int {
        designs.filter { $0.status == "new" }.count
    }

    var viewedDesignCount: Int {
        designs.filter { $0.status == "viewed" }.count
    }

    var newQuoteCount: Int {
        quickQuotes.filter { $0.status == "new" }.count
    }

    // MARK: - Load All Data

    func loadAll() async {
        isLoading = true
        errorMessage = nil

        async let designsTask: () = loadDesigns()
        async let quotesTask: () = loadQuickQuotes()
        async let statsTask: () = loadStats()
        async let quoteStatsTask: () = loadQuoteStats()

        _ = await (designsTask, quotesTask, statsTask, quoteStatsTask)

        isLoading = false
    }

    // MARK: - Load Designs

    func loadDesigns() async {
        do {
            designs = try await designsService.getAllDesigns()
            print("[Designs] Loaded \(designs.count) designs")
        } catch {
            print("[Designs] Error loading: \(error)")
        }
    }

    // MARK: - Load Quick Quotes

    func loadQuickQuotes() async {
        do {
            quickQuotes = try await designsService.getAllQuickQuotes()
            print("[Quotes] Loaded \(quickQuotes.count) quick quotes")
        } catch {
            print("[Quotes] Error loading: \(error)")
        }
    }

    // MARK: - Load Stats

    func loadStats() async {
        do {
            stats = try await designsService.getStats()
        } catch {
            print("[Designs] Error loading stats: \(error)")
        }
    }

    func loadQuoteStats() async {
        do {
            quoteStats = try await designsService.getQuickQuoteStats()
        } catch {
            print("[Quotes] Error loading stats: \(error)")
        }
    }

    // MARK: - View Design Detail

    func viewDesign(_ design: Design) async {
        do {
            selectedDesign = try await designsService.getDesign(design.id)
            showingDetail = true
            await loadDesigns()
        } catch {
            errorMessage = "Failed to load design details: \(error.localizedDescription)"
        }
    }

    // MARK: - View Quote Detail

    func viewQuote(_ quote: QuickQuote) async {
        do {
            selectedQuote = try await designsService.getQuickQuote(quote.id)
            showingQuoteDetail = true
        } catch {
            errorMessage = "Failed to load quote details: \(error.localizedDescription)"
        }
    }

    // MARK: - Update Design Status

    func updateDesignStatus(_ design: Design, to newStatus: String) async {
        do {
            try await designsService.updateStatus(design.id, status: newStatus)
            await loadDesigns()
            successMessage = "Status updated"
        } catch {
            errorMessage = "Failed to update status: \(error.localizedDescription)"
        }
    }

    // MARK: - Update Quote Status

    func updateQuoteStatus(_ quote: QuickQuote, to newStatus: String) async {
        do {
            try await designsService.updateQuickQuoteStatus(quote.id, status: newStatus)
            await loadQuickQuotes()
            await loadQuoteStats()
            successMessage = "Quote status updated"
        } catch {
            errorMessage = "Failed to update status: \(error.localizedDescription)"
        }
    }

    // MARK: - Design Note Editing

    func startEditingNote(_ design: Design) {
        editingNoteId = design.id
        editingNoteText = design.adminNote ?? ""
    }

    func cancelEditingNote() {
        editingNoteId = nil
        editingNoteText = ""
    }

    func saveNote() async {
        guard let designId = editingNoteId else { return }

        isSaving = true
        do {
            try await designsService.updateNote(designId, note: editingNoteText)
            cancelEditingNote()
            await loadDesigns()
            successMessage = "Note saved"
        } catch {
            errorMessage = "Failed to save note: \(error.localizedDescription)"
        }
        isSaving = false
    }

    // MARK: - Quote Note Editing

    func startEditingQuoteNote(_ quote: QuickQuote) {
        editingQuoteNoteId = quote.id
        editingQuoteNoteText = quote.internalNotes ?? ""
    }

    func cancelEditingQuoteNote() {
        editingQuoteNoteId = nil
        editingQuoteNoteText = ""
    }

    func saveQuoteNote() async {
        guard let quoteId = editingQuoteNoteId else { return }

        isSaving = true
        do {
            try await designsService.updateQuickQuoteNote(quoteId, note: editingQuoteNoteText)
            cancelEditingQuoteNote()
            await loadQuickQuotes()
            successMessage = "Note saved"
        } catch {
            errorMessage = "Failed to save note: \(error.localizedDescription)"
        }
        isSaving = false
    }

    // MARK: - Delete Design

    func deleteDesign(_ design: Design) async {
        do {
            try await designsService.deleteDesign(design.id)
            await loadDesigns()
            successMessage = "Design deleted"
        } catch {
            errorMessage = "Failed to delete design: \(error.localizedDescription)"
        }
    }

    // MARK: - Delete Quote

    func deleteQuote(_ quote: QuickQuote) async {
        do {
            try await designsService.deleteQuickQuote(quote.id)
            await loadQuickQuotes()
            await loadQuoteStats()
            successMessage = "Quote deleted"
        } catch {
            errorMessage = "Failed to delete quote: \(error.localizedDescription)"
        }
    }

    // MARK: - Download PDF

    func downloadPDF(_ design: Design) async -> Data? {
        do {
            return try await designsService.downloadPDF(design.id)
        } catch {
            errorMessage = "Failed to download PDF: \(error.localizedDescription)"
            return nil
        }
    }

    // MARK: - Toggle Sort

    func toggleSort(_ key: String) {
        if sortKey == key {
            sortAscending.toggle()
        } else {
            sortKey = key
            sortAscending = key == "client_name"
        }
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

        return dateString
    }
}
