//
//  Design.swift
//  GCWadmin
//
//  Design models for design management
//

import Foundation

// MARK: - Design Model (List/Summary)

struct Design: Codable, Identifiable {
    let id: Int
    var clientName: String
    var clientEmail: String?
    var clientPhone: String?
    var contactPreference: String
    var totalPrice: Double?
    var status: String
    var createdAt: String?
    var viewedAt: String?
    var viewedBy: String?
    var adminNote: String?
    var includeKitchen: Bool?
    var includeBathroom: Bool?

    init(id: Int, clientName: String, clientEmail: String? = nil, clientPhone: String? = nil,
         contactPreference: String, totalPrice: Double? = nil, status: String,
         createdAt: String? = nil, viewedAt: String? = nil, viewedBy: String? = nil,
         adminNote: String? = nil, includeKitchen: Bool? = nil, includeBathroom: Bool? = nil) {
        self.id = id
        self.clientName = clientName
        self.clientEmail = clientEmail
        self.clientPhone = clientPhone
        self.contactPreference = contactPreference
        self.totalPrice = totalPrice
        self.status = status
        self.createdAt = createdAt
        self.viewedAt = viewedAt
        self.viewedBy = viewedBy
        self.adminNote = adminNote
        self.includeKitchen = includeKitchen
        self.includeBathroom = includeBathroom
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(Int.self, forKey: .id)
        clientName = try container.decode(String.self, forKey: .clientName)
        clientEmail = try container.decodeIfPresent(String.self, forKey: .clientEmail)
        clientPhone = try container.decodeIfPresent(String.self, forKey: .clientPhone)
        contactPreference = try container.decodeIfPresent(String.self, forKey: .contactPreference) ?? "email"

        // total_price can be String or Double from SQLite
        if let priceDouble = try? container.decodeIfPresent(Double.self, forKey: .totalPrice) {
            totalPrice = priceDouble
        } else if let priceString = try? container.decodeIfPresent(String.self, forKey: .totalPrice) {
            totalPrice = Double(priceString)
        } else {
            totalPrice = nil
        }

        status = try container.decodeIfPresent(String.self, forKey: .status) ?? "new"
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
        viewedAt = try container.decodeIfPresent(String.self, forKey: .viewedAt)
        viewedBy = try container.decodeIfPresent(String.self, forKey: .viewedBy)
        adminNote = try container.decodeIfPresent(String.self, forKey: .adminNote)

        // include_kitchen/bathroom come as 0/1 integers from SQLite
        if let intVal = try? container.decodeIfPresent(Int.self, forKey: .includeKitchen) {
            includeKitchen = intVal == 1
        } else {
            includeKitchen = try container.decodeIfPresent(Bool.self, forKey: .includeKitchen)
        }

        if let intVal = try? container.decodeIfPresent(Int.self, forKey: .includeBathroom) {
            includeBathroom = intVal == 1
        } else {
            includeBathroom = try container.decodeIfPresent(Bool.self, forKey: .includeBathroom)
        }
    }

    var statusLabel: String {
        switch status {
        case "new": return "New"
        case "viewed": return "Viewed"
        case "pending": return "Pending"
        default: return status.capitalized
        }
    }

    var contactPreferenceLabel: String {
        switch contactPreference {
        case "email": return "Email"
        case "phone": return "Phone"
        case "text": return "Text"
        default: return contactPreference.capitalized
        }
    }

    var formattedPrice: String {
        guard let price = totalPrice else { return "N/A" }
        return String(format: "$%.2f", price)
    }

    var initials: String {
        let components = clientName.split(separator: " ")
        if components.count >= 2 {
            let first = components[0].prefix(1)
            let last = components[1].prefix(1)
            return "\(first)\(last)".uppercased()
        } else if let first = components.first?.prefix(1) {
            return String(first).uppercased()
        }
        return "?"
    }

    // APIClient uses .convertFromSnakeCase, so CodingKeys use camelCase property names
    // (decoder auto-converts client_name → clientName, etc.)
    enum CodingKeys: String, CodingKey {
        case id, clientName, clientEmail, clientPhone, contactPreference
        case totalPrice, status, createdAt, viewedAt, viewedBy
        case adminNote, includeKitchen, includeBathroom
    }
}

// MARK: - Design Detail (Full)

struct DesignDetail: Codable {
    let id: Int
    var clientName: String
    var clientEmail: String?
    var clientPhone: String?
    var contactPreference: String
    var kitchenData: String?
    var bathroomData: String?
    var includeKitchen: Bool?
    var includeBathroom: Bool?
    var totalPrice: Double?
    var comments: String?
    var status: String
    var createdAt: String?
    var viewedAt: String?
    var viewedBy: String?
    var floorPlanImage: String?
    var wallViewImages: String?
    var adminNote: String?

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(Int.self, forKey: .id)
        clientName = try container.decode(String.self, forKey: .clientName)
        clientEmail = try container.decodeIfPresent(String.self, forKey: .clientEmail)
        clientPhone = try container.decodeIfPresent(String.self, forKey: .clientPhone)
        contactPreference = try container.decodeIfPresent(String.self, forKey: .contactPreference) ?? "email"

        // kitchen_data/bathroom_data: backend parses JSON strings to objects,
        // so they may arrive as a dictionary. Convert back to string for storage.
        if let stringVal = try? container.decodeIfPresent(String.self, forKey: .kitchenData) {
            kitchenData = stringVal
        } else if let dictVal = try? container.decodeIfPresent(AnyCodable.self, forKey: .kitchenData) {
            if let data = try? JSONSerialization.data(withJSONObject: dictVal.value),
               let str = String(data: data, encoding: .utf8) {
                kitchenData = str
            } else {
                kitchenData = nil
            }
        } else {
            kitchenData = nil
        }

        if let stringVal = try? container.decodeIfPresent(String.self, forKey: .bathroomData) {
            bathroomData = stringVal
        } else if let dictVal = try? container.decodeIfPresent(AnyCodable.self, forKey: .bathroomData) {
            if let data = try? JSONSerialization.data(withJSONObject: dictVal.value),
               let str = String(data: data, encoding: .utf8) {
                bathroomData = str
            } else {
                bathroomData = nil
            }
        } else {
            bathroomData = nil
        }

        // include_kitchen/bathroom: 0/1 integers from SQLite
        if let intVal = try? container.decodeIfPresent(Int.self, forKey: .includeKitchen) {
            includeKitchen = intVal == 1
        } else {
            includeKitchen = try container.decodeIfPresent(Bool.self, forKey: .includeKitchen)
        }

        if let intVal = try? container.decodeIfPresent(Int.self, forKey: .includeBathroom) {
            includeBathroom = intVal == 1
        } else {
            includeBathroom = try container.decodeIfPresent(Bool.self, forKey: .includeBathroom)
        }

        // total_price can be String or Double
        if let priceDouble = try? container.decodeIfPresent(Double.self, forKey: .totalPrice) {
            totalPrice = priceDouble
        } else if let priceString = try? container.decodeIfPresent(String.self, forKey: .totalPrice) {
            totalPrice = Double(priceString)
        } else {
            totalPrice = nil
        }

        comments = try container.decodeIfPresent(String.self, forKey: .comments)
        status = try container.decodeIfPresent(String.self, forKey: .status) ?? "new"
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
        viewedAt = try container.decodeIfPresent(String.self, forKey: .viewedAt)
        viewedBy = try container.decodeIfPresent(String.self, forKey: .viewedBy)
        floorPlanImage = try container.decodeIfPresent(String.self, forKey: .floorPlanImage)

        // wall_view_images: backend parses from JSON string to array
        if let stringVal = try? container.decodeIfPresent(String.self, forKey: .wallViewImages) {
            wallViewImages = stringVal
        } else if let arrayVal = try? container.decodeIfPresent([String].self, forKey: .wallViewImages) {
            if let data = try? JSONSerialization.data(withJSONObject: arrayVal),
               let str = String(data: data, encoding: .utf8) {
                wallViewImages = str
            } else {
                wallViewImages = nil
            }
        } else {
            wallViewImages = nil
        }

        adminNote = try container.decodeIfPresent(String.self, forKey: .adminNote)
    }

    var formattedPrice: String {
        guard let price = totalPrice else { return "N/A" }
        return String(format: "$%.2f", price)
    }

    var roomsSummary: String {
        var rooms: [String] = []
        if includeKitchen == true { rooms.append("Kitchen") }
        if includeBathroom == true { rooms.append("Bathroom") }
        return rooms.isEmpty ? "No rooms" : rooms.joined(separator: ", ")
    }

    var parsedKitchenElements: Int {
        guard let data = kitchenData?.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let elements = json["elements"] as? [[String: Any]] else { return 0 }
        return elements.count
    }

    var parsedBathroomElements: Int {
        guard let data = bathroomData?.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let elements = json["elements"] as? [[String: Any]] else { return 0 }
        return elements.count
    }

    // APIClient uses .convertFromSnakeCase, so CodingKeys use camelCase property names
    enum CodingKeys: String, CodingKey {
        case id, clientName, clientEmail, clientPhone, contactPreference
        case kitchenData, bathroomData, includeKitchen, includeBathroom
        case totalPrice, comments, status, createdAt, viewedAt, viewedBy
        case floorPlanImage, wallViewImages, adminNote
    }
}

// MARK: - AnyCodable Helper (for decoding arbitrary JSON)

struct AnyCodable: Decodable {
    let value: Any

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if let dict = try? container.decode([String: AnyCodable].self) {
            value = dict.mapValues { $0.value }
        } else if let array = try? container.decode([AnyCodable].self) {
            value = array.map { $0.value }
        } else if let string = try? container.decode(String.self) {
            value = string
        } else if let int = try? container.decode(Int.self) {
            value = int
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let bool = try? container.decode(Bool.self) {
            value = bool
        } else if container.decodeNil() {
            value = NSNull()
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported type")
        }
    }
}

// MARK: - Design Stats

struct DesignStats: Codable {
    let totalDesigns: Int
    let totalRevenue: Double?
    let averageOrderValue: Double?
    let recentDesigns: Int
    let statusBreakdown: StatusBreakdown?

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        totalDesigns = try container.decodeIfPresent(Int.self, forKey: .totalDesigns) ?? 0
        totalRevenue = try container.decodeIfPresent(Double.self, forKey: .totalRevenue)
        averageOrderValue = try container.decodeIfPresent(Double.self, forKey: .averageOrderValue)
        recentDesigns = try container.decodeIfPresent(Int.self, forKey: .recentDesigns) ?? 0
        statusBreakdown = try container.decodeIfPresent(StatusBreakdown.self, forKey: .statusBreakdown)
    }

    struct StatusBreakdown: Codable {
        let pending: Int?
        let new: Int?
        let viewed: Int?
    }

    // Backend returns camelCase keys (JS object), so CodingKeys match directly
    enum CodingKeys: String, CodingKey {
        case totalDesigns
        case totalRevenue
        case averageOrderValue
        case recentDesigns
        case statusBreakdown
    }
}

// MARK: - Quick Quote Model

struct QuickQuote: Codable, Identifiable {
    let id: Int
    var clientName: String
    var clientEmail: String?
    var clientPhone: String?
    var clientLanguage: String?
    var projectType: String?
    var roomDimensions: String?
    var budgetRange: String?
    var preferredMaterials: String?
    var preferredColors: String?
    var message: String?
    var photos: String?
    var status: String
    var priority: Int?
    var internalNotes: String?
    var submittedAt: String?
    var contactedAt: String?
    var convertedAt: String?

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(Int.self, forKey: .id)
        clientName = try container.decode(String.self, forKey: .clientName)
        clientEmail = try container.decodeIfPresent(String.self, forKey: .clientEmail)
        clientPhone = try container.decodeIfPresent(String.self, forKey: .clientPhone)
        clientLanguage = try container.decodeIfPresent(String.self, forKey: .clientLanguage)
        projectType = try container.decodeIfPresent(String.self, forKey: .projectType)
        roomDimensions = try container.decodeIfPresent(String.self, forKey: .roomDimensions)
        budgetRange = try container.decodeIfPresent(String.self, forKey: .budgetRange)
        preferredMaterials = try container.decodeIfPresent(String.self, forKey: .preferredMaterials)
        preferredColors = try container.decodeIfPresent(String.self, forKey: .preferredColors)
        message = try container.decodeIfPresent(String.self, forKey: .message)
        photos = try container.decodeIfPresent(String.self, forKey: .photos)
        status = try container.decodeIfPresent(String.self, forKey: .status) ?? "new"
        priority = try container.decodeIfPresent(Int.self, forKey: .priority)
        internalNotes = try container.decodeIfPresent(String.self, forKey: .internalNotes)
        submittedAt = try container.decodeIfPresent(String.self, forKey: .submittedAt)
        contactedAt = try container.decodeIfPresent(String.self, forKey: .contactedAt)
        convertedAt = try container.decodeIfPresent(String.self, forKey: .convertedAt)
    }

    var statusLabel: String {
        switch status {
        case "new": return "New"
        case "contacted": return "Contacted"
        case "quote_sent": return "Quote Sent"
        case "converted": return "Converted"
        case "closed": return "Closed"
        default: return status.capitalized
        }
    }

    var projectTypeLabel: String {
        switch projectType {
        case "new-construction": return "New Construction"
        case "remodel": return "Remodel"
        case "addition": return "Addition"
        case "kitchen": return "Kitchen"
        case "bathroom": return "Bathroom"
        case "custom": return "Custom"
        default: return projectType?.capitalized ?? "N/A"
        }
    }

    var budgetRangeLabel: String {
        switch budgetRange {
        case "under_5k": return "Under $5,000"
        case "5k_10k": return "$5K - $10K"
        case "10k_25k": return "$10K - $25K"
        case "25k_50k": return "$25K - $50K"
        case "over_50k": return "Over $50K"
        case "not_sure": return "Not Sure"
        default: return budgetRange ?? "N/A"
        }
    }

    var photoList: [String] {
        guard let photos = photos, !photos.isEmpty else { return [] }
        if let data = photos.data(using: .utf8),
           let array = try? JSONSerialization.jsonObject(with: data) as? [String] {
            return array
        }
        return []
    }

    // APIClient uses .convertFromSnakeCase, so CodingKeys use camelCase property names
    enum CodingKeys: String, CodingKey {
        case id, clientName, clientEmail, clientPhone, clientLanguage
        case projectType, roomDimensions, budgetRange
        case preferredMaterials, preferredColors
        case message, photos, status, priority
        case internalNotes, submittedAt, contactedAt, convertedAt
    }
}

// MARK: - Quick Quote Stats

struct QuickQuoteStats: Codable {
    let totalQuotes: Int
    let statusBreakdown: QuoteStatusBreakdown?

    struct QuoteStatusBreakdown: Codable {
        let new: Int?
        let contacted: Int?
        let quoteSent: Int?
        let converted: Int?
        let closed: Int?
    }
}

// MARK: - API Responses

struct DesignStatusResponse: Codable {
    let success: Bool
}

struct DesignNoteResponse: Codable {
    let success: Bool
}

struct DesignDeleteResponse: Codable {
    let success: Bool
    let message: String?
}

struct QuickQuoteMessageResponse: Codable {
    let success: Bool
    let message: String?
}
