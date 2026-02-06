//
//  InstagramService.swift
//  GCWadmin
//
//  API service for Instagram endpoints
//  Matches webapp InstagramManager.js API calls
//

import Foundation

class InstagramService {
    static let shared = InstagramService()
    private let apiClient = APIClient.shared
    
    private init() {}
    
    // MARK: - Posts (API Token-based)
    
    /// Get all Instagram posts
    func getPosts() async throws -> [InstagramPost] {
        return try await apiClient.get("/api/instagram/admin/posts")
    }
    
    /// Fetch new posts from Instagram API
    func fetchFromInstagram() async throws -> InstagramFetchResponse {
        return try await apiClient.post("/api/instagram/admin/fetch", body: [:])
    }
    
    /// Update post (toggle approval, update display order)
    func updatePost(_ postId: Int, approved: Bool? = nil, displayOrder: Int? = nil) async throws -> InstagramPostUpdateResponse {
        var body: [String: Any] = [:]
        if let approved = approved {
            body["approved"] = approved
        }
        if let displayOrder = displayOrder {
            body["display_order"] = displayOrder
        }
        return try await apiClient.put("/api/instagram/admin/posts/\(postId)", body: body)
    }
    
    /// Delete post
    func deletePost(_ postId: Int) async throws {
        let _: InstagramPostUpdateResponse = try await apiClient.delete("/api/instagram/admin/posts/\(postId)")
    }
    
    // MARK: - Settings
    
    /// Get Instagram settings
    func getSettings() async throws -> InstagramSettings {
        return try await apiClient.get("/api/instagram/admin/settings")
    }
    
    /// Save access token
    func saveAccessToken(_ token: String) async throws -> InstagramPostUpdateResponse {
        let body: [String: Any] = ["access_token": token]
        return try await apiClient.put("/api/instagram/admin/settings", body: body)
    }
    
    // MARK: - oEmbed Posts
    
    /// Get saved oEmbed posts
    func getOembedPosts() async throws -> [OEmbedPost] {
        return try await apiClient.get("/api/instagram/admin/oembed")
    }
    
    /// Fetch available posts for oEmbed selection
    func fetchOembedAvailable() async throws -> [AvailablePost] {
        return try await apiClient.get("/api/instagram/admin/oembed/available")
    }
    
    /// Save selected posts for oEmbed
    func saveOembedPosts(_ posts: [[String: Any]]) async throws -> OEmbedSaveResponse {
        let body: [String: Any] = ["posts": posts]
        return try await apiClient.post("/api/instagram/admin/oembed/save", body: body)
    }
    
    /// Add post by URL (no API token required)
    func addPostByUrl(_ url: String) async throws -> OEmbedAddUrlResponse {
        let body: [String: Any] = ["url": url]
        return try await apiClient.post("/api/instagram/admin/oembed/add-url", body: body)
    }
    
    /// Remove oEmbed post
    func removeOembedPost(_ postId: Int) async throws {
        let _: InstagramPostUpdateResponse = try await apiClient.delete("/api/instagram/admin/oembed/\(postId)")
    }
    
    /// Update oEmbed post display order
    func updateOembedOrder(_ postId: Int, order: Int) async throws {
        let body: [String: Any] = ["order": order]
        let _: InstagramPostUpdateResponse = try await apiClient.put("/api/instagram/admin/oembed/\(postId)/order", body: body)
    }
}
