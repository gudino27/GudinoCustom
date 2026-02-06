//
//  GlassTextField.swift
//  GCWadmin
//
//  Glass-styled text input field matching webapp design
//  Input background: rgba(255, 255, 255, 0.08)
//  Border: 1px solid rgba(255, 255, 255, 0.15)
//

import SwiftUI
import Combine

// MARK: - Glass Text Field
struct GlassTextField: View {
    let placeholder: String
    @Binding var text: String
    let icon: String?
    let iconColor: Color

    @FocusState private var isFocused: Bool

    init(
        _ placeholder: String,
        text: Binding<String>,
        icon: String? = nil,
        iconColor: Color = AppColors.textLight
    ) {
        self.placeholder = placeholder
        self._text = text
        self.icon = icon
        self.iconColor = iconColor
    }

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            if let icon = icon {
                Image(systemName: icon)
                    .font(.system(size: 20))
                    .foregroundColor(iconColor)
                    .frame(width: 24)
            }

            TextField(placeholder, text: $text)
                .font(AppTypography.body())
                .foregroundColor(.white)
                .focused($isFocused)
                .autocapitalization(.none)
                .disableAutocorrection(true)
        }
        .padding(AppSpacing.md)
        .background(AppColors.glassInput)
        .cornerRadius(AppRadius.lg)
        .overlay(
            RoundedRectangle(cornerRadius: AppRadius.lg)
                .stroke(
                    isFocused
                        ? Color.white.opacity(0.4)
                        : AppColors.glassInputBorder,
                    lineWidth: 1
                )
        )
        .animation(.easeInOut(duration: 0.2), value: isFocused)
    }
}

// MARK: - Glass Secure Field (Password)
struct GlassSecureField: View {
    let placeholder: String
    @Binding var text: String
    let icon: String?
    let iconColor: Color

    @State private var isSecure = true
    @FocusState private var isFocused: Bool

    init(
        _ placeholder: String,
        text: Binding<String>,
        icon: String? = "lock.fill",
        iconColor: Color = AppColors.textLight
    ) {
        self.placeholder = placeholder
        self._text = text
        self.icon = icon
        self.iconColor = iconColor
    }

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            if let icon = icon {
                Image(systemName: icon)
                    .font(.system(size: 20))
                    .foregroundColor(iconColor)
                    .frame(width: 24)
            }

            Group {
                if isSecure {
                    SecureField(placeholder, text: $text)
                } else {
                    TextField(placeholder, text: $text)
                }
            }
            .font(AppTypography.body())
            .foregroundColor(.white)
            .focused($isFocused)
            .autocapitalization(.none)
            .disableAutocorrection(true)

            // Eye toggle button
            Button(action: {
                isSecure.toggle()
            }) {
                Image(systemName: isSecure ? "eye.slash.fill" : "eye.fill")
                    .font(.system(size: 20))
                    .foregroundColor(AppColors.textLight)
            }
            .buttonStyle(.plain)
        }
        .padding(AppSpacing.md)
        .background(AppColors.glassInput)
        .cornerRadius(AppRadius.lg)
        .overlay(
            RoundedRectangle(cornerRadius: AppRadius.lg)
                .stroke(
                    isFocused
                        ? Color.white.opacity(0.4)
                        : AppColors.glassInputBorder,
                    lineWidth: 1
                )
        )
        .animation(.easeInOut(duration: 0.2), value: isFocused)
    }
}

// MARK: - Form Field with Label
struct LabeledGlassTextField: View {
    let label: String
    let placeholder: String
    @Binding var text: String
    let icon: String?
    let iconColor: Color
    let isRequired: Bool

    init(
        label: String,
        placeholder: String,
        text: Binding<String>,
        icon: String? = nil,
        iconColor: Color = AppColors.textLight,
        isRequired: Bool = false
    ) {
        self.label = label
        self.placeholder = placeholder
        self._text = text
        self.icon = icon
        self.iconColor = iconColor
        self.isRequired = isRequired
    }

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            HStack(spacing: AppSpacing.xs) {
                if let icon = icon {
                    Image(systemName: icon)
                        .font(.system(size: 14))
                        .foregroundColor(iconColor)
                }

                Text(label)
                    .font(AppTypography.captionBold())
                    .foregroundColor(Color.gray.opacity(0.8))

                if isRequired {
                    Text("*")
                        .foregroundColor(AppColors.errorMedium)
                }
            }

            GlassTextField(placeholder, text: $text, icon: nil)
        }
    }
}

// MARK: - Labeled Secure Field
struct LabeledGlassSecureField: View {
    let label: String
    let placeholder: String
    @Binding var text: String
    let icon: String?
    let iconColor: Color
    let isRequired: Bool

    init(
        label: String,
        placeholder: String,
        text: Binding<String>,
        icon: String? = "lock.fill",
        iconColor: Color = AppColors.textLight,
        isRequired: Bool = false
    ) {
        self.label = label
        self.placeholder = placeholder
        self._text = text
        self.icon = icon
        self.iconColor = iconColor
        self.isRequired = isRequired
    }

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            HStack(spacing: AppSpacing.xs) {
                if let icon = icon {
                    Image(systemName: icon)
                        .font(.system(size: 14))
                        .foregroundColor(iconColor)
                }

                Text(label)
                    .font(AppTypography.captionBold())
                    .foregroundColor(Color.gray.opacity(0.8))

                if isRequired {
                    Text("*")
                        .foregroundColor(AppColors.errorMedium)
                }
            }

            GlassSecureField(placeholder, text: $text, icon: nil)
        }
    }
}

// MARK: - Previews
#Preview("Glass Text Fields") {
    struct TextFieldDemo: View {
        @State private var username = ""
        @State private var password = ""
        @State private var email = ""

        var body: some View {
            ZStack {
                AppColors.primary
                    .ignoresSafeArea()

                VStack(spacing: AppSpacing.xl) {
                    // Basic glass text field
                    GlassTextField("Username", text: $username, icon: "person.fill", iconColor: AppColors.blue)

                    // Secure field
                    GlassSecureField("Password", text: $password, icon: "lock.fill", iconColor: AppColors.accent)

                    // Labeled fields
                    LabeledGlassTextField(
                        label: "Email Address",
                        placeholder: "Enter your email",
                        text: $email,
                        icon: "envelope.fill",
                        iconColor: AppColors.blue,
                        isRequired: true
                    )

                    LabeledGlassSecureField(
                        label: "Password",
                        placeholder: "Enter password",
                        text: $password,
                        icon: "lock.fill",
                        iconColor: AppColors.accent,
                        isRequired: true
                    )
                }
                .padding(AppSpacing.xl)
            }
        }
    }

    return TextFieldDemo()
}
