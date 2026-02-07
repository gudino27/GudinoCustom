//
//  DesignManagementView.swift
//  GCWadmin
//
//  Design Management UI - matches webapp DesignViewer.js
//

import SwiftUI

struct DesignManagementView: View {
    @StateObject private var viewModel = DesignManagementViewModel()
    @State private var showDeleteConfirmation = false
    @State private var designToDelete: Design?
    @State private var showDeleteQuoteConfirmation = false
    @State private var quoteToDelete: QuickQuote?

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.lg) {
                // View type tabs
                viewTypeTabs

                // Content based on view type
                switch viewModel.viewType {
                case "designs":
                    designsSection
                case "quotes":
                    quotesSection
                default: // "all"
                    designsSection
                    quotesSection
                }
            }
            .padding(AppSpacing.lg)
        }
        .background(AppColors.background)
        .navigationTitle("Designs Manager")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.loadAll()
        }
        .sheet(isPresented: $viewModel.showingDetail) {
            if let detail = viewModel.selectedDesign {
                DesignDetailSheet(
                    detail: detail,
                    viewModel: viewModel,
                    onDismiss: { viewModel.showingDetail = false }
                )
            }
        }
        .sheet(isPresented: $viewModel.showingQuoteDetail) {
            if let quote = viewModel.selectedQuote {
                QuoteDetailSheet(
                    quote: quote,
                    viewModel: viewModel,
                    onDismiss: { viewModel.showingQuoteDetail = false }
                )
            }
        }
        .alert("Delete Design", isPresented: $showDeleteConfirmation, presenting: designToDelete) { design in
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive) {
                Task { await viewModel.deleteDesign(design) }
            }
        } message: { design in
            Text("Are you sure you want to delete the design from \(design.clientName)?")
        }
        .alert("Delete Quote", isPresented: $showDeleteQuoteConfirmation, presenting: quoteToDelete) { quote in
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive) {
                Task { await viewModel.deleteQuote(quote) }
            }
        } message: { quote in
            Text("Are you sure you want to delete the quote from \(quote.clientName)?")
        }
        .overlay(alignment: .top) {
            notificationOverlay
        }
    }

    // MARK: - View Type Tabs

    private var viewTypeTabs: some View {
        HStack(spacing: 0) {
            viewTypeTab("All", value: "all", count: viewModel.designs.count + viewModel.quickQuotes.count)
            viewTypeTab("3D Designs", value: "designs", count: viewModel.designs.count)
            viewTypeTab("Quick Quotes", value: "quotes", count: viewModel.quickQuotes.count)
        }
        .background(AppColors.gray200)
        .cornerRadius(8)
    }

    private func viewTypeTab(_ label: String, value: String, count: Int) -> some View {
        Button(action: { viewModel.viewType = value }) {
            VStack(spacing: 2) {
                Text(label)
                    .font(.caption)
                    .fontWeight(viewModel.viewType == value ? .semibold : .regular)
                Text("\(count)")
                    .font(.system(size: 11))
                    .foregroundColor(viewModel.viewType == value ? AppColors.blue : AppColors.textGray)
            }
            .foregroundColor(viewModel.viewType == value ? AppColors.text : AppColors.textGray)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(viewModel.viewType == value ? Color.white : Color.clear)
            .cornerRadius(8)
        }
    }

    // MARK: - Designs Section

    private var designsSection: some View {
        VStack(spacing: AppSpacing.md) {
            // Header
            HStack {
                HStack(spacing: 6) {
                    Image(systemName: "cube")
                        .font(.system(size: 14))
                        .foregroundColor(AppColors.blue)
                    Text("3D Designs")
                        .font(.headline)
                        .foregroundColor(AppColors.text)
                }
                Spacer()
                Text("\(viewModel.designs.count) total")
                    .font(.caption)
                    .foregroundColor(AppColors.textGray)
            }

            // Stats
            designStatsBar

            // Filter bar
            designFilterBar

            // List or empty
            if viewModel.isLoading && viewModel.designs.isEmpty {
                loadingState("Loading designs...")
            } else if viewModel.filteredDesigns.isEmpty {
                emptyState(icon: "doc.text", title: "No designs yet", subtitle: "Customer 3D designs will appear here when submitted.")
            } else {
                ForEach(viewModel.filteredDesigns) { design in
                    DesignCard(
                        design: design,
                        viewModel: viewModel,
                        onView: { Task { await viewModel.viewDesign(design) } },
                        onDelete: {
                            designToDelete = design
                            showDeleteConfirmation = true
                        },
                        onDownloadPDF: {
                            Task { _ = await viewModel.downloadPDF(design) }
                        }
                    )
                }
            }
        }
    }

    // MARK: - Quotes Section

    private var quotesSection: some View {
        VStack(spacing: AppSpacing.md) {
            // Header
            HStack {
                HStack(spacing: 6) {
                    Image(systemName: "text.bubble")
                        .font(.system(size: 14))
                        .foregroundColor(AppColors.successMedium)
                    Text("Quick Quote Requests")
                        .font(.headline)
                        .foregroundColor(AppColors.text)
                }
                Spacer()
                if viewModel.newQuoteCount > 0 {
                    Text("\(viewModel.newQuoteCount) new")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(AppColors.warning)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(AppColors.warningBg)
                        .cornerRadius(4)
                }
                Text("\(viewModel.quickQuotes.count) total")
                    .font(.caption)
                    .foregroundColor(AppColors.textGray)
            }

            // Quote filter bar
            quoteFilterBar

            // List or empty
            if viewModel.isLoading && viewModel.quickQuotes.isEmpty {
                loadingState("Loading quotes...")
            } else if viewModel.filteredQuotes.isEmpty {
                emptyState(icon: "text.bubble", title: "No quick quotes found", subtitle: "Quick quote requests will appear here when customers submit them.")
            } else {
                ForEach(viewModel.filteredQuotes) { quote in
                    QuoteCard(
                        quote: quote,
                        viewModel: viewModel,
                        onView: { Task { await viewModel.viewQuote(quote) } },
                        onDelete: {
                            quoteToDelete = quote
                            showDeleteQuoteConfirmation = true
                        }
                    )
                }
            }
        }
    }

    // MARK: - Design Stats

    private var designStatsBar: some View {
        HStack(spacing: 12) {
            statCard(title: "Total", value: "\(viewModel.designs.count)", icon: "doc.text", color: AppColors.blue)
            statCard(title: "New", value: "\(viewModel.newDesignCount)", icon: "exclamationmark.circle", color: AppColors.warningMedium)
            statCard(title: "Viewed", value: "\(viewModel.viewedDesignCount)", icon: "checkmark.circle", color: AppColors.successMedium)
        }
    }

    private func statCard(title: String, value: String, icon: String, color: Color) -> some View {
        VStack(spacing: 4) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 12))
                    .foregroundColor(color)
                Text(value)
                    .font(.title3)
                    .fontWeight(.bold)
                    .foregroundColor(AppColors.text)
            }
            Text(title)
                .font(.caption)
                .foregroundColor(AppColors.textGray)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(Color.white)
        .cornerRadius(8)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(AppColors.border, lineWidth: 1)
        )
    }

    // MARK: - Design Filter Bar

    private var designFilterBar: some View {
        HStack(spacing: 8) {
            filterChip("All", isSelected: viewModel.statusFilter == "all") { viewModel.statusFilter = "all" }
            filterChip("New", isSelected: viewModel.statusFilter == "new") { viewModel.statusFilter = "new" }
            filterChip("Viewed", isSelected: viewModel.statusFilter == "viewed") { viewModel.statusFilter = "viewed" }

            Spacer()

            Menu {
                Button(action: { viewModel.toggleSort("created_at") }) {
                    Label("Date", systemImage: viewModel.sortKey == "created_at"
                          ? (viewModel.sortAscending ? "chevron.up" : "chevron.down") : "minus")
                }
                Button(action: { viewModel.toggleSort("client_name") }) {
                    Label("Name", systemImage: viewModel.sortKey == "client_name"
                          ? (viewModel.sortAscending ? "chevron.up" : "chevron.down") : "minus")
                }
                Button(action: { viewModel.toggleSort("total_price") }) {
                    Label("Price", systemImage: viewModel.sortKey == "total_price"
                          ? (viewModel.sortAscending ? "chevron.up" : "chevron.down") : "minus")
                }
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "arrow.up.arrow.down")
                        .font(.system(size: 12))
                    Text("Sort")
                        .font(.caption)
                }
                .foregroundColor(AppColors.textMedium)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(AppColors.gray200)
                .cornerRadius(6)
            }
        }
    }

    // MARK: - Quote Filter Bar

    private var quoteFilterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                filterChip("All", isSelected: viewModel.quoteStatusFilter == "all") { viewModel.quoteStatusFilter = "all" }
                filterChip("New", isSelected: viewModel.quoteStatusFilter == "new") { viewModel.quoteStatusFilter = "new" }
                filterChip("Contacted", isSelected: viewModel.quoteStatusFilter == "contacted") { viewModel.quoteStatusFilter = "contacted" }
                filterChip("Quote Sent", isSelected: viewModel.quoteStatusFilter == "quote_sent") { viewModel.quoteStatusFilter = "quote_sent" }
                filterChip("Converted", isSelected: viewModel.quoteStatusFilter == "converted") { viewModel.quoteStatusFilter = "converted" }
                filterChip("Closed", isSelected: viewModel.quoteStatusFilter == "closed") { viewModel.quoteStatusFilter = "closed" }
            }
        }
    }

    // MARK: - Shared Helpers

    private func filterChip(_ label: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.caption)
                .fontWeight(isSelected ? .semibold : .regular)
                .foregroundColor(isSelected ? .white : AppColors.textMedium)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(isSelected ? AppColors.blue : AppColors.gray200)
                .cornerRadius(6)
        }
    }

    private func emptyState(icon: String, title: String, subtitle: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundColor(AppColors.gray400)
            Text(title)
                .font(.subheadline)
                .foregroundColor(AppColors.textGray)
            Text(subtitle)
                .font(.caption)
                .foregroundColor(AppColors.textLight)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 48)
        .background(AppColors.gray50)
        .cornerRadius(8)
    }

    private func loadingState(_ message: String) -> some View {
        VStack(spacing: 12) {
            ProgressView()
            Text(message)
                .font(.subheadline)
                .foregroundColor(AppColors.textGray)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 48)
    }

    // MARK: - Notification

    @ViewBuilder
    private var notificationOverlay: some View {
        if let msg = viewModel.successMessage {
            notificationBanner(msg, isError: false)
        } else if let msg = viewModel.errorMessage {
            notificationBanner(msg, isError: true)
        }
    }

    private func notificationBanner(_ message: String, isError: Bool) -> some View {
        Text(message)
            .font(.subheadline)
            .foregroundColor(.white)
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
            .background(isError ? AppColors.error : AppColors.success)
            .cornerRadius(8)
            .shadow(radius: 8)
            .padding(.top, 8)
            .transition(.move(edge: .top).combined(with: .opacity))
            .onAppear {
                DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                    withAnimation {
                        if isError {
                            viewModel.errorMessage = nil
                        } else {
                            viewModel.successMessage = nil
                        }
                    }
                }
            }
    }
}

// MARK: - Design Card

struct DesignCard: View {
    let design: Design
    @ObservedObject var viewModel: DesignManagementViewModel
    let onView: () -> Void
    let onDelete: () -> Void
    let onDownloadPDF: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                statusBadge

                VStack(alignment: .leading, spacing: 2) {
                    Text(design.clientName)
                        .font(.headline)
                        .foregroundColor(AppColors.text)

                    HStack(spacing: 12) {
                        if let email = design.clientEmail, !email.isEmpty {
                            HStack(spacing: 4) {
                                Image(systemName: "envelope").font(.system(size: 11))
                                Text(email).font(.caption).lineLimit(1)
                            }
                            .foregroundColor(AppColors.textGray)
                        }
                        if let phone = design.clientPhone, !phone.isEmpty {
                            HStack(spacing: 4) {
                                Image(systemName: "phone").font(.system(size: 11))
                                Text(phone).font(.caption)
                            }
                            .foregroundColor(AppColors.textGray)
                        }
                    }
                }

                Spacer()

                HStack(spacing: 4) {
                    Button(action: onView) {
                        Image(systemName: "eye").font(.system(size: 14))
                            .foregroundColor(AppColors.blue)
                            .frame(width: 32, height: 32)
                            .background(AppColors.infoBg).cornerRadius(6)
                    }
                    Button(action: onDownloadPDF) {
                        Image(systemName: "arrow.down.doc").font(.system(size: 14))
                            .foregroundColor(AppColors.successMedium)
                            .frame(width: 32, height: 32)
                            .background(AppColors.successBg).cornerRadius(6)
                    }
                    Button(action: onDelete) {
                        Image(systemName: "trash").font(.system(size: 14))
                            .foregroundColor(AppColors.error)
                            .frame(width: 32, height: 32)
                            .background(AppColors.errorBg).cornerRadius(6)
                    }
                }
            }

            HStack(spacing: 16) {
                HStack(spacing: 4) {
                    Image(systemName: "dollarsign.circle").font(.system(size: 12))
                    Text(design.formattedPrice).font(.subheadline).fontWeight(.semibold)
                }
                .foregroundColor(AppColors.text)

                Spacer()

                Text(viewModel.formatDate(design.createdAt))
                    .font(.caption)
                    .foregroundColor(AppColors.textGray)
            }

            // Note
            if viewModel.editingNoteId == design.id {
                noteEditor(text: $viewModel.editingNoteText,
                           onSave: { Task { await viewModel.saveNote() } },
                           onCancel: { viewModel.cancelEditingNote() },
                           isSaving: viewModel.isSaving)
            } else {
                noteRow(note: design.adminNote,
                        onEdit: { viewModel.startEditingNote(design) })
            }
        }
        .padding(16)
        .background(Color.white)
        .cornerRadius(8)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(design.status == "new" ? AppColors.warningBorder : AppColors.border, lineWidth: 1)
        )
    }

    private var statusBadge: some View {
        Text(design.statusLabel)
            .font(.system(size: 11, weight: .semibold))
            .foregroundColor(design.status == "new" ? AppColors.warning : AppColors.success)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(design.status == "new" ? AppColors.warningBg : AppColors.successBg)
            .cornerRadius(4)
    }
}

// MARK: - Quote Card

struct QuoteCard: View {
    let quote: QuickQuote
    @ObservedObject var viewModel: DesignManagementViewModel
    let onView: () -> Void
    let onDelete: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                // Status badge
                quoteStatusBadge

                VStack(alignment: .leading, spacing: 2) {
                    Text(quote.clientName)
                        .font(.headline)
                        .foregroundColor(AppColors.text)

                    HStack(spacing: 12) {
                        if let email = quote.clientEmail, !email.isEmpty {
                            HStack(spacing: 4) {
                                Image(systemName: "envelope").font(.system(size: 11))
                                Text(email).font(.caption).lineLimit(1)
                            }
                            .foregroundColor(AppColors.textGray)
                        }
                        if let phone = quote.clientPhone, !phone.isEmpty {
                            HStack(spacing: 4) {
                                Image(systemName: "phone").font(.system(size: 11))
                                Text(phone).font(.caption)
                            }
                            .foregroundColor(AppColors.textGray)
                        }
                    }
                }

                Spacer()

                HStack(spacing: 4) {
                    Button(action: onView) {
                        Image(systemName: "eye").font(.system(size: 14))
                            .foregroundColor(AppColors.blue)
                            .frame(width: 32, height: 32)
                            .background(AppColors.infoBg).cornerRadius(6)
                    }
                    Button(action: onDelete) {
                        Image(systemName: "trash").font(.system(size: 14))
                            .foregroundColor(AppColors.error)
                            .frame(width: 32, height: 32)
                            .background(AppColors.errorBg).cornerRadius(6)
                    }
                }
            }

            // Details row
            HStack(spacing: 12) {
                if let projectType = quote.projectType, !projectType.isEmpty {
                    HStack(spacing: 4) {
                        Image(systemName: "hammer").font(.system(size: 11))
                        Text(quote.projectTypeLabel).font(.caption)
                    }
                    .foregroundColor(AppColors.blue)
                }

                Text(quote.budgetRangeLabel)
                    .font(.caption)
                    .foregroundColor(AppColors.textMedium)

                Spacer()

                // Status dropdown
                Menu {
                    Button("New") { Task { await viewModel.updateQuoteStatus(quote, to: "new") } }
                    Button("Contacted") { Task { await viewModel.updateQuoteStatus(quote, to: "contacted") } }
                    Button("Quote Sent") { Task { await viewModel.updateQuoteStatus(quote, to: "quote_sent") } }
                    Button("Converted") { Task { await viewModel.updateQuoteStatus(quote, to: "converted") } }
                    Button("Closed") { Task { await viewModel.updateQuoteStatus(quote, to: "closed") } }
                } label: {
                    HStack(spacing: 4) {
                        Text(quote.statusLabel).font(.system(size: 11))
                        Image(systemName: "chevron.down").font(.system(size: 8))
                    }
                    .foregroundColor(AppColors.textMedium)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(AppColors.gray50)
                    .cornerRadius(4)
                    .overlay(
                        RoundedRectangle(cornerRadius: 4)
                            .stroke(AppColors.border, lineWidth: 1)
                    )
                }

                Text(viewModel.formatDate(quote.submittedAt))
                    .font(.caption)
                    .foregroundColor(AppColors.textGray)
            }

            // Message preview
            if let message = quote.message, !message.isEmpty {
                Text(message)
                    .font(.caption)
                    .foregroundColor(AppColors.textMedium)
                    .lineLimit(2)
            }

            // Note
            if viewModel.editingQuoteNoteId == quote.id {
                noteEditor(text: $viewModel.editingQuoteNoteText,
                           onSave: { Task { await viewModel.saveQuoteNote() } },
                           onCancel: { viewModel.cancelEditingQuoteNote() },
                           isSaving: viewModel.isSaving)
            } else {
                noteRow(note: quote.internalNotes,
                        onEdit: { viewModel.startEditingQuoteNote(quote) })
            }
        }
        .padding(16)
        .background(Color.white)
        .cornerRadius(8)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(quote.status == "new" ? AppColors.successBorder : AppColors.border, lineWidth: 1)
        )
    }

    private var quoteStatusBadge: some View {
        let color: Color = {
            switch quote.status {
            case "new": return AppColors.successMedium
            case "contacted": return AppColors.blue
            case "quote_sent": return AppColors.warningMedium
            case "converted": return AppColors.successMedium
            case "closed": return AppColors.gray500
            default: return AppColors.textGray
            }
        }()

        let bgColor: Color = {
            switch quote.status {
            case "new": return AppColors.successBg
            case "contacted": return AppColors.infoBg
            case "quote_sent": return AppColors.warningBg
            case "converted": return AppColors.successBg
            case "closed": return AppColors.gray50
            default: return AppColors.gray50
            }
        }()

        return Text(quote.statusLabel)
            .font(.system(size: 11, weight: .semibold))
            .foregroundColor(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(bgColor)
            .cornerRadius(4)
    }
}

// MARK: - Shared Note Components

private func noteRow(note: String?, onEdit: @escaping () -> Void) -> some View {
    HStack {
        if let note = note, !note.isEmpty {
            HStack(spacing: 4) {
                Image(systemName: "note.text").font(.system(size: 11))
                Text(note).font(.caption).foregroundColor(AppColors.textMedium).lineLimit(1)
            }
        }
        Spacer()
        Button(action: onEdit) {
            HStack(spacing: 2) {
                Image(systemName: "pencil").font(.system(size: 11))
                Text(note?.isEmpty != false ? "Add Note" : "Edit").font(.caption)
            }
            .foregroundColor(AppColors.blue)
        }
    }
}

private func noteEditor(text: Binding<String>, onSave: @escaping () -> Void, onCancel: @escaping () -> Void, isSaving: Bool) -> some View {
    VStack(spacing: 8) {
        TextField("Note...", text: text)
            .font(.subheadline)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color.white)
            .cornerRadius(6)
            .overlay(
                RoundedRectangle(cornerRadius: 6)
                    .stroke(AppColors.blue.opacity(0.5), lineWidth: 1)
            )

        HStack(spacing: 8) {
            Button(action: onSave) {
                Text("Save").font(.caption).fontWeight(.medium)
                    .foregroundColor(.white)
                    .padding(.horizontal, 12).padding(.vertical, 6)
                    .background(AppColors.blue).cornerRadius(6)
            }
            .disabled(isSaving)

            Button(action: onCancel) {
                Text("Cancel").font(.caption)
                    .foregroundColor(AppColors.textGray)
                    .padding(.horizontal, 12).padding(.vertical, 6)
                    .background(AppColors.gray200).cornerRadius(6)
            }
        }
    }
}

// MARK: - Quote Detail Sheet

struct QuoteDetailSheet: View {
    let quote: QuickQuote
    @ObservedObject var viewModel: DesignManagementViewModel
    let onDismiss: () -> Void

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: AppSpacing.lg) {
                    clientInfoSection
                    projectDetailsSection

                    if let message = quote.message, !message.isEmpty {
                        messageSection(message)
                    }

                    if !quote.photoList.isEmpty {
                        photosSection
                    }

                    if let notes = quote.internalNotes, !notes.isEmpty {
                        notesSection(notes)
                    }
                }
                .padding(AppSpacing.lg)
            }
            .background(AppColors.background)
            .navigationTitle("Quote Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { onDismiss() }
                }
            }
        }
    }

    private var clientInfoSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Client Information", icon: "person")

            VStack(alignment: .leading, spacing: 8) {
                infoRow("Name", value: quote.clientName)

                if let email = quote.clientEmail, !email.isEmpty {
                    infoRow("Email", value: email, icon: "envelope")
                }
                if let phone = quote.clientPhone, !phone.isEmpty {
                    infoRow("Phone", value: phone, icon: "phone")
                }
                if let lang = quote.clientLanguage, !lang.isEmpty {
                    infoRow("Language", value: lang == "es" ? "Spanish" : "English", icon: "globe")
                }
                infoRow("Submitted", value: viewModel.formatDate(quote.submittedAt), icon: "calendar")

                // Status
                HStack(spacing: 8) {
                    Text("Status:")
                        .font(.subheadline)
                        .foregroundColor(AppColors.textGray)

                    Menu {
                        Button("New") { Task { await viewModel.updateQuoteStatus(quote, to: "new") } }
                        Button("Contacted") { Task { await viewModel.updateQuoteStatus(quote, to: "contacted") } }
                        Button("Quote Sent") { Task { await viewModel.updateQuoteStatus(quote, to: "quote_sent") } }
                        Button("Converted") { Task { await viewModel.updateQuoteStatus(quote, to: "converted") } }
                        Button("Closed") { Task { await viewModel.updateQuoteStatus(quote, to: "closed") } }
                    } label: {
                        HStack(spacing: 4) {
                            Text(quote.statusLabel)
                                .font(.subheadline).fontWeight(.medium)
                            Image(systemName: "chevron.down").font(.system(size: 10))
                        }
                        .foregroundColor(AppColors.text)
                        .padding(.horizontal, 10).padding(.vertical, 6)
                        .background(AppColors.gray50).cornerRadius(6)
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(AppColors.border, lineWidth: 1))
                    }
                }
            }
        }
        .padding(16).background(Color.white).cornerRadius(8)
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppColors.border, lineWidth: 1))
    }

    private var projectDetailsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Project Details", icon: "hammer")

            VStack(alignment: .leading, spacing: 8) {
                infoRow("Project Type", value: quote.projectTypeLabel, icon: "wrench.and.screwdriver")
                infoRow("Budget Range", value: quote.budgetRangeLabel, icon: "dollarsign.circle")

                if let dimensions = quote.roomDimensions, !dimensions.isEmpty {
                    infoRow("Room Dimensions", value: dimensions, icon: "ruler")
                }
                if let materials = quote.preferredMaterials, !materials.isEmpty {
                    infoRow("Materials", value: materials, icon: "square.stack.3d.up")
                }
                if let colors = quote.preferredColors, !colors.isEmpty {
                    infoRow("Colors", value: colors, icon: "paintpalette")
                }
            }
        }
        .padding(16).background(Color.white).cornerRadius(8)
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppColors.border, lineWidth: 1))
    }

    private func messageSection(_ message: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionHeader("Customer Message", icon: "text.bubble")
            Text(message)
                .font(.subheadline)
                .foregroundColor(AppColors.textMedium)
        }
        .padding(16).background(Color.white).cornerRadius(8)
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppColors.border, lineWidth: 1))
    }

    private var photosSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionHeader("Inspiration Photos", icon: "photo")

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(quote.photoList, id: \.self) { photo in
                        AsyncImage(url: URL(string: "\(APIConfig.baseURL)/uploads/quick-quote-photos/\(photo)")) { phase in
                            switch phase {
                            case .success(let image):
                                image.resizable().aspectRatio(contentMode: .fill)
                                    .frame(width: 120, height: 90)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                            case .failure:
                                RoundedRectangle(cornerRadius: 8).fill(AppColors.gray200)
                                    .frame(width: 120, height: 90)
                                    .overlay(Image(systemName: "photo").foregroundColor(AppColors.gray400))
                            default:
                                RoundedRectangle(cornerRadius: 8).fill(AppColors.gray100)
                                    .frame(width: 120, height: 90)
                                    .overlay(ProgressView())
                            }
                        }
                    }
                }
            }
        }
        .padding(16).background(Color.white).cornerRadius(8)
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppColors.border, lineWidth: 1))
    }

    private func notesSection(_ notes: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionHeader("Internal Notes", icon: "note.text")
            Text(notes)
                .font(.subheadline)
                .foregroundColor(AppColors.textMedium)
        }
        .padding(16).background(AppColors.warningBg).cornerRadius(8)
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppColors.warningBorder, lineWidth: 1))
    }

    private func sectionHeader(_ title: String, icon: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon).font(.system(size: 14)).foregroundColor(AppColors.blue)
            Text(title).font(.headline).foregroundColor(AppColors.text)
        }
    }

    private func infoRow(_ label: String, value: String, icon: String? = nil) -> some View {
        HStack(spacing: 8) {
            if let icon = icon {
                Image(systemName: icon).font(.system(size: 12))
                    .foregroundColor(AppColors.textGray).frame(width: 16)
            }
            Text(label + ":").font(.subheadline).foregroundColor(AppColors.textGray)
            Text(value).font(.subheadline).foregroundColor(AppColors.text)
            Spacer()
        }
    }
}

// MARK: - Design Detail Sheet

struct DesignDetailSheet: View {
    let detail: DesignDetail
    @ObservedObject var viewModel: DesignManagementViewModel
    let onDismiss: () -> Void

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: AppSpacing.lg) {
                    clientInfoSection
                    designSummarySection

                    // Design Preview (Floor Plan / Wall Views)
                    if detail.includeKitchen == true || detail.includeBathroom == true {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack(spacing: 8) {
                                Image(systemName: "cube").font(.system(size: 14)).foregroundColor(AppColors.blue)
                                Text("Design Preview").font(.headline).foregroundColor(AppColors.text)
                            }
                            DesignPreviewView(detail: detail)
                        }
                        .padding(16).background(Color.white).cornerRadius(8)
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppColors.border, lineWidth: 1))
                    }

                    if detail.includeKitchen == true {
                        roomSection(title: "Kitchen", icon: "fork.knife", elementCount: detail.parsedKitchenElements)
                    }
                    if detail.includeBathroom == true {
                        roomSection(title: "Bathroom", icon: "shower", elementCount: detail.parsedBathroomElements)
                    }
                    if let comments = detail.comments, !comments.isEmpty {
                        commentsSection(comments)
                    }
                    if let note = detail.adminNote, !note.isEmpty {
                        adminNoteSection(note)
                    }
                }
                .padding(AppSpacing.lg)
            }
            .background(AppColors.background)
            .navigationTitle("Design Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { onDismiss() }
                }
            }
        }
    }

    private var clientInfoSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Client Information", icon: "person")
            VStack(alignment: .leading, spacing: 8) {
                infoRow("Name", value: detail.clientName)
                if let email = detail.clientEmail, !email.isEmpty {
                    infoRow("Email", value: email, icon: "envelope")
                }
                if let phone = detail.clientPhone, !phone.isEmpty {
                    infoRow("Phone", value: phone, icon: "phone")
                }
                infoRow("Preferred Contact", value: detail.contactPreference.capitalized, icon: "hand.point.right")
                infoRow("Submitted", value: viewModel.formatDate(detail.createdAt), icon: "calendar")
                if let viewedAt = detail.viewedAt {
                    infoRow("Viewed", value: viewModel.formatDate(viewedAt), icon: "eye")
                }
                if let viewedBy = detail.viewedBy, !viewedBy.isEmpty {
                    infoRow("Viewed By", value: viewedBy, icon: "person.badge.clock")
                }
            }
        }
        .padding(16).background(Color.white).cornerRadius(8)
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppColors.border, lineWidth: 1))
    }

    private var designSummarySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Design Summary", icon: "doc.text")

            HStack(spacing: 24) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Total Estimate").font(.caption).foregroundColor(AppColors.textGray)
                    Text(detail.formattedPrice).font(.title2).fontWeight(.bold).foregroundColor(AppColors.text)
                }
                Divider().frame(height: 40)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Rooms").font(.caption).foregroundColor(AppColors.textGray)
                    Text(detail.roomsSummary).font(.subheadline).fontWeight(.medium).foregroundColor(AppColors.text)
                }
            }

            HStack(spacing: 8) {
                Text("Status:").font(.subheadline).foregroundColor(AppColors.textGray)
                Menu {
                    Button("New") { Task { await updateDetailStatus("new") } }
                    Button("Viewed") { Task { await updateDetailStatus("viewed") } }
                } label: {
                    HStack(spacing: 4) {
                        Circle().fill(detail.status == "new" ? AppColors.warningMedium : AppColors.successMedium).frame(width: 8, height: 8)
                        Text(detail.status.capitalized).font(.subheadline).fontWeight(.medium)
                        Image(systemName: "chevron.down").font(.system(size: 10))
                    }
                    .foregroundColor(AppColors.text)
                    .padding(.horizontal, 10).padding(.vertical, 6)
                    .background(AppColors.gray50).cornerRadius(6)
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(AppColors.border, lineWidth: 1))
                }
            }
        }
        .padding(16).background(Color.white).cornerRadius(8)
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppColors.border, lineWidth: 1))
    }

    private func roomSection(title: String, icon: String, elementCount: Int) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionHeader(title, icon: icon)
            HStack {
                Text("Cabinet Elements:").font(.subheadline).foregroundColor(AppColors.textGray)
                Text("\(elementCount)").font(.subheadline).fontWeight(.medium).foregroundColor(AppColors.text)
            }
        }
        .padding(16).background(Color.white).cornerRadius(8)
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppColors.border, lineWidth: 1))
    }

    private func commentsSection(_ comments: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionHeader("Customer Notes", icon: "text.bubble")
            Text(comments).font(.subheadline).foregroundColor(AppColors.textMedium)
        }
        .padding(16).background(Color.white).cornerRadius(8)
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppColors.border, lineWidth: 1))
    }

    private func adminNoteSection(_ note: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionHeader("Admin Note", icon: "note.text")
            Text(note).font(.subheadline).foregroundColor(AppColors.textMedium)
        }
        .padding(16).background(AppColors.warningBg).cornerRadius(8)
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppColors.warningBorder, lineWidth: 1))
    }

    private func sectionHeader(_ title: String, icon: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon).font(.system(size: 14)).foregroundColor(AppColors.blue)
            Text(title).font(.headline).foregroundColor(AppColors.text)
        }
    }

    private func infoRow(_ label: String, value: String, icon: String? = nil) -> some View {
        HStack(spacing: 8) {
            if let icon = icon {
                Image(systemName: icon).font(.system(size: 12))
                    .foregroundColor(AppColors.textGray).frame(width: 16)
            }
            Text(label + ":").font(.subheadline).foregroundColor(AppColors.textGray)
            Text(value).font(.subheadline).foregroundColor(AppColors.text)
            Spacer()
        }
    }

    private func updateDetailStatus(_ status: String) async {
        let tempDesign = Design(
            id: detail.id, clientName: detail.clientName, clientEmail: detail.clientEmail,
            clientPhone: detail.clientPhone, contactPreference: detail.contactPreference,
            totalPrice: detail.totalPrice, status: detail.status, createdAt: detail.createdAt,
            viewedAt: detail.viewedAt, viewedBy: detail.viewedBy, adminNote: detail.adminNote,
            includeKitchen: detail.includeKitchen, includeBathroom: detail.includeBathroom
        )
        await viewModel.updateDesignStatus(tempDesign, to: status)
    }
}

#Preview {
    NavigationStack {
        DesignManagementView()
    }
}
