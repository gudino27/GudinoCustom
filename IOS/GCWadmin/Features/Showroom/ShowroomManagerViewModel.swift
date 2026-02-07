//
//  ShowroomManagerViewModel.swift
//  GCWadmin
//
//  ViewModel for Virtual Showroom Manager
//  Matches webapp ShowroomManager.js
//

import Foundation
import SwiftUI
import Combine

@MainActor
class ShowroomManagerViewModel: ObservableObject {
    private let showroomService = ShowroomService.shared
    
    // MARK: - Published Properties - Data
    
    @Published var rooms: [ShowroomRoom] = []
    @Published var settings: ShowroomSettings?
    
    // MARK: - Published Properties - View State
    
    @Published var selectedTab = "rooms"
    @Published var isLoading = false
    @Published var isSaving = false
    @Published var errorMessage: String?
    @Published var successMessage: String?
    
    // MARK: - Published Properties - Room Form
    
    @Published var editingRoom: ShowroomRoom?
    @Published var roomForm = RoomFormData()
    @Published var showDeleteRoomAlert = false
    @Published var roomToDelete: ShowroomRoom?
    
    // MARK: - Tab Options
    
    let tabs: [(id: String, label: String, icon: String)] = [
        ("rooms", "Rooms", "door.left.hand.open"),
        ("settings", "Settings", "gearshape"),
        ("guide", "Setup Guide", "book")
    ]
    
    // MARK: - Load All Data
    
    func loadAll() async {
        isLoading = true
        errorMessage = nil
        
        async let roomsTask: () = loadRooms()
        async let settingsTask: () = loadSettings()
        
        _ = await (roomsTask, settingsTask)
        
        isLoading = false
    }
    
    // MARK: - Load Rooms
    
    func loadRooms() async {
        do {
            rooms = try await showroomService.getRooms()
        } catch {
            print("Failed to load rooms: \(error)")
            errorMessage = "Failed to load showroom data"
        }
    }
    
    // MARK: - Load Settings
    
    func loadSettings() async {
        do {
            settings = try await showroomService.getSettings()
        } catch {
            print("Failed to load settings: \(error)")
        }
    }
    
    // MARK: - Save Room
    
    func saveRoom() async {
        guard !roomForm.roomNameEn.isEmpty, !roomForm.roomNameEs.isEmpty else {
            errorMessage = "Room names in English and Spanish are required"
            return
        }
        
        isSaving = true
        errorMessage = nil
        
        do {
            let body = roomForm.toBody()
            
            if let editing = editingRoom {
                let _ = try await showroomService.updateRoom(editing.id, body: body)
                successMessage = "Room updated!"
            } else {
                let _ = try await showroomService.createRoom(body)
                successMessage = "Room created!"
            }
            
            editingRoom = nil
            roomForm = RoomFormData()
            await loadRooms()
        } catch {
            errorMessage = "Failed to save room: \(error.localizedDescription)"
        }
        
        isSaving = false
    }
    
    // MARK: - Edit Room
    
    func editRoom(_ room: ShowroomRoom) {
        editingRoom = room
        roomForm = RoomFormData(from: room)
    }
    
    // MARK: - Cancel Edit
    
    func cancelEdit() {
        editingRoom = nil
        roomForm = RoomFormData()
    }
    
    // MARK: - Delete Room
    
    func deleteRoom(_ room: ShowroomRoom) async {
        do {
            try await showroomService.deleteRoom(room.id)
            successMessage = "Room deleted!"
            await loadRooms()
        } catch {
            errorMessage = "Failed to delete room"
        }
    }
    
    // MARK: - Save Settings
    
    func saveSettings() async {
        guard let currentSettings = settings else { return }
        
        isSaving = true
        
        do {
            let _ = try await showroomService.updateSettings(currentSettings)
            successMessage = "Settings saved!"
        } catch {
            errorMessage = "Failed to save settings"
        }
        
        isSaving = false
    }
    
    // MARK: - Demo Data
    
    func seedDemoData() async {
        isSaving = true
        
        do {
            let response = try await showroomService.seedDemo()
            if let data = response.data {
                successMessage = "Demo data created: \(data.rooms ?? 0) rooms, \(data.materials ?? 0) materials, \(data.elements ?? 0) elements"
            } else {
                successMessage = "Demo data loaded"
            }
            await loadRooms()
        } catch {
            errorMessage = "Failed to load demo data: \(error.localizedDescription)"
        }
        
        isSaving = false
    }
    
    func clearAllData() async {
        isSaving = true
        
        do {
            let _ = try await showroomService.clearDemo()
            successMessage = "All showroom data cleared"
            await loadRooms()
        } catch {
            errorMessage = "Failed to clear data"
        }
        
        isSaving = false
    }
}
