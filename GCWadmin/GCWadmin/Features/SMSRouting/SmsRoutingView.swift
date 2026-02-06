//
//  SmsRoutingView.swift
//  GCWadmin
//
//  SMS Routing Manager UI - Settings, Recipients, History
//  Matches webapp SmsRoutingManager.js
//

import SwiftUI

struct SmsRoutingView: View {
    @StateObject private var viewModel = SmsRoutingViewModel()
    @State private var showDeleteConfirmation = false
    @State private var recipientToDelete: SmsRecipient?
    
    // Add recipient form state
    @State private var newMessageType = "design_submission"
    @State private var newEmployeeId: Int?
    @State private var newPhoneNumber = ""
    @State private var newName = ""
    @State private var newPriorityOrder = 1
    
    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.lg) {
                // Tab bar
                SubTabBar(
                    tabs: [
                        SubTab(id: "settings", label: "Settings", icon: "gearshape"),
                        SubTab(id: "recipients", label: "Recipients", icon: "person.2", count: viewModel.recipients.count),
                        SubTab(id: "history", label: "History", icon: "clock")
                    ],
                    selection: $viewModel.selectedTab
                )
                
                // Content based on tab
                switch viewModel.selectedTab {
                case "settings":
                    settingsSection
                case "recipients":
                    recipientsSection
                case "history":
                    historySection
                default:
                    settingsSection
                }
            }
            .padding(AppSpacing.lg)
        }
        .background(AppColors.background)
        .navigationTitle("SMS Routing")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.loadAll()
        }
        .sheet(isPresented: $viewModel.showAddRecipient) {
            addRecipientSheet
        }
        .sheet(isPresented: Binding(
            get: { viewModel.editingRecipient != nil },
            set: { if !$0 { viewModel.editingRecipient = nil } }
        )) {
            if let recipient = viewModel.editingRecipient {
                editRecipientSheet(recipient)
            }
        }
        .alert("Delete Recipient", isPresented: $showDeleteConfirmation, presenting: recipientToDelete) { recipient in
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive) {
                Task { await viewModel.deleteRecipient(recipient) }
            }
        } message: { recipient in
            Text("Are you sure you want to delete \(recipient.name)?")
        }
        .overlay(alignment: .top) {
            notificationOverlay
        }
    }
    
    // MARK: - Notification Overlay
    
    private var notificationOverlay: some View {
        VStack {
            if let success = viewModel.successMessage {
                HStack {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.white)
                    Text(success)
                        .font(AppTypography.caption())
                        .foregroundColor(.white)
                }
                .padding(AppSpacing.md)
                .background(AppColors.success)
                .cornerRadius(AppRadius.md)
                .padding(.top, AppSpacing.sm)
                .onAppear {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                        viewModel.successMessage = nil
                    }
                }
            }
            
            if let error = viewModel.errorMessage {
                HStack {
                    Image(systemName: "exclamationmark.circle.fill")
                        .foregroundColor(.white)
                    Text(error)
                        .font(AppTypography.caption())
                        .foregroundColor(.white)
                }
                .padding(AppSpacing.md)
                .background(AppColors.error)
                .cornerRadius(AppRadius.md)
                .padding(.top, AppSpacing.sm)
                .onAppear {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 5) {
                        viewModel.errorMessage = nil
                    }
                }
            }
        }
    }
    
    // MARK: - Settings Section
    
    private var settingsSection: some View {
        VStack(spacing: AppSpacing.lg) {
            ForEach(viewModel.messageTypes, id: \.value) { messageType in
                let setting = viewModel.getSetting(for: messageType.value)
                
                GlassCard(intensity: .light, style: .light) {
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        HStack {
                            VStack(alignment: .leading, spacing: AppSpacing.xs) {
                                Text(messageType.label)
                                    .font(AppTypography.headline())
                                    .foregroundColor(AppColors.text)
                                Text(messageType.description)
                                    .font(AppTypography.caption())
                                    .foregroundColor(AppColors.textGray)
                            }
                            Spacer()
                            Button {
                                Task { await viewModel.testSmsRouting(messageType: messageType.value) }
                            } label: {
                                HStack(spacing: AppSpacing.xs) {
                                    Image(systemName: "paperplane")
                                    Text("Test")
                                }
                                .font(AppTypography.caption())
                                .foregroundColor(.white)
                                .padding(.horizontal, AppSpacing.md)
                                .padding(.vertical, AppSpacing.sm)
                                .background(AppColors.blue)
                                .cornerRadius(AppRadius.md)
                            }
                        }
                        
                        Divider()
                        
                        HStack(spacing: AppSpacing.lg) {
                            VStack(alignment: .leading, spacing: AppSpacing.xs) {
                                Text("Status")
                                    .font(AppTypography.small())
                                    .fontWeight(.medium)
                                    .foregroundColor(AppColors.textMedium)
                                
                                Picker("Status", selection: Binding(
                                    get: { setting.enabled },
                                    set: { newValue in
                                        Task {
                                            await viewModel.updateSetting(
                                                messageType: messageType.value,
                                                isEnabled: newValue,
                                                routingMode: setting.routingMode
                                            )
                                        }
                                    }
                                )) {
                                    Text("Enabled").tag(true)
                                    Text("Disabled").tag(false)
                                }
                                .pickerStyle(.menu)
                            }
                            
                            VStack(alignment: .leading, spacing: AppSpacing.xs) {
                                Text("Routing Mode")
                                    .font(AppTypography.small())
                                    .fontWeight(.medium)
                                    .foregroundColor(AppColors.textMedium)
                                
                                Picker("Routing Mode", selection: Binding(
                                    get: { setting.routingMode },
                                    set: { newValue in
                                        Task {
                                            await viewModel.updateSetting(
                                                messageType: messageType.value,
                                                isEnabled: setting.enabled,
                                                routingMode: newValue
                                            )
                                        }
                                    }
                                )) {
                                    ForEach(viewModel.routingModes, id: \.value) { mode in
                                        Text(mode.label).tag(mode.value)
                                    }
                                }
                                .pickerStyle(.menu)
                            }
                        }
                    }
                }
            }
        }
    }
    
    // MARK: - Recipients Section
    
    private var recipientsSection: some View {
        VStack(spacing: AppSpacing.lg) {
            HStack {
                Text("SMS Recipients")
                    .font(AppTypography.headline())
                    .foregroundColor(AppColors.text)
                Spacer()
                Button {
                    // Reset form
                    newMessageType = "design_submission"
                    newEmployeeId = nil
                    newPhoneNumber = ""
                    newName = ""
                    newPriorityOrder = 1
                    viewModel.showAddRecipient = true
                } label: {
                    HStack(spacing: AppSpacing.xs) {
                        Image(systemName: "plus")
                        Text("Add Recipient")
                    }
                    .font(AppTypography.caption())
                    .foregroundColor(.white)
                    .padding(.horizontal, AppSpacing.md)
                    .padding(.vertical, AppSpacing.sm)
                    .background(AppColors.blue)
                    .cornerRadius(AppRadius.md)
                }
            }
            
            if viewModel.recipients.isEmpty {
                GlassCard(intensity: .light, style: .light) {
                    VStack(spacing: AppSpacing.lg) {
                        Image(systemName: "person.2.slash")
                            .font(.system(size: 48))
                            .foregroundColor(AppColors.textLight)
                        Text("No Recipients")
                            .font(AppTypography.headline())
                            .foregroundColor(AppColors.textGray)
                        Text("Add SMS recipients to start receiving notifications")
                            .font(AppTypography.caption())
                            .foregroundColor(AppColors.textLight)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, AppSpacing.xxxxl)
                }
            } else {
                GlassCard(intensity: .light, style: .light) {
                    VStack(spacing: 0) {
                        ForEach(Array(viewModel.recipients.enumerated()), id: \.element.id) { index, recipient in
                            VStack(spacing: 0) {
                                recipientRow(recipient)
                                if index < viewModel.recipients.count - 1 {
                                    Divider()
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    private func recipientRow(_ recipient: SmsRecipient) -> some View {
        HStack(spacing: AppSpacing.md) {
            VStack(alignment: .leading, spacing: AppSpacing.xs) {
                Text(recipient.name)
                    .font(AppTypography.body())
                    .fontWeight(.medium)
                    .foregroundColor(AppColors.text)
                
                let messageType = viewModel.messageTypes.first(where: { $0.value == recipient.messageType })?.label ?? recipient.messageType
                Text(messageType)
                    .font(AppTypography.small())
                    .foregroundColor(AppColors.textGray)
            }
            
            Spacer()
            
            VStack(alignment: .trailing, spacing: AppSpacing.xs) {
                HStack(spacing: 4) {
                    Image(systemName: "phone")
                        .font(.system(size: 10))
                    Text(recipient.phoneNumber)
                }
                .font(AppTypography.caption())
                .foregroundColor(AppColors.textGray)
                
                if let empName = recipient.employeeName {
                    Text(empName)
                        .font(AppTypography.small())
                        .foregroundColor(AppColors.textLight)
                }
                
                StatusBadge(
                    label: recipient.active ? "Active" : "Inactive",
                    color: recipient.active ? AppColors.success : AppColors.error,
                    bgColor: recipient.active ? AppColors.successBg : AppColors.errorBg
                )
            }
            
            HStack(spacing: AppSpacing.xs) {
                Button {
                    viewModel.editingRecipient = recipient
                } label: {
                    Image(systemName: "pencil")
                        .font(.system(size: 14))
                        .foregroundColor(AppColors.blue)
                        .frame(width: 32, height: 32)
                        .background(AppColors.blue.opacity(0.1))
                        .cornerRadius(AppRadius.sm)
                }
                
                Button {
                    recipientToDelete = recipient
                    showDeleteConfirmation = true
                } label: {
                    Image(systemName: "trash")
                        .font(.system(size: 14))
                        .foregroundColor(AppColors.error)
                        .frame(width: 32, height: 32)
                        .background(AppColors.error.opacity(0.1))
                        .cornerRadius(AppRadius.sm)
                }
            }
        }
        .padding(AppSpacing.md)
    }
    
    // MARK: - History Section
    
    private var historySection: some View {
        VStack(spacing: AppSpacing.lg) {
            HStack {
                Text("SMS History")
                    .font(AppTypography.headline())
                    .foregroundColor(AppColors.text)
                Spacer()
                Button {
                    Task { await viewModel.loadHistory() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 14))
                        .foregroundColor(AppColors.textGray)
                        .padding(AppSpacing.xs)
                }
            }
            
            if viewModel.history.isEmpty {
                GlassCard(intensity: .light, style: .light) {
                    VStack(spacing: AppSpacing.lg) {
                        Image(systemName: "tray")
                            .font(.system(size: 48))
                            .foregroundColor(AppColors.textLight)
                        Text("No History")
                            .font(AppTypography.headline())
                            .foregroundColor(AppColors.textGray)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, AppSpacing.xxxxl)
                }
            } else {
                GlassCard(intensity: .light, style: .light) {
                    VStack(spacing: 0) {
                        ForEach(Array(viewModel.history.enumerated()), id: \.element.id) { index, entry in
                            VStack(spacing: 0) {
                                historyRow(entry)
                                if index < viewModel.history.count - 1 {
                                    Divider()
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    private func historyRow(_ entry: SmsHistoryEntry) -> some View {
        HStack(spacing: AppSpacing.md) {
            VStack(alignment: .leading, spacing: AppSpacing.xs) {
                if let recipient = entry.recipientName {
                    Text(recipient)
                        .font(AppTypography.caption())
                        .fontWeight(.medium)
                        .foregroundColor(AppColors.text)
                }
                if let phone = entry.recipientPhone {
                    Text(phone)
                        .font(AppTypography.small())
                        .foregroundColor(AppColors.textGray)
                }
                if let message = entry.messageContent {
                    Text(message)
                        .font(AppTypography.small())
                        .foregroundColor(AppColors.textLight)
                        .lineLimit(2)
                }
            }
            
            Spacer()
            
            VStack(alignment: .trailing, spacing: AppSpacing.xs) {
                Text(entry.formattedDate)
                    .font(AppTypography.small())
                    .foregroundColor(AppColors.textGray)
                
                if let status = entry.deliveryStatus {
                    StatusBadge.smsStatus(status)
                }
            }
        }
        .padding(AppSpacing.md)
    }
    
    // MARK: - Add Recipient Sheet
    
    private var addRecipientSheet: some View {
        NavigationStack {
            Form {
                Section("Message Type") {
                    Picker("Type", selection: $newMessageType) {
                        ForEach(viewModel.messageTypes, id: \.value) { type in
                            Text(type.label).tag(type.value)
                        }
                    }
                }
                
                Section("Recipient Info") {
                    Picker("Employee (Optional)", selection: $newEmployeeId) {
                        Text("External Recipient").tag(nil as Int?)
                        ForEach(viewModel.employees) { emp in
                            Text(emp.name).tag(emp.id as Int?)
                        }
                    }
                    .onChange(of: newEmployeeId) { _, empId in
                        if let empId = empId, let emp = viewModel.employees.first(where: { $0.id == empId }) {
                            newName = emp.name
                            newPhoneNumber = emp.phone ?? ""
                        }
                    }
                    
                    TextField("Name", text: $newName)
                    TextField("Phone Number", text: $newPhoneNumber)
                        .keyboardType(.phonePad)
                    Stepper("Priority: \(newPriorityOrder)", value: $newPriorityOrder, in: 1...99)
                }
            }
            .navigationTitle("Add Recipient")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        viewModel.showAddRecipient = false
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        Task {
                            await viewModel.addRecipient(
                                messageType: newMessageType,
                                employeeId: newEmployeeId,
                                phoneNumber: newPhoneNumber,
                                name: newName,
                                priorityOrder: newPriorityOrder
                            )
                        }
                    }
                    .disabled(newName.isEmpty || newPhoneNumber.isEmpty)
                }
            }
        }
    }
    
    // MARK: - Edit Recipient Sheet
    
    private func editRecipientSheet(_ recipient: SmsRecipient) -> some View {
        EditRecipientView(recipient: recipient, viewModel: viewModel)
    }
}

// MARK: - Edit Recipient View

struct EditRecipientView: View {
    let recipient: SmsRecipient
    let viewModel: SmsRoutingViewModel
    
    @State private var name: String
    @State private var phoneNumber: String
    @State private var priorityOrder: Int
    @State private var isActive: Bool
    @Environment(\.dismiss) private var dismiss
    
    init(recipient: SmsRecipient, viewModel: SmsRoutingViewModel) {
        self.recipient = recipient
        self.viewModel = viewModel
        _name = State(initialValue: recipient.name)
        _phoneNumber = State(initialValue: recipient.phoneNumber)
        _priorityOrder = State(initialValue: recipient.priorityOrder)
        _isActive = State(initialValue: recipient.active)
    }
    
    var body: some View {
        NavigationStack {
            Form {
                Section("Recipient Info") {
                    TextField("Name", text: $name)
                    TextField("Phone Number", text: $phoneNumber)
                        .keyboardType(.phonePad)
                    Stepper("Priority: \(priorityOrder)", value: $priorityOrder, in: 1...99)
                    Toggle("Active", isOn: $isActive)
                }
            }
            .navigationTitle("Edit Recipient")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        viewModel.editingRecipient = nil
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task {
                            var updated = recipient
                            updated.name = name
                            updated.phoneNumber = phoneNumber
                            updated.priorityOrder = priorityOrder
                            updated.isActive = isActive ? 1 : 0
                            await viewModel.updateRecipient(updated)
                        }
                    }
                    .disabled(name.isEmpty || phoneNumber.isEmpty)
                }
            }
        }
    }
}
