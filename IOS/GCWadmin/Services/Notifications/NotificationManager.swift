//
//  NotificationManager.swift
//  GCWadmin
//
//  Manages push notification registration, handling, and display
//  Registers APNs device token with backend for native push delivery
//

import SwiftUI
import UserNotifications
import Combine

@MainActor
class NotificationManager: NSObject, ObservableObject {
    static let shared = NotificationManager()

    // MARK: - Published Properties
    @Published var isPermissionGranted = false
    @Published var deviceToken: String?
    @Published var pendingNotification: PushNotificationData?

    // MARK: - Private Properties
    private let apiClient = APIClient.shared

    // MARK: - Notification Data
    struct PushNotificationData: Identifiable {
        let id = UUID()
        let title: String
        let body: String
        let type: NotificationType
        let screen: String?
        let data: [String: String]

        enum NotificationType: String {
            case designSubmitted = "design_submitted"
            case testimonialSubmitted = "testimonial_submitted"
            case testimonialOpened = "testimonial_opened"
            case invoiceOpened = "invoice_opened"
            case invoiceChangesViewed = "invoice_changes_viewed"
            case unknown

            init(rawValue: String) {
                switch rawValue {
                case "design_submitted": self = .designSubmitted
                case "testimonial_submitted": self = .testimonialSubmitted
                case "testimonial_opened": self = .testimonialOpened
                case "invoice_opened": self = .invoiceOpened
                case "invoice_changes_viewed": self = .invoiceChangesViewed
                default: self = .unknown
                }
            }
        }
    }

    // MARK: - Initialization

    override private init() {
        super.init()
    }

    // MARK: - Permission Request

    /// Request notification permissions from the user
    func requestPermission() async {
        let center = UNUserNotificationCenter.current()

        do {
            let granted = try await center.requestAuthorization(options: [.alert, .sound, .badge])
            isPermissionGranted = granted

            if granted {
                print("✅ Notification permission granted")
                // Register for remote notifications on main thread
                await MainActor.run {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            } else {
                print("⚠️ Notification permission denied")
            }
        } catch {
            print("❌ Error requesting notification permission: \(error)")
        }
    }

    /// Check current notification permission status
    func checkPermissionStatus() async {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        isPermissionGranted = settings.authorizationStatus == .authorized
    }

    // MARK: - Token Registration

    /// Called when APNs device token is received
    func didRegisterForRemoteNotifications(deviceToken: Data) {
        let tokenString = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        self.deviceToken = tokenString
        print("📱 APNs device token: \(tokenString)")

        // Register token with backend
        Task {
            await registerPushToken(tokenString)
        }
    }

    /// Called when APNs registration fails
    func didFailToRegisterForRemoteNotifications(error: Error) {
        print("❌ Failed to register for remote notifications: \(error)")
    }

    /// Register the push token with the backend
    private func registerPushToken(_ token: String) async {
        do {
            struct RegisterTokenResponse: Codable {
                let success: Bool
                let message: String?
            }

            let _: RegisterTokenResponse = try await apiClient.post(
                "/api/admin/push-tokens",
                body: [
                    "token": token,
                    "device_type": "ios_native"
                ]
            )

            print("✅ Push token registered with backend")
        } catch {
            print("❌ Failed to register push token with backend: \(error)")
        }
    }

    /// Unregister push token on logout
    func unregisterPushToken() async {
        guard let token = deviceToken else { return }

        do {
            struct UnregisterResponse: Codable {
                let success: Bool
            }

            let _: UnregisterResponse = try await apiClient.delete(
                "/api/admin/push-tokens/\(token)"
            )

            print("✅ Push token unregistered from backend")
        } catch {
            print("❌ Failed to unregister push token: \(error)")
        }
    }

    // MARK: - Handle Incoming Notifications

    /// Handle notification received while app is in foreground
    func handleForegroundNotification(_ notification: UNNotification) -> PushNotificationData? {
        let content = notification.request.content
        let userInfo = content.userInfo

        let type = (userInfo["type"] as? String) ?? "unknown"
        let screen = userInfo["screen"] as? String

        var data: [String: String] = [:]
        for (key, value) in userInfo {
            if let key = key as? String, let value = value as? String {
                data[key] = value
            }
        }

        let notificationData = PushNotificationData(
            title: content.title,
            body: content.body,
            type: .init(rawValue: type),
            screen: screen,
            data: data
        )

        pendingNotification = notificationData
        return notificationData
    }

    /// Handle notification tapped (app opened from notification)
    func handleNotificationTap(_ response: UNNotificationResponse) -> PushNotificationData? {
        let content = response.notification.request.content
        let userInfo = content.userInfo

        let type = (userInfo["type"] as? String) ?? "unknown"
        let screen = userInfo["screen"] as? String

        var data: [String: String] = [:]
        for (key, value) in userInfo {
            if let key = key as? String, let value = value as? String {
                data[key] = value
            }
        }

        let notificationData = PushNotificationData(
            title: content.title,
            body: content.body,
            type: .init(rawValue: type),
            screen: screen,
            data: data
        )

        pendingNotification = notificationData
        return notificationData
    }

    /// Clear the pending notification
    func clearPendingNotification() {
        pendingNotification = nil
    }

    /// Clear badge count
    func clearBadge() {
        UNUserNotificationCenter.current().setBadgeCount(0) { error in
            if let error = error {
                print("❌ Error clearing badge: \(error)")
            }
        }
    }
}
