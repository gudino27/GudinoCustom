//
//  UsersService.swift
//  GCWadmin
//
//  API service for Users endpoints
//

import Foundation

class UsersService {
    static let shared = UsersService()
    private let apiClient = APIClient.shared

    private init() {}

    /// Get all users (admin/super_admin only)
    func getAllUsers() async throws -> [User] {
        struct UsersResponse: Codable {
            let success: Bool
            let users: [User]
        }

        let response: UsersResponse = try await apiClient.get("/api/users")
        return response.users
    }

    /// Get user by ID
    func getUser(id: Int) async throws -> User {
        struct UserResponse: Codable {
            let success: Bool
            let user: User
        }

        let response: UserResponse = try await apiClient.get("/api/users/\(id)")
        return response.user
    }
}
