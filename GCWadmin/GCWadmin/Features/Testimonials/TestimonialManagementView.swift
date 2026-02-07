//
//  TestimonialManagementView.swift
//  GCWadmin
//
//  Testimonial Management UI - Testimonials, Send Link, Tokens, Analytics
//

import SwiftUI

struct TestimonialManagementView: View {
    @StateObject private var viewModel = TestimonialManagementViewModel()
    @State private var selectedTab = "testimonials"
    @State private var showDeleteConfirmation = false
    @State private var testimonialToDelete: Testimonial?
    @State private var showDeleteTokenConfirmation = false
    @State private var tokenToDelete: TestimonialToken?

    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.lg) {
                // Tab bar
                tabBar

                // Content based on tab
                switch selectedTab {
                case "testimonials":
                    testimonialsSection
                case "send":
                    sendLinkSection
                case "tokens":
                    tokensSection
                case "analytics":
                    analyticsSection
                default:
                    testimonialsSection
                }
            }
            .padding(AppSpacing.lg)
        }
        .background(AppColors.background)
        .navigationTitle("Testimonials")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.loadAll()
        }
        .sheet(isPresented: $viewModel.showingTestimonialDetail) {
            if let testimonial = viewModel.selectedTestimonial {
                TestimonialDetailSheet(
                    testimonial: testimonial,
                    viewModel: viewModel,
                    onDismiss: { viewModel.showingTestimonialDetail = false }
                )
            }
        }
        .alert("Delete Testimonial", isPresented: $showDeleteConfirmation, presenting: testimonialToDelete) { testimonial in
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive) {
                Task { await viewModel.deleteTestimonial(testimonial) }
            }
        } message: { testimonial in
            Text("Are you sure you want to delete the testimonial from \(testimonial.clientName)?")
        }
        .alert("Delete Token", isPresented: $showDeleteTokenConfirmation, presenting: tokenToDelete) { token in
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive) {
                Task { await viewModel.deleteToken(token) }
            }
        } message: { token in
            Text("Are you sure you want to delete the token for \(token.clientName)?")
        }
        .overlay(alignment: .top) {
            notificationOverlay
        }
    }

    // MARK: - Tab Bar

    private var tabBar: some View {
        HStack(spacing: 0) {
            tabButton("Reviews", value: "testimonials", icon: "star.fill", count: viewModel.testimonials.count)
            tabButton("Send\nLink", value: "send", icon: "paperplane.fill", count: nil)
            tabButton("Tokens", value: "tokens", icon: "link", count: viewModel.tokens.count)
            tabButton("Stats", value: "analytics", icon: "chart.bar.fill", count: nil)
        }
        .background(AppColors.gray200)
        .cornerRadius(8)
    }

    private func tabButton(_ label: String, value: String, icon: String, count: Int?) -> some View {
        Button(action: { selectedTab = value }) {
            VStack(spacing: 3) {
                Image(systemName: icon)
                    .font(.system(size: 16))

                Text(label)
                    .font(.system(size: 11))
                    .fontWeight(selectedTab == value ? .semibold : .regular)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)

                if let count = count {
                    Text("\(count)")
                        .font(.system(size: 11))
                        .foregroundColor(selectedTab == value ? AppColors.blue : AppColors.textGray)
                }
            }
            .foregroundColor(selectedTab == value ? AppColors.text : AppColors.textGray)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .background(selectedTab == value ? Color.white : Color.clear)
            .cornerRadius(8)
        }
    }

    // MARK: - Testimonials Section

    private var testimonialsSection: some View {
        VStack(spacing: AppSpacing.md) {
            // Header
            HStack {
                HStack(spacing: 6) {
                    Image(systemName: "star.fill")
                        .font(.system(size: 16))
                        .foregroundColor(AppColors.warningMedium)
                    Text("Received Testimonials")
                        .font(.headline)
                        .foregroundColor(AppColors.text)
                }
                Spacer()
                Text("\(viewModel.visibleCount) visible")
                    .font(.subheadline)
                    .foregroundColor(AppColors.textGray)
            }

            // List or empty
            if viewModel.isLoading && viewModel.testimonials.isEmpty {
                loadingState("Loading testimonials...")
            } else if viewModel.testimonials.isEmpty {
                emptyState(
                    icon: "star",
                    title: "No testimonials yet",
                    subtitle: "Send testimonial links to clients to start collecting reviews."
                )
            } else {
                ForEach(viewModel.testimonials) { testimonial in
                    TestimonialCard(
                        testimonial: testimonial,
                        viewModel: viewModel,
                        onView: {
                            viewModel.selectedTestimonial = testimonial
                            viewModel.showingTestimonialDetail = true
                        },
                        onToggleVisibility: {
                            Task { await viewModel.toggleVisibility(testimonial) }
                        },
                        onDelete: {
                            testimonialToDelete = testimonial
                            showDeleteConfirmation = true
                        }
                    )
                }
            }
        }
    }

    // MARK: - Send Link Section

    private var sendLinkSection: some View {
        VStack(spacing: AppSpacing.md) {
            // Header
            HStack(spacing: 6) {
                Image(systemName: "paperplane.fill")
                    .font(.system(size: 16))
                    .foregroundColor(AppColors.blue)
                Text("Send Testimonial Request")
                    .font(.headline)
                    .foregroundColor(AppColors.text)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            GlassCard(padding: AppSpacing.lg) {
                VStack(spacing: AppSpacing.base) {
                    // Client Name
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Client Name *")
                            .font(.subheadline)
                            .foregroundColor(AppColors.textGray)
                        TextField("Full name", text: $viewModel.linkClientName)
                            .font(.body)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                            .background(Color.white)
                            .cornerRadius(6)
                            .overlay(
                                RoundedRectangle(cornerRadius: 6)
                                    .stroke(AppColors.border, lineWidth: 1)
                            )
                    }

                    // Client Email
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Client Email *")
                            .font(.subheadline)
                            .foregroundColor(AppColors.textGray)
                        TextField("email@example.com", text: $viewModel.linkClientEmail)
                            .font(.body)
                            .keyboardType(.emailAddress)
                            .autocapitalization(.none)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                            .background(Color.white)
                            .cornerRadius(6)
                            .overlay(
                                RoundedRectangle(cornerRadius: 6)
                                    .stroke(AppColors.border, lineWidth: 1)
                            )
                    }

                    // Client Phone
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Client Phone")
                            .font(.subheadline)
                            .foregroundColor(AppColors.textGray)
                        TextField("(555) 555-5555", text: $viewModel.linkClientPhone)
                            .font(.body)
                            .keyboardType(.phonePad)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                            .background(Color.white)
                            .cornerRadius(6)
                            .overlay(
                                RoundedRectangle(cornerRadius: 6)
                                    .stroke(AppColors.border, lineWidth: 1)
                            )
                    }

                    // Project Type
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Project Type")
                            .font(.subheadline)
                            .foregroundColor(AppColors.textGray)
                        Menu {
                            Button("None") { viewModel.linkProjectType = "" }
                            Button("Kitchen Remodeling") { viewModel.linkProjectType = "Kitchen Remodeling" }
                            Button("Bathroom Remodeling") { viewModel.linkProjectType = "Bathroom Remodeling" }
                            Button("Cabinet Installation") { viewModel.linkProjectType = "Cabinet Installation" }
                            Button("Custom Woodwork") { viewModel.linkProjectType = "Custom Woodwork" }
                            Button("Other") { viewModel.linkProjectType = "Other" }
                        } label: {
                            HStack {
                                Text(viewModel.linkProjectType.isEmpty ? "Select project type" : viewModel.linkProjectType)
                                    .font(.body)
                                    .foregroundColor(viewModel.linkProjectType.isEmpty ? AppColors.textLight : AppColors.text)
                                Spacer()
                                Image(systemName: "chevron.down")
                                    .font(.system(size: 15))
                                    .foregroundColor(AppColors.textGray)
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                            .background(Color.white)
                            .cornerRadius(6)
                            .overlay(
                                RoundedRectangle(cornerRadius: 6)
                                    .stroke(AppColors.border, lineWidth: 1)
                            )
                        }
                    }

                    // Custom project type field
                    if viewModel.linkProjectType == "Other" {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Specify Project Type")
                                .font(.subheadline)
                                .foregroundColor(AppColors.textGray)
                            TextField("Describe the project type", text: $viewModel.linkCustomProjectType)
                                .font(.body)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 10)
                                .background(Color.white)
                                .cornerRadius(6)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 6)
                                        .stroke(AppColors.border, lineWidth: 1)
                                )
                        }
                    }

                    // Send Via
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Send Via")
                            .font(.subheadline)
                            .foregroundColor(AppColors.textGray)
                        HStack(spacing: 8) {
                            sendViaButton("Email", value: "email", icon: "envelope.fill")
                            sendViaButton("SMS", value: "sms", icon: "message.fill")
                            sendViaButton("Both", value: "both", icon: "paperplane.fill")
                        }
                    }

                    // Send Button
                    Button(action: { Task { await viewModel.sendLink() } }) {
                        HStack(spacing: 8) {
                            if viewModel.isSaving {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                    .scaleEffect(0.8)
                            }
                            Image(systemName: "paperplane.fill")
                                .font(.system(size: 16))
                            Text("Send Testimonial Link")
                                .font(.body)
                                .fontWeight(.semibold)
                        }
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(viewModel.isSaving ? AppColors.gray400 : AppColors.blue)
                        .cornerRadius(8)
                    }
                    .disabled(viewModel.isSaving)
                }
            }
        }
    }

    private func sendViaButton(_ label: String, value: String, icon: String) -> some View {
        Button(action: { viewModel.linkSendVia = value }) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 14))
                Text(label)
                    .font(.subheadline)
                    .fontWeight(viewModel.linkSendVia == value ? .semibold : .regular)
            }
            .foregroundColor(viewModel.linkSendVia == value ? .white : AppColors.textMedium)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .background(viewModel.linkSendVia == value ? AppColors.blue : AppColors.gray200)
            .cornerRadius(6)
        }
    }

    // MARK: - Tokens Section

    private var tokensSection: some View {
        VStack(spacing: AppSpacing.md) {
            // Header
            HStack {
                HStack(spacing: 6) {
                    Image(systemName: "link")
                        .font(.system(size: 16))
                        .foregroundColor(AppColors.blue)
                    Text("Testimonial Tokens")
                        .font(.headline)
                        .foregroundColor(AppColors.text)
                }
                Spacer()
                Text("\(viewModel.tokens.count) total")
                    .font(.subheadline)
                    .foregroundColor(AppColors.textGray)
            }

            // Status filter
            tokenStatusFilter

            // List or empty
            if viewModel.isLoading && viewModel.tokens.isEmpty {
                loadingState("Loading tokens...")
            } else if viewModel.filteredTokens.isEmpty {
                emptyState(
                    icon: "link",
                    title: "No tokens found",
                    subtitle: "Tokens will appear here after sending testimonial links."
                )
            } else {
                ForEach(viewModel.filteredTokens) { token in
                    TokenCard(
                        token: token,
                        viewModel: viewModel,
                        isExpanded: viewModel.expandedTokenId == token.token,
                        onToggleExpand: {
                            if viewModel.expandedTokenId == token.token {
                                viewModel.expandedTokenId = nil
                            } else {
                                viewModel.expandedTokenId = token.token
                                Task { await viewModel.loadTracking(for: token.token) }
                            }
                        },
                        onDelete: {
                            tokenToDelete = token
                            showDeleteTokenConfirmation = true
                        }
                    )
                }
            }
        }
    }

    private var tokenStatusFilter: some View {
        HStack(spacing: 8) {
            filterChip("All", isSelected: viewModel.statusFilter == "all") { viewModel.statusFilter = "all" }
            filterChip("Sent", isSelected: viewModel.statusFilter == "sent") { viewModel.statusFilter = "sent" }
            filterChip("Opened", isSelected: viewModel.statusFilter == "opened") { viewModel.statusFilter = "opened" }
            filterChip("Submitted", isSelected: viewModel.statusFilter == "submitted") { viewModel.statusFilter = "submitted" }
            Spacer()
        }
    }

    // MARK: - Analytics Section

    private var analyticsSection: some View {
        VStack(spacing: AppSpacing.md) {
            // Header
            HStack(spacing: 6) {
                Image(systemName: "chart.bar.fill")
                    .font(.system(size: 16))
                    .foregroundColor(AppColors.blue)
                Text("Testimonial Analytics")
                    .font(.headline)
                    .foregroundColor(AppColors.text)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if viewModel.isLoading && viewModel.analytics == nil {
                loadingState("Loading analytics...")
            } else if let analytics = viewModel.analytics {
                // Summary cards
                HStack(spacing: 12) {
                    statCard(
                        title: "Total",
                        value: "\(analytics.submissions?.total ?? 0)",
                        icon: "star.fill",
                        color: AppColors.blue
                    )
                    statCard(
                        title: "Avg Rating",
                        value: String(format: "%.1f", analytics.submissions?.averageRating ?? 0),
                        icon: "star.leadinghalf.filled",
                        color: AppColors.warningMedium
                    )
                    statCard(
                        title: "Visible",
                        value: "\(analytics.submissions?.visible ?? 0)",
                        icon: "eye.fill",
                        color: AppColors.successMedium
                    )
                }

                // Link activity
                if let linkActivity = analytics.linkActivity {
                    GlassCard(padding: AppSpacing.base) {
                        VStack(alignment: .leading, spacing: AppSpacing.sm) {
                            HStack(spacing: 6) {
                                Image(systemName: "link")
                                    .font(.system(size: 15))
                                    .foregroundColor(AppColors.blue)
                                Text("Link Activity")
                                    .font(.body)
                                    .fontWeight(.semibold)
                                    .foregroundColor(AppColors.text)
                            }

                            HStack(spacing: AppSpacing.lg) {
                                analyticsRow("Sent", value: "\(linkActivity.totalSent ?? 0)")
                                analyticsRow("Opened", value: "\(linkActivity.totalOpened ?? 0)")
                                analyticsRow("Submitted", value: "\(linkActivity.totalSubmitted ?? 0)")
                            }

                            if let rate = linkActivity.conversionRate {
                                HStack {
                                    Text("Conversion Rate:")
                                        .font(.subheadline)
                                        .foregroundColor(AppColors.textGray)
                                    Text(String(format: "%.1f%%", rate))
                                        .font(.subheadline)
                                        .fontWeight(.semibold)
                                        .foregroundColor(AppColors.successMedium)
                                }
                            }
                        }
                    }
                }

                // Rating distribution
                if let ratings = analytics.ratingDistribution, !ratings.isEmpty {
                    GlassCard(padding: AppSpacing.base) {
                        VStack(alignment: .leading, spacing: AppSpacing.sm) {
                            HStack(spacing: 6) {
                                Image(systemName: "chart.bar.fill")
                                    .font(.system(size: 15))
                                    .foregroundColor(AppColors.warningMedium)
                                Text("Rating Distribution")
                                    .font(.body)
                                    .fontWeight(.semibold)
                                    .foregroundColor(AppColors.text)
                            }

                            ForEach(ratings.sorted(by: { ($0.rating ?? 0) > ($1.rating ?? 0) })) { bucket in
                                HStack(spacing: 8) {
                                    Text(String(repeating: "\u{2605}", count: bucket.rating ?? 0))
                                        .font(.system(size: 15))
                                        .foregroundColor(AppColors.warningMedium)
                                        .frame(width: 70, alignment: .leading)
                                    GeometryReader { geo in
                                        let maxCount = ratings.map { $0.count ?? 0 }.max() ?? 1
                                        let width = maxCount > 0 ? (CGFloat(bucket.count ?? 0) / CGFloat(maxCount)) * geo.size.width : 0
                                        RoundedRectangle(cornerRadius: 3)
                                            .fill(AppColors.warningMedium)
                                            .frame(width: max(width, 2), height: 16)
                                    }
                                    .frame(height: 16)
                                    Text("\(bucket.count ?? 0)")
                                        .font(.subheadline)
                                        .foregroundColor(AppColors.textGray)
                                        .frame(width: 30, alignment: .trailing)
                                }
                            }
                        }
                    }
                }

                // Project types
                if let types = analytics.projectTypes, !types.isEmpty {
                    GlassCard(padding: AppSpacing.base) {
                        VStack(alignment: .leading, spacing: AppSpacing.sm) {
                            HStack(spacing: 6) {
                                Image(systemName: "hammer.fill")
                                    .font(.system(size: 15))
                                    .foregroundColor(AppColors.blue)
                                Text("By Project Type")
                                    .font(.body)
                                    .fontWeight(.semibold)
                                    .foregroundColor(AppColors.text)
                            }

                            ForEach(types) { typeStat in
                                HStack {
                                    Text(typeStat.projectType ?? "Unknown")
                                        .font(.subheadline)
                                        .foregroundColor(AppColors.textMedium)
                                    Spacer()
                                    Text("\(typeStat.count ?? 0)")
                                        .font(.subheadline)
                                        .fontWeight(.semibold)
                                        .foregroundColor(AppColors.text)
                                }
                            }
                        }
                    }
                }
            } else {
                emptyState(
                    icon: "chart.bar",
                    title: "No analytics data",
                    subtitle: "Analytics will appear once you start collecting testimonials."
                )
            }
        }
    }

    private func analyticsRow(_ label: String, value: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.body)
                .fontWeight(.bold)
                .foregroundColor(AppColors.text)
            Text(label)
                .font(.system(size: 14))
                .foregroundColor(AppColors.textGray)
        }
    }

    // MARK: - Shared Helpers

    private func filterChip(_ label: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.subheadline)
                .fontWeight(isSelected ? .semibold : .regular)
                .foregroundColor(isSelected ? .white : AppColors.textMedium)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(isSelected ? AppColors.blue : AppColors.gray200)
                .cornerRadius(6)
        }
    }

    private func statCard(title: String, value: String, icon: String, color: Color) -> some View {
        VStack(spacing: 4) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 15))
                    .foregroundColor(color)
                Text(value)
                    .font(.title3)
                    .fontWeight(.bold)
                    .foregroundColor(AppColors.text)
            }
            Text(title)
                .font(.subheadline)
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

    private func emptyState(icon: String, title: String, subtitle: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundColor(AppColors.gray400)
            Text(title)
                .font(.body)
                .foregroundColor(AppColors.textGray)
            Text(subtitle)
                .font(.subheadline)
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
                .font(.body)
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
            .font(.body)
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

// MARK: - Testimonial Card

struct TestimonialCard: View {
    let testimonial: Testimonial
    @ObservedObject var viewModel: TestimonialManagementViewModel
    let onView: () -> Void
    let onToggleVisibility: () -> Void
    let onDelete: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Top row: client name, stars, actions
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(testimonial.clientName)
                        .font(.headline)
                        .foregroundColor(AppColors.text)

                    // Star rating
                    HStack(spacing: 2) {
                        ForEach(1...5, id: \.self) { star in
                            Image(systemName: star <= testimonial.rating ? "star.fill" : "star")
                                .font(.system(size: 15))
                                .foregroundColor(AppColors.warningMedium)
                        }
                    }
                }

                Spacer()

                HStack(spacing: 4) {
                    // Visibility toggle
                    Button(action: onToggleVisibility) {
                        Image(systemName: testimonial.isVisible ? "eye.fill" : "eye.slash.fill")
                            .font(.system(size: 16))
                            .foregroundColor(testimonial.isVisible ? AppColors.successMedium : AppColors.gray400)
                            .frame(width: 32, height: 32)
                            .background(testimonial.isVisible ? AppColors.successBg : AppColors.gray50)
                            .cornerRadius(6)
                    }

                    // View detail
                    Button(action: onView) {
                        Image(systemName: "doc.text.magnifyingglass")
                            .font(.system(size: 16))
                            .foregroundColor(AppColors.blue)
                            .frame(width: 32, height: 32)
                            .background(AppColors.infoBg)
                            .cornerRadius(6)
                    }

                    // Delete
                    Button(action: onDelete) {
                        Image(systemName: "trash")
                            .font(.system(size: 16))
                            .foregroundColor(AppColors.error)
                            .frame(width: 32, height: 32)
                            .background(AppColors.errorBg)
                            .cornerRadius(6)
                    }
                }
            }

            // Message preview
            if !testimonial.message.isEmpty {
                Text(testimonial.messagePreview)
                    .font(.subheadline)
                    .foregroundColor(AppColors.textMedium)
                    .lineLimit(3)
            }

            // Bottom row: project type, date
            HStack {
                if let projectType = testimonial.projectType, !projectType.isEmpty {
                    Text(testimonial.projectTypeLabel)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(AppColors.blue)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(AppColors.infoBg)
                        .cornerRadius(4)
                }

                if !testimonial.isVisible {
                    Text("Hidden")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(AppColors.textGray)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(AppColors.gray100)
                        .cornerRadius(4)
                }

                Spacer()

                Text(viewModel.formatDate(testimonial.createdAt))
                    .font(.subheadline)
                    .foregroundColor(AppColors.textGray)
            }
        }
        .padding(16)
        .background(Color.white)
        .cornerRadius(8)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(AppColors.border, lineWidth: 1)
        )
    }
}

// MARK: - Token Card

struct TokenCard: View {
    let token: TestimonialToken
    @ObservedObject var viewModel: TestimonialManagementViewModel
    let isExpanded: Bool
    let onToggleExpand: () -> Void
    let onDelete: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Top row
            HStack(alignment: .top) {
                // Status badge
                Text(token.statusLabel)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(token.statusColor)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(token.statusBgColor)
                    .cornerRadius(4)

                VStack(alignment: .leading, spacing: 2) {
                    Text(token.clientName)
                        .font(.headline)
                        .foregroundColor(AppColors.text)
                    if let email = token.clientEmail, !email.isEmpty {
                        HStack(spacing: 4) {
                            Image(systemName: "envelope")
                                .font(.system(size: 14))
                            Text(email)
                                .font(.subheadline)
                                .lineLimit(1)
                        }
                        .foregroundColor(AppColors.textGray)
                    }
                }

                Spacer()

                HStack(spacing: 4) {
                    Button(action: onToggleExpand) {
                        Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                            .font(.system(size: 16))
                            .foregroundColor(AppColors.blue)
                            .frame(width: 32, height: 32)
                            .background(AppColors.infoBg)
                            .cornerRadius(6)
                    }
                    Button(action: onDelete) {
                        Image(systemName: "trash")
                            .font(.system(size: 16))
                            .foregroundColor(AppColors.error)
                            .frame(width: 32, height: 32)
                            .background(AppColors.errorBg)
                            .cornerRadius(6)
                    }
                }
            }

            // Details row
            HStack(spacing: 12) {
                if let projectType = token.projectType, !projectType.isEmpty {
                    HStack(spacing: 4) {
                        Image(systemName: "hammer").font(.system(size: 14))
                        Text(projectType).font(.subheadline)
                    }
                    .foregroundColor(AppColors.blue)
                }

                HStack(spacing: 4) {
                    Image(systemName: "eye").font(.system(size: 14))
                    Text("\(token.openedCount) opens").font(.subheadline)
                }
                .foregroundColor(AppColors.textGray)

                Spacer()

                Text(viewModel.formatDate(token.createdAt))
                    .font(.subheadline)
                    .foregroundColor(AppColors.textGray)
            }

            // Expired badge
            if token.isExpired {
                Text("Expired")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(AppColors.error)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(AppColors.errorBg)
                    .cornerRadius(4)
            }

            // Tracking details (expanded)
            if isExpanded {
                Divider()

                if let tracking = viewModel.trackingData[token.token] {
                    if tracking.records.isEmpty {
                        Text("No tracking data available")
                            .font(.subheadline)
                            .foregroundColor(AppColors.textGray)
                            .padding(.vertical, 8)
                    } else {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Link Opens (\(tracking.total))")
                                .font(.subheadline)
                                .fontWeight(.semibold)
                                .foregroundColor(AppColors.textMedium)

                            ForEach(tracking.records) { record in
                                HStack(spacing: 8) {
                                    Image(systemName: "globe")
                                        .font(.system(size: 14))
                                        .foregroundColor(AppColors.textGray)
                                    Text(record.locationDisplay)
                                        .font(.system(size: 14))
                                        .foregroundColor(AppColors.textMedium)
                                    Spacer()
                                    Text(viewModel.formatDate(record.openedAt))
                                        .font(.system(size: 14))
                                        .foregroundColor(AppColors.textGray)
                                }
                            }
                        }
                    }
                } else {
                    HStack {
                        ProgressView()
                            .scaleEffect(0.7)
                        Text("Loading tracking data...")
                            .font(.subheadline)
                            .foregroundColor(AppColors.textGray)
                    }
                    .padding(.vertical, 8)
                }
            }
        }
        .padding(16)
        .background(Color.white)
        .cornerRadius(8)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(AppColors.border, lineWidth: 1)
        )
    }
}

// MARK: - Testimonial Detail Sheet

struct TestimonialDetailSheet: View {
    let testimonial: Testimonial
    @ObservedObject var viewModel: TestimonialManagementViewModel
    let onDismiss: () -> Void

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: AppSpacing.lg) {
                    // Client & Rating
                    clientSection

                    // Full message
                    if !testimonial.message.isEmpty {
                        messageSection
                    }

                    // Photos
                    if let photos = testimonial.photos, !photos.isEmpty {
                        photosSection(photos)
                    }

                    // Details
                    detailsSection
                }
                .padding(AppSpacing.lg)
            }
            .background(AppColors.background)
            .navigationTitle("Testimonial Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { onDismiss() }
                }
            }
        }
    }

    private var clientSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Client", icon: "person")

            VStack(alignment: .leading, spacing: 8) {
                infoRow("Name", value: testimonial.clientName)

                if let email = testimonial.clientEmail, !email.isEmpty {
                    infoRow("Email", value: email, icon: "envelope")
                }

                // Star rating
                HStack(spacing: 4) {
                    Text("Rating:")
                        .font(.body)
                        .foregroundColor(AppColors.textGray)
                    HStack(spacing: 2) {
                        ForEach(1...5, id: \.self) { star in
                            Image(systemName: star <= testimonial.rating ? "star.fill" : "star")
                                .font(.system(size: 16))
                                .foregroundColor(AppColors.warningMedium)
                        }
                    }
                    Text("(\(testimonial.rating)/5)")
                        .font(.subheadline)
                        .foregroundColor(AppColors.textGray)
                }

                // Visibility
                HStack(spacing: 8) {
                    Text("Visibility:")
                        .font(.body)
                        .foregroundColor(AppColors.textGray)
                    Image(systemName: testimonial.isVisible ? "eye.fill" : "eye.slash.fill")
                        .font(.system(size: 16))
                        .foregroundColor(testimonial.isVisible ? AppColors.successMedium : AppColors.gray400)
                    Text(testimonial.isVisible ? "Visible" : "Hidden")
                        .font(.body)
                        .foregroundColor(testimonial.isVisible ? AppColors.successMedium : AppColors.textGray)
                }
            }
        }
        .padding(16)
        .background(Color.white)
        .cornerRadius(8)
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppColors.border, lineWidth: 1))
    }

    private var messageSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionHeader("Testimonial Message", icon: "text.quote")
            Text(testimonial.message)
                .font(.body)
                .foregroundColor(AppColors.textMedium)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(16)
        .background(Color.white)
        .cornerRadius(8)
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppColors.border, lineWidth: 1))
    }

    private func photosSection(_ photos: [TestimonialPhoto]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionHeader("Photos", icon: "photo")

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(photos) { photo in
                        AsyncImage(url: photo.thumbnailURL ?? photo.fullURL) { phase in
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
        .padding(16)
        .background(Color.white)
        .cornerRadius(8)
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppColors.border, lineWidth: 1))
    }

    private var detailsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionHeader("Details", icon: "info.circle")

            VStack(alignment: .leading, spacing: 8) {
                if let projectType = testimonial.projectType, !projectType.isEmpty {
                    infoRow("Project Type", value: testimonial.projectTypeLabel, icon: "hammer")
                }
                infoRow("Submitted", value: viewModel.formatDate(testimonial.createdAt), icon: "calendar")
                if let approvedAt = testimonial.approvedAt {
                    infoRow("Approved", value: viewModel.formatDate(approvedAt), icon: "checkmark.circle")
                }
            }
        }
        .padding(16)
        .background(Color.white)
        .cornerRadius(8)
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppColors.border, lineWidth: 1))
    }

    private func sectionHeader(_ title: String, icon: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon).font(.system(size: 16)).foregroundColor(AppColors.blue)
            Text(title).font(.headline).foregroundColor(AppColors.text)
        }
    }

    private func infoRow(_ label: String, value: String, icon: String? = nil) -> some View {
        HStack(spacing: 8) {
            if let icon = icon {
                Image(systemName: icon).font(.system(size: 15))
                    .foregroundColor(AppColors.textGray).frame(width: 16)
            }
            Text(label + ":").font(.body).foregroundColor(AppColors.textGray)
            Text(value).font(.body).foregroundColor(AppColors.text)
            Spacer()
        }
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        TestimonialManagementView()
    }
}
