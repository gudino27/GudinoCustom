//
//  ShowroomManagerView.swift
//  GCWadmin
//
//  Virtual Showroom Manager UI - Rooms, Settings, Setup Guide
//  Matches webapp ShowroomManager.js
//

import SwiftUI

struct ShowroomManagerView: View {
    @StateObject private var viewModel = ShowroomManagerViewModel()
    @State private var showDeleteRoomAlert = false
    @State private var roomToDelete: ShowroomRoom?
    @State private var showSeedConfirmation = false
    @State private var showClearConfirmation = false
    
    var body: some View {
        ScrollView {
            VStack(spacing: AppSpacing.lg) {
                // Tab Bar
                SubTabBar(
                    tabs: [
                        SubTab(id: "rooms", label: "Rooms", icon: "door.left.hand.open"),
                        SubTab(id: "settings", label: "Settings", icon: "gearshape"),
                        SubTab(id: "guide", label: "Setup Guide", icon: "book")
                    ],
                    selection: $viewModel.selectedTab
                )
                
                // Content
                switch viewModel.selectedTab {
                case "rooms":
                    roomsTab
                case "settings":
                    settingsTab
                case "guide":
                    setupGuideTab
                default:
                    roomsTab
                }
            }
            .padding(AppSpacing.lg)
        }
        .background(AppColors.background)
        .navigationTitle("Virtual Showroom")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.loadAll()
        }
        .alert("Delete Room", isPresented: $showDeleteRoomAlert, presenting: roomToDelete) { room in
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive) {
                Task { await viewModel.deleteRoom(room) }
            }
        } message: { _ in
            Text("Are you sure you want to delete this room?")
        }
        .alert("Load Demo Data", isPresented: $showSeedConfirmation) {
            Button("Cancel", role: .cancel) { }
            Button("Load Demo") {
                Task { await viewModel.seedDemoData() }
            }
        } message: {
            Text("This will create demo rooms, materials, and elements. Continue?")
        }
        .alert("Clear All Data", isPresented: $showClearConfirmation) {
            Button("Cancel", role: .cancel) { }
            Button("Clear All", role: .destructive) {
                Task { await viewModel.clearAllData() }
            }
        } message: {
            Text("This will DELETE all showroom data (rooms, materials, elements). Are you sure?")
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
    
    // MARK: - Rooms Tab
    
    private var roomsTab: some View {
        VStack(spacing: AppSpacing.lg) {
            // Room Form
            roomFormSection
            
            // Room List
            roomListSection
        }
    }
    
    // MARK: - Room Form
    
    private var roomFormSection: some View {
        GlassCard(intensity: .light, style: .light) {
            VStack(alignment: .leading, spacing: AppSpacing.md) {
                HStack {
                    Text(viewModel.editingRoom != nil ? "Edit Room" : "Add New Room")
                        .font(AppTypography.headline())
                        .foregroundColor(AppColors.text)
                    
                    Spacer()
                    
                    if viewModel.editingRoom == nil {
                        Text("Fill form below")
                            .font(AppTypography.small())
                            .foregroundColor(Color(hex: "D97706"))
                            .padding(.horizontal, AppSpacing.sm)
                            .padding(.vertical, 2)
                            .background(Color(hex: "FEF3C7"))
                            .cornerRadius(AppRadius.sm)
                    }
                }
                
                Divider()
                
                // Name Fields
                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    Text("Name (English) *")
                        .font(AppTypography.small())
                        .fontWeight(.medium)
                        .foregroundColor(AppColors.textMedium)
                    TextField("Kitchen Showroom", text: $viewModel.roomForm.roomNameEn)
                        .font(AppTypography.body())
                        .padding(AppSpacing.md)
                        .background(Color.white)
                        .cornerRadius(AppRadius.md)
                        .overlay(
                            RoundedRectangle(cornerRadius: AppRadius.md)
                                .stroke(Color(hex: "D1D5DB"), lineWidth: 1)
                        )
                }
                
                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    Text("Name (Spanish) *")
                        .font(AppTypography.small())
                        .fontWeight(.medium)
                        .foregroundColor(AppColors.textMedium)
                    TextField("Sala de Exhibición de Cocinas", text: $viewModel.roomForm.roomNameEs)
                        .font(AppTypography.body())
                        .padding(AppSpacing.md)
                        .background(Color.white)
                        .cornerRadius(AppRadius.md)
                        .overlay(
                            RoundedRectangle(cornerRadius: AppRadius.md)
                                .stroke(Color(hex: "D1D5DB"), lineWidth: 1)
                        )
                }
                
                // Description Fields
                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    Text("Description (EN)")
                        .font(AppTypography.small())
                        .fontWeight(.medium)
                        .foregroundColor(AppColors.textMedium)
                    TextField("Optional description", text: $viewModel.roomForm.roomDescriptionEn)
                        .font(AppTypography.body())
                        .padding(AppSpacing.md)
                        .background(Color.white)
                        .cornerRadius(AppRadius.md)
                        .overlay(
                            RoundedRectangle(cornerRadius: AppRadius.md)
                                .stroke(Color(hex: "D1D5DB"), lineWidth: 1)
                        )
                }
                
                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    Text("Description (ES)")
                        .font(AppTypography.small())
                        .fontWeight(.medium)
                        .foregroundColor(AppColors.textMedium)
                    TextField("Descripción opcional", text: $viewModel.roomForm.roomDescriptionEs)
                        .font(AppTypography.body())
                        .padding(AppSpacing.md)
                        .background(Color.white)
                        .cornerRadius(AppRadius.md)
                        .overlay(
                            RoundedRectangle(cornerRadius: AppRadius.md)
                                .stroke(Color(hex: "D1D5DB"), lineWidth: 1)
                        )
                }
                
                // Category Picker
                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    Text("Category")
                        .font(AppTypography.small())
                        .fontWeight(.medium)
                        .foregroundColor(AppColors.textMedium)
                    
                    Picker("Category", selection: $viewModel.roomForm.category) {
                        ForEach(RoomCategory.allCases, id: \.self) { category in
                            Text(category.displayName).tag(category.rawValue)
                        }
                    }
                    .pickerStyle(.segmented)
                }
                
                // Toggles
                HStack(spacing: AppSpacing.xl) {
                    Toggle("Enabled", isOn: $viewModel.roomForm.isEnabled)
                        .font(AppTypography.caption())
                    
                    Toggle("Start Room", isOn: $viewModel.roomForm.isStartingRoom)
                        .font(AppTypography.caption())
                }
                
                // Save / Cancel Buttons
                HStack(spacing: AppSpacing.md) {
                    Button {
                        Task { await viewModel.saveRoom() }
                    } label: {
                        Text(viewModel.isSaving
                             ? "Saving..."
                             : (viewModel.editingRoom != nil ? "Update Room" : "+ Add Room"))
                            .font(AppTypography.body())
                            .fontWeight(.semibold)
                            .foregroundColor(.black)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, AppSpacing.md)
                            .background(Color(hex: "F59E0B"))
                            .cornerRadius(AppRadius.md)
                            .shadow(color: Color(hex: "525252"), radius: 3, y: 2)
                    }
                    .disabled(viewModel.isSaving)
                    
                    if viewModel.editingRoom != nil {
                        Button {
                            viewModel.cancelEdit()
                        } label: {
                            Text("Cancel")
                                .font(AppTypography.caption())
                                .foregroundColor(AppColors.textMedium)
                                .padding(.horizontal, AppSpacing.lg)
                                .padding(.vertical, AppSpacing.md)
                                .background(Color(hex: "E5E7EB"))
                                .cornerRadius(AppRadius.md)
                        }
                    }
                }
            }
        }
    }
    
    // MARK: - Room List
    
    private var roomListSection: some View {
        GlassCard(intensity: .light, style: .light) {
            VStack(alignment: .leading, spacing: AppSpacing.md) {
                Text("Rooms (\(viewModel.rooms.count))")
                    .font(AppTypography.headline())
                    .foregroundColor(AppColors.text)
                
                if viewModel.rooms.isEmpty {
                    Text("No rooms yet. Add your first room!")
                        .font(AppTypography.body())
                        .foregroundColor(AppColors.textGray)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, AppSpacing.xl)
                } else {
                    ForEach(viewModel.rooms) { room in
                        roomRow(room)
                    }
                }
            }
        }
    }
    
    // MARK: - Room Row
    
    private func roomRow(_ room: ShowroomRoom) -> some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            HStack(spacing: AppSpacing.md) {
                // Thumbnail
                if let thumbUrl = room.thumbnailUrl ?? room.image360Url,
                   let url = URL(string: thumbUrl.hasPrefix("http") ? thumbUrl : "https://api.gudinocustom.com\(thumbUrl)") {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image.resizable()
                                .aspectRatio(contentMode: .fill)
                                .frame(width: 60, height: 30)
                                .clipped()
                                .cornerRadius(AppRadius.sm)
                        default:
                            roomThumbnailPlaceholder
                        }
                    }
                } else {
                    roomThumbnailPlaceholder
                }
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(room.roomNameEn)
                        .font(AppTypography.body())
                        .fontWeight(.medium)
                        .foregroundColor(room.isEnabled ? AppColors.text : AppColors.textGray)
                    
                    Text(room.category.capitalized)
                        .font(AppTypography.small())
                        .foregroundColor(AppColors.textGray)
                    
                    if room.isStartingRoom {
                        Text("Starting Room")
                            .font(AppTypography.small())
                            .foregroundColor(Color(hex: "D97706"))
                            .padding(.horizontal, AppSpacing.sm)
                            .padding(.vertical, 1)
                            .background(Color(hex: "FEF3C7"))
                            .cornerRadius(AppRadius.sm)
                    }
                }
                
                Spacer()
                
                HStack(spacing: AppSpacing.md) {
                    Button {
                        viewModel.editRoom(room)
                    } label: {
                        Text("Edit")
                            .font(AppTypography.small())
                            .foregroundColor(AppColors.blue)
                    }
                    
                    Button {
                        roomToDelete = room
                        showDeleteRoomAlert = true
                    } label: {
                        Text("Delete")
                            .font(AppTypography.small())
                            .foregroundColor(AppColors.error)
                    }
                }
            }
            .padding(AppSpacing.md)
            .background(Color.white)
            .cornerRadius(AppRadius.md)
            .opacity(room.isEnabled ? 1 : 0.6)
            .overlay(
                RoundedRectangle(cornerRadius: AppRadius.md)
                    .stroke(Color(hex: "E5E7EB"), lineWidth: 1)
            )
        }
    }
    
    private var roomThumbnailPlaceholder: some View {
        RoundedRectangle(cornerRadius: AppRadius.sm)
            .fill(Color(hex: "E5E7EB"))
            .frame(width: 60, height: 30)
            .overlay(
                Image(systemName: "photo")
                    .font(.system(size: 14))
                    .foregroundColor(AppColors.textGray)
            )
    }
    
    // MARK: - Settings Tab
    
    private var settingsTab: some View {
        VStack(spacing: AppSpacing.lg) {
            if let settings = viewModel.settings {
                GlassCard(intensity: .light, style: .light) {
                    VStack(alignment: .leading, spacing: AppSpacing.lg) {
                        Text("Showroom Settings")
                            .font(AppTypography.headline())
                            .foregroundColor(AppColors.text)
                        
                        // Visibility Toggle
                        GlassCard(intensity: .light, style: .light) {
                            HStack {
                                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                                    Text("Show Showroom in Navigation")
                                        .font(AppTypography.body())
                                        .fontWeight(.medium)
                                        .foregroundColor(AppColors.text)
                                    Text(settings.showroomVisible
                                         ? "Showroom tab is visible to visitors"
                                         : "Showroom tab is hidden from visitors")
                                        .font(AppTypography.small())
                                        .foregroundColor(AppColors.textGray)
                                }
                                
                                Spacer()
                                
                                Toggle("", isOn: Binding(
                                    get: { viewModel.settings?.showroomVisible ?? false },
                                    set: { viewModel.settings?.showroomVisible = $0 }
                                ))
                                .tint(AppColors.success)
                            }
                        }
                        
                        // Welcome Messages
                        VStack(alignment: .leading, spacing: AppSpacing.xs) {
                            Text("Welcome Message (EN)")
                                .font(AppTypography.small())
                                .fontWeight(.medium)
                                .foregroundColor(AppColors.textMedium)
                            TextField("Welcome to our showroom", text: Binding(
                                get: { viewModel.settings?.welcomeMessageEn ?? "" },
                                set: { viewModel.settings?.welcomeMessageEn = $0 }
                            ))
                            .font(AppTypography.body())
                            .padding(AppSpacing.md)
                            .background(Color.white)
                            .cornerRadius(AppRadius.md)
                            .overlay(
                                RoundedRectangle(cornerRadius: AppRadius.md)
                                    .stroke(Color(hex: "D1D5DB"), lineWidth: 1)
                            )
                        }
                        
                        VStack(alignment: .leading, spacing: AppSpacing.xs) {
                            Text("Welcome Message (ES)")
                                .font(AppTypography.small())
                                .fontWeight(.medium)
                                .foregroundColor(AppColors.textMedium)
                            TextField("Bienvenido a nuestra sala de exhibición", text: Binding(
                                get: { viewModel.settings?.welcomeMessageEs ?? "" },
                                set: { viewModel.settings?.welcomeMessageEs = $0 }
                            ))
                            .font(AppTypography.body())
                            .padding(AppSpacing.md)
                            .background(Color.white)
                            .cornerRadius(AppRadius.md)
                            .overlay(
                                RoundedRectangle(cornerRadius: AppRadius.md)
                                    .stroke(Color(hex: "D1D5DB"), lineWidth: 1)
                            )
                        }
                        
                        // Navigation Style
                        VStack(alignment: .leading, spacing: AppSpacing.xs) {
                            Text("Navigation Style")
                                .font(AppTypography.small())
                                .fontWeight(.medium)
                                .foregroundColor(AppColors.textMedium)
                            
                            Picker("Navigation Style", selection: Binding(
                                get: { viewModel.settings?.navigationStyle ?? "dropdown" },
                                set: { viewModel.settings?.navigationStyle = $0 }
                            )) {
                                Text("Dropdown").tag("dropdown")
                                Text("Arrows").tag("arrows")
                                Text("Minimap").tag("minimap")
                            }
                            .pickerStyle(.segmented)
                        }
                        
                        // Three.js Info
                        HStack(spacing: AppSpacing.sm) {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(AppColors.success)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Three.js Viewer Active")
                                    .font(AppTypography.caption())
                                    .fontWeight(.medium)
                                    .foregroundColor(Color(hex: "166534"))
                                Text("The showroom uses Three.js for 360° viewing with material swapping.")
                                    .font(AppTypography.small())
                                    .foregroundColor(Color(hex: "166534"))
                            }
                        }
                        .padding(AppSpacing.md)
                        .background(Color(hex: "F0FDF4"))
                        .cornerRadius(AppRadius.md)
                        
                        // Toggles Grid
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: AppSpacing.md) {
                            Toggle("VR Mode", isOn: Binding(
                                get: { viewModel.settings?.vrModeEnabled ?? false },
                                set: { viewModel.settings?.vrModeEnabled = $0 }
                            ))
                            .font(AppTypography.caption())
                            
                            Toggle("Auto Rotate", isOn: Binding(
                                get: { viewModel.settings?.autoRotateEnabled ?? false },
                                set: { viewModel.settings?.autoRotateEnabled = $0 }
                            ))
                            .font(AppTypography.caption())
                            
                            Toggle("Compass", isOn: Binding(
                                get: { viewModel.settings?.showCompass ?? false },
                                set: { viewModel.settings?.showCompass = $0 }
                            ))
                            .font(AppTypography.caption())
                            
                            Toggle("Zoom Controls", isOn: Binding(
                                get: { viewModel.settings?.showZoomControls ?? false },
                                set: { viewModel.settings?.showZoomControls = $0 }
                            ))
                            .font(AppTypography.caption())
                        }
                        
                        // Save Button
                        Button {
                            Task { await viewModel.saveSettings() }
                        } label: {
                            Text(viewModel.isSaving ? "Saving..." : "Save Settings")
                                .font(AppTypography.body())
                                .fontWeight(.semibold)
                                .foregroundColor(.black)
                                .padding(.horizontal, AppSpacing.xl)
                                .padding(.vertical, AppSpacing.md)
                                .background(Color(hex: "F59E0B"))
                                .cornerRadius(AppRadius.md)
                                .shadow(color: Color(hex: "525252"), radius: 3, y: 2)
                        }
                        .disabled(viewModel.isSaving)
                    }
                }
            } else {
                ProgressView("Loading settings...")
            }
        }
    }
    
    // MARK: - Setup Guide Tab
    
    private var setupGuideTab: some View {
        VStack(spacing: AppSpacing.lg) {
            // Quick Start Demo
            GlassCard(intensity: .light, style: .light) {
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text("Quick Start Demo")
                        .font(AppTypography.headline())
                        .foregroundColor(Color(hex: "92400E"))
                    
                    Text("Load sample data with demo panoramas to test the virtual showroom features.")
                        .font(AppTypography.caption())
                        .foregroundColor(Color(hex: "B45309"))
                    
                    HStack(spacing: AppSpacing.md) {
                        Button {
                            showSeedConfirmation = true
                        } label: {
                            Text(viewModel.isSaving ? "Loading..." : "Load Demo Data")
                                .font(AppTypography.caption())
                                .fontWeight(.medium)
                                .foregroundColor(.white)
                                .padding(.horizontal, AppSpacing.lg)
                                .padding(.vertical, AppSpacing.md)
                                .background(Color(hex: "F59E0B"))
                                .cornerRadius(AppRadius.md)
                        }
                        .disabled(viewModel.isSaving)
                        
                        Button {
                            showClearConfirmation = true
                        } label: {
                            Text("Clear All Data")
                                .font(AppTypography.caption())
                                .fontWeight(.medium)
                                .foregroundColor(.white)
                                .padding(.horizontal, AppSpacing.lg)
                                .padding(.vertical, AppSpacing.md)
                                .background(AppColors.error)
                                .cornerRadius(AppRadius.md)
                        }
                        .disabled(viewModel.isSaving)
                    }
                }
            }
            .overlay(
                RoundedRectangle(cornerRadius: AppRadius.lg)
                    .stroke(Color(hex: "F59E0B").opacity(0.5), lineWidth: 1)
            )
            
            // Material Swapping Workflow
            GlassCard(intensity: .light, style: .light) {
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text("Material Swapping: How It Works")
                        .font(AppTypography.headline())
                        .foregroundColor(Color(hex: "1E40AF"))
                    
                    Text("The material swapping feature lets visitors customize finishes in your 360° showroom.")
                        .font(AppTypography.caption())
                        .foregroundColor(Color(hex: "3B82F6"))
                    
                    // Workflow Steps
                    HStack(spacing: AppSpacing.xs) {
                        workflowStep(number: "1", title: "Rooms", subtitle: "Upload 360° panoramas", color: Color(hex: "3B82F6"))
                        Image(systemName: "arrow.right")
                            .font(.system(size: 12))
                            .foregroundColor(AppColors.textGray)
                        workflowStep(number: "2", title: "Materials", subtitle: "Create finishes", color: AppColors.success)
                        Image(systemName: "arrow.right")
                            .font(.system(size: 12))
                            .foregroundColor(AppColors.textGray)
                        workflowStep(number: "3", title: "Elements", subtitle: "Define regions", color: Color(hex: "7C3AED"))
                    }
                }
            }
            .overlay(
                RoundedRectangle(cornerRadius: AppRadius.lg)
                    .stroke(Color(hex: "3B82F6").opacity(0.3), lineWidth: 1)
            )
            
            // Detailed Guide Steps
            GlassCard(intensity: .light, style: .light) {
                VStack(alignment: .leading, spacing: AppSpacing.lg) {
                    Text("Detailed Setup Guide")
                        .font(AppTypography.headline())
                        .foregroundColor(AppColors.text)
                    
                    guideStep(number: 1, title: "Create 360° Panorama Images", items: [
                        "Use Ricoh Theta, Insta360 ONE X3, or smartphone apps",
                        "Equirectangular format (2:1 ratio)",
                        "Min 4096x2048, recommended 8192x4096",
                        "JPEG or PNG, under 15MB"
                    ])
                    
                    guideStep(number: 2, title: "Add Showroom Rooms", items: [
                        "Add room name in English and Spanish",
                        "Upload your 360° panorama image",
                        "Set one room as the Starting Room",
                        "Adjust default view angles"
                    ])
                    
                    guideStep(number: 3, title: "Create Materials", items: [
                        "Create categories (Flooring, Countertops, etc.)",
                        "Add materials with colors and textures",
                        "Upload texture images for realistic appearance"
                    ])
                    
                    guideStep(number: 4, title: "Define Swappable Elements", items: [
                        "Select a room to add elements to",
                        "Name the element (Floor, Countertop, etc.)",
                        "Define the region on the panorama",
                        "Link materials that can be applied"
                    ])
                    
                    guideStep(number: 5, title: "Test Your Showroom", items: [
                        "Visit /showroom on your website",
                        "Click and drag to look around",
                        "Click on surfaces to change materials",
                        "Test on desktop and mobile"
                    ])
                }
            }
            
            // Pro Tips
            GlassCard(intensity: .light, style: .light) {
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text("Pro Tips")
                        .font(AppTypography.headline())
                        .foregroundColor(Color(hex: "1E40AF"))
                    
                    Group {
                        tipRow("Use a tripod at eye level (5-6 feet) for best results")
                        tipRow("Capture panoramas during consistent lighting")
                        tipRow("Use 512x512 or 1024x1024 tileable textures")
                        tipRow("Test on both desktop and mobile devices")
                        tipRow("Keep 3-5 swappable elements per room for performance")
                    }
                }
            }
            .overlay(
                RoundedRectangle(cornerRadius: AppRadius.lg)
                    .stroke(Color(hex: "3B82F6").opacity(0.3), lineWidth: 1)
            )
        }
    }
    
    // MARK: - Helper Views
    
    private func workflowStep(number: String, title: String, subtitle: String, color: Color) -> some View {
        VStack(spacing: AppSpacing.xs) {
            Text(number)
                .font(.system(size: 20, weight: .bold))
                .foregroundColor(color)
            Text(title)
                .font(AppTypography.small())
                .fontWeight(.medium)
                .foregroundColor(AppColors.text)
            Text(subtitle)
                .font(.system(size: 9))
                .foregroundColor(AppColors.textGray)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(AppSpacing.sm)
        .background(Color.white)
        .cornerRadius(AppRadius.md)
        .overlay(
            RoundedRectangle(cornerRadius: AppRadius.md)
                .stroke(color.opacity(0.3), lineWidth: 2)
        )
    }
    
    private func guideStep(number: Int, title: String, items: [String]) -> some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            HStack(spacing: AppSpacing.sm) {
                Text("\(number)")
                    .font(AppTypography.small())
                    .fontWeight(.bold)
                    .foregroundColor(.white)
                    .frame(width: 24, height: 24)
                    .background(Color(hex: "F59E0B"))
                    .cornerRadius(12)
                
                Text(title)
                    .font(AppTypography.body())
                    .fontWeight(.semibold)
                    .foregroundColor(AppColors.text)
            }
            
            VStack(alignment: .leading, spacing: AppSpacing.xs) {
                ForEach(items, id: \.self) { item in
                    HStack(alignment: .top, spacing: AppSpacing.sm) {
                        Text("•")
                            .foregroundColor(AppColors.textGray)
                        Text(item)
                            .font(AppTypography.small())
                            .foregroundColor(AppColors.textGray)
                    }
                }
            }
            .padding(.leading, 36)
        }
    }
    
    private func tipRow(_ text: String) -> some View {
        HStack(alignment: .top, spacing: AppSpacing.sm) {
            Text("•")
                .foregroundColor(Color(hex: "3B82F6"))
            Text(text)
                .font(AppTypography.caption())
                .foregroundColor(Color(hex: "3B82F6"))
        }
    }
}
