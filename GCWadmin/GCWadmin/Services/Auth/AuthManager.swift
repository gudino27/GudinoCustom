//
//  AuthManager.swift
//  GCWadmin
//
//  Authentication state management matching React Native AuthContext
//

import SwiftUI
import Combine
import LocalAuthentication

// MARK: - User Model
struct User: Codable, Identifiable, Hashable {
    let id: Int
    let username: String
    let email: String?
    let role: UserRole
    let fullName: String?
    let firstName: String?
    let lastName: String?
    let avatarUrl: String?

    // No custom CodingKeys needed - APIClient uses .convertFromSnakeCase
    // which automatically converts full_name -> fullName, etc.

    var displayName: String {
        if let fullName = fullName {
            return fullName
        }
        if let first = firstName, let last = lastName {
            return "\(first) \(last)"
        }
        return username
    }
}

// MARK: - User Role
enum UserRole: String, Codable, Hashable, CaseIterable {
    case employee
    case admin
    case superAdmin = "super_admin"

    var displayName: String {
        switch self {
        case .employee: return "Employee"
        case .admin: return "Admin"
        case .superAdmin: return "Super Admin"
        }
    }

    var canAccessAdminFeatures: Bool {
        self == .admin || self == .superAdmin
    }

    var canAccessSuperAdminFeatures: Bool {
        self == .superAdmin
    }
}

// MARK: - Auth Tokens
struct AuthTokens: Codable {
    let accessToken: String
    let refreshToken: String
    let expiresIn: Int?

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresIn = "expires_in"
    }
}

// MARK: - Login Response
struct LoginResponse: Codable {
    let user: User
    let token: String
    let refreshToken: String?
    let message: String?

    enum CodingKeys: String, CodingKey {
        case user
        case token
        case refreshToken
        case message
    }
}

// MARK: - Auth Error
enum AuthError: Error, LocalizedError {
    case invalidCredentials
    case networkError(Error)
    case serverError(String)
    case tokenExpired
    case biometricFailed
    case biometricNotAvailable
    case unknown

    var errorDescription: String? {
        switch self {
        case .invalidCredentials:
            return "Invalid username or password"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .serverError(let message):
            return message
        case .tokenExpired:
            return "Session expired. Please log in again."
        case .biometricFailed:
            return "Biometric authentication failed"
        case .biometricNotAvailable:
            return "Biometric authentication is not available"
        case .unknown:
            return "An unexpected error occurred"
        }
    }
}

// MARK: - Auth Manager
@MainActor
class AuthManager: ObservableObject {
    // MARK: - Published Properties
    @Published var isAuthenticated = false
    @Published var currentUser: User?
    @Published var isLoading = false
    @Published var error: AuthError?
    @Published var biometricType: BiometricType = .none
    @Published var isBiometricEnabled: Bool = false
    @Published var showBiometricPrompt = false

    // MARK: - Private Properties
    private let apiClient = APIClient.shared
    private let keychain = KeychainService.shared

    // MARK: - Constants
    static let accessTokenKey = "access_token"
    static let refreshTokenKey = "refresh_token"
    static let userKey = "current_user"
    static let biometricEnabledKey = "biometric_enabled"
    static let biometricUsernameKey = "biometric_username"
    static let biometricPasswordKey = "biometric_password"

    // MARK: - Biometric Type
    enum BiometricType {
        case none
        case faceID
        case touchID

        var displayName: String {
            switch self {
            case .none: return "None"
            case .faceID: return "Face ID"
            case .touchID: return "Touch ID"
            }
        }

        var iconName: String {
            switch self {
            case .none: return "lock"
            case .faceID: return "faceid"
            case .touchID: return "touchid"
            }
        }
    }

    // MARK: - Initialization
    init() {
        checkBiometricAvailability()
        isBiometricEnabled = UserDefaults.standard.bool(forKey: Self.biometricEnabledKey)

        // Check for existing session on launch
        Task {
            await checkExistingSession()
        }
    }

    // MARK: - Biometric Methods

    /// Check what biometric authentication is available
    func checkBiometricAvailability() {
        let context = LAContext()
        var error: NSError?

        if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) {
            switch context.biometryType {
            case .faceID:
                biometricType = .faceID
            case .touchID:
                biometricType = .touchID
            default:
                biometricType = .none
            }
        } else {
            biometricType = .none
        }
    }

    /// Check if biometrics can be used (available + enabled + credentials stored)
    var canUseBiometric: Bool {
        biometricType != .none &&
        isBiometricEnabled &&
        (try? keychain.get(for: Self.biometricUsernameKey)) != nil
    }

    /// Enable biometric login — stores credentials in Keychain with biometric protection
    func enableBiometric(username: String, password: String) {
        do {
            try keychain.saveBiometric(username, for: Self.biometricUsernameKey)
            try keychain.saveBiometric(password, for: Self.biometricPasswordKey)
            UserDefaults.standard.set(true, forKey: Self.biometricEnabledKey)
            isBiometricEnabled = true
            print("✅ Biometric login enabled")
        } catch {
            print("❌ Failed to enable biometric: \(error)")
        }
    }

    /// Disable biometric login
    func disableBiometric() {
        try? keychain.delete(for: Self.biometricUsernameKey)
        try? keychain.delete(for: Self.biometricPasswordKey)
        UserDefaults.standard.set(false, forKey: Self.biometricEnabledKey)
        isBiometricEnabled = false
        print("✅ Biometric login disabled")
    }

    /// Authenticate with Face ID / Touch ID
    func authenticateWithBiometric() async {
        let context = LAContext()
        context.localizedCancelTitle = "Use Password"

        do {
            let success = try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: "Sign in to GCW Admin"
            )

            guard success else {
                error = .biometricFailed
                return
            }

            // Retrieve stored credentials
            guard let username = try? keychain.getBiometric(for: Self.biometricUsernameKey),
                  let password = try? keychain.getBiometric(for: Self.biometricPasswordKey) else {
                error = .biometricFailed
                disableBiometric()
                return
            }

            // Login with stored credentials
            await login(username: username, password: password)

        } catch {
            self.error = .biometricFailed
        }
    }

    // MARK: - Public Methods

    /// Login with username and password
    func login(username: String, password: String) async {
        isLoading = true
        error = nil

        do {
            // Generate device ID if not exists
            let deviceId = UserDefaults.standard.string(forKey: "device_id") ?? UUID().uuidString
            UserDefaults.standard.set(deviceId, forKey: "device_id")

            let response: LoginResponse = try await apiClient.post(
                "/api/auth/login",
                body: [
                    "username": username,
                    "password": password,
                    "deviceId": deviceId,
                    "deviceType": "ios"
                ]
            )

            // Save tokens
            try keychain.save(response.token, for: Self.accessTokenKey)
            if let refreshToken = response.refreshToken {
                try keychain.save(refreshToken, for: Self.refreshTokenKey)
            }

            // Save user
            let userData = try JSONEncoder().encode(response.user)
            UserDefaults.standard.set(userData, forKey: Self.userKey)

            // Update state
            currentUser = response.user
            isAuthenticated = true

            // Prompt to enable biometric if available and not already enabled
            if biometricType != .none && !isBiometricEnabled {
                showBiometricPrompt = true
            }

            // If biometric is enabled, update stored credentials
            if isBiometricEnabled {
                enableBiometric(username: username, password: password)
            }

            print("✅ Login successful for user: \(response.user.username)")
            if let message = response.message {
                print("📧 Server message: \(message)")
            }

        } catch let apiError as APIError {
            switch apiError {
            case .unauthorized:
                error = .invalidCredentials
            case .serverError(let message):
                error = .serverError(message)
            default:
                error = .networkError(apiError)
            }
        } catch {
            self.error = .networkError(error)
        }

        isLoading = false
    }

    /// Logout and clear session
    func logout() {
        // Unregister push token before clearing auth
        Task {
            await NotificationManager.shared.unregisterPushToken()
        }

        // Clear tokens
        try? keychain.delete(for: Self.accessTokenKey)
        try? keychain.delete(for: Self.refreshTokenKey)

        // Clear user data
        UserDefaults.standard.removeObject(forKey: Self.userKey)

        // Update state
        currentUser = nil
        isAuthenticated = false

        print("User logged out")
    }

    /// Refresh access token
    func refreshToken() async -> Bool {
        guard let refreshToken = try? keychain.get(for: Self.refreshTokenKey) else {
            return false
        }

        do {
            struct RefreshResponse: Codable {
                let token: String
                let user: User
            }

            let response: RefreshResponse = try await apiClient.post(
                "/api/auth/refresh",
                body: ["refreshToken": refreshToken]
            )

            // Save new token
            try keychain.save(response.token, for: Self.accessTokenKey)

            // Update user data
            currentUser = response.user

            print("✅ Token refreshed successfully")
            return true
        } catch {
            print("❌ Token refresh failed: \(error)")
            return false
        }
    }

    /// Check for existing session on app launch
    func checkExistingSession() async {
        guard let accessToken = try? keychain.get(for: Self.accessTokenKey),
              !accessToken.isEmpty else {
            return
        }

        // Try to load cached user
        if let userData = UserDefaults.standard.data(forKey: Self.userKey),
           let user = try? JSONDecoder().decode(User.self, from: userData) {
            currentUser = user
            isAuthenticated = true
        }

        // Validate session with server
        do {
            struct MeResponse: Codable {
                let user: User
            }

            let response: MeResponse = try await apiClient.get("/api/auth/me")
            currentUser = response.user
            isAuthenticated = true
            print("✅ Session validated successfully")
            print("✅ User decoded - fullName: \(response.user.fullName ?? "nil"), displayName: \(response.user.displayName)")
        } catch {
            // Session invalid, try to refresh
            print("⚠️ Session validation failed, attempting refresh...")
            if await refreshToken() {
                await checkExistingSession()
            } else {
                logout()
            }
        }
    }

    /// Clear error
    func clearError() {
        error = nil
    }
}

// MARK: - Keychain Service
class KeychainService {
    static let shared = KeychainService()
    private init() {}

    private let service = "com.gudinocustom.GCWadmin"

    func save(_ value: String, for key: String) throws {
        guard let data = value.data(using: .utf8) else { return }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecValueData as String: data
        ]

        // Delete existing item
        SecItemDelete(query as CFDictionary)

        // Add new item
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw KeychainError.saveFailed
        }
    }

    /// Save with biometric access control (requires Face ID / Touch ID to retrieve)
    func saveBiometric(_ value: String, for key: String) throws {
        guard let data = value.data(using: .utf8) else { return }

        guard let accessControl = SecAccessControlCreateWithFlags(
            nil,
            kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
            .biometryCurrentSet,
            nil
        ) else {
            throw KeychainError.saveFailed
        }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessControl as String: accessControl
        ]

        // Delete existing item
        SecItemDelete(query as CFDictionary)

        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw KeychainError.saveFailed
        }
    }

    /// Retrieve a biometric-protected keychain item (triggers Face ID / Touch ID)
    func getBiometric(for key: String) throws -> String? {
        let context = LAContext()
        context.localizedReason = "Access saved login credentials"

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecUseAuthenticationContext as String: context
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess,
              let data = result as? Data,
              let value = String(data: data, encoding: .utf8) else {
            return nil
        }

        return value
    }

    func get(for key: String) throws -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess,
              let data = result as? Data,
              let value = String(data: data, encoding: .utf8) else {
            return nil
        }

        return value
    }

    func delete(for key: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]

        SecItemDelete(query as CFDictionary)
    }
}

enum KeychainError: Error {
    case saveFailed
    case loadFailed
}
