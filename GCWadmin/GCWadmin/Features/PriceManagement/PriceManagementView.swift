//
//  PriceManagementView.swift
//  GCWadmin
//
//  Main view for Price Management with tabs
//

import SwiftUI

struct PriceManagementView: View {
    @StateObject private var viewModel = PriceManagementViewModel()

    var body: some View {
        VStack(spacing: 0) {
            // Tab Selector
            tabSelector

            // Content
            ScrollView {
                VStack(spacing: AppSpacing.lg) {
                    switch viewModel.selectedTab {
                    case 0:
                        CabinetsPricingView(viewModel: viewModel)
                    case 1:
                        MaterialsPricingView(viewModel: viewModel)
                    case 2:
                        ColorsPricingView(viewModel: viewModel)
                    case 3:
                        WallsPricingView(viewModel: viewModel)
                    case 4:
                        WallAvailabilityView(viewModel: viewModel)
                    default:
                        EmptyView()
                    }
                }
                .padding()
            }
        }
        .navigationTitle("Price Management")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.loadAllPricing()
        }
        .alert("Error", isPresented: .constant(viewModel.errorMessage != nil)) {
            Button("OK") {
                viewModel.errorMessage = nil
            }
        } message: {
            if let error = viewModel.errorMessage {
                Text(error)
            }
        }
        .alert("Success", isPresented: .constant(viewModel.successMessage != nil)) {
            Button("OK") {
                viewModel.successMessage = nil
            }
        } message: {
            if let success = viewModel.successMessage {
                Text(success)
            }
        }
    }

    private var tabSelector: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: AppSpacing.sm) {
                TabButton(
                    title: "Cabinets",
                    icon: "cabinet",
                    isActive: viewModel.selectedTab == 0
                ) {
                    viewModel.selectedTab = 0
                }

                TabButton(
                    title: "Materials",
                    icon: "square.stack.3d.up",
                    isActive: viewModel.selectedTab == 1
                ) {
                    viewModel.selectedTab = 1
                }

                TabButton(
                    title: "Colors",
                    icon: "paintpalette",
                    isActive: viewModel.selectedTab == 2
                ) {
                    viewModel.selectedTab = 2
                }

                TabButton(
                    title: "Walls",
                    icon: "square.split.2x1",
                    isActive: viewModel.selectedTab == 3
                ) {
                    viewModel.selectedTab = 3
                }

                TabButton(
                    title: "Availability",
                    icon: "checkmark.circle",
                    isActive: viewModel.selectedTab == 4
                ) {
                    viewModel.selectedTab = 4
                }
            }
            .padding(.horizontal, AppSpacing.md)
            .padding(.vertical, AppSpacing.sm)
        }
        .navGlass(cornerRadius: 0)
    }
}

// MARK: - Cabinets Pricing View

struct CabinetsPricingView: View {
    @ObservedObject var viewModel: PriceManagementViewModel

    var body: some View {
        VStack(spacing: AppSpacing.lg) {
            // Header Card
            VStack(alignment: .leading, spacing: AppSpacing.sm) {
                HStack {
                    Image(systemName: "cabinet")
                        .font(.title2)
                        .foregroundColor(AppColors.blue)
                    Text("Cabinet Pricing")
                        .font(AppTypography.title3())
                }

                Text("Set base prices for different cabinet types. Final prices will be calculated based on cabinet type, material, and color selections.")
                    .font(AppTypography.small())
                    .foregroundColor(AppColors.textGray)
            }
            .padding()
            .contentGlass()

            // Room Selector
            HStack(spacing: AppSpacing.sm) {
                ForEach([PriceManagementViewModel.CabinetRoom.kitchen, .bathroom], id: \.self) { room in
                    Button(action: {
                        viewModel.selectedCabinetRoom = room
                    }) {
                        HStack {
                            Image(systemName: room == .kitchen ? "house" : "drop")
                                .font(.body)
                            Text(room.rawValue)
                                .font(AppTypography.body())
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, AppSpacing.sm)
                        .padding(.horizontal, AppSpacing.md)
                        .background(viewModel.selectedCabinetRoom == room ? AppColors.blue : AppColors.glassTab)
                        .foregroundColor(viewModel.selectedCabinetRoom == room ? .white : AppColors.text)
                        .cornerRadius(AppRadius.md)
                    }
                }
            }

            // Cabinet Prices List
            if viewModel.cabinetPrices.isEmpty {
                VStack(spacing: AppSpacing.md) {
                    Image(systemName: "cabinet")
                        .font(.system(size: 48))
                        .foregroundColor(.gray)
                    Text("No cabinet types yet")
                        .font(AppTypography.headline())
                        .foregroundColor(.gray)
                    Text("Cabinet types need to be created in the designer first before they can be priced here.")
                        .font(AppTypography.small())
                        .foregroundColor(AppColors.textGray)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, AppSpacing.xl)
            } else {
                ScrollView {
                    VStack(spacing: AppSpacing.sm) {
                        if viewModel.filteredCabinetPrices.isEmpty {
                            Text("No \(viewModel.selectedCabinetRoom.rawValue.lowercased()) cabinets found")
                                .font(AppTypography.body())
                                .foregroundColor(.gray)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, AppSpacing.xl)
                        } else {
                            ForEach(viewModel.filteredCabinetPrices, id: \.0) { type, price in
                                CabinetPriceRow(
                                    type: type,
                                    price: price,
                                    onPriceChange: { newPrice in
                                        viewModel.updateCabinetPrice(type: type, price: newPrice)
                                    }
                                )
                            }
                        }
                    }
                }
            }

            // Save Button
            if !viewModel.cabinetPrices.isEmpty {
                Button(action: {
                    Task {
                        await viewModel.saveCabinetPrices()
                    }
                }) {
                    HStack {
                        if viewModel.isSaving {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Image(systemName: "checkmark.circle")
                        }
                        Text(viewModel.isSaving ? "Saving..." : "Save Changes")
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(AppColors.blue)
                    .foregroundColor(.white)
                    .cornerRadius(AppRadius.md)
                }
                .disabled(viewModel.isSaving)
            }
        }
    }
}

// MARK: - Cabinet Price Row

struct CabinetPriceRow: View {
    let type: String
    let price: Double
    let onPriceChange: (Double) -> Void

    @State private var priceText: String
    @FocusState private var isFocused: Bool

    init(type: String, price: Double, onPriceChange: @escaping (Double) -> Void) {
        self.type = type
        self.price = price
        self.onPriceChange = onPriceChange
        _priceText = State(initialValue: String(format: "%.2f", price))
    }

    var displayName: String {
        type.split(separator: "-")
            .map { $0.capitalized }
            .joined(separator: " ")
    }

    var body: some View {
        HStack {
            Text(displayName)
                .font(AppTypography.body())
                .foregroundColor(AppColors.text)
                .fontWeight(.medium)

            Spacer()

            HStack(spacing: 4) {
                Text("$")
                    .font(AppTypography.body())
                    .foregroundColor(AppColors.textGray)

                TextField("0.00", text: $priceText)
                    .font(AppTypography.body())
                    .foregroundColor(AppColors.text)
                    .keyboardType(.decimalPad)
                    .multilineTextAlignment(.trailing)
                    .frame(width: 80)
                    .focused($isFocused)
                    .onChange(of: priceText) { _, newValue in
                        if let newPrice = Double(newValue) {
                            onPriceChange(newPrice)
                        }
                    }
            }
            .padding(.horizontal, AppSpacing.sm)
            .padding(.vertical, AppSpacing.xs)
            .background(AppColors.surface)
            .cornerRadius(AppRadius.sm)
            .overlay(
                RoundedRectangle(cornerRadius: AppRadius.sm)
                    .stroke(isFocused ? AppColors.blue : AppColors.border, lineWidth: 1)
            )
        }
        .padding()
        .contentGlass()
    }
}

struct MaterialsPricingView: View {
    @ObservedObject var viewModel: PriceManagementViewModel

    var body: some View {
        VStack(spacing: AppSpacing.lg) {
            // Header Card
            VStack(alignment: .leading, spacing: AppSpacing.sm) {
                HStack {
                    Image(systemName: "square.stack.3d.up")
                        .font(.title2)
                        .foregroundColor(AppColors.blue)
                    Text("Material Multipliers")
                        .font(AppTypography.title3())
                }

                Text("Material multipliers affect the base cabinet prices. A multiplier of 1.5 means the material costs 50% more than the base price.")
                    .font(AppTypography.small())
                    .foregroundColor(AppColors.textGray)
            }
            .padding()
            .contentGlass()

            // Add Material Button
            Button(action: {
                viewModel.showAddMaterial = true
            }) {
                HStack {
                    Image(systemName: "plus.circle.fill")
                    Text("Add Material")
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(AppColors.successMedium)
                .foregroundColor(.white)
                .cornerRadius(AppRadius.md)
            }

            // Materials List
            if viewModel.materials.isEmpty {
                VStack(spacing: AppSpacing.md) {
                    Image(systemName: "tray")
                        .font(.system(size: 48))
                        .foregroundColor(.gray)
                    Text("No materials yet")
                        .font(AppTypography.body())
                        .foregroundColor(.gray)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, AppSpacing.xl)
            } else {
                ForEach(viewModel.materials) { material in
                    MaterialRow(material: material, viewModel: viewModel)
                }
            }

            // Save Button
            if !viewModel.materials.isEmpty {
                Button(action: {
                    Task {
                        await viewModel.saveMaterials()
                    }
                }) {
                    HStack {
                        if viewModel.isSaving {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Image(systemName: "checkmark.circle")
                        }
                        Text(viewModel.isSaving ? "Saving..." : "Save Changes")
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(AppColors.blue)
                    .foregroundColor(.white)
                    .cornerRadius(AppRadius.md)
                }
                .disabled(viewModel.isSaving)
            }
        }
        .sheet(isPresented: $viewModel.showAddMaterial) {
            AddMaterialModal(viewModel: viewModel)
        }
    }
}

// MARK: - Material Row

struct MaterialRow: View {
    let material: PricingMaterial
    @ObservedObject var viewModel: PriceManagementViewModel

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: AppSpacing.xs) {
                Text(material.nameEn)
                    .font(AppTypography.body())
                    .foregroundColor(AppColors.text)
                    .fontWeight(.medium)
                if material.nameEn != material.nameEs {
                    Text(material.nameEs)
                        .font(AppTypography.small())
                        .foregroundColor(AppColors.textMedium)
                }
            }

            Spacer()

            Text(material.displayMultiplier)
                .font(AppTypography.headline())
                .foregroundColor(AppColors.blue)
                .padding(.horizontal, AppSpacing.md)
                .padding(.vertical, AppSpacing.xs)
                .background(AppColors.blue.opacity(0.1))
                .cornerRadius(AppRadius.sm)

            Button(action: {
                viewModel.startEditMaterial(material)
            }) {
                Image(systemName: "pencil")
                    .foregroundColor(AppColors.blue)
                    .frame(width: 44, height: 44)
            }

            Button(action: {
                viewModel.deleteMaterial(material)
            }) {
                Image(systemName: "trash")
                    .foregroundColor(.red)
                    .frame(width: 44, height: 44)
            }
        }
        .padding()
        .contentGlass()
    }
}

// MARK: - Add/Edit Material Modal

struct AddMaterialModal: View {
    @ObservedObject var viewModel: PriceManagementViewModel
    @Environment(\.dismiss) var dismiss

    var isEditing: Bool {
        viewModel.editingMaterial != nil
    }

    var body: some View {
        NavigationView {
            Form {
                Section("Material Name") {
                    TextField("English Name", text: $viewModel.newMaterialNameEn)
                        .autocorrectionDisabled()
                    TextField("Spanish Name (Nombre en Español)", text: $viewModel.newMaterialNameEs)
                        .autocorrectionDisabled()
                }

                Section("Multiplier") {
                    TextField("Multiplier (e.g., 1.5)", text: $viewModel.newMaterialMultiplier)
                        .keyboardType(.decimalPad)

                    Text("A multiplier of 1.5 means the material costs 50% more than the base price")
                        .font(AppTypography.small())
                        .foregroundColor(AppColors.textGray)
                }
            }
            .navigationTitle(isEditing ? "Edit Material" : "Add New Material")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        viewModel.resetMaterialForm()
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button(isEditing ? "Update" : "Add") {
                        if isEditing {
                            viewModel.updateMaterial()
                        } else {
                            viewModel.addMaterial()
                        }
                        dismiss()
                    }
                    .disabled(viewModel.newMaterialNameEn.isEmpty)
                }
            }
        }
    }
}

// MARK: - Colors Pricing View

struct ColorsPricingView: View {
    @ObservedObject var viewModel: PriceManagementViewModel

    var colorOptions: [(key: String, label: String, icon: String)] {
        [
            ("1", "Standard (1 Color)", "paintpalette"),
            ("2", "Two-Tone (2 Colors)", "circle.lefthalf.filled"),
            ("3", "Multi-Color (3+ Colors)", "circle.grid.3x3.fill"),
            ("custom", "Custom", "wand.and.stars")
        ]
    }

    var body: some View {
        VStack(spacing: AppSpacing.lg) {
            // Header Card
            VStack(alignment: .leading, spacing: AppSpacing.sm) {
                HStack {
                    Image(systemName: "paintpalette")
                        .font(.title2)
                        .foregroundColor(AppColors.blue)
                    Text("Color Pricing")
                        .font(AppTypography.title3())
                }

                Text("Set price additions for different color options. These amounts will be added to the base cabinet price.")
                    .font(AppTypography.small())
                    .foregroundColor(AppColors.textGray)
            }
            .padding()
            .contentGlass()

            // Color Options List
            VStack(spacing: AppSpacing.sm) {
                ForEach(colorOptions, id: \.key) { option in
                    ColorPriceRow(
                        key: option.key,
                        label: option.label,
                        icon: option.icon,
                        price: viewModel.colorPricing[option.key] ?? 0,
                        onPriceChange: { newPrice in
                            viewModel.updateColorPrice(key: option.key, price: newPrice)
                        }
                    )
                }
            }

            Spacer()

            // Save Button
            Button(action: {
                Task {
                    await viewModel.saveColorPricing()
                }
            }) {
                HStack {
                    if viewModel.isSaving {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Image(systemName: "checkmark.circle")
                    }
                    Text(viewModel.isSaving ? "Saving..." : "Save Changes")
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(AppColors.blue)
                .foregroundColor(.white)
                .cornerRadius(AppRadius.md)
            }
            .disabled(viewModel.isSaving)
        }
    }
}

// MARK: - Color Price Row

struct ColorPriceRow: View {
    let key: String
    let label: String
    let icon: String
    let price: Double
    let onPriceChange: (Double) -> Void

    @State private var priceText: String
    @FocusState private var isFocused: Bool

    init(key: String, label: String, icon: String, price: Double, onPriceChange: @escaping (Double) -> Void) {
        self.key = key
        self.label = label
        self.icon = icon
        self.price = price
        self.onPriceChange = onPriceChange
        _priceText = State(initialValue: String(format: "%.2f", price))
    }

    var body: some View {
        HStack {
            HStack(spacing: AppSpacing.sm) {
                Image(systemName: icon)
                    .font(.body)
                    .foregroundColor(AppColors.blue)
                    .frame(width: 24)

                VStack(alignment: .leading, spacing: 2) {
                    Text(label)
                        .font(AppTypography.body())
                        .foregroundColor(AppColors.text)
                        .fontWeight(.medium)

                    if key == "1" {
                        Text("No additional charge")
                            .font(AppTypography.small())
                            .foregroundColor(AppColors.textMedium)
                    } else {
                        Text("+$\(String(format: "%.2f", price))")
                            .font(AppTypography.small())
                            .foregroundColor(AppColors.blue)
                    }
                }
            }

            Spacer()

            HStack(spacing: 4) {
                Text("$")
                    .font(AppTypography.body())
                    .foregroundColor(AppColors.textGray)

                TextField("0.00", text: $priceText)
                    .font(AppTypography.body())
                    .foregroundColor(AppColors.text)
                    .keyboardType(.decimalPad)
                    .multilineTextAlignment(.trailing)
                    .frame(width: 80)
                    .focused($isFocused)
                    .onChange(of: priceText) { _, newValue in
                        if let newPrice = Double(newValue) {
                            onPriceChange(newPrice)
                        }
                    }
            }
            .padding(.horizontal, AppSpacing.sm)
            .padding(.vertical, AppSpacing.xs)
            .background(AppColors.surface)
            .cornerRadius(AppRadius.sm)
            .overlay(
                RoundedRectangle(cornerRadius: AppRadius.sm)
                    .stroke(isFocused ? AppColors.blue : AppColors.border, lineWidth: 1)
            )
        }
        .padding()
        .contentGlass()
    }
}

// MARK: - Walls Pricing View

struct WallsPricingView: View {
    @ObservedObject var viewModel: PriceManagementViewModel

    var wallOptions: [(key: String, label: String, description: String, icon: String)] {
        [
            ("addWall", "Add Wall", "Price for adding a new wall to the kitchen", "plus.rectangle"),
            ("removeWall", "Remove Wall", "Price for removing an existing wall", "minus.rectangle")
        ]
    }

    var body: some View {
        VStack(spacing: AppSpacing.lg) {
            // Header Card
            VStack(alignment: .leading, spacing: AppSpacing.sm) {
                HStack {
                    Image(systemName: "square.split.2x1")
                        .font(.title2)
                        .foregroundColor(AppColors.blue)
                    Text("Wall Modifications")
                        .font(AppTypography.title3())
                }

                Text("Set prices for adding or removing walls during kitchen remodeling projects.")
                    .font(AppTypography.small())
                    .foregroundColor(AppColors.textGray)
            }
            .padding()
            .contentGlass()

            // Wall Modification Options
            VStack(spacing: AppSpacing.sm) {
                ForEach(wallOptions, id: \.key) { option in
                    WallPriceRow(
                        key: option.key,
                        label: option.label,
                        description: option.description,
                        icon: option.icon,
                        price: viewModel.wallPricing[option.key] ?? 0,
                        onPriceChange: { newPrice in
                            viewModel.updateWallPrice(type: option.key, price: newPrice)
                        }
                    )
                }
            }

            Spacer()

            // Save Button
            Button(action: {
                Task {
                    await viewModel.saveWallPricing()
                }
            }) {
                HStack {
                    if viewModel.isSaving {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Image(systemName: "checkmark.circle")
                    }
                    Text(viewModel.isSaving ? "Saving..." : "Save Changes")
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(AppColors.blue)
                .foregroundColor(.white)
                .cornerRadius(AppRadius.md)
            }
            .disabled(viewModel.isSaving)
        }
    }
}

// MARK: - Wall Price Row

struct WallPriceRow: View {
    let key: String
    let label: String
    let description: String
    let icon: String
    let price: Double
    let onPriceChange: (Double) -> Void

    @State private var priceText: String
    @FocusState private var isFocused: Bool

    init(key: String, label: String, description: String, icon: String, price: Double, onPriceChange: @escaping (Double) -> Void) {
        self.key = key
        self.label = label
        self.description = description
        self.icon = icon
        self.price = price
        self.onPriceChange = onPriceChange
        _priceText = State(initialValue: String(format: "%.2f", price))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            HStack {
                Image(systemName: icon)
                    .font(.title3)
                    .foregroundColor(key == "addWall" ? AppColors.successMedium : AppColors.errorMedium)
                    .frame(width: 32)

                VStack(alignment: .leading, spacing: 2) {
                    Text(label)
                        .font(AppTypography.headline())
                        .foregroundColor(AppColors.text)
                        .fontWeight(.semibold)

                    Text(description)
                        .font(AppTypography.small())
                        .foregroundColor(AppColors.textMedium)
                }

                Spacer()
            }

            HStack {
                Text("Price:")
                    .font(AppTypography.body())
                    .foregroundColor(AppColors.textGray)

                Spacer()

                HStack(spacing: 4) {
                    Text("$")
                        .font(AppTypography.headline())
                        .foregroundColor(AppColors.textGray)

                    TextField("0.00", text: $priceText)
                        .font(AppTypography.headline())
                        .foregroundColor(AppColors.text)
                        .keyboardType(.decimalPad)
                        .multilineTextAlignment(.trailing)
                        .frame(width: 100)
                        .focused($isFocused)
                        .onChange(of: priceText) { _, newValue in
                            if let newPrice = Double(newValue) {
                                onPriceChange(newPrice)
                            }
                        }
                }
                .padding(.horizontal, AppSpacing.md)
                .padding(.vertical, AppSpacing.sm)
                .background(AppColors.surface)
                .cornerRadius(AppRadius.sm)
                .overlay(
                    RoundedRectangle(cornerRadius: AppRadius.sm)
                        .stroke(isFocused ? AppColors.blue : AppColors.border, lineWidth: 1)
                )
            }
        }
        .padding()
        .contentGlass()
    }
}

// MARK: - Wall Availability View

struct WallAvailabilityView: View {
    @ObservedObject var viewModel: PriceManagementViewModel

    var body: some View {
        VStack(spacing: AppSpacing.lg) {
            // Header Card
            VStack(alignment: .leading, spacing: AppSpacing.sm) {
                HStack {
                    Image(systemName: "checkmark.circle")
                        .font(.title2)
                        .foregroundColor(AppColors.blue)
                    Text("Service Availability")
                        .font(AppTypography.title3())
                }

                Text("Enable or disable wall modification services. When disabled, these options will not be shown to customers.")
                    .font(AppTypography.small())
                    .foregroundColor(AppColors.textGray)
            }
            .padding()
            .contentGlass()

            // Add Wall Availability
            VStack(alignment: .leading, spacing: AppSpacing.md) {
                HStack {
                    VStack(alignment: .leading, spacing: AppSpacing.xs) {
                        HStack {
                            Image(systemName: "plus.rectangle")
                                .foregroundColor(AppColors.successMedium)
                            Text("Add Wall Service")
                                .font(AppTypography.headline())
                                .foregroundColor(AppColors.text)
                        }

                        Text("Allow customers to request adding new walls")
                            .font(AppTypography.small())
                            .foregroundColor(AppColors.textGray)
                    }

                    Spacer()

                    Toggle("", isOn: $viewModel.wallAvailability.addWallEnabled)
                        .labelsHidden()
                }
            }
            .padding()
            .contentGlass()

            // Remove Wall Availability
            VStack(alignment: .leading, spacing: AppSpacing.md) {
                HStack {
                    VStack(alignment: .leading, spacing: AppSpacing.xs) {
                        HStack {
                            Image(systemName: "minus.rectangle")
                                .foregroundColor(AppColors.errorMedium)
                            Text("Remove Wall Service")
                                .font(AppTypography.headline())
                                .foregroundColor(AppColors.text)
                        }

                        Text("Allow customers to request removing existing walls")
                            .font(AppTypography.small())
                            .foregroundColor(AppColors.textGray)
                    }

                    Spacer()

                    Toggle("", isOn: $viewModel.wallAvailability.removeWallEnabled)
                        .labelsHidden()
                }
            }
            .padding()
            .contentGlass()

            Spacer()

            // Save Button
            Button(action: {
                Task {
                    await viewModel.saveWallAvailability()
                }
            }) {
                HStack {
                    if viewModel.isSaving {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Image(systemName: "checkmark.circle")
                    }
                    Text(viewModel.isSaving ? "Saving..." : "Save Changes")
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(AppColors.blue)
                .foregroundColor(.white)
                .cornerRadius(AppRadius.md)
            }
            .disabled(viewModel.isSaving)
        }
    }
}
