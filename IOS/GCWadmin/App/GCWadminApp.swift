//
//  GCWadminApp.swift
//  GCWadmin
//
//  Gudino Custom Woodwork Admin App
//

import SwiftUI
import UserNotifications

// MARK: - App Delegate for Push Notifications
class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        // Set notification delegate for foreground handling
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    // MARK: - Remote Notification Registration

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        Task { @MainActor in
            NotificationManager.shared.didRegisterForRemoteNotifications(deviceToken: deviceToken)
        }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        Task { @MainActor in
            NotificationManager.shared.didFailToRegisterForRemoteNotifications(error: error)
        }
    }

    // MARK: - UNUserNotificationCenterDelegate

    /// Handle notification received while app is in foreground — show banner
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        Task { @MainActor in
            _ = NotificationManager.shared.handleForegroundNotification(notification)
        }
        // Show banner + sound even when app is in foreground
        completionHandler([.banner, .sound, .badge])
    }

    /// Handle notification tapped (user opened app from notification)
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        Task { @MainActor in
            _ = NotificationManager.shared.handleNotificationTap(response)
        }
        completionHandler()
    }
}

// MARK: - Main App

@main
struct GCWadminApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject private var authManager = AuthManager()
    @StateObject private var languageManager = LanguageManager()
    @StateObject private var notificationManager = NotificationManager.shared
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authManager)
                .environmentObject(languageManager)
                .environmentObject(notificationManager)
                .task {
                    // Request notification permission after app launches
                    await notificationManager.checkPermissionStatus()
                }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                // Clear badge + delivered notifications when app opens
                notificationManager.clearBadge()
                UNUserNotificationCenter.current().removeAllDeliveredNotifications()
            }
        }
    }
}

struct ContentView: View {
    @EnvironmentObject var authManager: AuthManager
    @EnvironmentObject var notificationManager: NotificationManager

    var body: some View {
        Group {
            if authManager.isAuthenticated {
                DashboardView()
            } else {
                LoginView()
            }
        }
        .animation(.easeInOut(duration: 0.3), value: authManager.isAuthenticated)
        .onChange(of: authManager.isAuthenticated) { _, isAuthenticated in
            if isAuthenticated {
                // Request push permission + register when user logs in
                Task {
                    await notificationManager.requestPermission()
                }
            }
        }
        .alert("Notification", isPresented: .init(
            get: { notificationManager.pendingNotification != nil },
            set: { if !$0 { notificationManager.clearPendingNotification() } }
        )) {
            Button("OK") {
                notificationManager.clearPendingNotification()
            }
        } message: {
            if let notification = notificationManager.pendingNotification {
                Text(notification.body)
            }
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(AuthManager())
        .environmentObject(LanguageManager())
        .environmentObject(NotificationManager.shared)
}
