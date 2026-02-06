//
//  Colors.swift
//  GCWadmin
//
//  Color system matching webapp admin.css and React Native colors.js exactly
//

import SwiftUI

// MARK: - App Colors
struct AppColors {
    // === Primary - Admin Gray Background ===
    static let primary = Color(hex: "6e6e6e")           // rgb(110, 110, 110)
    static let primaryLight = Color(hex: "3b82f6")      // blue-500
    static let primaryDark = Color(hex: "1e40af")       // blue-800

    // === Blue System (Tailwind blue) - PRIMARY BUTTONS & LINKS ===
    static let blue = Color(hex: "3b82f6")              // blue-500
    static let blueHover = Color(hex: "2563eb")         // blue-700
    static let blueDark = Color(hex: "1d4ed8")          // blue-800 - active text
    static let blueLight = Color(hex: "60a5fa")         // blue-400

    // === Accent Colors (Amber) ===
    static let accent = Color(hex: "f59e0b")            // amber-500
    static let accentLight = Color(hex: "fbbf24")       // amber-400
    static let accentDark = Color(hex: "d97706")        // amber-600

    // === Backgrounds ===
    static let background = Color(hex: "f3f4f6")        // gray-100 - main bg
    static let backgroundDark = Color(hex: "e5e7eb")    // gray-200
    static let surface = Color.white

    // === Borders ===
    static let border = Color(hex: "e5e7eb")            // gray-200
    static let borderMedium = Color(hex: "d1d5db")      // gray-300
    static let borderDark = Color(hex: "9ca3af")        // gray-400

    // === Text Colors ===
    static let text = Color(hex: "111827")              // gray-900
    static let textMedium = Color(hex: "374151")        // gray-700
    static let textGray = Color(hex: "6b7280")          // gray-500
    static let textLight = Color(hex: "9ca3af")         // gray-400
    static let textMuted = Color(hex: "94a3b8")         // slate-400

    // === Status Colors - Red ===
    static let error = Color(hex: "b91c1c")             // red-700
    static let errorBg = Color(hex: "fef2f2")           // red-50
    static let errorBorder = Color(hex: "fecaca")       // red-200
    static let errorMedium = Color(hex: "ef4444")       // red-500

    // === Status Colors - Green ===
    static let success = Color(hex: "15803d")           // green-700
    static let successBg = Color(hex: "f0fdf4")         // green-50
    static let successBorder = Color(hex: "bbf7d0")     // green-200
    static let successMedium = Color(hex: "22c55e")     // green-500

    // === Status Colors - Yellow ===
    static let warning = Color(hex: "a16207")           // yellow-700
    static let warningBg = Color(hex: "fefce8")         // yellow-50
    static let warningBorder = Color(hex: "fef08a")     // yellow-200
    static let warningMedium = Color(hex: "eab308")     // yellow-500

    // === Info Colors ===
    static let info = Color(hex: "3b82f6")              // blue-500
    static let infoBg = Color(hex: "eff6ff")            // blue-50
    static let infoLight = Color(hex: "60a5fa")         // blue-400
    static let infoDark = Color(hex: "2563eb")          // blue-600

    // === Neutral Grays (Tailwind scale) ===
    static let gray50 = Color(hex: "f9fafb")
    static let gray100 = Color(hex: "f3f4f6")
    static let gray200 = Color(hex: "e5e7eb")
    static let gray300 = Color(hex: "d1d5db")
    static let gray400 = Color(hex: "9ca3af")
    static let gray500 = Color(hex: "6b7280")
    static let gray600 = Color(hex: "4b5563")
    static let gray700 = Color(hex: "374151")
    static let gray800 = Color(hex: "1f2937")
    static let gray900 = Color(hex: "111827")

    // === Glass Effect Colors (from admin.css) ===

    /// Navigation glass: rgba(255, 255, 255, 0.25) + blur(10px)
    static let glassNav = Color.white.opacity(0.25)

    /// Tab glass: rgba(255, 255, 255, 0.1) + blur(5px)
    static let glassTab = Color.white.opacity(0.1)

    /// Tab glass hover: rgba(255, 255, 255, 0.2)
    static let glassTabHover = Color.white.opacity(0.2)

    /// Header glass: rgba(255, 255, 255, 0.15) + blur(15px)
    static let glassHeader = Color.white.opacity(0.15)

    /// Content glass: rgba(255, 255, 255, 0.05) + blur(5px)
    static let glassContent = Color.white.opacity(0.05)

    /// Dark glass (login): rgba(0, 0, 0, 0.85) + blur(15px)
    static let glassDark = Color.black.opacity(0.85)

    /// Button glass: rgba(255, 255, 255, 0.2) + blur(10px)
    static let glassButton = Color.white.opacity(0.2)

    /// Glass borders
    static let glassBorder = Color.white.opacity(0.18)
    static let glassBorderLight = Color.white.opacity(0.2)
    static let glassBorderHover = Color.white.opacity(0.4)
    static let glassBorderStrong = Color.white.opacity(0.3)

    /// Glass shadow color: rgba(31, 38, 135, 0.37)
    static let glassShadow = Color(red: 31/255, green: 38/255, blue: 135/255).opacity(0.37)

    /// Active tab: rgba(59, 130, 246, 0.3) - blue with transparency
    static let glassActiveBlue = Color(hex: "3b82f6").opacity(0.3)
    static let glassActiveBlueBorder = Color(hex: "3b82f6").opacity(0.5)
    static let glassActiveBlueHover = Color(hex: "3b82f6").opacity(0.4)

    /// Shimmer gradient color
    static let shimmerWhite = Color.white.opacity(0.2)
    static let shimmerWhiteStrong = Color.white.opacity(0.3)

    /// Input field glass: rgba(255, 255, 255, 0.08)
    static let glassInput = Color.white.opacity(0.08)
    static let glassInputBorder = Color.white.opacity(0.15)
}

// MARK: - Color Extension for Hex
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3:
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - UIColor Extension for Hex (for UIKit interop)
#if canImport(UIKit)
import UIKit

extension UIColor {
    convenience init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3:
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            red: CGFloat(r) / 255,
            green: CGFloat(g) / 255,
            blue: CGFloat(b) / 255,
            alpha: CGFloat(a) / 255
        )
    }
}
#endif
