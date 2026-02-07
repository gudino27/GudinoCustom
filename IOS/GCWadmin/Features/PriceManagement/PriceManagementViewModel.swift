//
//  PriceManagementViewModel.swift
//  GCWadmin
//
//  ViewModel for Price Management
//

import Foundation
import SwiftUI
import Combine

@MainActor
class PriceManagementViewModel: ObservableObject {
    private let pricingService = PricingService.shared

    // MARK: - Published Properties

    // Tab selection
    @Published var selectedTab = 0  // 0=Cabinets, 1=Materials, 2=Colors, 3=Walls, 4=Availability

    // Loading states
    @Published var isLoading = false
    @Published var isSaving = false
    @Published var errorMessage: String?
    @Published var successMessage: String?

    // Cabinet Prices
    @Published var cabinetPrices: [String: Double] = [:]
    @Published var selectedCabinetRoom: CabinetRoom = .kitchen

    // Materials
    @Published var materials: [PricingMaterial] = []
    @Published var showAddMaterial = false
    @Published var editingMaterial: PricingMaterial?
    @Published var newMaterialNameEn = ""
    @Published var newMaterialNameEs = ""
    @Published var newMaterialMultiplier = "1.0"

    // Color Pricing
    @Published var colorPricing: [String: Double] = [:]

    // Wall Pricing
    @Published var wallPricing: [String: Double] = [:]

    // Wall Availability
    @Published var wallAvailability = WallAvailability(addWallEnabled: true, removeWallEnabled: true)

    enum CabinetRoom: String, CaseIterable {
        case kitchen = "Kitchen"
        case bathroom = "Bathroom"
    }

    // MARK: - Load Data

    func loadAllPricing() async {
        isLoading = true
        errorMessage = nil

        do {
            let pricing = try await pricingService.getAllPricing()

            // Merge backend prices with static cabinet types
            // Start with default prices (all types at $0)
            var mergedCabinetPrices = CabinetTypes.defaultPrices()

            // Override with actual prices from backend
            for (type, price) in pricing.basePrices {
                mergedCabinetPrices[type] = price
            }

            cabinetPrices = mergedCabinetPrices
            materials = pricing.materialMultipliers
            colorPricing = pricing.colorPricing
            wallPricing = pricing.wallPricing

            // Load wall availability separately
            wallAvailability = try await pricingService.getWallAvailability()

            print("✅ Loaded all pricing data")
            print("   - Cabinet types: \(cabinetPrices.count)")
            print("   - Materials: \(materials.count)")
            print("   - Color options: \(colorPricing.count)")
        } catch {
            errorMessage = "Failed to load pricing: \(error.localizedDescription)"
            print("❌ Error loading pricing: \(error)")
        }

        isLoading = false
    }

    // MARK: - Cabinet Prices

    var filteredCabinetPrices: [(String, Double)] {
        let typesToShow = selectedCabinetRoom == .kitchen ? CabinetTypes.kitchenTypes : CabinetTypes.bathroomTypes

        return cabinetPrices
            .filter { typesToShow.contains($0.key) }
            .sorted { $0.key < $1.key }
    }

    func updateCabinetPrice(type: String, price: Double) {
        cabinetPrices[type] = price
    }

    func saveCabinetPrices() async {
        isSaving = true
        errorMessage = nil

        do {
            try await pricingService.updateCabinetPrices(cabinetPrices)
            successMessage = "Cabinet prices saved successfully"
            print("✅ Cabinet prices saved")
        } catch {
            errorMessage = "Failed to save cabinet prices: \(error.localizedDescription)"
            print("❌ Error saving cabinet prices: \(error)")
        }

        isSaving = false
    }

    // MARK: - Materials

    func addMaterial() {
        guard let multiplier = Double(newMaterialMultiplier),
              !newMaterialNameEn.isEmpty,
              !newMaterialNameEn.trimmingCharacters(in: .whitespaces).isEmpty else {
            errorMessage = "Please fill in all fields with valid values"
            return
        }

        let newMaterial = PricingMaterial(
            id: nil,
            nameEn: newMaterialNameEn.trimmingCharacters(in: .whitespaces),
            nameEs: newMaterialNameEs.isEmpty ? newMaterialNameEn.trimmingCharacters(in: .whitespaces) : newMaterialNameEs.trimmingCharacters(in: .whitespaces),
            multiplier: multiplier
        )

        materials.append(newMaterial)
        print("✅ Added new material: \(newMaterial.nameEn), count: \(materials.count)")
        resetMaterialForm()
        showAddMaterial = false
    }

    func deleteMaterial(_ material: PricingMaterial) {
        let beforeCount = materials.count
        materials.removeAll { $0.id == material.id && $0.nameEn == material.nameEn }
        let afterCount = materials.count
        print("🗑️ Deleted material: \(material.nameEn), count: \(beforeCount) → \(afterCount)")
    }

    func saveMaterials() async {
        isSaving = true
        errorMessage = nil

        // Debug: Print all materials before filtering
        print("📦 Materials before filtering: \(materials.count)")
        for (index, material) in materials.enumerated() {
            print("  [\(index)] nameEn: '\(material.nameEn)', nameEs: '\(material.nameEs)', multiplier: \(material.multiplier), id: \(material.id ?? -1)")
        }

        // Filter out any materials with empty names and validate
        let validMaterials = materials.filter { material in
            let isValid = !material.nameEn.isEmpty && !material.nameEn.trimmingCharacters(in: .whitespaces).isEmpty
            if !isValid {
                print("⚠️ Filtering out invalid material with empty nameEn")
            }
            return isValid
        }

        print("✅ Valid materials after filtering: \(validMaterials.count)")

        if validMaterials.isEmpty {
            errorMessage = "No valid materials to save"
            isSaving = false
            return
        }

        do {
            try await pricingService.updateMaterials(validMaterials)
            successMessage = "Materials saved successfully"
            print("✅ Materials saved")

            // Reload to get updated IDs from backend
            materials = try await pricingService.getMaterials()
        } catch {
            errorMessage = "Failed to save materials: \(error.localizedDescription)"
            print("❌ Error saving materials: \(error)")
        }

        isSaving = false
    }

    func resetMaterialForm() {
        newMaterialNameEn = ""
        newMaterialNameEs = ""
        newMaterialMultiplier = "1.0"
        editingMaterial = nil
    }

    func startEditMaterial(_ material: PricingMaterial) {
        editingMaterial = material
        newMaterialNameEn = material.nameEn
        newMaterialNameEs = material.nameEs
        newMaterialMultiplier = String(material.multiplier)
        showAddMaterial = true
    }

    func updateMaterial() {
        guard let editingMaterial = editingMaterial,
              let multiplier = Double(newMaterialMultiplier),
              !newMaterialNameEn.isEmpty,
              !newMaterialNameEn.trimmingCharacters(in: .whitespaces).isEmpty else {
            errorMessage = "Please fill in all fields with valid values"
            return
        }

        let updatedMaterial = PricingMaterial(
            id: editingMaterial.id,
            nameEn: newMaterialNameEn.trimmingCharacters(in: .whitespaces),
            nameEs: newMaterialNameEs.isEmpty ? newMaterialNameEn.trimmingCharacters(in: .whitespaces) : newMaterialNameEs.trimmingCharacters(in: .whitespaces),
            multiplier: multiplier
        )

        if let index = materials.firstIndex(where: { $0.id == editingMaterial.id }) {
            materials[index] = updatedMaterial
            print("✅ Updated material at index \(index): \(updatedMaterial.nameEn)")
        } else {
            print("⚠️ Could not find material to update with id: \(editingMaterial.id ?? -1)")
        }

        resetMaterialForm()
        showAddMaterial = false
    }

    // MARK: - Color Pricing

    func updateColorPrice(key: String, price: Double) {
        colorPricing[key] = price
    }

    func saveColorPricing() async {
        isSaving = true
        errorMessage = nil

        do {
            try await pricingService.updateColorPricing(colorPricing)
            successMessage = "Color pricing saved successfully"
            print("✅ Color pricing saved")
        } catch {
            errorMessage = "Failed to save color pricing: \(error.localizedDescription)"
            print("❌ Error saving color pricing: \(error)")
        }

        isSaving = false
    }

    // MARK: - Wall Pricing

    func updateWallPrice(type: String, price: Double) {
        wallPricing[type] = price
    }

    func saveWallPricing() async {
        isSaving = true
        errorMessage = nil

        do {
            try await pricingService.updateWallPricing(wallPricing)
            successMessage = "Wall pricing saved successfully"
            print("✅ Wall pricing saved")
        } catch {
            errorMessage = "Failed to save wall pricing: \(error.localizedDescription)"
            print("❌ Error saving wall pricing: \(error)")
        }

        isSaving = false
    }

    // MARK: - Wall Availability

    func saveWallAvailability() async {
        isSaving = true
        errorMessage = nil

        do {
            try await pricingService.updateWallAvailability(wallAvailability)
            successMessage = "Wall availability saved successfully"
            print("✅ Wall availability saved")
        } catch {
            errorMessage = "Failed to save wall availability: \(error.localizedDescription)"
            print("❌ Error saving wall availability: \(error)")
        }

        isSaving = false
    }
}
