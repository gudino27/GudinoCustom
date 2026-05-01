//
//  GlassView.swift
//  GCWadmin
//
//  Base glass morphism component matching admin.css effects
//  Updated with Liquid Glass support for iOS 26+
//

import SwiftUI

// MARK: - Glass Intensity
enum GlassIntensity {
    /// Light blur (5px) - for tabs, content
    case light
    /// Regular blur (10px) - for navigation
    case regular
    /// Strong blur (15px) - for headers, login
    case strong

    var material: Material {
        switch self {
        case .light: return .ultraThinMaterial
        case .regular: return .thinMaterial
        case .strong: return .regularMaterial
        }
    }

    var overlayOpacity: Double {
        switch self {
        case .light: return 0.1
        case .regular: return 0.25
        case .strong: return 0.15
        }
    }

    var borderOpacity: Double {
        switch self {
        case .light: return 0.2
        case .regular: return 0.18
        case .strong: return 0.2
        }
    }
}

// MARK: - Glass Style
enum GlassStyle {
    /// Light glass on dark background (navigation, tabs)
    case light
    /// Dark glass on light background (login form)
    case dark

    var overlayColor: Color {
        switch self {
        case .light: return .white
        case .dark: return .black
        }
    }

    var borderColor: Color {
        switch self {
        case .light: return .white
        case .dark: return .white
        }
    }
}

// MARK: - Glass View Modifier (iOS 26+ with Liquid Glass support)
struct GlassModifier: ViewModifier {
    let intensity: GlassIntensity
    let style: GlassStyle
    let cornerRadius: CGFloat
    let showBorder: Bool
    let showShadow: Bool

    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            // Use Liquid Glass on iOS 26+
            content
                .glassEffect(glassVariant, in: .rect(cornerRadius: cornerRadius))
        } else {
            // Use traditional glass morphism on iOS 18-25
            content
                .background {
                    if style == .dark {
                        Color.black.opacity(0.85)
                    } else {
                        ZStack {
                            Color.clear
                                .background(intensity.material)
                            Color.white.opacity(intensity.overlayOpacity)
                        }
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
                .overlay(
                    RoundedRectangle(cornerRadius: cornerRadius)
                        .stroke(
                            style.borderColor.opacity(intensity.borderOpacity),
                            lineWidth: showBorder ? 1 : 0
                        )
                )
                .shadow(
                    color: showShadow ? AppShadows.glass.color : .clear,
                    radius: showShadow ? AppShadows.glass.radius : 0,
                    x: AppShadows.glass.x,
                    y: showShadow ? AppShadows.glass.y : 0
                )
        }
    }
    
    // Configure Liquid Glass variant based on style and intensity
    @available(iOS 26.0, *)
    private var glassVariant: Glass {
        let baseGlass: Glass = .regular
        
        switch style {
        case .light:
            // Light glass with subtle tint for better visibility on dark backgrounds
            return baseGlass.tint(.white.opacity(0.05))
        case .dark:
            // Darker glass with tint for login/modal backgrounds
            return baseGlass.tint(.black.opacity(0.3))
        }
    }
}

// MARK: - Tab Glass Modifier (with active state and iOS 26+ support)
struct TabGlassModifier: ViewModifier {
    let isActive: Bool
    let cornerRadius: CGFloat

    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            // Use Liquid Glass with interactive mode for tabs on iOS 26+
            content
                .glassEffect(
                    isActive ? .regular.tint(.blue.opacity(0.15)).interactive() : .regular.interactive(),
                    in: .rect(cornerRadius: cornerRadius)
                )
        } else {
            // Traditional glass morphism for iOS 18-25
            content
                .background(
                    isActive
                        ? AppColors.glassActiveBlue
                        : AppColors.glassTab
                )
                .background(.ultraThinMaterial)
                .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
                .overlay(
                    RoundedRectangle(cornerRadius: cornerRadius)
                        .stroke(
                            isActive
                                ? AppColors.glassActiveBlueBorder
                                : AppColors.glassBorderLight,
                            lineWidth: 1
                        )
                )
                .shadow(
                    color: isActive ? AppShadows.activeTab.color : .clear,
                    radius: isActive ? AppShadows.activeTab.radius : 0,
                    x: AppShadows.activeTab.x,
                    y: isActive ? AppShadows.activeTab.y : 0
                )
        }
    }
}

// MARK: - View Extension
extension View {
    /// Apply glass morphism effect (iOS 26+ uses Liquid Glass, older versions use Material)
    func glass(
        intensity: GlassIntensity = .regular,
        style: GlassStyle = .light,
        cornerRadius: CGFloat = AppRadius.xl,
        showBorder: Bool = true,
        showShadow: Bool = true
    ) -> some View {
        modifier(GlassModifier(
            intensity: intensity,
            style: style,
            cornerRadius: cornerRadius,
            showBorder: showBorder,
            showShadow: showShadow
        ))
    }

    /// Apply navigation glass style (from .admin-nav-glass)
    func navGlass(cornerRadius: CGFloat = 0) -> some View {
        glass(
            intensity: .regular,
            style: .light,
            cornerRadius: cornerRadius,
            showBorder: true,
            showShadow: true
        )
    }

    /// Apply tab glass style (from .admin-tab-glass)
    func tabGlass(isActive: Bool = false, cornerRadius: CGFloat = AppRadius.xl) -> some View {
        modifier(TabGlassModifier(isActive: isActive, cornerRadius: cornerRadius))
    }

    /// Apply header glass style (from .admin-header-glass)
    func headerGlass(cornerRadius: CGFloat = 0) -> some View {
        glass(
            intensity: .strong,
            style: .light,
            cornerRadius: cornerRadius,
            showBorder: true,
            showShadow: false
        )
        .shadow(
            color: AppShadows.glassHeader.color,
            radius: AppShadows.glassHeader.radius,
            x: AppShadows.glassHeader.x,
            y: AppShadows.glassHeader.y
        )
    }

    /// Apply content glass style (from .admin-content-glass)
    func contentGlass(cornerRadius: CGFloat = AppRadius.xxl) -> some View {
        glass(
            intensity: .light,
            style: .light,
            cornerRadius: cornerRadius,
            showBorder: true,
            showShadow: true
        )
    }

    /// Apply dark glass style (for login form)
    func darkGlass(cornerRadius: CGFloat = AppRadius.xxl) -> some View {
        glass(
            intensity: .strong,
            style: .dark,
            cornerRadius: cornerRadius,
            showBorder: true,
            showShadow: true
        )
    }

    /// Apply button glass style (from .admin-btn-glass)
    func buttonGlass(cornerRadius: CGFloat = AppRadius.lg) -> some View {
        glass(
            intensity: .regular,
            style: .light,
            cornerRadius: cornerRadius,
            showBorder: true,
            showShadow: false
        )
    }
}

// MARK: - Glass Card View
struct GlassCard<Content: View>: View {
    let intensity: GlassIntensity
    let style: GlassStyle
    let cornerRadius: CGFloat
    let padding: CGFloat
    @ViewBuilder let content: Content

    init(
        intensity: GlassIntensity = .light,
        style: GlassStyle = .light,
        cornerRadius: CGFloat = AppRadius.xxl,
        padding: CGFloat = AppSpacing.xl,
        @ViewBuilder content: () -> Content
    ) {
        self.intensity = intensity
        self.style = style
        self.cornerRadius = cornerRadius
        self.padding = padding
        self.content = content()
    }

    var body: some View {
        content
            .padding(padding)
            .glass(
                intensity: intensity,
                style: style,
                cornerRadius: cornerRadius
            )
    }
}

// MARK: - Dark Glass Card (for login)
struct DarkGlassCard<Content: View>: View {
    let cornerRadius: CGFloat
    let padding: CGFloat
    @ViewBuilder let content: Content

    init(
        cornerRadius: CGFloat = AppRadius.xxl,
        padding: CGFloat = AppSpacing.xxxl,
        @ViewBuilder content: () -> Content
    ) {
        self.cornerRadius = cornerRadius
        self.padding = padding
        self.content = content()
    }

    var body: some View {
        content
            .padding(padding)
            .darkGlass(cornerRadius: cornerRadius)
    }
}

// MARK: - Previews
#Preview("Glass Styles") {
    ZStack {
        // Gray background like admin dashboard
        AppColors.primary
            .ignoresSafeArea()

        VStack(spacing: AppSpacing.xl) {
            // Nav glass
            Text("Navigation Glass")
                .foregroundColor(.white)
                .padding()
                .navGlass(cornerRadius: AppRadius.lg)

            // Tab glass (inactive)
            Text("Tab Glass (Inactive)")
                .foregroundColor(.white)
                .padding(.horizontal, AppSpacing.lg)
                .padding(.vertical, AppSpacing.md)
                .tabGlass(isActive: false)

            // Tab glass (active)
            Text("Tab Glass (Active)")
                .foregroundColor(AppColors.blueDark)
                .padding(.horizontal, AppSpacing.lg)
                .padding(.vertical, AppSpacing.md)
                .tabGlass(isActive: true)

            // Content glass
            GlassCard {
                VStack {
                    Text("Content Glass Card")
                        .foregroundColor(.white)
                    Text("With some content inside")
                        .foregroundColor(.white.opacity(0.7))
                }
            }

            // Dark glass (login style)
            DarkGlassCard {
                VStack {
                    Text("Dark Glass Card")
                        .foregroundColor(.white)
                    Text("For login forms")
                        .foregroundColor(.gray)
                }
            }
            
            Text("On iOS 26+: Uses Liquid Glass ✨")
                .font(.caption)
                .foregroundColor(.white.opacity(0.6))
            Text("On iOS 18-25: Uses Material Glass")
                .font(.caption)
                .foregroundColor(.white.opacity(0.6))
        }
        .padding()
    }
}
