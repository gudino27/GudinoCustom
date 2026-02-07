//
//  UserService.swift
//  GCWadmin
//
//  API service for User Management endpoints
//

import Foundation

class UserService {
    static let shared = UserService()
    private let apiClient = APIClient.shared

    private init() {}

    // MARK: - Response Models

    private struct MessageResponse: Codable {
        let success: Bool?  // Optional since some endpoints don't return it
        let message: String
    }

    // MARK: - User Endpoints

    /// Get all users (admin, super_admin)
    func getAllUsers() async throws -> [AdminUser] {
        struct BackendUser: Codable {
            let id: Int
            let username: String
            let email: String?
            let fullName: String?
            let role: String
            let isActive: Int  // Backend returns 0/1 instead of Bool
            let lastLogin: String?
            let createdAt: String?
            let mustChangePassword: Int?  // Backend returns 0/1 instead of Bool
        }

        struct Response: Codable {
            let success: Bool
            let users: [BackendUser]
        }

        let response: Response = try await apiClient.get("/api/users")

        return response.users.map { backend in
            AdminUser(
                id: backend.id,
                username: backend.username,
                email: backend.email,
                fullName: backend.fullName,
                role: UserRole(rawValue: backend.role) ?? .employee,
                isActive: backend.isActive == 1,
                lastLogin: backend.lastLogin,
                createdAt: backend.createdAt,
                mustChangePassword: backend.mustChangePassword == 1
            )
        }
    }

    /// Create user manually (super_admin only)
    func createUser(request: CreateUserRequest) async throws {
        let _: MessageResponse = try await apiClient.post(
            "/api/users",
            body: [
                "username": request.username,
                "email": request.email as Any,
                "password": request.password,
                "full_name": request.fullName as Any,
                "role": request.role
            ]
        )
    }

    /// Update user (super_admin only)
    func updateUser(userId: Int, request: UpdateUserRequest) async throws {
        let _: MessageResponse = try await apiClient.put(
            "/api/users/\(userId)",
            body: [
                "email": request.email as Any,
                "full_name": request.fullName as Any,
                "role": request.role
            ]
        )
    }

    /// Deactivate/delete user (super_admin only)
    func deleteUser(userId: Int) async throws {
        let _: MessageResponse = try await apiClient.delete("/api/users/\(userId)")
    }

    // MARK: - Invitation Endpoints

    /// Send invitation to new user (super_admin)
    func sendInvite(request: SendInviteRequest) async throws {
        let _: MessageResponse = try await apiClient.post(
            "/api/users/send-invite",
            body: [
                "full_name": request.fullName,
                "role": request.role,
                "email": request.email as Any,
                "phone": request.phone as Any,
                "deliveryMethod": request.deliveryMethod,
                "language": request.language as Any
            ]
        )
    }

    /// List pending invitations (super_admin)
    func getInvitations() async throws -> [Invitation] {
        struct BackendInvitation: Codable {
            let id: Int
            let email: String?
            let phone: String?
            let fullName: String
            let role: String
            let language: String?
            let token: String?  // Optional - not returned in list for security
            let expiresAt: String
            let createdByUsername: String?
            let createdByName: String?
            let usedAt: String?
            let createdAt: String?
        }

        struct Response: Codable {
            let success: Bool
            let invitations: [BackendInvitation]
        }

        let response: Response = try await apiClient.get("/api/users/invitations")

        return response.invitations.map { backend in
            Invitation(
                id: backend.id,
                email: backend.email,
                phone: backend.phone,
                fullName: backend.fullName,
                role: UserRole(rawValue: backend.role) ?? .employee,
                language: backend.language,
                token: backend.token,
                expiresAt: backend.expiresAt,
                createdBy: nil,  // Not returned in list
                createdByUsername: backend.createdByUsername,
                createdByName: backend.createdByName,
                usedAt: backend.usedAt,
                createdAt: backend.createdAt
            )
        }
    }

    /// Resend invitation (super_admin)
    func resendInvite(invitationId: Int) async throws {
        let _: MessageResponse = try await apiClient.post(
            "/api/users/invitations/\(invitationId)/resend",
            body: [:]
        )
    }

    /// Cancel invitation (super_admin)
    func cancelInvite(invitationId: Int) async throws {
        let _: MessageResponse = try await apiClient.delete("/api/users/invitations/\(invitationId)")
    }
}
