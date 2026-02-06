//
//  Typography.swift
//  GCWadmin
//
//  Typography system using Inter font family
//

import SwiftUI

// MARK: - App Typography
struct AppTypography {
    // === Font Family ===
    static let fontFamily = "Inter"

    // === Font Sizes (matching React Native typography.js) ===
    static let xs: CGFloat = 12
    static let sm: CGFloat = 14
    static let base: CGFloat = 16
    static let lg: CGFloat = 18
    static let xl: CGFloat = 20
    static let xxl: CGFloat = 24
    static let xxxl: CGFloat = 30
    static let xxxxl: CGFloat = 36
    static let xxxxxl: CGFloat = 48

    // === Font Weights ===
    enum Weight: String {
        case light = "Light"
        case regular = "Regular"
        case medium = "Medium"
        case semibold = "SemiBold"
        case bold = "Bold"
        case extrabold = "ExtraBold"

        var fontName: String {
            "Inter-\(rawValue)"
        }

        var swiftUIWeight: Font.Weight {
            switch self {
            case .light: return .light
            case .regular: return .regular
            case .medium: return .medium
            case .semibold: return .semibold
            case .bold: return .bold
            case .extrabold: return .heavy
            }
        }
    }

    // === Pre-defined Text Styles ===

    /// Large title - 30pt Bold
    static func title1() -> Font {
        customFont(size: xxxl, weight: .bold)
    }

    /// Medium title - 24pt Bold
    static func title2() -> Font {
        customFont(size: xxl, weight: .bold)
    }

    /// Small title - 20pt SemiBold
    static func title3() -> Font {
        customFont(size: xl, weight: .semibold)
    }

    /// Headline - 18pt SemiBold
    static func headline() -> Font {
        customFont(size: lg, weight: .semibold)
    }

    /// Body - 16pt Regular
    static func body() -> Font {
        customFont(size: base, weight: .regular)
    }

    /// Body Bold - 16pt SemiBold
    static func bodyBold() -> Font {
        customFont(size: base, weight: .semibold)
    }

    /// Callout - 16pt Medium
    static func callout() -> Font {
        customFont(size: base, weight: .medium)
    }

    /// Caption - 14pt Regular
    static func caption() -> Font {
        customFont(size: sm, weight: .regular)
    }

    /// Caption Bold - 14pt SemiBold
    static func captionBold() -> Font {
        customFont(size: sm, weight: .semibold)
    }

    /// Small - 12pt Regular
    static func small() -> Font {
        customFont(size: xs, weight: .regular)
    }

    /// Small Bold - 12pt SemiBold
    static func smallBold() -> Font {
        customFont(size: xs, weight: .semibold)
    }

    // === Custom Font Helper ===
    static func customFont(size: CGFloat, weight: Weight) -> Font {
        // Try custom font first, fall back to system font
        if let _ = UIFont(name: weight.fontName, size: size) {
            return Font.custom(weight.fontName, size: size)
        }
        return Font.system(size: size, weight: weight.swiftUIWeight)
    }
}

// MARK: - View Modifier for Custom Font
struct CustomFontModifier: ViewModifier {
    let size: CGFloat
    let weight: AppTypography.Weight

    func body(content: Content) -> some View {
        content.font(AppTypography.customFont(size: size, weight: weight))
    }
}

extension View {
    /// Apply custom Inter font with specified size and weight
    func customFont(_ size: CGFloat, weight: AppTypography.Weight = .regular) -> some View {
        modifier(CustomFontModifier(size: size, weight: weight))
    }

    /// Apply predefined text style
    func textStyle(_ style: @escaping () -> Font) -> some View {
        font(style())
    }
}

// MARK: - Font Registration Helper
struct FontRegistration {
    /// Register custom Inter fonts (call in App init if needed)
    static func registerFonts() {
        let fontNames = [
            "Inter-Light",
            "Inter-Regular",
            "Inter-Medium",
            "Inter-SemiBold",
            "Inter-Bold",
            "Inter-ExtraBold"
        ]

        for fontName in fontNames {
            if let fontURL = Bundle.main.url(forResource: fontName, withExtension: "ttf") {
                var error: Unmanaged<CFError>?
                CTFontManagerRegisterFontsForURL(fontURL as CFURL, .process, &error)
                if let error = error {
                    print("Error registering font \(fontName): \(error.takeUnretainedValue())")
                }
            }
        }
    }
}
