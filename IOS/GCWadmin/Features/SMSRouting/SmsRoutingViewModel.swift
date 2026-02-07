//
//  SmsRoutingViewModel.swift
//  GCWadmin
//
//  ViewModel for SMS Routing Manager
//

import Foundation
import SwiftUI
import Combine

@MainActor
class SmsRoutingViewModel: ObservableObject {
    private let smsService = SmsRoutingService.shared
    
    // MARK: - Published Properties - Data
    
    @Published var settings: [SmsRoutingSetting] = []
    @Published var recipients: [SmsRecipient] = []
    @Published var history: [SmsHistoryEntry] = []
    @Published var employees: [Employee] = []
    
    // MARK: - Published Properties - View State
    
    @Published var selectedTab: String = "settings"
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var successMessage: String?
    
    // MARK: - Published Properties - Forms
    
    @Published var showAddRecipient = false
    @Published var editingRecipient: SmsRecipient?
    
    // MARK: - Message Types
    
    let messageTypes: [(value: String, label: String, description: String)] = [
        ("design_submission", "Design Submissions", "SMS sent when a new design is submitted"),
        ("test_sms", "Test SMS", "Test messages for verifying SMS routing")
    ]
    
    let routingModes: [(value: String, label: String)] = [
        ("single", "Single Recipient"),
        ("all", "All Recipients"),
        ("rotation", "Rotation")
    ]
    
    // MARK: - Load All Data
    
    func loadAll() async {
        isLoading = true
        errorMessage = nil
        
        async let settingsTask: () = loadSettings()
        async let recipientsTask: () = loadRecipients()
        async let employeesTask: () = loadEmployees()
        async let historyTask: () = loadHistory()
        
        _ = await (settingsTask, recipientsTask, employeesTask, historyTask)
        
        isLoading = false
    }
    
    // MARK: - Load Settings
    
    func loadSettings() async {
        do {
            settings = try await smsService.getSettings()
        } catch {
            print("Failed to load SMS settings: \(error)")
            errorMessage = error.localizedDescription
        }
    }
    
    // MARK: - Load Recipients
    
    func loadRecipients() async {
        do {
            recipients = try await smsService.getRecipients()
        } catch {
            print("Failed to load recipients: \(error)")
            errorMessage = error.localizedDescription
        }
    }
    
    // MARK: - Load Employees
    
    func loadEmployees() async {
        do {
            let employeesService = EmployeesService.shared
            employees = try await employeesService.getAllEmployees(includeInactive: false)
        } catch {
            print("Failed to load employees: \(error)")
        }
    }
    
    // MARK: - Load History
    
    func loadHistory() async {
        do {
            history = try await smsService.getHistory(limit: 50)
        } catch {
            print("Failed to load history: \(error)")
            errorMessage = error.localizedDescription
        }
    }
    
    // MARK: - Update Setting
    
    func updateSetting(messageType: String, isEnabled: Bool, routingMode: String) async {
        do {
            let _ = try await smsService.updateSetting(
                messageType: messageType,
                isEnabled: isEnabled ? 1 : 0,
                routingMode: routingMode
            )
            successMessage = "Settings updated successfully"
            await loadSettings()
        } catch {
            errorMessage = "Failed to update settings: \(error.localizedDescription)"
        }
    }
    
    // MARK: - Add Recipient
    
    func addRecipient(messageType: String, employeeId: Int?, phoneNumber: String, name: String, priorityOrder: Int) async {
        do {
            let _ = try await smsService.addRecipient(
                messageType: messageType,
                employeeId: employeeId,
                phoneNumber: phoneNumber,
                name: name,
                priorityOrder: priorityOrder
            )
            successMessage = "Recipient added successfully"
            showAddRecipient = false
            await loadRecipients()
        } catch {
            errorMessage = "Failed to add recipient: \(error.localizedDescription)"
        }
    }
    
    // MARK: - Update Recipient
    
    func updateRecipient(_ recipient: SmsRecipient) async {
        do {
            let _ = try await smsService.updateRecipient(
                id: recipient.id,
                name: recipient.name,
                phoneNumber: recipient.phoneNumber,
                priorityOrder: recipient.priorityOrder,
                isActive: recipient.isActive
            )
            successMessage = "Recipient updated successfully"
            editingRecipient = nil
            await loadRecipients()
        } catch {
            errorMessage = "Failed to update recipient: \(error.localizedDescription)"
        }
    }
    
    // MARK: - Delete Recipient
    
    func deleteRecipient(_ recipient: SmsRecipient) async {
        do {
            let _ = try await smsService.deleteRecipient(id: recipient.id)
            successMessage = "Recipient deleted successfully"
            await loadRecipients()
        } catch {
            errorMessage = "Failed to delete recipient: \(error.localizedDescription)"
        }
    }
    
    // MARK: - Test SMS Routing
    
    func testSmsRouting(messageType: String) async {
        isLoading = true
        do {
            let dateFormatter = DateFormatter()
            dateFormatter.dateStyle = .short
            dateFormatter.timeStyle = .short
            let message = "Test SMS routing for \(messageType) - sent at \(dateFormatter.string(from: Date()))"
            
            let response = try await smsService.testRouting(messageType: messageType, message: message)
            if response.success == true {
                let sent = response.details?.totalSent ?? 0
                successMessage = "Test SMS sent to \(sent) recipient(s)"
                await loadHistory()
            } else {
                errorMessage = "Test failed: \(response.message ?? "Unknown error")"
            }
        } catch {
            errorMessage = "Failed to send test SMS: \(error.localizedDescription)"
        }
        isLoading = false
    }
    
    // MARK: - Get Setting for Message Type

    func getSetting(for messageType: String) -> SmsRoutingSetting {
        if let setting = settings.first(where: { $0.messageType == messageType }) {
            return setting
        }

        // Create default setting by decoding minimal JSON
        let jsonString = """
        {"message_type":"\(messageType)","is_enabled":1,"routing_mode":"single"}
        """
        let jsonData = jsonString.data(using: .utf8)!
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try! decoder.decode(SmsRoutingSetting.self, from: jsonData)
    }
    
    // MARK: - Recipients by Message Type
    
    func recipientsFor(messageType: String) -> [SmsRecipient] {
        return recipients.filter { $0.messageType == messageType }
    }
}
