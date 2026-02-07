//
//  Employee.swift
//  GCWadmin
//
//  Employee models for employee management
//

import Foundation

// MARK: - Employee Model

struct Employee: Codable, Identifiable {
    let id: Int
    var name: String
    var position: String
    var bio: String?
    var email: String?
    var phone: String?
    var joinedDate: String?
    let photoPath: String?
    let photoFilename: String?
    var photoUrl: String?
    var displayOrder: Int?
    var isActive: Bool

    // Custom decoding to handle missing is_active field
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(Int.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        position = try container.decode(String.self, forKey: .position)
        bio = try container.decodeIfPresent(String.self, forKey: .bio)
        email = try container.decodeIfPresent(String.self, forKey: .email)
        phone = try container.decodeIfPresent(String.self, forKey: .phone)
        joinedDate = try container.decodeIfPresent(String.self, forKey: .joinedDate)
        photoPath = try container.decodeIfPresent(String.self, forKey: .photoPath)
        photoFilename = try container.decodeIfPresent(String.self, forKey: .photoFilename)
        photoUrl = try container.decodeIfPresent(String.self, forKey: .photoUrl)
        displayOrder = try container.decodeIfPresent(Int.self, forKey: .displayOrder)
        // Default to true if is_active is missing
        isActive = try container.decodeIfPresent(Bool.self, forKey: .isActive) ?? true
    }

    var initials: String {
        let components = name.split(separator: " ")
        if components.count >= 2 {
            let first = components[0].prefix(1)
            let last = components[1].prefix(1)
            return "\(first)\(last)".uppercased()
        } else if let first = components.first?.prefix(1) {
            return String(first).uppercased()
        }
        return "?"
    }

    // APIClient uses .convertFromSnakeCase, so no explicit raw values needed
    enum CodingKeys: String, CodingKey {
        case id, name, position, bio, email, phone
        case joinedDate, photoPath, photoFilename, photoUrl
        case displayOrder, isActive
    }
}

// MARK: - Employee Create/Update Request

struct EmployeeRequest {
    var name: String
    var position: String
    var bio: String
    var email: String
    var phone: String
    var joinedDate: String
}

// MARK: - Employee Response

struct EmployeeResponse: Codable {
    let success: Bool
    let employee: Employee
}
