//
//  Spacing.swift
//  GCWadmin
//
//  Spacing and radius system matching Tailwind CSS scale
//

import SwiftUI

// MARK: - Spacing System
struct AppSpacing {
    /// 0pt
    static let zero: CGFloat = 0
    /// 4pt (Tailwind 1)
    static let xs: CGFloat = 4
    /// 8pt (Tailwind 2)
    static let sm: CGFloat = 8
    /// 12pt (Tailwind 3)
    static let md: CGFloat = 12
    /// 16pt (Tailwind 4)
    static let base: CGFloat = 16
    /// 20pt (Tailwind 5)
    static let lg: CGFloat = 20
    /// 24pt (Tailwind 6)
    static let xl: CGFloat = 24
    /// 28pt (Tailwind 7)
    static let xxl: CGFloat = 28
    /// 32pt (Tailwind 8)
    static let xxxl: CGFloat = 32
    /// 40pt (Tailwind 10)
    static let xxxxl: CGFloat = 40
    /// 48pt (Tailwind 12)
    static let xxxxxl: CGFloat = 48
    /// 64pt (Tailwind 16)
    static let huge: CGFloat = 64
    /// 80pt (Tailwind 20)
    static let massive: CGFloat = 80
    /// 96pt (Tailwind 24)
    static let giant: CGFloat = 96
}

// MARK: - Border Radius System
struct AppRadius {
    /// 0pt
    static let none: CGFloat = 0
    /// 2pt (rounded-sm)
    static let sm: CGFloat = 2
    /// 4pt (rounded)
    static let base: CGFloat = 4
    /// 6pt (rounded-md)
    static let md: CGFloat = 6
    /// 8pt (rounded-lg)
    static let lg: CGFloat = 8
    /// 12pt (rounded-xl)
    static let xl: CGFloat = 12
    /// 16pt (rounded-2xl)
    static let xxl: CGFloat = 16
    /// 24pt (rounded-3xl)
    static let xxxl: CGFloat = 24
    /// Full circle
    static let full: CGFloat = 9999
}

// MARK: - Shadow Presets
struct AppShadows {
    /// Small shadow - sm
    static func small() -> some View {
        Color.clear
            .shadow(color: Color.black.opacity(0.05), radius: 1, x: 0, y: 1)
    }

    /// Default shadow - base
    static let base = (
        color: Color.black.opacity(0.1),
        radius: CGFloat(3),
        x: CGFloat(0),
        y: CGFloat(1)
    )

    /// Medium shadow - md
    static let medium = (
        color: Color.black.opacity(0.1),
        radius: CGFloat(6),
        x: CGFloat(0),
        y: CGFloat(4)
    )

    /// Large shadow - lg
    static let large = (
        color: Color.black.opacity(0.1),
        radius: CGFloat(15),
        x: CGFloat(0),
        y: CGFloat(10)
    )

    /// Extra large shadow - xl
    static let xl = (
        color: Color.black.opacity(0.1),
        radius: CGFloat(25),
        x: CGFloat(0),
        y: CGFloat(20)
    )

    /// Glass shadow (from admin.css: 0 8px 32px rgba(31, 38, 135, 0.37))
    static let glass = (
        color: Color(red: 31/255, green: 38/255, blue: 135/255).opacity(0.37),
        radius: CGFloat(16),
        x: CGFloat(0),
        y: CGFloat(8)
    )

    /// Glass header shadow (from admin.css: 0 4px 16px rgba(31, 38, 135, 0.2))
    static let glassHeader = (
        color: Color(red: 31/255, green: 38/255, blue: 135/255).opacity(0.2),
        radius: CGFloat(8),
        x: CGFloat(0),
        y: CGFloat(4)
    )

    /// Tab hover shadow (from admin.css: 0 8px 25px rgba(0, 0, 0, 0.15))
    static let tabHover = (
        color: Color.black.opacity(0.15),
        radius: CGFloat(12),
        x: CGFloat(0),
        y: CGFloat(8)
    )

    /// Active tab shadow (from admin.css: 0 8px 25px rgba(59, 130, 246, 0.3))
    static let activeTab = (
        color: Color(hex: "3b82f6").opacity(0.3),
        radius: CGFloat(12),
        x: CGFloat(0),
        y: CGFloat(8)
    )

    /// Button shadow (from admin.css: 0 4px 12px rgba(0, 0, 0, 0.15))
    static let button = (
        color: Color.black.opacity(0.15),
        radius: CGFloat(6),
        x: CGFloat(0),
        y: CGFloat(4)
    )
}

// MARK: - View Extension for Glass Shadow
extension View {
    /// Apply glass shadow effect matching admin.css
    func glassShadow() -> some View {
        shadow(
            color: AppShadows.glass.color,
            radius: AppShadows.glass.radius,
            x: AppShadows.glass.x,
            y: AppShadows.glass.y
        )
    }

    /// Apply glass header shadow
    func glassHeaderShadow() -> some View {
        shadow(
            color: AppShadows.glassHeader.color,
            radius: AppShadows.glassHeader.radius,
            x: AppShadows.glassHeader.x,
            y: AppShadows.glassHeader.y
        )
    }

    /// Apply tab hover shadow
    func tabHoverShadow() -> some View {
        shadow(
            color: AppShadows.tabHover.color,
            radius: AppShadows.tabHover.radius,
            x: AppShadows.tabHover.x,
            y: AppShadows.tabHover.y
        )
    }

    /// Apply active tab shadow (blue tinted)
    func activeTabShadow() -> some View {
        shadow(
            color: AppShadows.activeTab.color,
            radius: AppShadows.activeTab.radius,
            x: AppShadows.activeTab.x,
            y: AppShadows.activeTab.y
        )
    }

    /// Apply button shadow
    func buttonShadow() -> some View {
        shadow(
            color: AppShadows.button.color,
            radius: AppShadows.button.radius,
            x: AppShadows.button.x,
            y: AppShadows.button.y
        )
    }
}
