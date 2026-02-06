//
//  CabinetTypes.swift
//  GCWadmin
//
//  Static definitions of all available cabinet types
//

import Foundation

struct CabinetTypes {
    // MARK: - Kitchen Cabinet Types

    static let kitchenTypes: [String] = [
        "base",
        "sink-base",
        "wall",
        "tall",
        "corner",
        "drawer-base",
        "double-drawer-base",
        "glass-wall",
        "open-shelf",
        "island-base",
        "peninsula-base",
        "pantry",
        "corner-wall",
        "lazy-susan",
        "blind-corner",
        "appliance-garage",
        "wine-rack",
        "spice-rack",
        "tray-divider",
        "pull-out-drawer",
        "soft-close-drawer",
        "under-cabinet-lighting"
    ]

    // MARK: - Bathroom Cabinet Types

    static let bathroomTypes: [String] = [
        "vanity",
        "vanity-sink",
        "double-vanity",
        "floating-vanity",
        "corner-vanity",
        "vanity-tower",
        "medicine",
        "medicine-mirror",
        "linen",
        "linen-tower",
        "wall-hung-vanity",
        "vessel-sink-vanity",
        "undermount-sink-vanity",
        "powder-room-vanity",
        "master-bath-vanity",
        "kids-bathroom-vanity",
        "toilet",
        "bathtub",
        "shower"
    ]

    // MARK: - All Types

    static let allTypes: [String] = kitchenTypes + bathroomTypes

    // MARK: - Helper Methods

    static func isKitchenType(_ type: String) -> Bool {
        return kitchenTypes.contains(type)
    }

    static func isBathroomType(_ type: String) -> Bool {
        return bathroomTypes.contains(type)
    }

    static func displayName(for type: String) -> String {
        return type.split(separator: "-")
            .map { $0.capitalized }
            .joined(separator: " ")
    }

    /// Get default prices for all cabinet types (set to 0)
    static func defaultPrices() -> [String: Double] {
        var prices: [String: Double] = [:]
        for type in allTypes {
            prices[type] = 0
        }
        return prices
    }
}
