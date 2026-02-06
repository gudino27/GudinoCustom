//
//  GlassButton.swift
//  GCWadmin
//
//  Glass-styled buttons matching webapp admin.css
//

import SwiftUI

// MARK: - Primary Button (Blue)
struct PrimaryButton: View {
    let title: String
    let icon: String?
    let isLoading: Bool
    let isDisabled: Bool
    let action: () -> Void

    @State private var isPressed = false

    init(
        _ title: String,
        icon: String? = nil,
        isLoading: Bool = false,
        isDisabled: Bool = false,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.icon = icon
        self.isLoading = isLoading
        self.isDisabled = isDisabled
        self.action = action
    }

    var body: some View {
        Button(action: {
            if !isLoading && !isDisabled {
                action()
            }
        }) {
            HStack(spacing: AppSpacing.sm) {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        .scaleEffect(0.8)
                } else if let icon = icon {
                    Image(systemName: icon)
                        .font(.system(size: 18))
                }

                Text(title)
                    .font(AppTypography.bodyBold())
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, AppSpacing.md)
            .padding(.horizontal, AppSpacing.xl)
            .background(
                (isDisabled || isLoading)
                    ? AppColors.blue.opacity(0.5)
                    : AppColors.blue
            )
            .cornerRadius(AppRadius.lg)
            .scaleEffect(isPressed ? 0.98 : 1.0)
        }
        .buttonStyle(.plain)
        .disabled(isDisabled || isLoading)
        .touchShimmer()
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in isPressed = true }
                .onEnded { _ in isPressed = false }
        )
        .animation(.easeInOut(duration: 0.1), value: isPressed)
    }
}

// MARK: - Glass Button (from .admin-btn-glass)
struct GlassButton: View {
    let title: String
    let icon: String?
    let isLoading: Bool
    let action: () -> Void

    @State private var isPressed = false

    init(
        _ title: String,
        icon: String? = nil,
        isLoading: Bool = false,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.icon = icon
        self.isLoading = isLoading
        self.action = action
    }

    var body: some View {
        Button(action: {
            if !isLoading {
                action()
            }
        }) {
            HStack(spacing: AppSpacing.sm) {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: AppColors.textMedium))
                        .scaleEffect(0.8)
                } else if let icon = icon {
                    Image(systemName: icon)
                        .font(.system(size: 16))
                }

                Text(title)
                    .font(AppTypography.captionBold())
            }
            .foregroundColor(AppColors.textMedium)
            .padding(.vertical, AppSpacing.sm + 2)
            .padding(.horizontal, AppSpacing.lg)
            .background(AppColors.glassButton)
            .background(.thinMaterial)
            .cornerRadius(AppRadius.lg)
            .overlay(
                RoundedRectangle(cornerRadius: AppRadius.lg)
                    .stroke(AppColors.glassBorderStrong, lineWidth: 1)
            )
            .scaleEffect(isPressed ? 0.98 : 1.0)
            .offset(y: isPressed ? 1 : 0)
        }
        .buttonStyle(.plain)
        .disabled(isLoading)
        .hoverShimmer(duration: 0.6, color: .white.opacity(0.3))
        .buttonShadow()
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in isPressed = true }
                .onEnded { _ in isPressed = false }
        )
        .animation(.easeInOut(duration: 0.1), value: isPressed)
    }
}

// MARK: - Icon Button
struct IconButton: View {
    let icon: String
    let size: CGFloat
    let color: Color
    let backgroundColor: Color
    let action: () -> Void

    @State private var isPressed = false

    init(
        icon: String,
        size: CGFloat = 20,
        color: Color = .white,
        backgroundColor: Color = AppColors.glassDark,
        action: @escaping () -> Void
    ) {
        self.icon = icon
        self.size = size
        self.color = color
        self.backgroundColor = backgroundColor
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: size))
                .foregroundColor(color)
                .frame(width: max(size + 16, 44), height: max(size + 16, 44))
                .background(backgroundColor)
                .clipShape(Circle())
                .contentShape(Circle())
                .scaleEffect(isPressed ? 0.9 : 1.0)
        }
        .buttonStyle(.plain)
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in isPressed = true }
                .onEnded { _ in isPressed = false }
        )
        .animation(.easeInOut(duration: 0.1), value: isPressed)
    }
}

// MARK: - Tab Button (Glass)
struct TabButton: View {
    let title: String
    let icon: String
    let isActive: Bool
    let action: () -> Void

    @State private var isHovered = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: AppSpacing.sm) {
                Image(systemName: icon)
                    .font(.system(size: 16))

                Text(title)
                    .font(AppTypography.captionBold())
            }
            .foregroundColor(
                isActive
                    ? AppColors.blueDark
                    : AppColors.textMedium
            )
            .padding(.horizontal, AppSpacing.lg)
            .padding(.vertical, AppSpacing.md)
            .tabGlass(isActive: isActive)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Language Selector Button
struct LanguageSelectorButton: View {
    let currentLanguage: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: AppSpacing.sm) {
                Image(systemName: "globe")
                    .font(.system(size: 16))

                Text(currentLanguage)
                    .font(AppTypography.caption())

                Image(systemName: "chevron.down")
                    .font(.system(size: 12))
            }
            .foregroundColor(.white)
            .padding(.horizontal, AppSpacing.base)
            .padding(.vertical, AppSpacing.sm)
            .background(Color.white.opacity(0.15))
            .cornerRadius(AppRadius.full)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Previews
#Preview("Buttons") {
    ZStack {
        AppColors.primary
            .ignoresSafeArea()

        VStack(spacing: AppSpacing.xl) {
            // Primary button
            PrimaryButton("Sign In", icon: "arrow.right") {
                print("Sign in tapped")
            }

            // Loading primary button
            PrimaryButton("Signing In...", isLoading: true) {
                print("Loading")
            }

            // Disabled primary button
            PrimaryButton("Disabled", isDisabled: true) {
                print("Disabled")
            }

            // Glass button
            GlassButton("Glass Button", icon: "star.fill") {
                print("Glass button tapped")
            }

            // Icon buttons
            HStack(spacing: AppSpacing.base) {
                IconButton(icon: "xmark") {
                    print("Close")
                }

                IconButton(icon: "arrow.right.square", color: .white, backgroundColor: AppColors.blue) {
                    print("Logout")
                }
            }

            // Tab buttons
            HStack(spacing: AppSpacing.sm) {
                TabButton(title: "Prices", icon: "dollarsign.circle", isActive: true) {
                    print("Prices")
                }

                TabButton(title: "Photos", icon: "photo", isActive: false) {
                    print("Photos")
                }
            }

            // Language selector
            LanguageSelectorButton(currentLanguage: "English") {
                print("Language selector")
            }
        }
        .padding(AppSpacing.xl)
    }
}
