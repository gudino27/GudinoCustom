//
//  PhotoManagementViewModel.swift
//  GCWadmin
//
//  ViewModel for Photo Management
//

import Foundation
import SwiftUI
import Combine
import PhotosUI

@MainActor
class PhotoManagementViewModel: ObservableObject {
    private let photosService = PhotosService.shared

    // MARK: - Published Properties

    // Photos data
    @Published var photos: [Photo] = []
    @Published var selectedCategory: PhotoCategory = .kitchen

    // UI state
    @Published var isLoading = false
    @Published var isUploading = false
    @Published var isSaving = false
    @Published var errorMessage: String?
    @Published var successMessage: String?

    // Reordering
    @Published var isReordering = false
    @Published var hasOrderChanges = false

    // Editing
    @Published var editingPhotoId: Int?
    @Published var editingTitle = ""

    // Photo picker
    @Published var showingPhotoPicker = false
    @Published var selectedPhotoItems: [PhotosPickerItem] = []

    // Pairing (before/after)
    @Published var pairingMode = false
    @Published var pairingWithPhotoId: Int?

    // MARK: - Computed Properties

    var currentPhotos: [Photo] {
        photos
            .filter { $0.category == selectedCategory.rawValue }
            .sorted { ($0.displayOrder ?? 999) < ($1.displayOrder ?? 999) }
    }

    var photosByCategory: [PhotoCategory: [Photo]] {
        var grouped: [PhotoCategory: [Photo]] = [:]
        for category in PhotoCategory.allCases {
            grouped[category] = photos.filter { $0.category == category.rawValue }
        }
        return grouped
    }

    var categoryStats: [PhotoCategory: (photos: Int, videos: Int)] {
        var stats: [PhotoCategory: (photos: Int, videos: Int)] = [:]
        for category in PhotoCategory.allCases {
            let categoryPhotos = photos.filter { $0.category == category.rawValue }
            let photoCount = categoryPhotos.filter { !$0.isVideo }.count
            let videoCount = categoryPhotos.filter { $0.isVideo }.count
            stats[category] = (photos: photoCount, videos: videoCount)
        }
        return stats
    }

    // MARK: - Load Photos

    func loadPhotos() async {
        isLoading = true
        errorMessage = nil

        do {
            photos = try await photosService.getAllPhotos()
            print("✅ Loaded \(photos.count) photos")

            // Debug: Print photo URLs
            for photo in photos.prefix(3) {
                print("   Photo \(photo.id): category=\(photo.category), url=\(photo.url)")
            }
        } catch {
            errorMessage = "Failed to load photos: \(error.localizedDescription)"
            print("❌ Error loading photos: \(error)")
        }

        isLoading = false
    }

    // MARK: - Upload Photos

    func uploadPhotos(items: [PhotosPickerItem]) async {
        isUploading = true
        errorMessage = nil

        var uploadedCount = 0

        for item in items {
            do {
                // Load image data
                guard let imageData = try await item.loadTransferable(type: Data.self),
                      let image = UIImage(data: imageData) else {
                    print("⚠️ Failed to load image from picker item")
                    continue
                }

                // Generate title from identifier or use default
                let title = item.itemIdentifier ?? "photo_\(Date().timeIntervalSince1970)"

                // Upload photo
                _ = try await photosService.uploadPhoto(
                    image: image,
                    category: selectedCategory.rawValue,
                    title: title
                )

                uploadedCount += 1
                print("✅ Uploaded photo: \(title)")
            } catch {
                print("❌ Failed to upload photo: \(error)")
                errorMessage = "Some photos failed to upload"
            }
        }

        if uploadedCount > 0 {
            successMessage = "Uploaded \(uploadedCount) photo(s) to \(selectedCategory.displayName)"
            await loadPhotos()
        }

        isUploading = false
        selectedPhotoItems = []
    }

    // MARK: - Edit Photo

    func startEditingPhoto(_ photo: Photo) {
        editingPhotoId = photo.id
        editingTitle = photo.title
    }

    func savePhotoTitle() async {
        guard let photoId = editingPhotoId else { return }

        do {
            try await photosService.updatePhoto(photoId, updates: ["title": editingTitle])
            await loadPhotos()
            editingPhotoId = nil
            successMessage = "Title updated successfully"
        } catch {
            errorMessage = "Failed to update title: \(error.localizedDescription)"
        }
    }

    func cancelEditingPhoto() {
        editingPhotoId = nil
        editingTitle = ""
    }

    // MARK: - Update Photo Category

    func updatePhotoCategory(_ photo: Photo, newCategory: PhotoCategory) async {
        do {
            print("🔄 Updating photo \(photo.id) category from \(photo.category) to \(newCategory.rawValue)")
            try await photosService.updatePhoto(photo.id, updates: ["category": newCategory.rawValue])
            print("✅ Category updated, reloading photos...")
            await loadPhotos()
            print("✅ Photos reloaded, photo \(photo.id) should now have updated paths")
        } catch {
            errorMessage = "Failed to update category: \(error.localizedDescription)"
            print("❌ Category update failed: \(error)")
        }
    }

    // MARK: - Delete Photo

    func deletePhoto(_ photo: Photo) async {
        do {
            try await photosService.deletePhoto(photo.id)
            await loadPhotos()
            successMessage = "Photo deleted successfully"
        } catch {
            errorMessage = "Failed to delete photo: \(error.localizedDescription)"
        }
    }

    // MARK: - Reordering

    func movePhoto(from source: IndexSet, to destination: Int) {
        var reorderedPhotos = currentPhotos
        reorderedPhotos.move(fromOffsets: source, toOffset: destination)

        // Update display order
        for (index, photo) in reorderedPhotos.enumerated() {
            if let photoIndex = photos.firstIndex(where: { $0.id == photo.id }) {
                photos[photoIndex].displayOrder = index + 1
            }
        }

        hasOrderChanges = true
    }

    func savePhotoOrder() async {
        isSaving = true
        errorMessage = nil

        let photoIds = currentPhotos.map { $0.id }

        do {
            try await photosService.reorderPhotos(photoIds: photoIds)
            hasOrderChanges = false
            successMessage = "Photo order saved successfully"
            await loadPhotos()
        } catch {
            errorMessage = "Failed to save photo order: \(error.localizedDescription)"
        }

        isSaving = false
    }

    // MARK: - Photo Type (Before/After)

    func updatePhotoType(_ photo: Photo, newType: PhotoType) async {
        do {
            try await photosService.updatePhoto(photo.id, updates: ["photo_type": newType.rawValue])
            await loadPhotos()
        } catch {
            errorMessage = "Failed to update photo type: \(error.localizedDescription)"
        }
    }

    // MARK: - Pairing

    func startPairing(with photo: Photo) {
        pairingWithPhotoId = photo.id
        pairingMode = true
    }

    func cancelPairing() {
        pairingWithPhotoId = nil
        pairingMode = false
    }

    func pairWith(_ photo: Photo) async {
        guard let pairingPhotoId = pairingWithPhotoId,
              let pairingPhoto = photos.first(where: { $0.id == pairingPhotoId }) else {
            return
        }

        // Determine which is before and which is after
        let beforeId: Int
        let afterId: Int

        if pairingPhoto.photoTypeEnum == .before {
            beforeId = pairingPhoto.id
            afterId = photo.id
        } else {
            beforeId = photo.id
            afterId = pairingPhoto.id
        }

        do {
            try await photosService.pairPhotos(beforePhotoId: beforeId, afterPhotoId: afterId)
            await loadPhotos()
            cancelPairing()
            successMessage = "Photos paired successfully"
        } catch {
            errorMessage = "Failed to pair photos: \(error.localizedDescription)"
        }
    }

    func unpairPhoto(_ photo: Photo) async {
        do {
            try await photosService.unpairPhoto(photo.id)
            await loadPhotos()
            successMessage = "Photos unpaired successfully"
        } catch {
            errorMessage = "Failed to unpair photos: \(error.localizedDescription)"
        }
    }

    // MARK: - Helpers

    func canPair(_ photo: Photo) -> Bool {
        guard let pairingPhotoId = pairingWithPhotoId,
              let pairingPhoto = photos.first(where: { $0.id == pairingPhotoId }),
              photo.id != pairingPhotoId else {
            return false
        }

        // Check if both are before/after types and are different types
        if let pairingType = pairingPhoto.photoTypeEnum,
           let photoType = photo.photoTypeEnum,
           (pairingType == .before || pairingType == .after),
           (photoType == .before || photoType == .after),
           pairingType != photoType,
           photo.comparisonPairId == nil {
            return true
        }

        return false
    }
}
