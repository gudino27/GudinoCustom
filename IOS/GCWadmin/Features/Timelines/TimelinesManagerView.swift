//
//  TimelinesManagerView.swift
//  GCWadmin
//
//  Project Timeline Manager UI - List, Details, Phase Editing, Create, Send Link
//  Matches webapp ProjectTimelineManager.js
//

import SwiftUI

struct TimelinesManagerView: View {
    @StateObject private var viewModel = TimelinesManagerViewModel()
    
    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.lg) {
                if viewModel.isLoading {
                    loadingView
                } else if viewModel.selectedTimeline != nil {
                    timelineDetailView
                } else {
                    timelineListView
                }
            }
            .padding(AppSpacing.lg)
        }
        .background(AppColors.background)
        .navigationTitle("Project Timelines")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                if viewModel.selectedTimeline == nil {
                    Button {
                        viewModel.showCreateModal = true
                    } label: {
                        Image(systemName: "plus")
                            .foregroundColor(AppColors.blue)
                    }
                }
            }
        }
        .task {
            await viewModel.loadAll()
        }
        .sheet(isPresented: $viewModel.showCreateModal) {
            createTimelineSheet
        }
        .sheet(isPresented: $viewModel.showSendLinkModal) {
            sendLinkSheet
        }
        .alert("Delete Timeline", isPresented: $viewModel.showDeleteConfirmation) {
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive) {
                Task { await viewModel.deleteTimeline() }
            }
        } message: {
            Text("Are you sure you want to delete this timeline? This action cannot be undone.")
        }
        .overlay(alignment: .top) {
            notificationOverlay
        }
    }
    
    // MARK: - Loading View
    
    private var loadingView: some View {
        VStack(spacing: AppSpacing.lg) {
            ProgressView()
                .scaleEffect(1.5)
            Text("Loading timelines...")
                .font(AppTypography.body())
                .foregroundColor(AppColors.textGray)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 60)
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
    
    // MARK: - Timeline List View
    
    private var timelineListView: some View {
        VStack(alignment: .leading, spacing: AppSpacing.lg) {
            // Header
            VStack(alignment: .leading, spacing: AppSpacing.xs) {
                Text("All Timelines (\(viewModel.timelines.count))")
                    .font(AppTypography.headline())
                    .foregroundColor(AppColors.text)
                Text("Manage project progress and client updates")
                    .font(AppTypography.caption())
                    .foregroundColor(AppColors.textGray)
            }
            
            if viewModel.timelines.isEmpty {
                emptyStateView
            } else {
                ForEach(viewModel.timelines) { timeline in
                    timelineCard(timeline)
                }
            }
        }
    }
    
    // MARK: - Empty State
    
    private var emptyStateView: some View {
        GlassCard(intensity: .light, style: .light) {
            VStack(spacing: AppSpacing.lg) {
                Image(systemName: "calendar.badge.clock")
                    .font(.system(size: 48))
                    .foregroundColor(AppColors.textGray)
                Text("No timelines yet")
                    .font(AppTypography.headline())
                    .foregroundColor(AppColors.text)
                Text("Create one to get started.")
                    .font(AppTypography.body())
                    .foregroundColor(AppColors.textGray)
                Button {
                    viewModel.showCreateModal = true
                } label: {
                    HStack {
                        Image(systemName: "plus")
                        Text("Create Timeline")
                    }
                    .font(AppTypography.body())
                    .fontWeight(.medium)
                    .foregroundColor(.white)
                    .padding(.horizontal, AppSpacing.xl)
                    .padding(.vertical, AppSpacing.md)
                    .background(AppColors.blue)
                    .cornerRadius(AppRadius.md)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, AppSpacing.xl)
        }
    }
    
    // MARK: - Timeline Card
    
    private func timelineCard(_ timeline: Timeline) -> some View {
        Button {
            Task { await viewModel.selectTimeline(timeline) }
        } label: {
            GlassCard(intensity: .light, style: .light) {
                VStack(alignment: .leading, spacing: AppSpacing.sm) {
                    HStack {
                        VStack(alignment: .leading, spacing: AppSpacing.xs) {
                            Text(timeline.clientName)
                                .font(AppTypography.headline())
                                .foregroundColor(AppColors.text)
                            
                            Text(timeline.isInvoiceBased
                                 ? "Invoice #\(timeline.invoiceNumber ?? "")"
                                 : (timeline.clientEmail ?? "Standalone Project"))
                                .font(AppTypography.caption())
                                .foregroundColor(AppColors.textGray)
                        }
                        
                        Spacer()
                        
                        HStack(spacing: AppSpacing.xs) {
                            if !timeline.isInvoiceBased {
                                Text("Standalone")
                                    .font(AppTypography.small())
                                    .fontWeight(.medium)
                                    .foregroundColor(Color(hex: "1E40AF"))
                                    .padding(.horizontal, AppSpacing.sm)
                                    .padding(.vertical, 2)
                                    .background(Color(hex: "DBEAFE"))
                                    .cornerRadius(AppRadius.sm)
                            }
                            
                            Text(timeline.languageLabel)
                                .font(AppTypography.small())
                                .fontWeight(.medium)
                                .foregroundColor(AppColors.textMedium)
                                .padding(.horizontal, AppSpacing.sm)
                                .padding(.vertical, 2)
                                .background(Color(hex: "F3F4F6"))
                                .cornerRadius(AppRadius.sm)
                        }
                    }
                    
                    Text("Created \(formatDate(timeline.createdAt))")
                        .font(AppTypography.small())
                        .foregroundColor(AppColors.textLight)
                }
            }
        }
        .buttonStyle(.plain)
    }
    
    // MARK: - Timeline Detail View
    
    private var timelineDetailView: some View {
        VStack(alignment: .leading, spacing: AppSpacing.lg) {
            guard let timeline = viewModel.selectedTimeline else { return AnyView(EmptyView()) }
            
            return AnyView(VStack(alignment: .leading, spacing: AppSpacing.lg) {
                // Back Button
                Button {
                    viewModel.selectedTimeline = nil
                } label: {
                    HStack(spacing: AppSpacing.sm) {
                        Image(systemName: "chevron.left")
                        Text("Back to Timelines")
                    }
                    .font(AppTypography.body())
                    .foregroundColor(AppColors.blue)
                }
                
                // Client Information Card
                clientInfoCard(timeline)
                
                // Actions
                actionsRow(timeline)
                
                // Phases
                if !timeline.phases.isEmpty {
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        Text("Project Phases")
                            .font(AppTypography.headline())
                            .foregroundColor(AppColors.text)
                        
                        ForEach(timeline.phases) { phase in
                            phaseCard(phase, language: timeline.clientLanguage)
                        }
                    }
                }
            })
        }
    }
    
    // MARK: - Client Info Card
    
    private func clientInfoCard(_ timeline: TimelineDetail) -> some View {
        GlassCard(intensity: .regular, style: .light) {
            VStack(alignment: .leading, spacing: AppSpacing.md) {
                // Client Name Row
                HStack(spacing: AppSpacing.md) {
                    // Avatar
                    ZStack {
                        Circle()
                            .fill(LinearGradient(
                                colors: [Color(hex: "3B82F6"), Color(hex: "2563EB")],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ))
                            .frame(width: 48, height: 48)
                        
                        Text(String(timeline.clientName.prefix(1)).uppercased())
                            .font(.system(size: 20, weight: .semibold))
                            .foregroundColor(.white)
                    }
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text(timeline.clientName)
                            .font(AppTypography.headline())
                            .foregroundColor(AppColors.text)
                        
                        Text(timeline.invoiceNumber != nil
                             ? "Invoice #\(timeline.invoiceNumber!)"
                             : timeline.clientName)
                            .font(AppTypography.caption())
                            .foregroundColor(AppColors.textGray)
                    }
                    
                    Spacer()
                }
                
                // Language Selector & Send Link
                HStack(spacing: AppSpacing.sm) {
                    Menu {
                        Button("🇺🇸 English") {
                            Task { await viewModel.updateLanguage("en") }
                        }
                        Button("🇲🇽 Español") {
                            Task { await viewModel.updateLanguage("es") }
                        }
                    } label: {
                        HStack {
                            Text(timeline.clientLanguage == "es" ? "🇲🇽 Español" : "🇺🇸 English")
                                .font(AppTypography.caption())
                                .foregroundColor(AppColors.text)
                            Image(systemName: "chevron.down")
                                .font(.system(size: 10))
                                .foregroundColor(AppColors.textGray)
                        }
                        .padding(.horizontal, AppSpacing.md)
                        .padding(.vertical, AppSpacing.sm)
                        .background(Color.white)
                        .cornerRadius(AppRadius.md)
                        .overlay(
                            RoundedRectangle(cornerRadius: AppRadius.md)
                                .stroke(Color(hex: "D1D5DB"), lineWidth: 1)
                        )
                    }
                    
                    Button {
                        viewModel.showSendLinkModal = true
                    } label: {
                        HStack(spacing: AppSpacing.xs) {
                            Image(systemName: "paperplane.fill")
                            Text("Send Link")
                        }
                        .font(AppTypography.caption())
                        .fontWeight(.medium)
                        .foregroundColor(.white)
                        .padding(.horizontal, AppSpacing.md)
                        .padding(.vertical, AppSpacing.sm)
                        .background(AppColors.blue)
                        .cornerRadius(AppRadius.md)
                    }
                }
                
                Divider()
                
                // Contact Info Grid
                VStack(alignment: .leading, spacing: AppSpacing.sm) {
                    if let email = timeline.clientEmail, !email.isEmpty {
                        HStack(spacing: AppSpacing.sm) {
                            Text("Email")
                                .font(AppTypography.small())
                                .foregroundColor(AppColors.textGray)
                            Text(email)
                                .font(AppTypography.caption())
                                .fontWeight(.medium)
                                .foregroundColor(AppColors.text)
                        }
                    }
                    
                    if let phone = timeline.clientPhone, !phone.isEmpty {
                        HStack(spacing: AppSpacing.sm) {
                            Text("Phone")
                                .font(AppTypography.small())
                                .foregroundColor(AppColors.textGray)
                            Text(phone)
                                .font(AppTypography.caption())
                                .fontWeight(.medium)
                                .foregroundColor(AppColors.text)
                        }
                    }
                    
                    if let invoiceNum = timeline.invoiceNumber {
                        HStack(spacing: AppSpacing.sm) {
                            Text("Invoice")
                                .font(AppTypography.small())
                                .foregroundColor(AppColors.textGray)
                            Text("#\(invoiceNum)")
                                .font(AppTypography.caption())
                                .fontWeight(.medium)
                                .foregroundColor(AppColors.text)
                        }
                    }
                }
            }
        }
    }
    
    // MARK: - Actions Row
    
    private func actionsRow(_ timeline: TimelineDetail) -> some View {
        HStack {
            Spacer()
            Button {
                viewModel.showDeleteConfirmation = true
            } label: {
                HStack(spacing: AppSpacing.xs) {
                    Image(systemName: "trash")
                    Text("Delete Timeline")
                }
                .font(AppTypography.caption())
                .fontWeight(.medium)
                .foregroundColor(Color(hex: "DC2626"))
                .padding(.horizontal, AppSpacing.lg)
                .padding(.vertical, AppSpacing.md)
                .background(Color(hex: "FEE2E2"))
                .cornerRadius(AppRadius.md)
            }
        }
    }
    
    // MARK: - Phase Card
    
    private func phaseCard(_ phase: TimelinePhase, language: String) -> some View {
        let isEditing = viewModel.editingPhaseId == phase.id
        
        return GlassCard(intensity: .light, style: .light) {
            VStack(alignment: .leading, spacing: AppSpacing.md) {
                if isEditing {
                    phaseEditForm(phase, language: language)
                } else {
                    phaseDisplayView(phase, language: language)
                }
            }
        }
    }
    
    // MARK: - Phase Display View
    
    private func phaseDisplayView(_ phase: TimelinePhase, language: String) -> some View {
        VStack(alignment: .leading, spacing: AppSpacing.md) {
            HStack {
                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    Text(phase.phaseName(language: language))
                        .font(AppTypography.headline())
                        .foregroundColor(AppColors.text)
                    
                    phaseStatusBadge(phase.status)
                }
                
                Spacer()
                
                Button {
                    viewModel.startEditingPhase(phase)
                } label: {
                    Image(systemName: "pencil")
                        .font(.system(size: 16))
                        .foregroundColor(AppColors.textGray)
                        .padding(AppSpacing.sm)
                        .background(Color(hex: "F3F4F6"))
                        .cornerRadius(AppRadius.sm)
                }
            }
            
            if let estDate = phase.formattedEstimatedDate {
                HStack(spacing: AppSpacing.xs) {
                    Text("Est. Completion:")
                        .font(AppTypography.small())
                        .fontWeight(.semibold)
                        .foregroundColor(AppColors.textGray)
                    Text(estDate)
                        .font(AppTypography.caption())
                        .foregroundColor(AppColors.textGray)
                }
            }
            
            if let actDate = phase.formattedActualDate {
                HStack(spacing: AppSpacing.xs) {
                    Text("Completed:")
                        .font(AppTypography.small())
                        .fontWeight(.semibold)
                        .foregroundColor(AppColors.success)
                    Text(actDate)
                        .font(AppTypography.caption())
                        .foregroundColor(AppColors.success)
                }
            }
            
            if let notes = phase.notes, !notes.isEmpty {
                Text(notes)
                    .font(AppTypography.caption())
                    .foregroundColor(AppColors.textMedium)
                    .padding(AppSpacing.md)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(hex: "F9FAFB"))
                    .cornerRadius(AppRadius.sm)
            }
        }
    }
    
    // MARK: - Phase Edit Form
    
    private func phaseEditForm(_ phase: TimelinePhase, language: String) -> some View {
        VStack(alignment: .leading, spacing: AppSpacing.md) {
            Text("Edit: \(phase.phaseName(language: language))")
                .font(AppTypography.headline())
                .foregroundColor(AppColors.text)
            
            // Status Picker
            VStack(alignment: .leading, spacing: AppSpacing.xs) {
                Text("Status")
                    .font(AppTypography.small())
                    .fontWeight(.medium)
                    .foregroundColor(AppColors.textMedium)
                
                Picker("Status", selection: $viewModel.editFormStatus) {
                    Text("Pending").tag("pending")
                    Text("In Progress").tag("in_progress")
                    Text("Completed").tag("completed")
                }
                .pickerStyle(.segmented)
            }
            
            // Estimated Completion
            VStack(alignment: .leading, spacing: AppSpacing.xs) {
                Text("Estimated Completion")
                    .font(AppTypography.small())
                    .fontWeight(.medium)
                    .foregroundColor(AppColors.textMedium)
                
                TextField("YYYY-MM-DD", text: $viewModel.editFormEstimatedCompletion)
                    .font(AppTypography.body())
                    .padding(AppSpacing.md)
                    .background(Color.white)
                    .cornerRadius(AppRadius.md)
                    .overlay(
                        RoundedRectangle(cornerRadius: AppRadius.md)
                            .stroke(Color(hex: "D1D5DB"), lineWidth: 1)
                    )
            }
            
            // Notes
            VStack(alignment: .leading, spacing: AppSpacing.xs) {
                Text("Notes")
                    .font(AppTypography.small())
                    .fontWeight(.medium)
                    .foregroundColor(AppColors.textMedium)
                
                TextEditor(text: $viewModel.editFormNotes)
                    .font(AppTypography.body())
                    .frame(minHeight: 80)
                    .padding(AppSpacing.sm)
                    .background(Color.white)
                    .cornerRadius(AppRadius.md)
                    .overlay(
                        RoundedRectangle(cornerRadius: AppRadius.md)
                            .stroke(Color(hex: "D1D5DB"), lineWidth: 1)
                    )
            }
            
            // Action Buttons
            HStack(spacing: AppSpacing.md) {
                Spacer()
                
                Button {
                    viewModel.cancelEditingPhase()
                } label: {
                    Text("Cancel")
                        .font(AppTypography.caption())
                        .foregroundColor(AppColors.textGray)
                        .padding(.horizontal, AppSpacing.lg)
                        .padding(.vertical, AppSpacing.sm)
                        .background(Color(hex: "F3F4F6"))
                        .cornerRadius(AppRadius.md)
                }
                
                Button {
                    Task { await viewModel.savePhaseChanges() }
                } label: {
                    Text("Save Changes")
                        .font(AppTypography.caption())
                        .fontWeight(.medium)
                        .foregroundColor(.white)
                        .padding(.horizontal, AppSpacing.lg)
                        .padding(.vertical, AppSpacing.sm)
                        .background(AppColors.blue)
                        .cornerRadius(AppRadius.md)
                }
            }
        }
    }
    
    // MARK: - Phase Status Badge
    
    private func phaseStatusBadge(_ status: String) -> some View {
        let config: (bg: String, fg: String, icon: String, label: String) = {
            switch status {
            case "in_progress":
                return ("DBEAFE", "1E40AF", "play.circle", "IN PROGRESS")
            case "completed":
                return ("D1FAE5", "065F46", "checkmark.circle", "COMPLETED")
            default:
                return ("FEF3C7", "92400E", "circle", "PENDING")
            }
        }()
        
        return HStack(spacing: AppSpacing.xs) {
            Image(systemName: config.icon)
                .font(.system(size: 14))
            Text(config.label)
                .font(AppTypography.small())
                .fontWeight(.medium)
        }
        .foregroundColor(Color(hex: config.fg))
        .padding(.horizontal, AppSpacing.md)
        .padding(.vertical, 4)
        .background(Color(hex: config.bg))
        .cornerRadius(20)
    }
    
    // MARK: - Create Timeline Sheet
    
    private var createTimelineSheet: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: AppSpacing.lg) {
                    // Mode Toggle
                    HStack(spacing: AppSpacing.sm) {
                        ForEach(TimelinesManagerViewModel.CreateMode.allCases, id: \.self) { mode in
                            Button {
                                viewModel.createMode = mode
                            } label: {
                                Text(mode.label)
                                    .font(AppTypography.caption())
                                    .fontWeight(viewModel.createMode == mode ? .semibold : .regular)
                                    .foregroundColor(viewModel.createMode == mode ? Color(hex: "2563EB") : AppColors.textGray)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, AppSpacing.md)
                                    .background(viewModel.createMode == mode ? Color(hex: "EFF6FF") : Color.white)
                                    .cornerRadius(AppRadius.md)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: AppRadius.md)
                                            .stroke(viewModel.createMode == mode ? Color(hex: "2563EB") : Color(hex: "D1D5DB"), lineWidth: viewModel.createMode == mode ? 2 : 1)
                                    )
                            }
                        }
                    }
                    
                    if viewModel.createMode == .invoice {
                        invoiceCreateForm
                    } else {
                        standaloneCreateForm
                    }
                }
                .padding(AppSpacing.lg)
            }
            .navigationTitle("Create Timeline")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        viewModel.showCreateModal = false
                    }
                }
            }
        }
    }
    
    // MARK: - Invoice Create Form
    
    private var invoiceCreateForm: some View {
        VStack(alignment: .leading, spacing: AppSpacing.lg) {
            // Invoice Picker
            VStack(alignment: .leading, spacing: AppSpacing.xs) {
                Text("Select Invoice")
                    .font(AppTypography.caption())
                    .fontWeight(.medium)
                    .foregroundColor(AppColors.textMedium)
                
                if viewModel.availableInvoices.isEmpty {
                    Text("No invoices available without timelines")
                        .font(AppTypography.caption())
                        .foregroundColor(AppColors.textGray)
                        .padding(AppSpacing.lg)
                        .frame(maxWidth: .infinity)
                        .background(Color(hex: "F9FAFB"))
                        .cornerRadius(AppRadius.md)
                } else {
                    ForEach(viewModel.availableInvoices) { invoice in
                        Button {
                            viewModel.selectedInvoiceId = invoice.id
                        } label: {
                            HStack {
                                VStack(alignment: .leading) {
                                    Text("Invoice #\(invoice.invoiceNumber ?? "N/A")")
                                        .font(AppTypography.caption())
                                        .fontWeight(.medium)
                                        .foregroundColor(AppColors.text)
                                    Text(invoice.clientName ?? "Unknown")
                                        .font(AppTypography.small())
                                        .foregroundColor(AppColors.textGray)
                                }
                                Spacer()
                                if viewModel.selectedInvoiceId == invoice.id {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundColor(AppColors.blue)
                                }
                            }
                            .padding(AppSpacing.md)
                            .background(viewModel.selectedInvoiceId == invoice.id ? Color(hex: "EFF6FF") : Color.white)
                            .cornerRadius(AppRadius.md)
                            .overlay(
                                RoundedRectangle(cornerRadius: AppRadius.md)
                                    .stroke(viewModel.selectedInvoiceId == invoice.id ? AppColors.blue : Color(hex: "E5E7EB"), lineWidth: viewModel.selectedInvoiceId == invoice.id ? 2 : 1)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            
            // Language Picker
            languagePicker(selection: $viewModel.createLanguage)
            
            // Create Button
            Button {
                Task { await viewModel.createTimelineFromInvoice() }
            } label: {
                Text("Create Timeline")
                    .font(AppTypography.body())
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, AppSpacing.md)
                    .background(viewModel.selectedInvoiceId != nil ? AppColors.blue : Color(hex: "D1D5DB"))
                    .cornerRadius(AppRadius.md)
            }
            .disabled(viewModel.selectedInvoiceId == nil)
        }
    }
    
    // MARK: - Standalone Create Form
    
    private var standaloneCreateForm: some View {
        VStack(alignment: .leading, spacing: AppSpacing.lg) {
            formField(label: "Client Name *", placeholder: "John Doe", text: $viewModel.standaloneClientName)
            formField(label: "Client Email *", placeholder: "john@example.com", text: $viewModel.standaloneClientEmail, keyboardType: .emailAddress)
            formField(label: "Client Phone (optional)", placeholder: "+1 (555) 123-4567", text: $viewModel.standaloneClientPhone, keyboardType: .phonePad)
            
            languagePicker(selection: $viewModel.standaloneLanguage)
            
            // Info Banner
            HStack(spacing: AppSpacing.sm) {
                Image(systemName: "envelope")
                    .foregroundColor(Color(hex: "1E40AF"))
                Text("An email with the timeline access link will be automatically sent to the client.")
                    .font(AppTypography.small())
                    .foregroundColor(Color(hex: "1E40AF"))
            }
            .padding(AppSpacing.md)
            .background(Color(hex: "EFF6FF"))
            .cornerRadius(AppRadius.md)
            
            // Create Button
            Button {
                Task { await viewModel.createStandaloneTimeline() }
            } label: {
                Text("Create Standalone Timeline")
                    .font(AppTypography.body())
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, AppSpacing.md)
                    .background(
                        (!viewModel.standaloneClientName.isEmpty && !viewModel.standaloneClientEmail.isEmpty)
                        ? AppColors.blue : Color(hex: "D1D5DB")
                    )
                    .cornerRadius(AppRadius.md)
            }
            .disabled(viewModel.standaloneClientName.isEmpty || viewModel.standaloneClientEmail.isEmpty)
        }
    }
    
    // MARK: - Send Link Sheet
    
    private var sendLinkSheet: some View {
        NavigationStack {
            VStack(spacing: AppSpacing.lg) {
                Text("Choose how to send the project timeline link to \(viewModel.selectedTimeline?.clientName ?? "client")")
                    .font(AppTypography.body())
                    .foregroundColor(AppColors.textGray)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
                
                VStack(spacing: AppSpacing.md) {
                    // Email Option
                    if let email = viewModel.selectedTimeline?.clientEmail, !email.isEmpty {
                        sendLinkOption(
                            icon: "envelope.fill",
                            iconColor: Color(hex: "2563EB"),
                            iconBg: Color(hex: "DBEAFE"),
                            borderColor: Color(hex: "3B82F6"),
                            title: "Email",
                            subtitle: email
                        ) {
                            Task { await viewModel.sendLink(method: "email") }
                        }
                    }
                    
                    // SMS Option
                    if let phone = viewModel.selectedTimeline?.clientPhone, !phone.isEmpty {
                        sendLinkOption(
                            icon: "message.fill",
                            iconColor: Color(hex: "059669"),
                            iconBg: Color(hex: "D1FAE5"),
                            borderColor: Color(hex: "10B981"),
                            title: "Text Message",
                            subtitle: phone
                        ) {
                            Task { await viewModel.sendLink(method: "sms") }
                        }
                    }
                    
                    // Both Option
                    if let email = viewModel.selectedTimeline?.clientEmail, !email.isEmpty,
                       let phone = viewModel.selectedTimeline?.clientPhone, !phone.isEmpty {
                        sendLinkOption(
                            icon: "paperplane.fill",
                            iconColor: Color(hex: "7C3AED"),
                            iconBg: Color(hex: "EDE9FE"),
                            borderColor: Color(hex: "8B5CF6"),
                            title: "Email & SMS",
                            subtitle: "Send via both methods"
                        ) {
                            Task { await viewModel.sendLink(method: "both") }
                        }
                    }
                }
                .padding(.horizontal)
                
                Spacer()
            }
            .padding(.top, AppSpacing.lg)
            .navigationTitle("Send Timeline Link")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        viewModel.showSendLinkModal = false
                    }
                }
            }
        }
    }
    
    // MARK: - Send Link Option Button
    
    private func sendLinkOption(
        icon: String,
        iconColor: Color,
        iconBg: Color,
        borderColor: Color,
        title: String,
        subtitle: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: AppSpacing.md) {
                Image(systemName: icon)
                    .font(.system(size: 24))
                    .foregroundColor(iconColor)
                    .frame(width: 48, height: 48)
                    .background(iconBg)
                    .cornerRadius(AppRadius.md)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(AppTypography.body())
                        .fontWeight(.semibold)
                        .foregroundColor(AppColors.text)
                    Text(subtitle)
                        .font(AppTypography.small())
                        .foregroundColor(AppColors.textGray)
                }
                
                Spacer()
                
                Image(systemName: "chevron.right")
                    .font(.system(size: 14))
                    .foregroundColor(AppColors.textGray)
            }
            .padding(AppSpacing.lg)
            .background(Color.white)
            .cornerRadius(AppRadius.md)
            .overlay(
                RoundedRectangle(cornerRadius: AppRadius.md)
                    .stroke(borderColor, lineWidth: 2)
            )
        }
        .buttonStyle(.plain)
    }
    
    // MARK: - Helpers
    
    private func formField(label: String, placeholder: String, text: Binding<String>, keyboardType: UIKeyboardType = .default) -> some View {
        VStack(alignment: .leading, spacing: AppSpacing.xs) {
            Text(label)
                .font(AppTypography.caption())
                .fontWeight(.medium)
                .foregroundColor(AppColors.textMedium)
            
            TextField(placeholder, text: text)
                .font(AppTypography.body())
                .keyboardType(keyboardType)
                .autocapitalization(keyboardType == .emailAddress ? .none : .words)
                .padding(AppSpacing.md)
                .background(Color.white)
                .cornerRadius(AppRadius.md)
                .overlay(
                    RoundedRectangle(cornerRadius: AppRadius.md)
                        .stroke(Color(hex: "D1D5DB"), lineWidth: 1)
                )
        }
    }
    
    private func languagePicker(selection: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: AppSpacing.xs) {
            Text("Client Language")
                .font(AppTypography.caption())
                .fontWeight(.medium)
                .foregroundColor(AppColors.textMedium)
            
            Picker("Language", selection: selection) {
                Text("🇺🇸 English").tag("en")
                Text("🇲🇽 Español").tag("es")
            }
            .pickerStyle(.segmented)
        }
    }
    
    private func formatDate(_ dateString: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        
        if let date = formatter.date(from: dateString) {
            let displayFormatter = DateFormatter()
            displayFormatter.dateStyle = .medium
            return displayFormatter.string(from: date)
        }
        
        // Fallback
        let fallbackFormatter = ISO8601DateFormatter()
        fallbackFormatter.formatOptions = [.withInternetDateTime]
        if let date = fallbackFormatter.date(from: dateString) {
            let displayFormatter = DateFormatter()
            displayFormatter.dateStyle = .medium
            return displayFormatter.string(from: date)
        }
        
        return String(dateString.prefix(10))
    }
}
