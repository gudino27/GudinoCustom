//
//  InstagramManagerViewModel.swift
//  GCWadmin
//
//  ViewModel for Instagram Feed Manager
//  Matches webapp InstagramManager.js
//

import Foundation
import SwiftUI
import Combine

@MainActor
class InstagramManagerViewModel: ObservableObject {
    private let instagramService = InstagramService.shared
    
    // MARK: - Published Properties - Data
    
    @Published var posts: [InstagramPost] = []
    @Published var settings: InstagramSettings?
    @Published var oembedPosts: [OEmbedPost] = []
    
    // MARK: - Published Properties - View State
    
    @Published var isLoading = false
    @Published var isFetching = false
    @Published var errorMessage: String?
    @Published var successMessage: String?
    
    // MARK: - Published Properties - Settings
    
    @Published var showSettings = false
    @Published var accessTokenInput = ""
    
    // MARK: - Published Properties - oEmbed
    
    @Published var manualUrl = ""
    @Published var isAddingUrl = false
    
    // MARK: - Computed Properties
    
    var approvedPosts: [InstagramPost] {
        posts.filter { $0.approved }
    }
    
    var unapprovedPosts: [InstagramPost] {
        posts.filter { !$0.approved }
    }
    
    var tokenConfigured: Bool {
        settings?.tokenConfigured ?? false
    }
    
    // MARK: - Load All Data
    
    func loadAll() async {
        isLoading = true
        errorMessage = nil
        
        async let postsTask: () = loadPosts()
        async let settingsTask: () = loadSettings()
        async let oembedTask: () = loadOembedPosts()
        
        _ = await (postsTask, settingsTask, oembedTask)
        
        isLoading = false
    }
    
    // MARK: - Load Posts
    
    func loadPosts() async {
        do {
            posts = try await instagramService.getPosts()
        } catch {
            print("Failed to load Instagram posts: \(error)")
            errorMessage = "Failed to load Instagram posts"
        }
    }
    
    // MARK: - Load Settings
    
    func loadSettings() async {
        do {
            settings = try await instagramService.getSettings()
        } catch {
            print("Failed to load Instagram settings: \(error)")
        }
    }
    
    // MARK: - Fetch from Instagram
    
    func fetchFromInstagram() async {
        isFetching = true
        errorMessage = nil
        successMessage = nil
        
        do {
            let response = try await instagramService.fetchFromInstagram()
            successMessage = response.message ?? "Successfully fetched Instagram posts"
            await loadPosts()
            await loadSettings()
        } catch {
            errorMessage = "Error fetching from Instagram: \(error.localizedDescription)"
        }
        
        isFetching = false
    }
    
    // MARK: - Toggle Approval
    
    func toggleApproval(_ post: InstagramPost) async {
        do {
            let _ = try await instagramService.updatePost(post.id, approved: !post.approved)
            if let index = posts.firstIndex(where: { $0.id == post.id }) {
                posts[index].approved.toggle()
            }
        } catch {
            errorMessage = "Failed to update post"
        }
    }
    
    // MARK: - Update Display Order
    
    func updateDisplayOrder(_ post: InstagramPost, order: Int) async {
        do {
            let _ = try await instagramService.updatePost(post.id, displayOrder: order)
            if let index = posts.firstIndex(where: { $0.id == post.id }) {
                posts[index].displayOrder = order
            }
        } catch {
            print("Error updating display order: \(error)")
        }
    }
    
    // MARK: - Delete Post
    
    func deletePost(_ post: InstagramPost) async {
        do {
            try await instagramService.deletePost(post.id)
            posts.removeAll { $0.id == post.id }
            successMessage = "Post deleted successfully"
        } catch {
            errorMessage = "Failed to delete post"
        }
    }
    
    // MARK: - Save Access Token
    
    func saveAccessToken() async {
        guard !accessTokenInput.trimmingCharacters(in: .whitespaces).isEmpty else {
            errorMessage = "Please enter an access token"
            return
        }
        
        do {
            let _ = try await instagramService.saveAccessToken(accessTokenInput)
            successMessage = "Access token saved successfully"
            accessTokenInput = ""
            showSettings = false
            await loadSettings()
        } catch {
            errorMessage = "Failed to save access token"
        }
    }
    
    // MARK: - oEmbed Posts
    
    func loadOembedPosts() async {
        do {
            oembedPosts = try await instagramService.getOembedPosts()
        } catch {
            print("Failed to load oEmbed posts: \(error)")
        }
    }
    
    // MARK: - Add Post by URL
    
    func addPostByUrl() async {
        let url = manualUrl.trimmingCharacters(in: .whitespaces)
        guard !url.isEmpty else {
            errorMessage = "Please enter an Instagram URL"
            return
        }
        
        // Basic validation
        let pattern = #"^https?://(www\.)?instagram\.com/(p|reel|tv)/[\w-]+/?"#
        guard url.range(of: pattern, options: .regularExpression) != nil else {
            errorMessage = "Invalid Instagram URL. Use a URL like https://www.instagram.com/p/ABC123/"
            return
        }
        
        isAddingUrl = true
        errorMessage = nil
        successMessage = nil
        
        do {
            let response = try await instagramService.addPostByUrl(url)
            successMessage = response.message ?? "Instagram post added successfully!"
            manualUrl = ""
            await loadOembedPosts()
        } catch {
            errorMessage = "Error adding Instagram post: \(error.localizedDescription)"
        }
        
        isAddingUrl = false
    }
    
    // MARK: - Remove oEmbed Post
    
    func removeOembedPost(_ post: OEmbedPost) async {
        do {
            try await instagramService.removeOembedPost(post.id)
            oembedPosts.removeAll { $0.id == post.id }
            successMessage = "Post removed from oEmbed display"
        } catch {
            errorMessage = "Failed to remove post"
        }
    }
    
    // MARK: - Format Date
    
    func formatDate(_ dateString: String?) -> String {
        guard let dateString = dateString else { return "Unknown" }
        
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        
        if let date = formatter.date(from: dateString) {
            let displayFormatter = DateFormatter()
            displayFormatter.dateStyle = .medium
            return displayFormatter.string(from: date)
        }
        
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
