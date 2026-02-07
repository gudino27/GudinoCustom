//
//  DesignsService.swift
//  GCWadmin
//
//  API service for Designs endpoints
//

import Foundation

class DesignsService {
    static let shared = DesignsService()
    private let apiClient = APIClient.shared

    private init() {}

    // MARK: - Get All Designs

    func getAllDesigns(status: String? = nil) async throws -> [Design] {
        var endpoint = "/api/designs"
        if let status = status {
            endpoint += "?status=\(status)"
        }
        return try await apiClient.get(endpoint)
    }

    // MARK: - Get Single Design (Full Detail)

    func getDesign(_ id: Int) async throws -> DesignDetail {
        return try await apiClient.get("/api/designs/\(id)")
    }

    // MARK: - Get Design Stats

    func getStats() async throws -> DesignStats {
        return try await apiClient.get("/api/designs/stats")
    }

    // MARK: - Update Design Status

    func updateStatus(_ id: Int, status: String) async throws {
        let _: DesignStatusResponse = try await apiClient.put(
            "/api/designs/\(id)/status",
            body: ["status": status]
        )
    }

    // MARK: - Update Design Note

    func updateNote(_ id: Int, note: String) async throws {
        let _: DesignNoteResponse = try await apiClient.put(
            "/api/designs/\(id)/note",
            body: ["note": note]
        )
    }

    // MARK: - Delete Design

    func deleteDesign(_ id: Int) async throws {
        let _: DesignDeleteResponse = try await apiClient.delete("/api/designs/\(id)")
    }

    // MARK: - Download PDF

    func downloadPDF(_ id: Int) async throws -> Data {
        let url = URL(string: "\(APIConfig.baseURL)/api/designs/\(id)/pdf")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"

        if let token = try? KeychainService.shared.get(for: "access_token") {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw NSError(domain: "DesignsService", code: -1,
                          userInfo: [NSLocalizedDescriptionKey: "Failed to download PDF"])
        }

        return data
    }

    // MARK: - Quick Quotes

    func getAllQuickQuotes(status: String? = nil) async throws -> [QuickQuote] {
        var endpoint = "/api/admin/quick-quotes"
        if let status = status, status != "all" {
            endpoint += "?status=\(status)"
        }
        return try await apiClient.get(endpoint)
    }

    func getQuickQuote(_ id: Int) async throws -> QuickQuote {
        return try await apiClient.get("/api/admin/quick-quotes/\(id)")
    }

    func getQuickQuoteStats() async throws -> QuickQuoteStats {
        return try await apiClient.get("/api/admin/quick-quotes/stats")
    }

    func updateQuickQuoteStatus(_ id: Int, status: String) async throws {
        let _: QuickQuoteMessageResponse = try await apiClient.put(
            "/api/admin/quick-quotes/\(id)/status",
            body: ["status": status]
        )
    }

    func updateQuickQuoteNote(_ id: Int, note: String) async throws {
        let _: QuickQuoteMessageResponse = try await apiClient.put(
            "/api/admin/quick-quotes/\(id)/note",
            body: ["note": note]
        )
    }

    func deleteQuickQuote(_ id: Int) async throws {
        let _: QuickQuoteMessageResponse = try await apiClient.delete("/api/admin/quick-quotes/\(id)")
    }
}
