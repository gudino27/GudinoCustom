//
//  PricingService.swift
//  GCWadmin
//
//  API service for Pricing endpoints
//

import Foundation

class PricingService {
    static let shared = PricingService()
    private let apiClient = APIClient.shared

    private init() {}

    // MARK: - Response Models

    private struct MessageResponse: Codable {
        let success: Bool
        let message: String?
    }

    // MARK: - Get All Pricing Data

    func getAllPricing() async throws -> AllPricing {
        return try await apiClient.get("/api/prices")
    }

    // MARK: - Cabinet Prices

    func getCabinetPrices() async throws -> CabinetPrices {
        return try await apiClient.get("/api/prices/cabinets")
    }

    func updateCabinetPrices(_ prices: CabinetPrices) async throws {
        let pricesDict = Dictionary(uniqueKeysWithValues: prices.map { ($0.key, $0.value) })
        let _: MessageResponse = try await apiClient.put(
            "/api/prices/cabinets",
            body: pricesDict
        )
    }

    // MARK: - Materials

    func getMaterials() async throws -> [PricingMaterial] {
        return try await apiClient.get("/api/prices/materials")
    }

    func updateMaterials(_ materials: [PricingMaterial]) async throws {
        // Create encodable wrapper
        struct MaterialUpdate: Encodable {
            let id: Int?
            let nameEn: String
            let nameEs: String
            let multiplier: Double
        }

        let updates = materials.map { material in
            MaterialUpdate(
                id: material.id,
                nameEn: material.nameEn,
                nameEs: material.nameEs,
                multiplier: material.multiplier
            )
        }

        // Debug: Print what we're sending
        print("🚀 Sending \(updates.count) materials to API:")
        for (index, update) in updates.enumerated() {
            print("  [\(index)] id: \(update.id ?? -1), nameEn: '\(update.nameEn)', nameEs: '\(update.nameEs)', multiplier: \(update.multiplier)")
        }

        // Try to encode to JSON to see what's being sent
        if let jsonData = try? JSONEncoder().encode(updates),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            print("📤 JSON payload: \(jsonString)")
        }

        let _: MessageResponse = try await apiClient.put("/api/prices/materials", body: updates)
    }

    // MARK: - Color Pricing

    func getColorPricing() async throws -> ColorPricing {
        return try await apiClient.get("/api/prices/colors")
    }

    func updateColorPricing(_ colors: ColorPricing) async throws {
        let colorsDict = Dictionary(uniqueKeysWithValues: colors.map { ($0.key, $0.value) })
        let _: MessageResponse = try await apiClient.put(
            "/api/prices/colors",
            body: colorsDict
        )
    }

    // MARK: - Wall Pricing

    func getWallPricing() async throws -> WallPricing {
        return try await apiClient.get("/api/prices/walls")
    }

    func updateWallPricing(_ walls: WallPricing) async throws {
        let wallsDict = Dictionary(uniqueKeysWithValues: walls.map { ($0.key, $0.value) })
        let _: MessageResponse = try await apiClient.put(
            "/api/prices/walls",
            body: wallsDict
        )
    }

    // MARK: - Wall Availability

    func getWallAvailability() async throws -> WallAvailability {
        return try await apiClient.get("/api/prices/wall-availability")
    }

    func updateWallAvailability(_ availability: WallAvailability) async throws {
        let _: MessageResponse = try await apiClient.put(
            "/api/prices/wall-availability",
            body: [
                "addWallEnabled": availability.addWallEnabled,
                "removeWallEnabled": availability.removeWallEnabled
            ]
        )
    }
}
