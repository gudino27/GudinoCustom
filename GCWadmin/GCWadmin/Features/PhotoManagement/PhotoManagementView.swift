//
//  PhotoManagementView.swift
//  GCWadmin
//
//  Photo management screen with upload, edit, delete, and reorder
//

import SwiftUI
import PhotosUI

struct PhotoManagementView: View {
    @StateObject private var viewModel = PhotoManagementViewModel()

    var body: some View {
        VStack(spacing: 0) {
            // Header
            PhotoManagementHeaderView(viewModel: viewModel)

            // Category Tabs
            CategoryTabsView(viewModel: viewModel)

            // Content
            ScrollView {
                VStack(spacing: AppSpacing.lg) {
                    // Reorder Instructions
                    if viewModel.isReordering {
                        ReorderInstructionsView(viewModel: viewModel)
                    }

                    // Upload Section
                    if !viewModel.isReordering {
                        PhotoUploadSectionView(viewModel: viewModel)
                    }

                    // Photo Grid
                    PhotoGridView(viewModel: viewModel)

                    // Category Overview
                    CategoryOverviewView(viewModel: viewModel)

                    // Instructions
                    InstructionsView()
                }
                .padding()
            }
        }
        .task {
            await viewModel.loadPhotos()
        }
        .photosPicker(
            isPresented: $viewModel.showingPhotoPicker,
            selection: $viewModel.selectedPhotoItems,
            matching: .images
        )
        .onChange(of: viewModel.selectedPhotoItems) { _, items in
            if !items.isEmpty {
                Task {
                    await viewModel.uploadPhotos(items: items)
                }
            }
        }
        .alert("Error", isPresented: .constant(viewModel.errorMessage != nil)) {
            Button("OK") { viewModel.errorMessage = nil }
        } message: {
            Text(viewModel.errorMessage ?? "")
        }
        .alert("Success", isPresented: .constant(viewModel.successMessage != nil)) {
            Button("OK") { viewModel.successMessage = nil }
        } message: {
            Text(viewModel.successMessage ?? "")
        }
    }
}

// MARK: - Header View

struct PhotoManagementHeaderView: View {
    @ObservedObject var viewModel: PhotoManagementViewModel

    var body: some View {
        HStack {
            Text("Photo Manager")
                .font(AppTypography.title2())
                .foregroundColor(.white)

            Spacer()

            Button(action: {
                if viewModel.isReordering && viewModel.hasOrderChanges {
                    // Prompt to save changes
                    Task {
                        await viewModel.savePhotoOrder()
                        viewModel.isReordering = false
                    }
                } else {
                    viewModel.isReordering.toggle()
                }
            }) {
                HStack(spacing: AppSpacing.xs) {
                    Image(systemName: "arrow.up.arrow.down")
                        .font(.system(size: 14))
                    Text(viewModel.isReordering ? "Done" : "Reorder")
                        .font(AppTypography.captionBold())
                }
                .padding(.horizontal, AppSpacing.md)
                .padding(.vertical, AppSpacing.sm)
                .background(viewModel.isReordering ? AppColors.blue : AppColors.glassButton)
                .foregroundColor(viewModel.isReordering ? .white : AppColors.textMedium)
                .cornerRadius(AppRadius.lg)
            }

            if viewModel.hasOrderChanges {
                Button(action: {
                    Task {
                        await viewModel.savePhotoOrder()
                    }
                }) {
                    HStack(spacing: AppSpacing.xs) {
                        Image(systemName: "checkmark.circle")
                            .font(.system(size: 14))
                        Text("Save Order")
                            .font(AppTypography.captionBold())
                    }
                    .padding(.horizontal, AppSpacing.md)
                    .padding(.vertical, AppSpacing.sm)
                    .background(AppColors.successMedium)
                    .foregroundColor(.white)
                    .cornerRadius(AppRadius.lg)
                }
            }
        }
        .padding()
        .navGlass(cornerRadius: 0)
    }
}

// MARK: - Category Tabs View

struct CategoryTabsView: View {
    @ObservedObject var viewModel: PhotoManagementViewModel

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: AppSpacing.sm) {
                ForEach(PhotoCategory.allCases, id: \.self) { category in
                    CategoryTabButton(
                        category: category,
                        count: viewModel.photosByCategory[category]?.count ?? 0,
                        isSelected: viewModel.selectedCategory == category
                    ) {
                        viewModel.selectedCategory = category
                    }
                }
            }
            .padding(.horizontal)
            .padding(.vertical, AppSpacing.sm)
        }
        .background(AppColors.glassTab)
    }
}

struct CategoryTabButton: View {
    let category: PhotoCategory
    let count: Int
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: AppSpacing.xs) {
                Text(category.icon)
                    .font(.system(size: 14))
                Text(category.displayName)
                    .font(AppTypography.caption())
                Text("(\(count))")
                    .font(AppTypography.small())
                    .foregroundColor(isSelected ? AppColors.blue : AppColors.textGray)
            }
            .padding(.horizontal, AppSpacing.md)
            .padding(.vertical, AppSpacing.sm)
            .background(isSelected ? .white.opacity(0.2) : .clear)
            .foregroundColor(isSelected ? AppColors.blue : AppColors.textMedium)
            .cornerRadius(AppRadius.md)
        }
    }
}

// MARK: - Reorder Instructions

struct ReorderInstructionsView: View {
    @ObservedObject var viewModel: PhotoManagementViewModel

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            Image(systemName: "info.circle")
                .foregroundColor(AppColors.blue)

            VStack(alignment: .leading, spacing: AppSpacing.xs) {
                Text("Reordering Mode")
                    .font(AppTypography.bodyBold())
                    .foregroundColor(AppColors.blue)
                Text("Drag photos to reorder them within the category")
                    .font(AppTypography.small())
                    .foregroundColor(AppColors.textMedium)
            }

            Spacer()
        }
        .padding()
        .background(AppColors.blue.opacity(0.1))
        .cornerRadius(AppRadius.md)
    }
}

// MARK: - Upload Section

struct PhotoUploadSectionView: View {
    @ObservedObject var viewModel: PhotoManagementViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.md) {
            Text("Upload to \(viewModel.selectedCategory.displayName)")
                .font(AppTypography.headline())
                .foregroundColor(AppColors.text)

            HStack(spacing: AppSpacing.md) {
                // Photos Button
                Button(action: {
                    viewModel.showingPhotoPicker = true
                }) {
                    HStack {
                        Image(systemName: "photo")
                        Text(viewModel.isUploading ? "Uploading..." : "Add Photos")
                            .font(AppTypography.bodyBold())
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(AppColors.blue)
                    .foregroundColor(.white)
                    .cornerRadius(AppRadius.md)
                }
                .disabled(viewModel.isUploading)

                // Videos Button
                Button(action: {
                    // TODO: Add video picker
                }) {
                    HStack {
                        Image(systemName: "video")
                        Text("Add Videos")
                            .font(AppTypography.bodyBold())
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.purple)
                    .foregroundColor(.white)
                    .cornerRadius(AppRadius.md)
                }
                .disabled(viewModel.isUploading)
            }

            Text("You can select multiple photos. They will be uploaded to the \(viewModel.selectedCategory.displayName) category.")
                .font(AppTypography.small())
                .foregroundColor(AppColors.textGray)
        }
        .padding()
        .contentGlass()
    }
}

// MARK: - Photo Grid

struct PhotoGridView: View {
    @ObservedObject var viewModel: PhotoManagementViewModel

    let columns = [
        GridItem(.flexible(), spacing: AppSpacing.md),
        GridItem(.flexible(), spacing: AppSpacing.md)
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.md) {
            Text("\(viewModel.selectedCategory.displayName) Photos (\(viewModel.currentPhotos.count))")
                .font(AppTypography.headline())
                .foregroundColor(AppColors.text)

            if viewModel.currentPhotos.isEmpty {
                EmptyPhotosView(category: viewModel.selectedCategory)
            } else if viewModel.isReordering {
                // Use List for reordering
                ForEach(viewModel.currentPhotos) { photo in
                    PhotoCardView(photo: photo, index: viewModel.currentPhotos.firstIndex(where: { $0.id == photo.id }) ?? 0, viewModel: viewModel)
                }
                .onMove { source, destination in
                    viewModel.movePhoto(from: source, to: destination)
                }
            } else {
                // Use LazyVGrid for normal display
                LazyVGrid(columns: columns, spacing: AppSpacing.md) {
                    ForEach(Array(viewModel.currentPhotos.enumerated()), id: \.element.id) { index, photo in
                        PhotoCardView(photo: photo, index: index, viewModel: viewModel)
                    }
                }
            }
        }
    }
}

// MARK: - Empty Photos View

struct EmptyPhotosView: View {
    let category: PhotoCategory

    var body: some View {
        VStack(spacing: AppSpacing.md) {
            Image(systemName: "photo")
                .font(.system(size: 48))
                .foregroundColor(AppColors.textGray)

            Text("No photos yet")
                .font(AppTypography.body())
                .foregroundColor(AppColors.textMedium)

            Text("Get started by uploading photos to \(category.displayName)")
                .font(AppTypography.small())
                .foregroundColor(AppColors.textGray)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, AppSpacing.xl)
        .contentGlass()
    }
}

// MARK: - Photo Card

struct PhotoCardView: View {
    let photo: Photo
    let index: Int
    @ObservedObject var viewModel: PhotoManagementViewModel

    @State private var showDeleteConfirmation = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Photo/Video with overlay
            ZStack(alignment: .topLeading) {
                // Order badge
                Text("#\(index + 1)")
                    .font(AppTypography.small())
                    .foregroundColor(.white)
                    .padding(.horizontal, AppSpacing.sm)
                    .padding(.vertical, AppSpacing.xs)
                    .background(Color.black.opacity(0.7))
                    .cornerRadius(AppRadius.sm)
                    .padding(AppSpacing.sm)
                    .zIndex(2)

                // Drag handle (reorder mode)
                if viewModel.isReordering {
                    HStack {
                        Spacer()
                        Image(systemName: "line.3.horizontal")
                            .foregroundColor(.white)
                            .padding(AppSpacing.sm)
                            .background(Color.black.opacity(0.7))
                            .cornerRadius(AppRadius.sm)
                            .padding(AppSpacing.sm)
                    }
                    .zIndex(2)
                }

                // Photo/Video thumbnail
                GeometryReader { geo in
                    AsyncImage(url: URL(string: "\(APIConfig.baseURL)\(photo.thumbnail ?? photo.url)")) { phase in
                        switch phase {
                        case .empty:
                            Color.gray.opacity(0.3)
                        case .success(let image):
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                                .frame(width: geo.size.width, height: 160)
                                .clipped()
                        case .failure(let error):
                            VStack {
                                Image(systemName: "exclamationmark.triangle")
                                    .foregroundColor(.red)
                                Text("Failed to load")
                                    .font(.caption)
                                    .foregroundColor(.red)
                            }
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                            .onAppear {
                                print("❌ Image load failed for photo \(photo.id): \(error)")
                                print("   URL: \(APIConfig.baseURL)\(photo.thumbnail ?? photo.url)")
                            }
                        @unknown default:
                            Color.gray.opacity(0.3)
                        }
                    }
                }
                .frame(height: 160)
                .clipped()

                // Video overlay
                if photo.isVideo {
                    VStack {
                        Spacer()
                        HStack {
                            Spacer()
                            Image(systemName: "play.circle.fill")
                                .font(.system(size: 40))
                                .foregroundColor(.white)
                                .shadow(radius: 4)
                            Spacer()
                        }
                        Spacer()
                    }
                    .frame(height: 160)
                }
            }

            // Photo info section
            VStack(alignment: .leading, spacing: AppSpacing.sm) {
                // Title editing
                if viewModel.editingPhotoId == photo.id {
                    HStack {
                        TextField("Title", text: $viewModel.editingTitle)
                            .textFieldStyle(.roundedBorder)
                            .font(AppTypography.small())

                        Button(action: {
                            Task {
                                await viewModel.savePhotoTitle()
                            }
                        }) {
                            Image(systemName: "checkmark")
                                .foregroundColor(AppColors.successMedium)
                                .frame(width: 32, height: 32)
                        }

                        Button(action: {
                            viewModel.cancelEditingPhoto()
                        }) {
                            Image(systemName: "xmark")
                                .foregroundColor(.red)
                                .frame(width: 32, height: 32)
                        }
                    }
                } else {
                    HStack {
                        Text(photo.title)
                            .font(AppTypography.body())
                            .foregroundColor(AppColors.text)
                            .lineLimit(1)

                        Spacer()

                        if !viewModel.isReordering {
                            Button(action: {
                                viewModel.startEditingPhoto(photo)
                            }) {
                                Image(systemName: "pencil")
                                    .foregroundColor(AppColors.blue)
                                    .frame(width: 32, height: 32)
                            }
                        }
                    }
                }

                if !viewModel.isReordering {
                    // Category selector and delete
                    HStack {
                        Menu {
                            ForEach(PhotoCategory.allCases, id: \.self) { category in
                                Button(action: {
                                    Task {
                                        await viewModel.updatePhotoCategory(photo, newCategory: category)
                                    }
                                }) {
                                    Text("\(category.icon) \(category.displayName)")
                                }
                            }
                        } label: {
                            Text("\(photo.categoryEnum?.icon ?? "") \(photo.category)")
                                .font(AppTypography.small())
                                .foregroundColor(AppColors.textMedium)
                                .padding(.horizontal, AppSpacing.sm)
                                .padding(.vertical, AppSpacing.xs)
                                .background(AppColors.surface)
                                .cornerRadius(AppRadius.sm)
                        }

                        Spacer()

                        Button(action: {
                            showDeleteConfirmation = true
                        }) {
                            Image(systemName: "trash")
                                .foregroundColor(.red)
                                .frame(width: 32, height: 32)
                        }
                    }

                    // Photo type selector
                    Menu {
                        Button("📷 Regular Photo") {
                            Task {
                                await viewModel.updatePhotoType(photo, newType: .regular)
                            }
                        }
                        Button("⏪ Before Photo") {
                            Task {
                                await viewModel.updatePhotoType(photo, newType: .before)
                            }
                        }
                        Button("⏩ After Photo") {
                            Task {
                                await viewModel.updatePhotoType(photo, newType: .after)
                            }
                        }
                    } label: {
                        HStack {
                            Text(photo.photoTypeEnum?.rawValue.capitalized ?? "Regular")
                                .font(AppTypography.small())
                            Image(systemName: "chevron.down")
                                .font(.system(size: 10))
                        }
                        .foregroundColor(AppColors.textMedium)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, AppSpacing.xs)
                        .background(AppColors.surface)
                        .cornerRadius(AppRadius.sm)
                    }

                    // Pairing controls
                    if photo.comparisonPairId != nil {
                        HStack {
                            Text("🔗 Paired")
                                .font(AppTypography.small())
                                .foregroundColor(AppColors.successMedium)

                            Spacer()

                            Button(action: {
                                Task {
                                    await viewModel.unpairPhoto(photo)
                                }
                            }) {
                                Image(systemName: "xmark")
                                    .foregroundColor(.red)
                                    .frame(width: 24, height: 24)
                            }
                        }
                        .padding(.horizontal, AppSpacing.sm)
                        .padding(.vertical, AppSpacing.xs)
                        .background(AppColors.successMedium.opacity(0.1))
                        .cornerRadius(AppRadius.sm)
                    } else if photo.photoTypeEnum == .before || photo.photoTypeEnum == .after {
                        Button(action: {
                            if viewModel.pairingWithPhotoId == photo.id {
                                viewModel.cancelPairing()
                            } else {
                                viewModel.startPairing(with: photo)
                            }
                        }) {
                            Text(viewModel.pairingWithPhotoId == photo.id ? "Cancel Pairing" : "Pair with...")
                                .font(AppTypography.small())
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, AppSpacing.xs)
                                .background(viewModel.pairingWithPhotoId == photo.id ? AppColors.blue : AppColors.textGray)
                                .cornerRadius(AppRadius.sm)
                        }
                    }

                    // Pairing action button
                    if viewModel.canPair(photo) {
                        Button(action: {
                            Task {
                                await viewModel.pairWith(photo)
                            }
                        }) {
                            Text("✓ Pair with this")
                                .font(AppTypography.small())
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, AppSpacing.xs)
                                .background(AppColors.successMedium)
                                .cornerRadius(AppRadius.sm)
                        }
                    }
                }
            }
            .padding(AppSpacing.sm)
        }
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.xxl))
        .contentGlass()
        .confirmationDialog("Delete Photo", isPresented: $showDeleteConfirmation) {
            Button("Delete", role: .destructive) {
                Task {
                    await viewModel.deletePhoto(photo)
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Are you sure you want to delete this photo? This action cannot be undone.")
        }
    }
}

// MARK: - Category Overview

struct CategoryOverviewView: View {
    @ObservedObject var viewModel: PhotoManagementViewModel

    let columns = [
        GridItem(.flexible(), spacing: AppSpacing.md),
        GridItem(.flexible(), spacing: AppSpacing.md)
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.md) {
            Text("Category Overview")
                .font(AppTypography.headline())
                .foregroundColor(AppColors.text)

            LazyVGrid(columns: columns, spacing: AppSpacing.md) {
                ForEach(PhotoCategory.allCases, id: \.self) { category in
                    let stats = viewModel.categoryStats[category] ?? (photos: 0, videos: 0)

                    VStack(alignment: .leading, spacing: AppSpacing.sm) {
                        HStack {
                            Text("\(category.icon) \(category.displayName)")
                                .font(AppTypography.body())
                                .foregroundColor(AppColors.text)

                            Spacer()

                            Text("\(stats.photos + stats.videos)")
                                .font(AppTypography.title3())
                                .fontWeight(.bold)
                                .foregroundColor(AppColors.blue)
                        }

                        HStack(spacing: AppSpacing.md) {
                            HStack(spacing: AppSpacing.xs) {
                                Image(systemName: "photo")
                                    .font(.system(size: 10))
                                Text("\(stats.photos) photos")
                                    .font(AppTypography.small())
                            }
                            .foregroundColor(AppColors.textGray)

                            HStack(spacing: AppSpacing.xs) {
                                Image(systemName: "video")
                                    .font(.system(size: 10))
                                Text("\(stats.videos) videos")
                                    .font(AppTypography.small())
                            }
                            .foregroundColor(AppColors.textGray)
                        }
                    }
                    .padding()
                    .contentGlass()
                }
            }
        }
    }
}

// MARK: - Instructions

struct InstructionsView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.md) {
            Text("How It Works")
                .font(AppTypography.headline())
                .foregroundColor(AppColors.blue)

            VStack(alignment: .leading, spacing: AppSpacing.sm) {
                InstructionRow(text: "Upload photos or videos to any category")
                InstructionRow(text: "Edit titles and change categories")
                InstructionRow(text: "Drag to reorder photos within a category")
                InstructionRow(text: "Mark photos as Before/After and pair them")
                InstructionRow(text: "Photos appear in your public portfolio")
            }
        }
        .padding()
        .background(AppColors.blue.opacity(0.1))
        .cornerRadius(AppRadius.md)
    }
}

struct InstructionRow: View {
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: AppSpacing.sm) {
            Text("•")
                .foregroundColor(AppColors.blue)
            Text(text)
                .font(AppTypography.small())
                .foregroundColor(AppColors.textMedium)
        }
    }
}

// MARK: - Preview

#Preview {
    PhotoManagementView()
}
