//
//  EmployeesService.swift
//  GCWadmin
//
//  API service for Employees endpoints
//

import Foundation
import UIKit

class EmployeesService {
    static let shared = EmployeesService()
    private let apiClient = APIClient.shared

    private init() {}

    // MARK: - Response Models

    private struct MessageResponse: Codable {
        let success: Bool
        let message: String?
    }

    // MARK: - Get All Employees

    func getAllEmployees(includeInactive: Bool = false) async throws -> [Employee] {
        let endpoint = includeInactive ? "/api/employees?includeInactive=true" : "/api/employees"
        return try await apiClient.get(endpoint)
    }

    // MARK: - Get Single Employee

    func getEmployee(_ id: Int) async throws -> Employee {
        return try await apiClient.get("/api/employees/\(id)")
    }

    // MARK: - Create Employee

    func createEmployee(
        name: String,
        position: String,
        bio: String,
        email: String,
        phone: String,
        joinedDate: String,
        photo: UIImage?
    ) async throws -> Employee {
        let boundary = UUID().uuidString
        var body = Data()

        // Add text fields
        let fields: [String: String] = [
            "name": name,
            "position": position,
            "bio": bio,
            "email": email,
            "phone": phone,
            "joined_date": joinedDate
        ]

        for (key, value) in fields {
            if !value.isEmpty {
                body.append("--\(boundary)\r\n".data(using: .utf8)!)
                body.append("Content-Disposition: form-data; name=\"\(key)\"\r\n\r\n".data(using: .utf8)!)
                body.append("\(value)\r\n".data(using: .utf8)!)
            }
        }

        // Add photo if provided
        if let photo = photo, let imageData = photo.jpegData(compressionQuality: 0.8) {
            let filename = "emp_\(UUID().uuidString).jpg"

            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"photo\"; filename=\"\(filename)\"\r\n".data(using: .utf8)!)
            body.append("Content-Type: image/jpeg\r\n\r\n".data(using: .utf8)!)
            body.append(imageData)
            body.append("\r\n".data(using: .utf8)!)
        }

        body.append("--\(boundary)--\r\n".data(using: .utf8)!)

        // Create request
        let url = URL(string: "\(APIConfig.baseURL)/api/employees")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        if let token = try? KeychainService.shared.get(for: "access_token") {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        request.httpBody = body

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw NSError(domain: "EmployeesService", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid response"])
        }

        guard httpResponse.statusCode == 200 else {
            let errorMessage = String(data: data, encoding: .utf8) ?? "Create failed"
            throw NSError(domain: "EmployeesService", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: errorMessage])
        }

        let employeeResponse = try JSONDecoder().decode(EmployeeResponse.self, from: data)
        return employeeResponse.employee
    }

    // MARK: - Update Employee

    func updateEmployee(
        _ id: Int,
        name: String?,
        position: String?,
        bio: String?,
        email: String?,
        phone: String?,
        joinedDate: String?,
        isActive: Bool?,
        photo: UIImage?
    ) async throws -> Employee {
        let boundary = UUID().uuidString
        var body = Data()

        // Add text fields
        let fields: [(String, String?)] = [
            ("name", name),
            ("position", position),
            ("bio", bio),
            ("email", email),
            ("phone", phone),
            ("joined_date", joinedDate),
            ("is_active", isActive != nil ? (isActive! ? "true" : "false") : nil)
        ]

        for (key, value) in fields {
            if let value = value {
                body.append("--\(boundary)\r\n".data(using: .utf8)!)
                body.append("Content-Disposition: form-data; name=\"\(key)\"\r\n\r\n".data(using: .utf8)!)
                body.append("\(value)\r\n".data(using: .utf8)!)
            }
        }

        // Add photo if provided
        if let photo = photo, let imageData = photo.jpegData(compressionQuality: 0.8) {
            let filename = "emp_\(UUID().uuidString).jpg"

            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"photo\"; filename=\"\(filename)\"\r\n".data(using: .utf8)!)
            body.append("Content-Type: image/jpeg\r\n\r\n".data(using: .utf8)!)
            body.append(imageData)
            body.append("\r\n".data(using: .utf8)!)
        }

        body.append("--\(boundary)--\r\n".data(using: .utf8)!)

        // Create request
        let url = URL(string: "\(APIConfig.baseURL)/api/employees/\(id)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        if let token = try? KeychainService.shared.get(for: "access_token") {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        request.httpBody = body

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw NSError(domain: "EmployeesService", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid response"])
        }

        guard httpResponse.statusCode == 200 else {
            let errorMessage = String(data: data, encoding: .utf8) ?? "Update failed"
            throw NSError(domain: "EmployeesService", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: errorMessage])
        }

        let employeeResponse = try JSONDecoder().decode(EmployeeResponse.self, from: data)
        return employeeResponse.employee
    }

    // MARK: - Delete Employee

    func deleteEmployee(_ id: Int, hardDelete: Bool = false) async throws {
        let endpoint = hardDelete ? "/api/employees/\(id)?hard=true" : "/api/employees/\(id)"
        let _: MessageResponse = try await apiClient.delete(endpoint)
    }

    // MARK: - Reorder Employees

    func reorderEmployees(employeeIds: [Int]) async throws {
        let _: MessageResponse = try await apiClient.put("/api/employees/reorder", body: ["employeeIds": employeeIds])
    }
}
