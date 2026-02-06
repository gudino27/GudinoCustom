//
//  LoginView.swift
//  GCWadmin
//
//  Login screen matching webapp design exactly
//  - Gray background (#6e6e6e)
//  - Dark glass card: rgba(0, 0, 0, 0.85) + blur(15px)
//  - Glass-styled inputs
//  - Shimmer effect on button
//

import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authManager: AuthManager
    @EnvironmentObject var languageManager: LanguageManager

    @State private var username = ""
    @State private var password = ""
    @State private var showLanguageSheet = false
    @State private var triggerShimmer = false

    var body: some View {
        ZStack {
            // Background - matching admin gray #6e6e6e
            AppColors.primary
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: AppSpacing.xxxl) {
                    Spacer()
                        .frame(height: AppSpacing.xxxxl)

                    // Logo
                    logoSection

                    // Login Card
                    loginCard

                    Spacer()
                        .frame(height: AppSpacing.xxxxl)
                }
                .padding(.horizontal, AppSpacing.xl)
            }
        }
        .sheet(isPresented: $showLanguageSheet) {
            languageSheet
        }
        .alert("Enable \(authManager.biometricType.displayName)?",
               isPresented: $authManager.showBiometricPrompt) {
            Button("Enable") {
                authManager.enableBiometric(username: username, password: password)
            }
            Button("Not Now", role: .cancel) { }
        } message: {
            Text("Use \(authManager.biometricType.displayName) to sign in quickly next time.")
        }
        .task {
            // Auto-trigger biometric if available on appear
            if authManager.canUseBiometric && !authManager.isAuthenticated {
                await authManager.authenticateWithBiometric()
            }
        }
    }

    // MARK: - Logo Section
    private var logoSection: some View {
        VStack(spacing: AppSpacing.base) {
            // Logo - circular image container
            Image("logo")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: 120, height: 120)
                .clipShape(Circle())
                .overlay(
                    Circle()
                        .stroke(Color.white.opacity(0.2), lineWidth: 2)
                )
                .shadow(color: Color.black.opacity(0.3), radius: 8, x: 0, y: 4)
        }
    }

    // MARK: - Login Card
    private var loginCard: some View {
        VStack(spacing: AppSpacing.xl) {
            // Header
            headerSection

            // Error message
            if let error = authManager.error {
                errorBanner(message: error.localizedDescription)
            }

            // Form fields
            formSection

            // Login button
            loginButton

            // Biometric button
            if authManager.canUseBiometric {
                biometricButton
            }

            // Language selector
            languageSelector
        }
        .padding(AppSpacing.xxxl)
        .background(AppColors.glassDark) // rgba(0, 0, 0, 0.85)
        .background(.ultraThinMaterial)
        .cornerRadius(AppRadius.xxl)
        .overlay(
            RoundedRectangle(cornerRadius: AppRadius.xxl)
                .stroke(Color.white.opacity(0.15), lineWidth: 1)
        )
        .shadow(
            color: Color.black.opacity(0.5),
            radius: 10,
            x: 0,
            y: 4
        )
    }

    // MARK: - Header Section
    private var headerSection: some View {
        VStack(spacing: AppSpacing.md) {
            // Icon in colored circle
            ZStack {
                Circle()
                    .fill(AppColors.blue.opacity(0.2))
                    .frame(width: 72, height: 72)

                Image(systemName: "lock.shield.fill")
                    .font(.system(size: 36))
                    .foregroundColor(AppColors.blue)
            }
            .overlay(
                Circle()
                    .stroke(AppColors.blue.opacity(0.3), lineWidth: 1)
            )

            // Title
            Text(languageManager.t("admin_login"))
                .font(AppTypography.title2())
                .foregroundColor(.white)

            // Subtitle
            Text("Sign in to access admin features")
                .font(AppTypography.caption())
                .foregroundColor(AppColors.gray400)
        }
    }

    // MARK: - Error Banner
    private func errorBanner(message: String) -> some View {
        HStack(spacing: AppSpacing.sm) {
            Image(systemName: "exclamationmark.circle.fill")
                .foregroundColor(AppColors.errorMedium)

            Text(message)
                .font(AppTypography.caption())
                .foregroundColor(AppColors.errorMedium)
        }
        .padding(AppSpacing.md)
        .frame(maxWidth: .infinity)
        .background(AppColors.errorMedium.opacity(0.2))
        .cornerRadius(AppRadius.lg)
        .overlay(
            RoundedRectangle(cornerRadius: AppRadius.lg)
                .stroke(AppColors.errorMedium.opacity(0.3), lineWidth: 1)
        )
    }

    // MARK: - Form Section
    private var formSection: some View {
        VStack(spacing: AppSpacing.lg) {
            // Username field
            LabeledGlassTextField(
                label: languageManager.t("username"),
                placeholder: "Enter username",
                text: $username,
                icon: "person.fill",
                iconColor: AppColors.blue,
                isRequired: true
            )

            // Password field
            LabeledGlassSecureField(
                label: languageManager.t("password"),
                placeholder: "Enter password",
                text: $password,
                icon: "lock.fill",
                iconColor: AppColors.accent,
                isRequired: true
            )
        }
    }

    // MARK: - Login Button
    private var loginButton: some View {
        Button(action: {
            triggerShimmer = true
            Task {
                await authManager.login(username: username, password: password)
                triggerShimmer = false
            }
        }) {
            HStack(spacing: AppSpacing.sm) {
                if authManager.isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        .scaleEffect(0.8)
                }

                Text(authManager.isLoading
                     ? languageManager.t("signing_in")
                     : languageManager.t("sign_in"))
                    .font(AppTypography.bodyBold())
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, AppSpacing.md)
            .background(AppColors.glassButton)
            .background(.thinMaterial)
            .cornerRadius(AppRadius.lg)
            .overlay(
                RoundedRectangle(cornerRadius: AppRadius.lg)
                    .stroke(Color.white.opacity(0.35), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .disabled(username.isEmpty || password.isEmpty || authManager.isLoading)
        .opacity((username.isEmpty || password.isEmpty) ? 0.6 : 1.0)
        .shimmer(trigger: triggerShimmer, color: .white.opacity(0.3))
    }

    // MARK: - Biometric Button
    private var biometricButton: some View {
        Button(action: {
            Task {
                await authManager.authenticateWithBiometric()
            }
        }) {
            HStack(spacing: AppSpacing.sm) {
                Image(systemName: authManager.biometricType.iconName)
                    .font(.system(size: 20))
                Text("Sign in with \(authManager.biometricType.displayName)")
                    .font(AppTypography.body())
            }
            .foregroundColor(.white.opacity(0.9))
            .frame(maxWidth: .infinity)
            .padding(.vertical, AppSpacing.md)
            .background(Color.white.opacity(0.1))
            .cornerRadius(AppRadius.lg)
            .overlay(
                RoundedRectangle(cornerRadius: AppRadius.lg)
                    .stroke(Color.white.opacity(0.2), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .disabled(authManager.isLoading)
    }

    // MARK: - Language Selector
    private var languageSelector: some View {
        Button(action: {
            showLanguageSheet = true
        }) {
            HStack(spacing: AppSpacing.sm) {
                Image(systemName: "globe")
                    .font(.system(size: 16))

                Text(languageManager.currentLanguage.displayName)
                    .font(AppTypography.caption())

                Image(systemName: "chevron.down")
                    .font(.system(size: 12))
            }
            .foregroundColor(.white.opacity(0.8))
            .padding(.horizontal, AppSpacing.base)
            .padding(.vertical, AppSpacing.sm)
            .background(Color.white.opacity(0.1))
            .cornerRadius(AppRadius.full)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Language Sheet
    private var languageSheet: some View {
        NavigationView {
            List(Language.allCases, id: \.self) { language in
                Button(action: {
                    languageManager.setLanguage(language)
                    showLanguageSheet = false
                }) {
                    HStack {
                        Text(language.flag)
                            .font(.title2)

                        Text(language.displayName)
                            .font(AppTypography.body())

                        Spacer()

                        if language == languageManager.currentLanguage {
                            Image(systemName: "checkmark")
                                .foregroundColor(AppColors.blue)
                        }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
            .navigationTitle("Select Language")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        showLanguageSheet = false
                    }
                }
            }
        }
        .presentationDetents([.medium])
    }
}

// MARK: - Preview
#Preview {
    LoginView()
        .environmentObject(AuthManager())
        .environmentObject(LanguageManager())
}
