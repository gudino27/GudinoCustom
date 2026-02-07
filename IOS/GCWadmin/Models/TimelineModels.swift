//
//  TimelineModels.swift
//  GCWadmin
//
//  Models for Project Timeline Management
//

import Foundation

// MARK: - Timeline Phase Enums

enum TimelinePhaseType: String, Codable, CaseIterable {
    case design
    case materials
    case fabrication
    case installation
    case completion

    var displayName: String {
        switch self {
        case .design: return "Design"
        case .materials: return "Materials Ordered"
        case .fabrication: return "Fabrication"
        case .installation: return "Installation"
        case .completion: return "Completion"
        }
    }

    var displayNameES: String {
        switch self {
        case .design: return "Diseño"
        case .materials: return "Materiales Pedidos"
        case .fabrication: return "Fabricación"
        case .installation: return "Instalación"
        case .completion: return "Finalización"
        }
    }
}

enum TimelinePhaseStatus: String, Codable, CaseIterable {
    case pending
    case inProgress = "in_progress"
    case completed

    var displayName: String {
        switch self {
        case .pending: return "Pending"
        case .inProgress: return "In Progress"
        case .completed: return "Completed"
        }
    }
}

// MARK: - Timeline Model

struct Timeline: Codable, Identifiable {
    let id: Int
    var invoiceId: Int?
    var clientName: String
    var clientEmail: String?
    var clientPhone: String?
    var clientLanguage: String
    var accessToken: String?
    var invoiceNumber: String?
    let createdAt: String
    let updatedAt: String?

    // APIClient uses .convertFromSnakeCase, so no explicit raw values needed
    enum CodingKeys: String, CodingKey {
        case id, invoiceId, clientName, clientEmail, clientPhone
        case clientLanguage, accessToken, invoiceNumber
        case createdAt, updatedAt
    }

    var languageLabel: String {
        clientLanguage.lowercased() == "es" ? "ES" : "EN"
    }

    var isInvoiceBased: Bool {
        invoiceId != nil
    }
}

// MARK: - Timeline with Phases (Detail View)

struct TimelineDetail: Codable, Identifiable {
    let id: Int
    var invoiceId: Int?
    var clientName: String
    var clientEmail: String?
    var clientPhone: String?
    var clientLanguage: String
    var accessToken: String?
    var invoiceNumber: String?
    let createdAt: String
    let updatedAt: String?
    var phases: [TimelinePhase]

    // APIClient uses .convertFromSnakeCase, so no explicit raw values needed
    enum CodingKeys: String, CodingKey {
        case id, invoiceId, clientName, clientEmail, clientPhone
        case clientLanguage, accessToken, invoiceNumber
        case createdAt, updatedAt, phases
    }

    var languageLabel: String {
        clientLanguage.lowercased() == "es" ? "ES" : "EN"
    }

    var isInvoiceBased: Bool {
        invoiceId != nil
    }
}

// MARK: - Timeline Phase Model

struct TimelinePhase: Codable, Identifiable {
    let id: Int
    var timelineId: Int
    var phaseNameKey: String
    var status: String
    var startDate: String?
    var estimatedCompletion: String?
    var actualCompletion: String?
    var notes: String?
    var photos: [String] // Backend returns parsed JSON array
    var phaseOrder: Int
    let createdAt: String?
    let updatedAt: String?

    // APIClient uses .convertFromSnakeCase, so no explicit raw values needed
    enum CodingKeys: String, CodingKey {
        case id, timelineId, phaseNameKey, status
        case startDate, estimatedCompletion, actualCompletion
        case notes, photos, phaseOrder, createdAt, updatedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(Int.self, forKey: .id)
        timelineId = try container.decode(Int.self, forKey: .timelineId)
        phaseNameKey = try container.decode(String.self, forKey: .phaseNameKey)
        status = try container.decode(String.self, forKey: .status)
        startDate = try container.decodeIfPresent(String.self, forKey: .startDate)
        estimatedCompletion = try container.decodeIfPresent(String.self, forKey: .estimatedCompletion)
        actualCompletion = try container.decodeIfPresent(String.self, forKey: .actualCompletion)
        notes = try container.decodeIfPresent(String.self, forKey: .notes)
        phaseOrder = try container.decode(Int.self, forKey: .phaseOrder)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
        updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt)

        // photos can come as [] array or "[]" string from backend
        if let arr = try? container.decode([String].self, forKey: .photos) {
            photos = arr
        } else if let str = try? container.decodeIfPresent(String.self, forKey: .photos),
                  let data = str.data(using: .utf8),
                  let parsed = try? JSONDecoder().decode([String].self, from: data) {
            photos = parsed
        } else {
            photos = []
        }
    }

    var phaseType: TimelinePhaseType? {
        TimelinePhaseType(rawValue: phaseNameKey)
    }

    var phaseStatus: TimelinePhaseStatus? {
        TimelinePhaseStatus(rawValue: status)
    }

    var phaseName: String {
        phaseType?.displayName ?? phaseNameKey.capitalized
    }

    func phaseName(language: String) -> String {
        guard let type = phaseType else {
            return phaseNameKey.capitalized
        }
        return language.lowercased() == "es" ? type.displayNameES : type.displayName
    }

    var formattedEstimatedDate: String? {
        guard let dateStr = estimatedCompletion else { return nil }
        return formatDate(dateStr)
    }

    var formattedActualDate: String? {
        guard let dateStr = actualCompletion else { return nil }
        return formatDate(dateStr)
    }

    var formattedStartDate: String? {
        guard let dateStr = startDate else { return nil }
        return formatDate(dateStr)
    }

    private func formatDate(_ dateString: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate, .withDashSeparatorInDate]

        if let date = formatter.date(from: dateString) {
            let displayFormatter = DateFormatter()
            displayFormatter.dateStyle = .medium
            return displayFormatter.string(from: date)
        }

        // Fallback to simple parsing
        let components = dateString.prefix(10).split(separator: "-")
        if components.count == 3 {
            return "\(components[1])/\(components[2])/\(components[0])"
        }

        return dateString
    }
}

// MARK: - API Response Types

struct TimelineCreateResponse: Codable {
    let success: Bool
    let timeline: Timeline
}

struct TimelineStandaloneCreateResponse: Codable {
    let success: Bool
    let timeline: Timeline
    let accessToken: String
    let timelineUrl: String
}

struct TimelinePhaseCreateResponse: Codable {
    let success: Bool
    let phaseId: Int
}

struct TimelineMessageResponse: Codable {
    let success: Bool
    let message: String?
}

struct TimelineSendLinkResponse: Codable {
    let success: Bool
    let message: String?
    let results: SendLinkResults?
    let timelineUrl: String?
}

struct SendLinkResults: Codable {
    let email: String?
    let sms: String?
}
