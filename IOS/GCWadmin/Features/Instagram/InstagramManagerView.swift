//
//  InstagramManagerView.swift
//  GCWadmin
//
//  Instagram Feed Manager UI - Posts Grid, Settings, oEmbed, Manual URL
//  Matches webapp InstagramManager.js
//

import SwiftUI

struct InstagramManagerView: View {
    @StateObject private var viewModel = InstagramManagerViewModel()
    @State private var postToDelete: InstagramPost?
    @State private var oembedPostToDelete: OEmbedPost?
    @State private var showDeletePostAlert = false
    @State private var showDeleteOembedAlert = false
    
    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.lg) {
                // Header with Settings toggle
                headerSection
                
                // Settings Panel
                if viewModel.showSettings {
                    settingsPanel
                }
                
                // Status Messages
                // (handled by overlay)
                
                // Stats Row
                statsRow
                
                // Token Warning
                if !viewModel.tokenConfigured {
                    tokenWarning
                }
                
                // Last Fetch Info
                if let lastFetch = viewModel.settings?.lastFetchAt {
                    Text("Last fetch: \(viewModel.formatDate(lastFetch))")
                        .font(AppTypography.small())
                        .foregroundColor(AppColors.textGray)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                
                // Posts Grid
                postsSection
                
                // Divider
                Rectangle()
                    .fill(Color(hex: "E5E7EB"))
                    .frame(height: 2)
                    .padding(.vertical, AppSpacing.md)
                
                // oEmbed Section
                oembedSection
            }
            .padding(AppSpacing.lg)
        }
        .background(AppColors.background)
        .navigationTitle("Instagram")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.loadAll()
        }
        .alert("Delete Post", isPresented: $showDeletePostAlert, presenting: postToDelete) { post in
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive) {
                Task { await viewModel.deletePost(post) }
            }
        } message: { _ in
            Text("Are you sure you want to delete this Instagram post?")
        }
        .alert("Remove Post", isPresented: $showDeleteOembedAlert, presenting: oembedPostToDelete) { post in
            Button("Cancel", role: .cancel) { }
            Button("Remove", role: .destructive) {
                Task { await viewModel.removeOembedPost(post) }
            }
        } message: { _ in
            Text("Remove this post from oEmbed display?")
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
    
    // MARK: - Header
    
    private var headerSection: some View {
        HStack {
            HStack(spacing: AppSpacing.sm) {
                Image(systemName: "camera.fill")
                    .font(.system(size: 24))
                    .foregroundColor(Color(hex: "E11D48"))
                Text("Instagram Feed Manager")
                    .font(AppTypography.title2())
                    .foregroundColor(AppColors.text)
            }
            
            Spacer()
            
            Button {
                viewModel.showSettings.toggle()
            } label: {
                HStack(spacing: AppSpacing.xs) {
                    Image(systemName: "gearshape")
                    Text("Settings")
                }
                .font(AppTypography.caption())
                .foregroundColor(.white)
                .padding(.horizontal, AppSpacing.md)
                .padding(.vertical, AppSpacing.sm)
                .background(Color(hex: "6B7280"))
                .cornerRadius(AppRadius.md)
            }
        }
    }
    
    // MARK: - Settings Panel
    
    private var settingsPanel: some View {
        GlassCard(intensity: .light, style: .light) {
            VStack(alignment: .leading, spacing: AppSpacing.md) {
                Text("Instagram Graph API Settings")
                    .font(AppTypography.headline())
                    .foregroundColor(AppColors.text)
                
                Text("To connect Instagram, you need the Instagram Graph API (requires Facebook App + Instagram Business account).")
                    .font(AppTypography.small())
                    .foregroundColor(AppColors.textGray)
                
                // Steps info
                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    Text("Steps to get access token:")
                        .font(AppTypography.small())
                        .fontWeight(.semibold)
                        .foregroundColor(Color(hex: "92400E"))
                    
                    Group {
                        Text("1. Create a Facebook App at developers.facebook.com")
                        Text("2. Add Instagram Graph API product")
                        Text("3. Connect Instagram Business account to a Facebook Page")
                        Text("4. Generate a long-lived access token (60 days)")
                        Text("5. Paste the token below")
                    }
                    .font(AppTypography.small())
                    .foregroundColor(Color(hex: "92400E"))
                }
                .padding(AppSpacing.md)
                .background(Color(hex: "FEF3C7"))
                .cornerRadius(AppRadius.md)
                
                // Token Input
                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    Text("Access Token:")
                        .font(AppTypography.small())
                        .fontWeight(.medium)
                        .foregroundColor(AppColors.textMedium)
                    
                    SecureField("Enter Instagram access token", text: $viewModel.accessTokenInput)
                        .font(AppTypography.body())
                        .padding(AppSpacing.md)
                        .background(Color.white)
                        .cornerRadius(AppRadius.md)
                        .overlay(
                            RoundedRectangle(cornerRadius: AppRadius.md)
                                .stroke(Color(hex: "D1D5DB"), lineWidth: 1)
                        )
                }
                
                HStack(spacing: AppSpacing.sm) {
                    Button {
                        Task { await viewModel.saveAccessToken() }
                    } label: {
                        Text("Save Token")
                            .font(AppTypography.caption())
                            .foregroundColor(.white)
                            .padding(.horizontal, AppSpacing.md)
                            .padding(.vertical, AppSpacing.sm)
                            .background(AppColors.success)
                            .cornerRadius(AppRadius.md)
                    }
                    
                    Button {
                        viewModel.showSettings = false
                        viewModel.accessTokenInput = ""
                    } label: {
                        Text("Cancel")
                            .font(AppTypography.caption())
                            .foregroundColor(.white)
                            .padding(.horizontal, AppSpacing.md)
                            .padding(.vertical, AppSpacing.sm)
                            .background(Color(hex: "6B7280"))
                            .cornerRadius(AppRadius.md)
                    }
                }
                
                if viewModel.tokenConfigured {
                    HStack(spacing: AppSpacing.xs) {
                        Image(systemName: "checkmark")
                            .foregroundColor(AppColors.success)
                        Text("Access token is configured")
                            .font(AppTypography.small())
                            .foregroundColor(AppColors.success)
                    }
                }
            }
        }
    }
    
    // MARK: - Stats Row
    
    private var statsRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: AppSpacing.md) {
                statCard(label: "Total Posts", value: "\(viewModel.posts.count)", color: AppColors.text)
                statCard(label: "Approved", value: "\(viewModel.approvedPosts.count)", color: AppColors.success)
                statCard(label: "Pending", value: "\(viewModel.unapprovedPosts.count)", color: Color(hex: "F59E0B"))
                
                // Fetch Button Card
                GlassCard(intensity: .light, style: .light) {
                    Button {
                        Task { await viewModel.fetchFromInstagram() }
                    } label: {
                        HStack(spacing: AppSpacing.sm) {
                            if viewModel.isFetching {
                                ProgressView()
                                    .scaleEffect(0.8)
                            } else {
                                Image(systemName: "arrow.clockwise")
                            }
                            Text(viewModel.isFetching ? "Fetching..." : "Fetch")
                        }
                        .font(AppTypography.caption())
                        .fontWeight(.semibold)
                        .foregroundColor(.white)
                        .padding(.horizontal, AppSpacing.lg)
                        .padding(.vertical, AppSpacing.md)
                        .background(viewModel.isFetching || !viewModel.tokenConfigured ? Color(hex: "9CA3AF") : Color(hex: "E11D48"))
                        .cornerRadius(AppRadius.md)
                    }
                    .disabled(viewModel.isFetching || !viewModel.tokenConfigured)
                }
                .frame(width: 160)
            }
        }
    }
    
    private func statCard(label: String, value: String, color: Color) -> some View {
        GlassCard(intensity: .light, style: .light) {
            VStack(alignment: .leading, spacing: AppSpacing.sm) {
                Text(label)
                    .font(AppTypography.small())
                    .foregroundColor(AppColors.textGray)
                Text(value)
                    .font(.system(size: 28, weight: .bold))
                    .foregroundColor(color)
            }
        }
        .frame(width: 140)
    }
    
    // MARK: - Token Warning
    
    private var tokenWarning: some View {
        HStack(spacing: AppSpacing.sm) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(Color(hex: "92400E"))
            Text("Please configure your Instagram access token in Settings before fetching posts.")
                .font(AppTypography.small())
                .foregroundColor(Color(hex: "92400E"))
        }
        .padding(AppSpacing.md)
        .background(Color(hex: "FEF3C7"))
        .cornerRadius(AppRadius.md)
    }
    
    // MARK: - Posts Section
    
    private var postsSection: some View {
        VStack(alignment: .leading, spacing: AppSpacing.md) {
            if viewModel.isLoading {
                VStack(spacing: AppSpacing.md) {
                    ProgressView()
                    Text("Loading posts...")
                        .font(AppTypography.body())
                        .foregroundColor(AppColors.textGray)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, AppSpacing.xl)
            } else if viewModel.posts.isEmpty {
                emptyPostsView
            } else {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: AppSpacing.md) {
                    ForEach(viewModel.posts) { post in
                        postCard(post)
                    }
                }
            }
        }
    }
    
    // MARK: - Empty Posts
    
    private var emptyPostsView: some View {
        GlassCard(intensity: .light, style: .light) {
            VStack(spacing: AppSpacing.md) {
                Image(systemName: "camera")
                    .font(.system(size: 48))
                    .foregroundColor(Color(hex: "D1D5DB"))
                Text("No Instagram posts yet")
                    .font(AppTypography.headline())
                    .foregroundColor(AppColors.textGray)
                Text(viewModel.tokenConfigured
                     ? "Click \"Fetch from Instagram\" to load your posts"
                     : "Configure your access token in Settings first")
                    .font(AppTypography.caption())
                    .foregroundColor(AppColors.textLight)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, AppSpacing.xl)
        }
    }
    
    // MARK: - Post Card
    
    private func postCard(_ post: InstagramPost) -> some View {
        GlassCard(intensity: .light, style: .light) {
            VStack(alignment: .leading, spacing: 0) {
                // Image
                if let mediaUrl = post.mediaUrl, let url = URL(string: mediaUrl) {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image.resizable()
                                .aspectRatio(contentMode: .fill)
                                .frame(height: 150)
                                .clipped()
                        case .failure:
                            imagePlaceholder
                        case .empty:
                            ProgressView()
                                .frame(height: 150)
                                .frame(maxWidth: .infinity)
                        @unknown default:
                            imagePlaceholder
                        }
                    }
                } else {
                    imagePlaceholder
                }
                
                // Content
                VStack(alignment: .leading, spacing: AppSpacing.sm) {
                    if let caption = post.caption, !caption.isEmpty {
                        Text(caption)
                            .font(AppTypography.small())
                            .foregroundColor(AppColors.textMedium)
                            .lineLimit(3)
                    }
                    
                    Text(viewModel.formatDate(post.timestamp))
                        .font(AppTypography.small())
                        .foregroundColor(AppColors.textLight)
                    
                    // Actions
                    HStack(spacing: AppSpacing.sm) {
                        Button {
                            Task { await viewModel.toggleApproval(post) }
                        } label: {
                            HStack(spacing: AppSpacing.xs) {
                                Image(systemName: post.approved ? "eye" : "eye.slash")
                                Text(post.approved ? "Approved" : "Approve")
                            }
                            .font(AppTypography.small())
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, AppSpacing.sm)
                            .background(post.approved ? AppColors.success : Color(hex: "F59E0B"))
                            .cornerRadius(AppRadius.sm)
                        }
                        
                        Button {
                            postToDelete = post
                            showDeletePostAlert = true
                        } label: {
                            Image(systemName: "trash")
                                .font(AppTypography.small())
                                .foregroundColor(.white)
                                .padding(AppSpacing.sm)
                                .background(AppColors.error)
                                .cornerRadius(AppRadius.sm)
                        }
                    }
                }
                .padding(AppSpacing.md)
            }
        }
        .overlay(
            RoundedRectangle(cornerRadius: AppRadius.lg)
                .stroke(post.approved ? AppColors.success : Color(hex: "E5E7EB"), lineWidth: 2)
        )
    }
    
    private var imagePlaceholder: some View {
        LinearGradient(
            colors: [Color(hex: "833AB4"), Color(hex: "FD1D1D"), Color(hex: "FCAF45")],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .frame(height: 150)
        .overlay(
            Image(systemName: "camera.fill")
                .font(.system(size: 32))
                .foregroundColor(.white)
        )
    }
    
    // MARK: - oEmbed Section
    
    private var oembedSection: some View {
        VStack(alignment: .leading, spacing: AppSpacing.lg) {
            // oEmbed Header
            HStack {
                HStack(spacing: AppSpacing.sm) {
                    Image(systemName: "camera.fill")
                        .foregroundColor(Color(hex: "E11D48"))
                    Text("oEmbed Posts")
                        .font(AppTypography.headline())
                        .foregroundColor(AppColors.text)
                }
                Spacer()
            }
            
            Text("Select posts to display on the public oEmbed demo page. This demonstrates Instagram oEmbed integration for Meta's app review.")
                .font(AppTypography.small())
                .foregroundColor(AppColors.textGray)
            
            // Stats
            HStack(spacing: AppSpacing.md) {
                HStack(spacing: AppSpacing.xs) {
                    Text("Saved for Display:")
                        .font(AppTypography.small())
                        .foregroundColor(Color(hex: "166534"))
                    Text("\(viewModel.oembedPosts.count)")
                        .font(AppTypography.headline())
                        .foregroundColor(Color(hex: "166534"))
                }
                .padding(.horizontal, AppSpacing.md)
                .padding(.vertical, AppSpacing.sm)
                .background(Color(hex: "F0FDF4"))
                .cornerRadius(AppRadius.md)
            }
            
            // Manual URL Input
            manualUrlSection
            
            // Saved oEmbed Posts
            savedOembedPostsSection
        }
    }
    
    // MARK: - Manual URL Section
    
    private var manualUrlSection: some View {
        GlassCard(intensity: .light, style: .light) {
            VStack(alignment: .leading, spacing: AppSpacing.md) {
                HStack(spacing: AppSpacing.sm) {
                    Image(systemName: "link")
                        .foregroundColor(Color(hex: "DB2777"))
                    Text("Add Post by URL")
                        .font(AppTypography.headline())
                        .foregroundColor(Color(hex: "831843"))
                    
                    Text("NO API TOKEN NEEDED")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(.white)
                        .padding(.horizontal, AppSpacing.sm)
                        .padding(.vertical, 2)
                        .background(AppColors.success)
                        .cornerRadius(20)
                }
                
                Text("Simply paste Instagram post URLs below. Works without any Facebook/Instagram API setup!")
                    .font(AppTypography.small())
                    .foregroundColor(Color(hex: "9D174D"))
                
                Text("Supports: Posts, Reels, and IGTV")
                    .font(AppTypography.small())
                    .foregroundColor(Color(hex: "BE185D"))
                
                HStack(spacing: AppSpacing.sm) {
                    TextField("https://www.instagram.com/p/ABC123/", text: $viewModel.manualUrl)
                        .font(AppTypography.body())
                        .padding(AppSpacing.md)
                        .background(Color.white)
                        .cornerRadius(AppRadius.md)
                        .overlay(
                            RoundedRectangle(cornerRadius: AppRadius.md)
                                .stroke(Color(hex: "F9A8D4"), lineWidth: 2)
                        )
                        .onSubmit {
                            Task { await viewModel.addPostByUrl() }
                        }
                    
                    Button {
                        Task { await viewModel.addPostByUrl() }
                    } label: {
                        HStack(spacing: AppSpacing.xs) {
                            if viewModel.isAddingUrl {
                                ProgressView()
                                    .scaleEffect(0.7)
                                    .tint(.white)
                            } else {
                                Image(systemName: "plus")
                            }
                            Text(viewModel.isAddingUrl ? "Adding..." : "Add")
                        }
                        .font(AppTypography.caption())
                        .fontWeight(.semibold)
                        .foregroundColor(.white)
                        .padding(.horizontal, AppSpacing.md)
                        .padding(.vertical, AppSpacing.md)
                        .background {
                            if viewModel.isAddingUrl || viewModel.manualUrl.trimmingCharacters(in: .whitespaces).isEmpty {
                                Color(hex: "9CA3AF")
                            } else {
                                LinearGradient(colors: [Color(hex: "EC4899"), Color(hex: "DB2777")], startPoint: .leading, endPoint: .trailing)
                            }
                        }
                        .cornerRadius(AppRadius.md)
                    }
                    .disabled(viewModel.isAddingUrl || viewModel.manualUrl.trimmingCharacters(in: .whitespaces).isEmpty)
                }
                
                HStack(spacing: AppSpacing.xs) {
                    Text("💡")
                    Text("Tip: Copy the URL from any public Instagram post")
                        .font(AppTypography.small())
                        .foregroundColor(Color(hex: "BE185D"))
                }
            }
        }
        .overlay(
            RoundedRectangle(cornerRadius: AppRadius.lg)
                .stroke(Color(hex: "F9A8D4"), lineWidth: 2)
        )
    }
    
    // MARK: - Saved oEmbed Posts
    
    private var savedOembedPostsSection: some View {
        VStack(alignment: .leading, spacing: AppSpacing.md) {
            Text("Saved oEmbed Posts (\(viewModel.oembedPosts.count))")
                .font(AppTypography.headline())
                .foregroundColor(AppColors.text)
            
            if viewModel.oembedPosts.isEmpty {
                GlassCard(intensity: .light, style: .light) {
                    VStack(spacing: AppSpacing.sm) {
                        Text("No posts saved for oEmbed display yet.")
                            .font(AppTypography.body())
                            .foregroundColor(AppColors.textGray)
                        Text("Add posts using the URL input above.")
                            .font(AppTypography.caption())
                            .foregroundColor(AppColors.textLight)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, AppSpacing.lg)
                }
            } else {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: AppSpacing.md) {
                    ForEach(viewModel.oembedPosts) { post in
                        oembedPostCard(post)
                    }
                }
            }
        }
    }
    
    // MARK: - oEmbed Post Card
    
    private func oembedPostCard(_ post: OEmbedPost) -> some View {
        GlassCard(intensity: .light, style: .light) {
            VStack(alignment: .leading, spacing: 0) {
                // Image or Gradient
                if let mediaUrl = post.mediaUrl, let url = URL(string: mediaUrl) {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image.resizable()
                                .aspectRatio(contentMode: .fill)
                                .frame(height: 130)
                                .clipped()
                        case .failure:
                            instagramGradientPlaceholder
                        case .empty:
                            ProgressView()
                                .frame(height: 130)
                                .frame(maxWidth: .infinity)
                        @unknown default:
                            instagramGradientPlaceholder
                        }
                    }
                } else {
                    instagramGradientPlaceholder
                }
                
                VStack(alignment: .leading, spacing: AppSpacing.sm) {
                    Text(viewModel.formatDate(post.timestamp))
                        .font(AppTypography.small())
                        .foregroundColor(AppColors.textLight)
                    
                    Button {
                        oembedPostToDelete = post
                        showDeleteOembedAlert = true
                    } label: {
                        HStack(spacing: AppSpacing.xs) {
                            Image(systemName: "trash")
                                .font(.system(size: 12))
                            Text("Remove")
                                .font(AppTypography.small())
                        }
                        .foregroundColor(Color(hex: "991B1B"))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, AppSpacing.sm)
                        .background(Color(hex: "FEE2E2"))
                        .cornerRadius(AppRadius.sm)
                    }
                }
                .padding(AppSpacing.md)
            }
        }
        .overlay(
            RoundedRectangle(cornerRadius: AppRadius.lg)
                .stroke(AppColors.success, lineWidth: 2)
        )
    }
    
    private var instagramGradientPlaceholder: some View {
        LinearGradient(
            colors: [Color(hex: "833AB4"), Color(hex: "FD1D1D"), Color(hex: "FCAF45")],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .frame(height: 130)
        .overlay(
            VStack(spacing: AppSpacing.xs) {
                Image(systemName: "camera.fill")
                    .font(.system(size: 32))
                    .foregroundColor(.white)
                Text("View on Instagram")
                    .font(AppTypography.small())
                    .foregroundColor(.white.opacity(0.9))
            }
        )
    }
}
