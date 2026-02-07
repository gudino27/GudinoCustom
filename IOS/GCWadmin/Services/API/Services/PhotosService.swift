//
//  PhotosService.swift
//  GCWadmin
//
//  API service for Photos endpoints
//

import Foundation
import UIKit

class PhotosService {
    static let shared = PhotosService()
    private let apiClient = APIClient.shared

    private init() {}

    // MARK: - Response Models

    private struct MessageResponse: Codable {
        let success: Bool
        let message: String?
    }

    // MARK: - Get All Photos

    func getAllPhotos() async throws -> [Photo] {
        do {
            let photos: [Photo] = try await apiClient.get("/api/photos")
            print("✅ Successfully decoded \(photos.count) photos")
            return photos
        } catch {
            print("❌ Photo decoding error: \(error)")
            // Try to get raw response to debug
            throw error
        }
    }

    // MARK: - Get Single Photo

    func getPhoto(_ id: Int) async throws -> Photo {
        return try await apiClient.get("/api/photos/\(id)")
    }

    // MARK: - Upload Photo

    func uploadPhoto(image: UIImage, category: String, title: String) async throws -> Photo {
        // Compress image
        guard let imageData = image.jpegData(compressionQuality: 0.8) else {
            throw NSError(domain: "PhotosService", code: -1, userInfo: [NSLocalizedDescriptionKey: "Failed to compress image"])
        }

        let filename = "\(category)_\(UUID().uuidString).jpg"

        // Create multipart form data
        let boundary = UUID().uuidString
        var body = Data()

        // Add category field
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"category\"\r\n\r\n".data(using: .utf8)!)
        body.append("\(category)\r\n".data(using: .utf8)!)

        // Add title field
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"title\"\r\n\r\n".data(using: .utf8)!)
        body.append("\(title)\r\n".data(using: .utf8)!)

        // Add filename field
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"filename\"\r\n\r\n".data(using: .utf8)!)
        body.append("\(filename)\r\n".data(using: .utf8)!)

        // Add photo file
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"photo\"; filename=\"\(filename)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: image/jpeg\r\n\r\n".data(using: .utf8)!)
        body.append(imageData)
        body.append("\r\n".data(using: .utf8)!)
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)

        // Create URL request
        let url = URL(string: "\(APIConfig.baseURL)/api/photos")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        // Add auth token
        if let token = try? KeychainService.shared.get(for: "access_token") {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        request.httpBody = body

        // Make request
        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw NSError(domain: "PhotosService", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid response"])
        }

        guard httpResponse.statusCode == 200 else {
            let errorMessage = String(data: data, encoding: .utf8) ?? "Upload failed"
            throw NSError(domain: "PhotosService", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: errorMessage])
        }

        let uploadResponse = try JSONDecoder().decode(PhotoUploadResponse.self, from: data)

        // Debug: Print upload response
        print("📸 Upload successful:")
        print("   - ID: \(uploadResponse.photo.id)")
        print("   - Title: \(uploadResponse.photo.title)")
        print("   - URL: \(uploadResponse.photo.url)")
        print("   - Thumbnail: \(uploadResponse.photo.thumbnail ?? "nil")")
        print("   - Category: \(uploadResponse.photo.category)")

        return uploadResponse.photo
    }

    // MARK: - Update Photo

    func updatePhoto(_ id: Int, updates: [String: Any]) async throws {
        let _: MessageResponse = try await apiClient.put("/api/photos/\(id)", body: updates)
    }

    // MARK: - Delete Photo

    func deletePhoto(_ id: Int) async throws {
        let _: MessageResponse = try await apiClient.delete("/api/photos/\(id)")
    }

    // MARK: - Reorder Photos

    func reorderPhotos(photoIds: [Int]) async throws {
        let _: MessageResponse = try await apiClient.put("/api/photos/reorder", body: ["photoIds": photoIds])
    }

    // MARK: - Pair Photos (Before/After)

    func pairPhotos(beforePhotoId: Int, afterPhotoId: Int) async throws {
        let pairId = Int(Date().timeIntervalSince1970 * 1000) // Timestamp in milliseconds

        // Update both photos
        try await updatePhoto(beforePhotoId, updates: [
            "photo_type": "before",
            "comparison_pair_id": pairId
        ])

        try await updatePhoto(afterPhotoId, updates: [
            "photo_type": "after",
            "comparison_pair_id": pairId
        ])
    }

    // MARK: - Unpair Photos

    func unpairPhoto(_ id: Int) async throws {
        try await updatePhoto(id, updates: [
            "photo_type": "regular",
            "comparison_pair_id": NSNull()
        ])
    }
}
