//
//  Invoice.swift
//  GCWadmin
//
//  Models for Invoice Management
//

import Foundation

// MARK: - Client Model

struct Client: Codable, Identifiable {
    let id: Int
    var companyName: String?
    var firstName: String
    var lastName: String
    var email: String?
    var phone: String?
    var address: String?
    var isBusiness: Bool
    var taxExemptNumber: String?
    let createdAt: String?
    let updatedAt: String?

    // APIClient uses .convertFromSnakeCase, so no explicit raw values needed
    enum CodingKeys: String, CodingKey {
        case id, companyName, firstName, lastName, email, phone
        case address, isBusiness, taxExemptNumber, createdAt, updatedAt
    }

    // Custom decoder to handle SQLite 0/1 for isBusiness
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(Int.self, forKey: .id)
        companyName = try container.decodeIfPresent(String.self, forKey: .companyName)
        firstName = try container.decodeIfPresent(String.self, forKey: .firstName) ?? ""
        lastName = try container.decodeIfPresent(String.self, forKey: .lastName) ?? ""
        email = try container.decodeIfPresent(String.self, forKey: .email)
        phone = try container.decodeIfPresent(String.self, forKey: .phone)
        address = try container.decodeIfPresent(String.self, forKey: .address)
        taxExemptNumber = try container.decodeIfPresent(String.self, forKey: .taxExemptNumber)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
        updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt)

        // Handle isBusiness as Bool or Int (SQLite returns 0/1)
        if let boolVal = try? container.decode(Bool.self, forKey: .isBusiness) {
            isBusiness = boolVal
        } else if let intVal = try? container.decode(Int.self, forKey: .isBusiness) {
            isBusiness = intVal != 0
        } else {
            isBusiness = false
        }
    }

    var displayName: String {
        if isBusiness, let company = companyName, !company.isEmpty {
            return company
        }
        return "\(firstName) \(lastName)"
    }

    var initials: String {
        if isBusiness, let company = companyName, !company.isEmpty {
            let components = company.split(separator: " ")
            if components.count >= 2 {
                return "\(components[0].prefix(1))\(components[1].prefix(1))".uppercased()
            } else if let first = components.first?.prefix(1) {
                return String(first).uppercased()
            }
        }
        let first = firstName.prefix(1)
        let last = lastName.prefix(1)
        if !first.isEmpty && !last.isEmpty {
            return "\(first)\(last)".uppercased()
        } else if !first.isEmpty {
            return String(first).uppercased()
        }
        return "?"
    }
}

// MARK: - Invoice Model (List/Summary)

struct Invoice: Codable, Identifiable {
    let id: Int
    var clientId: Int?
    var invoiceNumber: String
    var invoiceDate: String?
    var dueDate: String?
    var status: String
    var subtotal: Double?
    var taxRate: Double?
    var taxAmount: Double?
    var discountAmount: Double?
    var markupAmount: Double?
    var totalAmount: Double?
    var balanceDue: Double?
    var logoUrl: String?
    var clientNotes: String?
    var adminNotes: String?
    let createdAt: String?
    let updatedAt: String?
    // Joined client fields
    var companyName: String?
    var firstName: String?
    var lastName: String?
    var email: String?
    var phone: String?
    var address: String?
    var isBusiness: Bool?
    var accessToken: String?

    // APIClient uses .convertFromSnakeCase, so no explicit raw values needed
    enum CodingKeys: String, CodingKey {
        case id, clientId, invoiceNumber, invoiceDate, dueDate, status
        case subtotal, taxRate, taxAmount, discountAmount, markupAmount
        case totalAmount, balanceDue, logoUrl, clientNotes, adminNotes
        case createdAt, updatedAt
        case companyName, firstName, lastName, email, phone, address
        case isBusiness, accessToken
    }

    // Custom decoder for SQLite quirks (Double/String prices, 0/1 booleans)
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(Int.self, forKey: .id)
        clientId = try container.decodeIfPresent(Int.self, forKey: .clientId)
        invoiceNumber = try container.decode(String.self, forKey: .invoiceNumber)
        invoiceDate = try container.decodeIfPresent(String.self, forKey: .invoiceDate)
        dueDate = try container.decodeIfPresent(String.self, forKey: .dueDate)
        status = try container.decodeIfPresent(String.self, forKey: .status) ?? "draft"
        logoUrl = try container.decodeIfPresent(String.self, forKey: .logoUrl)
        clientNotes = try container.decodeIfPresent(String.self, forKey: .clientNotes)
        adminNotes = try container.decodeIfPresent(String.self, forKey: .adminNotes)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
        updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt)
        companyName = try container.decodeIfPresent(String.self, forKey: .companyName)
        firstName = try container.decodeIfPresent(String.self, forKey: .firstName)
        lastName = try container.decodeIfPresent(String.self, forKey: .lastName)
        email = try container.decodeIfPresent(String.self, forKey: .email)
        phone = try container.decodeIfPresent(String.self, forKey: .phone)
        address = try container.decodeIfPresent(String.self, forKey: .address)
        accessToken = try container.decodeIfPresent(String.self, forKey: .accessToken)

        // Handle Double fields that SQLite may return as String
        subtotal = Self.decodeFlexibleDouble(from: container, forKey: .subtotal)
        taxRate = Self.decodeFlexibleDouble(from: container, forKey: .taxRate)
        taxAmount = Self.decodeFlexibleDouble(from: container, forKey: .taxAmount)
        discountAmount = Self.decodeFlexibleDouble(from: container, forKey: .discountAmount)
        markupAmount = Self.decodeFlexibleDouble(from: container, forKey: .markupAmount)
        totalAmount = Self.decodeFlexibleDouble(from: container, forKey: .totalAmount)
        balanceDue = Self.decodeFlexibleDouble(from: container, forKey: .balanceDue)

        // Handle isBusiness as Bool or Int (SQLite returns 0/1)
        if let boolVal = try? container.decodeIfPresent(Bool.self, forKey: .isBusiness) {
            isBusiness = boolVal
        } else if let intVal = try? container.decodeIfPresent(Int.self, forKey: .isBusiness) {
            isBusiness = intVal != 0
        } else {
            isBusiness = nil
        }
    }

    // Helper to decode Double that may arrive as String from SQLite
    private static func decodeFlexibleDouble(
        from container: KeyedDecodingContainer<CodingKeys>,
        forKey key: CodingKeys
    ) -> Double? {
        if let val = try? container.decodeIfPresent(Double.self, forKey: key) {
            return val
        }
        if let str = try? container.decodeIfPresent(String.self, forKey: key) {
            return Double(str)
        }
        return nil
    }

    // MARK: - Computed Properties

    var clientDisplayName: String {
        if let business = isBusiness, business, let company = companyName, !company.isEmpty {
            return company
        }
        let first = firstName ?? ""
        let last = lastName ?? ""
        let name = "\(first) \(last)".trimmingCharacters(in: .whitespaces)
        return name.isEmpty ? "Unknown Client" : name
    }

    var formattedTotal: String {
        let amount = totalAmount ?? 0
        return String(format: "$%.2f", amount)
    }

    var formattedBalance: String {
        let amount = balanceDue ?? 0
        return String(format: "$%.2f", amount)
    }

    var statusLabel: String {
        switch status.lowercased() {
        case "draft": return "Draft"
        case "unpaid": return "Unpaid"
        case "partial": return "Partial"
        case "paid": return "Paid"
        default: return status.capitalized
        }
    }

    var statusColor: String {
        switch status.lowercased() {
        case "draft": return "gray"
        case "unpaid": return "red"
        case "partial": return "orange"
        case "paid": return "green"
        default: return "gray"
        }
    }
}

// MARK: - Invoice Detail (Full with Line Items & Payments)

struct InvoiceDetail: Codable, Identifiable {
    let id: Int
    var clientId: Int?
    var invoiceNumber: String
    var invoiceDate: String?
    var dueDate: String?
    var status: String
    var subtotal: Double?
    var taxRate: Double?
    var taxAmount: Double?
    var discountAmount: Double?
    var markupAmount: Double?
    var totalAmount: Double?
    var balanceDue: Double?
    var logoUrl: String?
    var clientNotes: String?
    var adminNotes: String?
    let createdAt: String?
    let updatedAt: String?
    // Joined client fields
    var companyName: String?
    var firstName: String?
    var lastName: String?
    var email: String?
    var phone: String?
    var address: String?
    var isBusiness: Bool?
    var accessToken: String?
    // Detail-specific fields
    var lineItems: [InvoiceLineItem]?
    var payments: [InvoicePayment]?

    // APIClient uses .convertFromSnakeCase, so no explicit raw values needed
    enum CodingKeys: String, CodingKey {
        case id, clientId, invoiceNumber, invoiceDate, dueDate, status
        case subtotal, taxRate, taxAmount, discountAmount, markupAmount
        case totalAmount, balanceDue, logoUrl, clientNotes, adminNotes
        case createdAt, updatedAt
        case companyName, firstName, lastName, email, phone, address
        case isBusiness, accessToken
        case lineItems, payments
    }

    // Custom decoder for SQLite quirks (Double/String prices, 0/1 booleans)
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(Int.self, forKey: .id)
        clientId = try container.decodeIfPresent(Int.self, forKey: .clientId)
        invoiceNumber = try container.decode(String.self, forKey: .invoiceNumber)
        invoiceDate = try container.decodeIfPresent(String.self, forKey: .invoiceDate)
        dueDate = try container.decodeIfPresent(String.self, forKey: .dueDate)
        status = try container.decodeIfPresent(String.self, forKey: .status) ?? "draft"
        logoUrl = try container.decodeIfPresent(String.self, forKey: .logoUrl)
        clientNotes = try container.decodeIfPresent(String.self, forKey: .clientNotes)
        adminNotes = try container.decodeIfPresent(String.self, forKey: .adminNotes)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
        updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt)
        companyName = try container.decodeIfPresent(String.self, forKey: .companyName)
        firstName = try container.decodeIfPresent(String.self, forKey: .firstName)
        lastName = try container.decodeIfPresent(String.self, forKey: .lastName)
        email = try container.decodeIfPresent(String.self, forKey: .email)
        phone = try container.decodeIfPresent(String.self, forKey: .phone)
        address = try container.decodeIfPresent(String.self, forKey: .address)
        accessToken = try container.decodeIfPresent(String.self, forKey: .accessToken)
        lineItems = try container.decodeIfPresent([InvoiceLineItem].self, forKey: .lineItems)
        payments = try container.decodeIfPresent([InvoicePayment].self, forKey: .payments)

        // Handle Double fields that SQLite may return as String
        subtotal = Self.decodeFlexibleDouble(from: container, forKey: .subtotal)
        taxRate = Self.decodeFlexibleDouble(from: container, forKey: .taxRate)
        taxAmount = Self.decodeFlexibleDouble(from: container, forKey: .taxAmount)
        discountAmount = Self.decodeFlexibleDouble(from: container, forKey: .discountAmount)
        markupAmount = Self.decodeFlexibleDouble(from: container, forKey: .markupAmount)
        totalAmount = Self.decodeFlexibleDouble(from: container, forKey: .totalAmount)
        balanceDue = Self.decodeFlexibleDouble(from: container, forKey: .balanceDue)

        // Handle isBusiness as Bool or Int (SQLite returns 0/1)
        if let boolVal = try? container.decodeIfPresent(Bool.self, forKey: .isBusiness) {
            isBusiness = boolVal
        } else if let intVal = try? container.decodeIfPresent(Int.self, forKey: .isBusiness) {
            isBusiness = intVal != 0
        } else {
            isBusiness = nil
        }
    }

    // Helper to decode Double that may arrive as String from SQLite
    private static func decodeFlexibleDouble(
        from container: KeyedDecodingContainer<CodingKeys>,
        forKey key: CodingKeys
    ) -> Double? {
        if let val = try? container.decodeIfPresent(Double.self, forKey: key) {
            return val
        }
        if let str = try? container.decodeIfPresent(String.self, forKey: key) {
            return Double(str)
        }
        return nil
    }

    // MARK: - Computed Properties

    var clientDisplayName: String {
        if let business = isBusiness, business, let company = companyName, !company.isEmpty {
            return company
        }
        let first = firstName ?? ""
        let last = lastName ?? ""
        let name = "\(first) \(last)".trimmingCharacters(in: .whitespaces)
        return name.isEmpty ? "Unknown Client" : name
    }

    var formattedTotal: String {
        let amount = totalAmount ?? 0
        return String(format: "$%.2f", amount)
    }

    var formattedBalance: String {
        let amount = balanceDue ?? 0
        return String(format: "$%.2f", amount)
    }

    var statusLabel: String {
        switch status.lowercased() {
        case "draft": return "Draft"
        case "unpaid": return "Unpaid"
        case "partial": return "Partial"
        case "paid": return "Paid"
        default: return status.capitalized
        }
    }

    var statusColor: String {
        switch status.lowercased() {
        case "draft": return "gray"
        case "unpaid": return "red"
        case "partial": return "orange"
        case "paid": return "green"
        default: return "gray"
        }
    }
}

// MARK: - Invoice Line Item

struct InvoiceLineItem: Codable, Identifiable {
    let id: Int
    var invoiceId: Int?
    var title: String?
    var description: String
    var quantity: Double
    var unitPrice: Double
    var totalPrice: Double
    var itemType: String?
    var lineOrder: Int?
    let createdAt: String?

    // APIClient uses .convertFromSnakeCase, so no explicit raw values needed
    enum CodingKeys: String, CodingKey {
        case id, invoiceId, title, description, quantity
        case unitPrice, totalPrice, itemType, lineOrder, createdAt
    }

    // Custom decoder for Double/String prices from SQLite
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(Int.self, forKey: .id)
        invoiceId = try container.decodeIfPresent(Int.self, forKey: .invoiceId)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        description = try container.decodeIfPresent(String.self, forKey: .description) ?? ""
        itemType = try container.decodeIfPresent(String.self, forKey: .itemType)
        lineOrder = try container.decodeIfPresent(Int.self, forKey: .lineOrder)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)

        // Handle Double fields that SQLite may return as String
        quantity = Self.decodeFlexibleDouble(from: container, forKey: .quantity) ?? 0
        unitPrice = Self.decodeFlexibleDouble(from: container, forKey: .unitPrice) ?? 0
        totalPrice = Self.decodeFlexibleDouble(from: container, forKey: .totalPrice) ?? 0
    }

    private static func decodeFlexibleDouble(
        from container: KeyedDecodingContainer<CodingKeys>,
        forKey key: CodingKeys
    ) -> Double? {
        if let val = try? container.decode(Double.self, forKey: key) {
            return val
        }
        if let str = try? container.decode(String.self, forKey: key) {
            return Double(str)
        }
        return nil
    }
}

// MARK: - Invoice Payment

struct InvoicePayment: Codable, Identifiable {
    let id: Int
    var invoiceId: Int?
    var paymentAmount: Double
    var paymentMethod: String?
    var checkNumber: String?
    var paymentDate: String?
    var notes: String?
    let createdAt: String?
    var createdBy: Int?

    // APIClient uses .convertFromSnakeCase, so no explicit raw values needed
    enum CodingKeys: String, CodingKey {
        case id, invoiceId, paymentAmount, paymentMethod
        case checkNumber, paymentDate, notes, createdAt, createdBy
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(Int.self, forKey: .id)
        invoiceId = try container.decodeIfPresent(Int.self, forKey: .invoiceId)
        paymentMethod = try container.decodeIfPresent(String.self, forKey: .paymentMethod)
        checkNumber = try container.decodeIfPresent(String.self, forKey: .checkNumber)
        paymentDate = try container.decodeIfPresent(String.self, forKey: .paymentDate)
        notes = try container.decodeIfPresent(String.self, forKey: .notes)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
        createdBy = try container.decodeIfPresent(Int.self, forKey: .createdBy)

        // Handle paymentAmount as Double or String from SQLite
        if let val = try? container.decode(Double.self, forKey: .paymentAmount) {
            paymentAmount = val
        } else if let str = try? container.decode(String.self, forKey: .paymentAmount) {
            paymentAmount = Double(str) ?? 0
        } else {
            paymentAmount = 0
        }
    }

    // MARK: - Computed Properties

    var paymentMethodLabel: String {
        switch paymentMethod?.lowercased() {
        case "cash": return "Cash"
        case "check": return "Check"
        case "credit_card", "creditcard": return "Credit Card"
        case "debit_card", "debitcard": return "Debit Card"
        case "bank_transfer", "banktransfer": return "Bank Transfer"
        case "zelle": return "Zelle"
        case "venmo": return "Venmo"
        case "paypal": return "PayPal"
        case "other": return "Other"
        default: return paymentMethod?.capitalized ?? "Unknown"
        }
    }

    var formattedAmount: String {
        String(format: "$%.2f", paymentAmount)
    }
}

// MARK: - Tax Rate

struct TaxRate: Codable, Identifiable {
    let id: Int
    var stateCode: String?
    var city: String
    var taxRate: Double
    var description: String?
    var isActive: Bool?
    var lastUpdated: String?
    var updatedBy: Int?

    // APIClient uses .convertFromSnakeCase, so no explicit raw values needed
    enum CodingKeys: String, CodingKey {
        case id, stateCode, city, taxRate, description
        case isActive, lastUpdated, updatedBy
    }

    // Custom decoder for SQLite quirks (0/1 for booleans, Double as String)
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(Int.self, forKey: .id)
        stateCode = try container.decodeIfPresent(String.self, forKey: .stateCode)
        city = try container.decodeIfPresent(String.self, forKey: .city) ?? ""
        description = try container.decodeIfPresent(String.self, forKey: .description)
        lastUpdated = try container.decodeIfPresent(String.self, forKey: .lastUpdated)
        updatedBy = try container.decodeIfPresent(Int.self, forKey: .updatedBy)

        // Handle taxRate as Double or String from SQLite
        if let val = try? container.decode(Double.self, forKey: .taxRate) {
            taxRate = val
        } else if let str = try? container.decode(String.self, forKey: .taxRate) {
            taxRate = Double(str) ?? 0
        } else {
            taxRate = 0
        }

        // Handle isActive as Bool or Int (SQLite returns 0/1)
        if let boolVal = try? container.decodeIfPresent(Bool.self, forKey: .isActive) {
            isActive = boolVal
        } else if let intVal = try? container.decodeIfPresent(Int.self, forKey: .isActive) {
            isActive = intVal != 0
        } else {
            isActive = nil
        }
    }
}

// MARK: - Line Item Label

struct LineItemLabel: Codable, Identifiable {
    let id: Int
    var labelName: String
    var defaultUnitPrice: Double?
    let createdAt: String?
    let updatedAt: String?

    // Backend sends "label" not "label_name", so we need explicit raw value
    // Note: .convertFromSnakeCase converts "default_unit_price" -> "defaultUnitPrice" automatically
    enum CodingKeys: String, CodingKey {
        case id
        case labelName = "label"
        case defaultUnitPrice, createdAt, updatedAt
    }
}

// MARK: - Invoice Tracking View

struct InvoiceTrackingView: Codable, Identifiable {
    let id: Int
    var invoiceId: Int?
    var token: String?
    var clientIp: String?
    var userAgent: String?
    var country: String?
    var region: String?
    var city: String?
    var timezone: String?
    var viewedAt: String?

    // APIClient uses .convertFromSnakeCase, so no explicit raw values needed
    enum CodingKeys: String, CodingKey {
        case id, invoiceId, token, clientIp, userAgent
        case country, region, city, timezone, viewedAt
    }
}

// MARK: - API Response Types

struct InvoiceMessageResponse: Codable {
    let success: Bool
    let message: String?
}

struct InvoiceCreateResponse: Codable {
    let success: Bool
    let invoice: Invoice?
}

struct ClientCreateResponse: Codable {
    let id: Int
}

struct ClientUpdateResponse: Codable {
    let success: Bool
}

struct InvoiceCreateMinimalResponse: Codable {
    let id: Int
    let invoiceNumber: String?
    let token: String?
}

struct TrackingStats: Codable {
    let totalViews: Int
    let uniqueIps: Int?
    let firstViewed: String?
    let lastViewed: String?

    // APIClient uses .convertFromSnakeCase, so no explicit raw values needed
    enum CodingKeys: String, CodingKey {
        case totalViews, uniqueIps, firstViewed, lastViewed
    }
}
