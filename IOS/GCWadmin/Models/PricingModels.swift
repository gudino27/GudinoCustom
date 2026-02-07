//
//  PricingModels.swift
//  GCWadmin
//
//  Models for Price Management
//

import Foundation

// MARK: - All Pricing Data

struct AllPricing: Codable {
    let basePrices: [String: Double]
    let materialMultipliers: [PricingMaterial]
    let colorPricing: [String: Double]
    let wallPricing: [String: Double]
}

// MARK: - Cabinet Prices

typealias CabinetPrices = [String: Double]

// MARK: - Pricing Material

struct PricingMaterial: Codable, Identifiable, Hashable {
    let id: Int?
    let nameEn: String
    let nameEs: String
    let multiplier: Double

    var displayName: String {
        nameEn
    }

    var displayMultiplier: String {
        String(format: "×%.1f", multiplier)
    }
}

// MARK: - Color Pricing

typealias ColorPricing = [String: Double]

// MARK: - Wall Pricing

typealias WallPricing = [String: Double]

// MARK: - Wall Availability

struct WallAvailability: Codable {
    var addWallEnabled: Bool
    var removeWallEnabled: Bool
}

// MARK: - Update Requests

struct UpdateMaterialsRequest: Codable {
    let materials: [PricingMaterial]
}
