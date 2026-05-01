//
//  DashboardView.swift
//  GCWadmin
//
//  Main admin dashboard with section navigation
//  Matches webapp AdminPanel.js layout
//

import SwiftUI

// MARK: - Dashboard Section
struct DashboardSection: Identifiable {
    let id: String
    let title: String
    let titleKey: String
    let icon: String
    let requiredRole: UserRole

    var isAvailableTo: (UserRole) -> Bool {
        return { userRole in
            switch requiredRole {
            case .employee:
                return true
            case .admin:
                return userRole == .admin || userRole == .superAdmin
            case .superAdmin:
                return userRole == .superAdmin
            }
        }
    }
}

// MARK: - All Dashboard Sections
let dashboardSections: [DashboardSection] = [
    DashboardSection(id: "prices", title: "Prices", titleKey: "prices", icon: "dollarsign.circle", requiredRole: .admin),
    DashboardSection(id: "photos", title: "Photos", titleKey: "photos", icon: "photo", requiredRole: .admin),
    DashboardSection(id: "employees", title: "Employees", titleKey: "employees", icon: "person.badge.shield.checkmark", requiredRole: .admin),
    DashboardSection(id: "timeclock", title: "Time Clock", titleKey: "timeclock", icon: "clock", requiredRole: .employee),
    DashboardSection(id: "designs", title: "Designs", titleKey: "designs", icon: "doc.text", requiredRole: .admin),
    DashboardSection(id: "invoices", title: "Invoices", titleKey: "invoices", icon: "doc.plaintext", requiredRole: .admin),
    DashboardSection(id: "testimonials", title: "Testimonials", titleKey: "testimonials", icon: "quote.bubble", requiredRole: .admin),
    DashboardSection(id: "instagram", title: "Instagram", titleKey: "instagram", icon: "camera", requiredRole: .admin),
    DashboardSection(id: "timelines", title: "Timelines", titleKey: "timelines", icon: "calendar", requiredRole: .admin),
    DashboardSection(id: "appointments", title: "Appointments", titleKey: "appointments", icon: "calendar.badge.clock", requiredRole: .admin),
    DashboardSection(id: "showroom", title: "Showroom", titleKey: "showroom", icon: "eye", requiredRole: .admin),
    DashboardSection(id: "users", title: "Users", titleKey: "users", icon: "person.2", requiredRole: .superAdmin),
    DashboardSection(id: "analytics", title: "Analytics", titleKey: "analytics", icon: "chart.bar", requiredRole: .superAdmin),
    DashboardSection(id: "sms", title: "SMS Routing", titleKey: "sms_routing", icon: "message", requiredRole: .superAdmin),
    DashboardSection(id: "security", title: "Security", titleKey: "security", icon: "shield", requiredRole: .superAdmin),
]

// MARK: - Dashboard View
struct DashboardView: View {
    @EnvironmentObject var authManager: AuthManager
    @EnvironmentObject var languageManager: LanguageManager

    @State private var activeSection: String = "prices"

    var body: some View {
        ZStack {
            // Background
            AppColors.background
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Header
                headerView

                // Section Navigation
                sectionNavigation

                // Content Area
                contentArea
            }
        }
        .onAppear {
            // Set default section to first available section for user's role
            if let firstSection = availableSections.first {
                activeSection = firstSection.id
                print("✅ Dashboard loaded - Available sections: \(availableSections.map { $0.id })")
                print("✅ Active section: \(activeSection)")
                if let userRole = authManager.currentUser?.role {
                    print("✅ User role: \(userRole.rawValue)")
                }
            }
        }
    }

    // MARK: - Available Sections
    private var availableSections: [DashboardSection] {
        guard let userRole = authManager.currentUser?.role else {
            return []
        }
        return dashboardSections.filter { $0.isAvailableTo(userRole) }
    }

    // MARK: - Header View
    private var headerView: some View {
        HStack {
            // Title
            VStack(alignment: .leading, spacing: AppSpacing.xs) {
                Text(languageManager.t("admin_panel"))
                    .font(AppTypography.headline())
                    .foregroundColor(AppColors.text)

                if let user = authManager.currentUser {
                    Text("\(languageManager.t("welcome")), \(user.displayName)")
                        .font(AppTypography.caption())
                        .foregroundColor(AppColors.textGray)
                }
            }

            Spacer()

            // User info and logout
            HStack(spacing: AppSpacing.md) {
                // Role badge
                if let role = authManager.currentUser?.role {
                    Text(role.displayName)
                        .font(AppTypography.small())
                        .foregroundColor(.white)
                        .padding(.horizontal, AppSpacing.sm)
                        .padding(.vertical, AppSpacing.xs)
                        .background(
                            role == .superAdmin ? AppColors.accent :
                            role == .admin ? AppColors.blue :
                            AppColors.success
                        )
                        .cornerRadius(AppRadius.full)
                }

                // Logout button
                IconButton(
                    icon: "rectangle.portrait.and.arrow.right",
                    size: 18,
                    color: .white,
                    backgroundColor: AppColors.error
                ) {
                    authManager.logout()
                }
            }
        }
        .padding(.horizontal, AppSpacing.lg)
        .padding(.vertical, AppSpacing.md)
        .background(Color.white)
        .shadow(color: Color.black.opacity(0.05), radius: 2, x: 0, y: 1)
    }

    // MARK: - Section Navigation
    // Note: .navGlass removed — it was blurring scrolling content underneath,
    // picking up colours from child views and making tabs shift appearance.
    private var sectionNavigation: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: AppSpacing.sm) {
                ForEach(availableSections) { section in
                    TabButton(
                        title: languageManager.t(section.titleKey),
                        icon: section.icon,
                        isActive: activeSection == section.id
                    ) {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            activeSection = section.id
                        }
                    }
                }
            }
            .padding(.horizontal, AppSpacing.lg)
            .padding(.vertical, AppSpacing.sm)
        }
        .frame(height: 60)
        .background(AppColors.primary)
    }

    // MARK: - Content Area
    private var contentArea: some View {
        // No ScrollView wrapper - let sections control their own scrolling
        sectionContent
    }

    // MARK: - Section Content
    @ViewBuilder
    private var sectionContent: some View {
        switch activeSection {
        case "prices":
            NavigationStack {
                PriceManagementView()
            }
        case "photos":
            NavigationStack {
                PhotoManagementView()
            }
        case "employees":
            NavigationStack {
                EmployeeManagementView()
            }
        case "timeclock":
            TimeClockView()
        case "designs":
            NavigationStack {
                DesignManagementView()
            }
        case "invoices":
            NavigationStack {
                InvoiceManagementView()
            }
        case "testimonials":
            NavigationStack {
                TestimonialManagementView()
            }
        case "instagram":
            NavigationStack {
                InstagramManagerView()
            }
        case "timelines":
            NavigationStack {
                TimelinesManagerView()
            }
        case "appointments":
            NavigationStack {
                AppointmentsView()
            }
        case "showroom":
            NavigationStack {
                ShowroomManagerView()
            }
        case "users":
            NavigationStack {
                UserManagementView()
            }
        case "analytics":
            NavigationStack {
                AnalyticsDashboardView()
            }
        case "sms":
            NavigationStack {
                SmsRoutingView()
            }
        case "security":
            NavigationStack {
                SecurityMonitorView()
            }
        default:
            placeholderScrollView {
                placeholderSection(title: "Select a Section", icon: "square.grid.2x2")
            }
        }
    }

    // MARK: - Placeholder ScrollView Wrapper
    private func placeholderScrollView<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        ScrollView {
            VStack(spacing: AppSpacing.xl) {
                content()
            }
            .padding(AppSpacing.lg)
        }
    }

    // MARK: - Placeholder Section
    private func placeholderSection(title: String, icon: String) -> some View {
        VStack(spacing: AppSpacing.xl) {
            // Section header
            HStack {
                Image(systemName: icon)
                    .font(.system(size: 24))
                    .foregroundColor(AppColors.blue)

                Text(title)
                    .font(AppTypography.title3())
                    .foregroundColor(AppColors.text)

                Spacer()
            }

            // Placeholder card
            GlassCard(intensity: .light, style: .light) {
                VStack(spacing: AppSpacing.lg) {
                    Image(systemName: icon)
                        .font(.system(size: 48))
                        .foregroundColor(AppColors.textLight)

                    Text("Coming Soon")
                        .font(AppTypography.headline())
                        .foregroundColor(AppColors.textMedium)

                    Text("This section is under development")
                        .font(AppTypography.caption())
                        .foregroundColor(AppColors.textGray)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, AppSpacing.xxxxl)
            }
        }
    }
}

// MARK: - Preview
#Preview {
    let authManager = AuthManager()

    return DashboardView()
        .environmentObject(authManager)
        .environmentObject(LanguageManager())
        .onAppear {
            // Note: In real app, this would come from login
        }
}
